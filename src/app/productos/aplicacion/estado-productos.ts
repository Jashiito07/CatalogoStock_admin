import { computed, inject, Injectable, signal } from '@angular/core';

import {
  CambiosProducto,
  ConsultaProductos,
  Disponibilidad,
  ImagenProducto,
  NuevoProducto,
  Producto,
  TAMANIO_PAGINA_PREDETERMINADO,
} from '../dominio/producto';
import { mensajeDeErrorDeProducto } from './mensajes-productos';
import { ApiProductos } from './puertos';

/** Filtros que elige el Vendedor; vacío o `undefined` = sin filtro. */
export interface FiltrosProductos {
  readonly marcaId?: string;
  readonly busqueda?: string;
  readonly disponibilidad?: Disponibilidad;
}

/**
 * Listado de productos del panel (RF-PRO-01, RF-INV-03). El panel siempre está en línea (D-02):
 * la API es la fuente de verdad, pagina, busca y filtra; aquí solo se guarda lo que muestra la
 * tabla. Las respuestas atrasadas se descartan para no mostrar un listado de filtros anteriores.
 */
@Injectable()
export class EstadoProductos {
  private readonly api = inject(ApiProductos);

  private readonly _consulta = signal<ConsultaProductos>({
    pagina: 1,
    tamanio: TAMANIO_PAGINA_PREDETERMINADO,
  });
  private readonly _elementos = signal<readonly Producto[]>([]);
  private readonly _total = signal(0);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);
  private numeroDeCarga = 0;

  readonly consulta = this._consulta.asReadonly();
  readonly elementos = this._elementos.asReadonly();
  readonly total = this._total.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  /** Mensaje del último error al cargar; `null` si fue bien. */
  readonly error = this._error.asReadonly();

  /** Primer registro de la página (base 0), como lo usa `p-table` en modo diferido. */
  readonly primero = computed(() => (this._consulta().pagina - 1) * this._consulta().tamanio);
  readonly hayFiltros = computed(() => {
    const { marcaId, busqueda, disponibilidad } = this._consulta();
    return Boolean(marcaId) || Boolean(busqueda) || Boolean(disponibilidad);
  });

  /** Consulta `GET /productos` con los filtros y la página actuales. */
  async cargar(): Promise<void> {
    const carga = ++this.numeroDeCarga;
    this._cargando.set(true);
    this._error.set(null);
    try {
      const pagina = await this.api.listar(this._consulta());
      if (carga !== this.numeroDeCarga) {
        return;
      }
      // Si la página quedó fuera de rango (por ejemplo, tras eliminar), vuelve a la última.
      const ultima = Math.max(1, Math.ceil(pagina.total / pagina.tamanio));
      if (pagina.elementos.length === 0 && pagina.total > 0 && this._consulta().pagina > ultima) {
        this._consulta.update((c) => ({ ...c, pagina: ultima }));
        await this.cargar();
        return;
      }
      this._elementos.set(pagina.elementos);
      this._total.set(pagina.total);
    } catch (error) {
      if (carga === this.numeroDeCarga) {
        this._error.set(mensajeDeErrorDeProducto(error));
      }
    } finally {
      if (carga === this.numeroDeCarga) {
        this._cargando.set(false);
      }
    }
  }

  /** Cambia filtros, vuelve a la primera página y consulta. */
  async filtrar(filtros: FiltrosProductos): Promise<void> {
    const busqueda = filtros.busqueda?.trim();
    this._consulta.update((c) => ({
      pagina: 1,
      tamanio: c.tamanio,
      ...(filtros.marcaId ? { marcaId: filtros.marcaId } : {}),
      ...(busqueda ? { busqueda } : {}),
      ...(filtros.disponibilidad ? { disponibilidad: filtros.disponibilidad } : {}),
    }));
    await this.cargar();
  }

  /** Limpia todos los filtros (CA-11: «sin resultados» ofrece esta opción). */
  limpiarFiltros(): Promise<void> {
    return this.filtrar({});
  }

  /** Cambia de página o de tamaño de página. `primero` es el índice base 0 del primer registro. */
  async irA(primero: number, tamanio: number): Promise<void> {
    const pagina = Math.floor(primero / tamanio) + 1;
    const actual = this._consulta();
    if (actual.pagina === pagina && actual.tamanio === tamanio) {
      return;
    }
    this._consulta.set({ ...actual, pagina, tamanio });
    await this.cargar();
  }

  crear(producto: NuevoProducto): Promise<Producto> {
    return this.api.crear(producto);
  }

  actualizar(id: string, cambios: CambiosProducto): Promise<Producto> {
    return this.api.actualizar(id, cambios);
  }

  obtener(id: string): Promise<Producto> {
    return this.api.obtener(id);
  }

  /** RF-PRO-03: eliminación lógica. Después recarga la página actual. */
  async eliminar(id: string): Promise<void> {
    await this.api.eliminar(id);
    await this.cargar();
  }

  /**
   * RF-PRO-05, CA-07: cambio rápido de disponibilidad. La fila refleja lo que devuelve la API;
   * con filtro de disponibilidad activo la fila puede dejar de coincidir, así que se recarga.
   */
  async cambiarDisponibilidad(id: string, disponibilidad: Disponibilidad): Promise<Producto> {
    const actualizado = await this.api.actualizar(id, { disponibilidad });
    if (this._consulta().disponibilidad) {
      await this.cargar();
    } else {
      this._elementos.update((lista) => lista.map((p) => (p.id === id ? actualizado : p)));
    }
    return actualizado;
  }

  subirImagen(productoId: string, archivo: File): Promise<ImagenProducto> {
    return this.api.subirImagen(productoId, archivo);
  }

  ordenarImagenes(productoId: string, ids: readonly string[]): Promise<readonly ImagenProducto[]> {
    return this.api.ordenarImagenes(productoId, ids);
  }

  eliminarImagen(productoId: string, imagenId: string): Promise<void> {
    return this.api.eliminarImagen(productoId, imagenId);
  }

  urlImagen(ruta: string): string {
    return this.api.urlImagen(ruta);
  }
}
