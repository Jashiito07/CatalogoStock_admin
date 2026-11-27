import { computed, inject, Injectable, signal } from '@angular/core';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import {
  Borrador,
  CambiosBorrador,
  ConsultaBorradores,
  EstadoBorrador,
  Importacion,
  cambiosParaConfirmarPrecio,
  resumirLote,
  ResumenLote,
  TAMANIO_PAGINA_BORRADORES,
  tienePrecioPorConfirmar,
} from '../dominio/importacion';
import { mensajeDeErrorDeImportacion } from './mensajes-importacion';
import { AlmacenImportacionesRecientes, ApiImportaciones } from './puertos';

/** Filtros que elige el Vendedor en la lista de revisión. */
export interface FiltrosBorradores {
  readonly estado: EstadoBorrador;
  readonly conAdvertencias?: boolean;
  readonly busqueda?: string;
  readonly paginaPdf?: number;
  /**
   * Solo los pendientes con `PRECIO_HEREDADO`. La API no tiene ese filtro: se piden los pendientes
   * con advertencias y se filtran aquí (la paginación pasa a ser local en este modo).
   */
  readonly soloPorConfirmar?: boolean;
}

/** Tamaño de página y tope de páginas al buscar los borradores que esperan confirmar su precio. */
const TAMANIO_ESCANEO = 100;
const MAXIMO_PAGINAS_ESCANEO = 30;

/** Cuántas importaciones recientes se recuerdan en la sesión. */
export const MAXIMO_RECIENTES = 5;

const CONSULTA_INICIAL: ConsultaBorradores = {
  pagina: 1,
  tamanio: TAMANIO_PAGINA_BORRADORES,
  estado: 'PENDIENTE',
};

/**
 * Importación del catálogo en PDF del panel (RF-PRO-01, RF-PRO-02). El panel siempre está en línea
 * (D-02): la API es la fuente de verdad y decide qué se puede aprobar; aquí solo se guarda lo que
 * muestran la pantalla de importación y la lista de revisión. Las respuestas atrasadas se descartan
 * para no mostrar el listado de filtros anteriores.
 */
@Injectable()
export class EstadoImportacion {
  private readonly api = inject(ApiImportaciones);
  private readonly almacen = inject(AlmacenImportacionesRecientes);

  private readonly _importacion = signal<Importacion | null>(null);
  private readonly _consulta = signal<ConsultaBorradores>(CONSULTA_INICIAL);
  private readonly _elementos = signal<readonly Borrador[]>([]);
  private readonly _total = signal(0);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _recientes = signal<readonly Importacion[]>([]);
  private readonly _cargandoRecientes = signal(false);
  private readonly _soloPorConfirmar = signal(false);
  private readonly _porConfirmar = signal<number | null>(null);
  private numeroDeCarga = 0;

  /** Modo «solo con precio por confirmar» activo. */
  readonly soloPorConfirmar = this._soloPorConfirmar.asReadonly();
  /** Cuántos pendientes esperan confirmar su precio; `null` si aún no se sabe. */
  readonly porConfirmar = this._porConfirmar.asReadonly();

  readonly importacion = this._importacion.asReadonly();
  readonly consulta = this._consulta.asReadonly();
  readonly elementos = this._elementos.asReadonly();
  readonly total = this._total.asReadonly();
  readonly cargando = this._cargando.asReadonly();
  /** Mensaje del último error al cargar la importación o sus borradores; `null` si fue bien. */
  readonly error = this._error.asReadonly();
  readonly recientes = this._recientes.asReadonly();
  readonly cargandoRecientes = this._cargandoRecientes.asReadonly();

  /** Primer registro de la página (base 0), como lo usa `p-table` en modo diferido. */
  readonly primero = computed(() => (this._consulta().pagina - 1) * this._consulta().tamanio);
  readonly hayFiltros = computed(() => {
    const { conAdvertencias, busqueda, paginaPdf } = this._consulta();
    return (
      conAdvertencias === true ||
      Boolean(busqueda) ||
      paginaPdf !== undefined ||
      this._soloPorConfirmar()
    );
  });

  // ── Análisis y recientes ─────────────────────────────────────────────────────────────

  /** POST de la importación. Si sale bien, la recuerda entre las recientes. */
  async analizar(
    archivo: File,
    marcaId: string,
    alProgreso?: (porcentaje: number) => void,
  ): Promise<Importacion> {
    const importacion = await this.api.analizar(archivo, marcaId, alProgreso);
    this.recordar(importacion.id);
    return importacion;
  }

  /** Carga las importaciones recordadas con sus totales; las que ya no existen se olvidan. */
  async cargarRecientes(): Promise<void> {
    this._cargandoRecientes.set(true);
    try {
      const ids = this.almacen.leer();
      const resultados = await Promise.all(
        ids.map((id) =>
          this.api.obtener(id).then(
            (importacion) => ({ id, importacion, inexistente: false }),
            (error: unknown) => ({
              id,
              importacion: null,
              inexistente: error instanceof ErrorApi && error.estado === 404,
            }),
          ),
        ),
      );
      this._recientes.set(
        resultados.flatMap((r) => (r.importacion === null ? [] : [r.importacion])),
      );
      // Solo se olvida lo que el servidor dice que no existe; una falla de red no borra nada.
      this.almacen.guardar(resultados.filter((r) => !r.inexistente).map((r) => r.id));
    } finally {
      this._cargandoRecientes.set(false);
    }
  }

  private recordar(id: string): void {
    const ids = [id, ...this.almacen.leer().filter((actual) => actual !== id)];
    this.almacen.guardar(ids.slice(0, MAXIMO_RECIENTES));
  }

  // ── Lista de revisión ────────────────────────────────────────────────────────────────

  /** Abre una importación: consulta sus totales y la primera página de pendientes. */
  async abrir(id: string): Promise<void> {
    this.numeroDeCarga++;
    this._importacion.set(null);
    this._elementos.set([]);
    this._total.set(0);
    this._consulta.set(CONSULTA_INICIAL);
    this._soloPorConfirmar.set(false);
    this._porConfirmar.set(null);
    this._error.set(null);
    this._cargando.set(true);
    try {
      this._importacion.set(await this.api.obtener(id));
      this.recordar(id);
    } catch (error) {
      this._error.set(mensajeDeErrorDeImportacion(error));
      this._cargando.set(false);
      return;
    }
    await this.cargar();
    await this.contarPorConfirmar();
  }

  /**
   * Pendientes con `PRECIO_HEREDADO` de la importación abierta (más los filtros de búsqueda y de
   * página del PDF que se indiquen). La API no los cuenta: se recorren los pendientes con
   * advertencias, de 100 en 100, y se filtran aquí.
   */
  private async buscarPorConfirmar(
    idImportacion: string,
    filtros: Pick<ConsultaBorradores, 'busqueda' | 'paginaPdf'> = {},
  ): Promise<Borrador[]> {
    const encontrados: Borrador[] = [];
    for (let pagina = 1; pagina <= MAXIMO_PAGINAS_ESCANEO; pagina++) {
      const respuesta = await this.api.listarBorradores(idImportacion, {
        pagina,
        tamanio: TAMANIO_ESCANEO,
        estado: 'PENDIENTE',
        conAdvertencias: true,
        ...(filtros.busqueda ? { busqueda: filtros.busqueda } : {}),
        ...(filtros.paginaPdf !== undefined ? { paginaPdf: filtros.paginaPdf } : {}),
      });
      encontrados.push(...respuesta.elementos.filter(tienePrecioPorConfirmar));
      if (respuesta.elementos.length === 0 || pagina * TAMANIO_ESCANEO >= respuesta.total) {
        break;
      }
    }
    return encontrados;
  }

  /** Actualiza el contador de precios por confirmar. Si falla, conserva el último valor. */
  async contarPorConfirmar(): Promise<void> {
    const importacion = this._importacion();
    if (importacion === null) {
      return;
    }
    if (importacion.totales.conAdvertencias === 0) {
      this._porConfirmar.set(0);
      return;
    }
    try {
      this._porConfirmar.set((await this.buscarPorConfirmar(importacion.id)).length);
    } catch {
      // El contador es una ayuda: la lista y la API siguen siendo la fuente de verdad.
    }
  }

  private async cargarPorConfirmar(importacion: Importacion, carga: number): Promise<void> {
    const consulta = this._consulta();
    const encontrados = await this.buscarPorConfirmar(importacion.id, consulta);
    if (carga !== this.numeroDeCarga) {
      return;
    }
    const ultima = Math.max(1, Math.ceil(encontrados.length / consulta.tamanio));
    const pagina = Math.min(consulta.pagina, ultima);
    if (pagina !== consulta.pagina) {
      this._consulta.update((c) => ({ ...c, pagina }));
    }
    const desde = (pagina - 1) * consulta.tamanio;
    this._elementos.set(encontrados.slice(desde, desde + consulta.tamanio));
    this._total.set(encontrados.length);
  }

  /** Consulta los borradores con la página y los filtros actuales. */
  async cargar(): Promise<void> {
    const importacion = this._importacion();
    if (importacion === null) {
      return;
    }
    const carga = ++this.numeroDeCarga;
    this._cargando.set(true);
    this._error.set(null);
    try {
      if (this._soloPorConfirmar()) {
        await this.cargarPorConfirmar(importacion, carga);
        return;
      }
      const pagina = await this.api.listarBorradores(importacion.id, this._consulta());
      if (carga !== this.numeroDeCarga) {
        return;
      }
      // Si la página quedó fuera de rango (por ejemplo, tras aprobar), vuelve a la última.
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
        this._error.set(mensajeDeErrorDeImportacion(error));
      }
    } finally {
      if (carga === this.numeroDeCarga) {
        this._cargando.set(false);
      }
    }
  }

  /** Cambia filtros, vuelve a la primera página y consulta. */
  async filtrar(filtros: FiltrosBorradores): Promise<void> {
    const busqueda = filtros.busqueda?.trim();
    this._soloPorConfirmar.set(filtros.soloPorConfirmar === true && filtros.estado === 'PENDIENTE');
    this._consulta.update((c) => ({
      pagina: 1,
      tamanio: c.tamanio,
      estado: filtros.estado,
      ...(filtros.conAdvertencias ? { conAdvertencias: true } : {}),
      ...(busqueda ? { busqueda } : {}),
      ...(filtros.paginaPdf !== undefined ? { paginaPdf: filtros.paginaPdf } : {}),
    }));
    await this.cargar();
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

  /** Vuelve a consultar los totales (contadores) de la importación abierta. */
  async refrescarImportacion(): Promise<void> {
    const actual = this._importacion();
    if (actual === null) {
      return;
    }
    try {
      this._importacion.set(await this.api.obtener(actual.id));
    } catch {
      // Los contadores se actualizarán en la próxima consulta; la lista ya es la oficial.
    }
  }

  /**
   * PATCH de un borrador. La fila refleja lo que devuelve el servidor (recalcula las advertencias)
   * y los contadores se vuelven a consultar.
   */
  async editar(id: string, cambios: CambiosBorrador): Promise<Borrador> {
    const borrador = await this.api.editarBorrador(id, cambios);
    this._elementos.update((lista) => lista.map((b) => (b.id === id ? borrador : b)));
    await this.refrescarImportacion();
    await this.contarPorConfirmar();
    return borrador;
  }

  /**
   * Confirma el precio heredado de la ficha: PATCH con el `precio` actual (contrato «Precio heredado
   * de la ficha»). La fila refleja lo que devuelve el servidor, sin la advertencia; en el modo «solo
   * por confirmar» el borrador sale de la lista.
   */
  async confirmarPrecio(borrador: Borrador): Promise<Borrador> {
    const confirmado = await this.editar(borrador.id, cambiosParaConfirmarPrecio(borrador));
    if (this._soloPorConfirmar() && !tienePrecioPorConfirmar(confirmado)) {
      await this.cargar();
    }
    return confirmado;
  }

  /** Aprueba borradores: el servidor crea los productos y decide cuáles son aprobables. */
  async aprobar(ids: readonly string[]): Promise<ResumenLote> {
    const resultados = await this.api.aprobar(ids);
    await this.recargarTrasLote();
    return resumirLote(resultados);
  }

  /** Descarta borradores pendientes: no llegan a los clientes y no se reactivan. */
  async descartar(ids: readonly string[]): Promise<ResumenLote> {
    const resultados = await this.api.descartar(ids);
    await this.recargarTrasLote();
    return resumirLote(resultados);
  }

  private async recargarTrasLote(): Promise<void> {
    await Promise.all([this.refrescarImportacion(), this.cargar()]);
    await this.contarPorConfirmar();
  }
}
