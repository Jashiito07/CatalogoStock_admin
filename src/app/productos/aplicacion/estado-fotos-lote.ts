import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import {
  emparejarFotos,
  FotoLote,
  FotoRevisada,
  PAUSA_ENTRE_SUBIDAS_MS,
  ProductoParaFotos,
  resumenLote,
  revisarLote,
} from '../dominio/fotos-lote';
import { mensajeDeErrorDeProducto } from './mensajes-productos';
import { ApiProductos } from './puertos';

/** Espera `ms` milisegundos. Se inyecta para que las pruebas no esperen de verdad. */
export type Espera = (ms: number) => Promise<void>;

export const ESPERA = new InjectionToken<Espera>('ESPERA', {
  providedIn: 'root',
  factory: () => (ms: number) => new Promise<void>((resolver) => setTimeout(resolver, ms)),
});

/** Tras un 429 del servidor se espera esto antes de reintentar (la ventana es de 60 s). */
export const ESPERA_TRAS_LIMITE_MS = 20_000;
export const REINTENTOS_TRAS_LIMITE = 3;
/** Tamaño de página para traer todos los productos (máximo del contrato). */
export const TAMANIO_PAGINA_LOTE = 100;

export type EstadoSubidaFoto = 'PENDIENTE' | 'SUBIENDO' | 'SUBIDA' | 'FALLIDA';

export interface ProgresoFoto {
  readonly estado: EstadoSubidaFoto;
  readonly mensaje?: string;
}

/**
 * Subida de fotos en lote del panel (RF-PRO-01, D-46, D-62; DEC-07). El panel siempre está en
 * línea (D-02). Trae todos los productos para emparejar por código, guarda lo que el Vendedor
 * corrige (producto elegido a mano, fotos quitadas) y sube de una en una a 30 por minuto con los
 * endpoints existentes. Un fallo no detiene el lote: queda marcado para reintentarlo.
 */
@Injectable()
export class EstadoFotosLote {
  private readonly api = inject(ApiProductos);
  private readonly esperar = inject(ESPERA);

  private archivos: File[] = [];
  private readonly productosAsignados = new Map<number, string | null>();
  private readonly excluidas = new Set<number>();
  private detenerPedido = false;

  private readonly _productos = signal<readonly ProductoParaFotos[]>([]);
  private readonly _cargando = signal(false);
  private readonly _errorCarga = signal<string | null>(null);
  private readonly _fotos = signal<readonly FotoLote[]>([]);
  private readonly _progreso = signal<ReadonlyMap<number, ProgresoFoto>>(new Map());
  private readonly _subiendo = signal(false);

  readonly productos = this._productos.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  readonly errorCarga = this._errorCarga.asReadonly();
  readonly subiendo = this._subiendo.asReadonly();
  readonly progreso = this._progreso.asReadonly();

  /** Fotos con sus avisos actuales y si están listas para subir. */
  readonly revisadas = computed<readonly FotoRevisada[]>(() =>
    revisarLote(this._fotos(), this._productos()),
  );
  readonly resumen = computed(() => resumenLote(this.revisadas()));
  /** Ya se intentó subir el lote (hay fotos subidas o con error). */
  readonly iniciado = computed(() => this._progreso().size > 0);
  readonly subidas = computed(() => this.contar('SUBIDA'));
  readonly fallidas = computed(() => this.contar('FALLIDA'));
  /** Fotos del lote en curso (las que estaban listas al empezar). */
  readonly totalLote = computed(() => this._progreso().size);

  /** Trae **todos** los productos del Vendedor (varias páginas de 100). */
  async cargarProductos(): Promise<void> {
    this._cargando.set(true);
    this._errorCarga.set(null);
    try {
      const productos: ProductoParaFotos[] = [];
      for (let pagina = 1; ; pagina++) {
        const resultado = await this.api.listar({ pagina, tamanio: TAMANIO_PAGINA_LOTE });
        productos.push(
          ...resultado.elementos.map((p) => ({
            id: p.id,
            nombre: p.nombre,
            codigo: p.codigo ?? null,
            fotosActuales: p.imagenes.length,
          })),
        );
        if (resultado.elementos.length === 0 || productos.length >= resultado.total) {
          break;
        }
      }
      this._productos.set(productos);
      this.reemparejar();
    } catch (error) {
      this._errorCarga.set(mensajeDeErrorDeProducto(error));
    } finally {
      this._cargando.set(false);
    }
  }

  /** Agrega fotos al lote (se pueden elegir en varias tandas). */
  agregar(archivos: readonly File[]): void {
    if (this._subiendo() || this.iniciado()) {
      return;
    }
    this.archivos = [...this.archivos, ...archivos];
    this.reemparejar();
  }

  archivo(clave: number): File | undefined {
    return this.archivos[clave];
  }

  /** El Vendedor elige a mano el producto de una foto (o lo quita con `null`). */
  asignarProducto(clave: number, productoId: string | null): void {
    this.productosAsignados.set(clave, productoId);
    this.reemparejar();
  }

  /** Quita la foto del lote o la vuelve a incluir. */
  alternarExclusion(clave: number): void {
    if (this.excluidas.has(clave)) {
      this.excluidas.delete(clave);
    } else {
      this.excluidas.add(clave);
    }
    this.reemparejar();
  }

  /** Empieza un lote nuevo y vuelve a traer los productos (con sus fotos actualizadas). */
  async nuevoLote(): Promise<void> {
    this.archivos = [];
    this.productosAsignados.clear();
    this.excluidas.clear();
    this._fotos.set([]);
    this._progreso.set(new Map());
    await this.cargarProductos();
  }

  /** Detiene el lote después de la foto en curso; las restantes quedan pendientes. */
  detener(): void {
    this.detenerPedido = true;
  }

  /**
   * Sube las fotos listas, en orden, a 30 por minuto (DEC-07). Devuelve cuántas se subieron en
   * esta pasada. Las fallidas quedan marcadas con su mensaje.
   */
  async subir(): Promise<number> {
    if (this._subiendo()) {
      return 0;
    }
    const pendientes = this.iniciado()
      ? this.revisadas().filter((f) => this._progreso().get(f.clave)?.estado === 'PENDIENTE')
      : this.revisadas().filter((f) => f.lista);
    if (!this.iniciado()) {
      this._progreso.set(new Map(pendientes.map((f) => [f.clave, { estado: 'PENDIENTE' }])));
    }
    return this.subirFotos(pendientes);
  }

  /** Vuelve a intentar las fotos que fallaron. */
  async reintentarFallidas(): Promise<number> {
    if (this._subiendo()) {
      return 0;
    }
    const fallidas = this.revisadas().filter(
      (f) => this._progreso().get(f.clave)?.estado === 'FALLIDA',
    );
    for (const foto of fallidas) {
      this.marcar(foto.clave, { estado: 'PENDIENTE' });
    }
    return this.subirFotos(fallidas);
  }

  private async subirFotos(fotos: readonly FotoRevisada[]): Promise<number> {
    this._subiendo.set(true);
    this.detenerPedido = false;
    let subidas = 0;
    try {
      for (const [indice, foto] of fotos.entries()) {
        if (this.detenerPedido) {
          break;
        }
        if (indice > 0) {
          await this.esperar(PAUSA_ENTRE_SUBIDAS_MS);
        }
        if (await this.subirUna(foto)) {
          subidas++;
        }
      }
    } finally {
      this._subiendo.set(false);
    }
    return subidas;
  }

  private async subirUna(foto: FotoRevisada): Promise<boolean> {
    const archivo = this.archivos[foto.clave];
    if (archivo === undefined || foto.productoId === null) {
      this.marcar(foto.clave, { estado: 'FALLIDA', mensaje: 'Falta el archivo o el producto.' });
      return false;
    }
    this.marcar(foto.clave, { estado: 'SUBIENDO' });
    for (let intento = 0; ; intento++) {
      try {
        await this.api.subirImagen(foto.productoId, archivo);
        this.marcar(foto.clave, { estado: 'SUBIDA' });
        return true;
      } catch (error) {
        const limite = error instanceof ErrorApi && error.estado === 429;
        if (limite && intento < REINTENTOS_TRAS_LIMITE) {
          await this.esperar(ESPERA_TRAS_LIMITE_MS);
          continue;
        }
        this.marcar(foto.clave, { estado: 'FALLIDA', mensaje: mensajeDeErrorDeProducto(error) });
        return false;
      }
    }
  }

  private marcar(clave: number, progreso: ProgresoFoto): void {
    this._progreso.update((actual) => new Map(actual).set(clave, progreso));
  }

  private contar(estado: EstadoSubidaFoto): number {
    return [...this._progreso().values()].filter((p) => p.estado === estado).length;
  }

  /** Empareja de nuevo todas las fotos y vuelve a aplicar lo que corrigió el Vendedor. */
  private reemparejar(): void {
    const fotos = emparejarFotos(this.archivos, this._productos()).map((foto) => ({
      ...foto,
      productoId: this.productosAsignados.has(foto.clave)
        ? (this.productosAsignados.get(foto.clave) ?? null)
        : foto.productoId,
      excluida: this.excluidas.has(foto.clave),
    }));
    this._fotos.set(fotos);
  }
}
