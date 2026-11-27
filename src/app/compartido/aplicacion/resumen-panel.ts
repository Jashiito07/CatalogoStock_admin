import { inject, Injectable, signal, WritableSignal } from '@angular/core';

import { RegistroActividad } from '../../auditoria/dominio/bitacora';
import { LectorBitacora } from '../../auditoria/aplicacion/puertos';
import { ApiClientes } from '../../clientes/aplicacion/puertos';
import { EstadoImportacion } from '../../importacion/aplicacion/estado-importacion';
import { Importacion } from '../../importacion/dominio/importacion';
import { EstadoMarcas } from '../../marcas/aplicacion/estado-marcas';
import { ApiProductos } from '../../productos/aplicacion/puertos';
import { Disponibilidad } from '../../productos/dominio/producto';

/** Cada tarjeta del Inicio carga por separado: una que falle no tumba a las demás. */
export type Seccion<T> =
  | { readonly estado: 'cargando' }
  | { readonly estado: 'listo'; readonly datos: T }
  | { readonly estado: 'error' };

export interface ProductosPorMarca {
  readonly id: string;
  readonly nombre: string;
  readonly color: string;
  readonly total: number;
}

export interface ResumenProductos {
  readonly total: number;
  readonly porDisponibilidad: Readonly<Record<Disponibilidad, number>>;
  readonly porMarca: readonly ProductosPorMarca[];
}

export interface ResumenMarcas {
  readonly activas: number;
  readonly total: number;
}

export interface ResumenClientes {
  readonly activos: number;
  readonly desactivados: number;
  readonly sinVerificar: number;
  /** Clientes con el correo confirmado (total menos los sin verificar). */
  readonly verificados: number;
}

export interface ResumenImportaciones {
  readonly recientes: readonly Importacion[];
  readonly borradoresPendientes: number;
}

/** Máximo de marcas en el gráfico «Productos por marca». */
export const MAXIMO_MARCAS_EN_GRAFICO = 8;
/** Cuántas actividades se muestran en «Actividad reciente». */
export const ACTIVIDADES_RECIENTES = 5;

/**
 * Datos del Inicio del panel (Fase 1). Solo usa endpoints que la API ya expone: totales de
 * `GET /productos`, `GET /usuarios` y `GET /auditoria` (con `tamanio=1` basta el `total`), las
 * marcas y las importaciones recordadas en la sesión. No hay ventas ni pedidos (Fase 6).
 * El panel siempre está en línea (D-02): nada se guarda localmente.
 */
@Injectable()
export class ResumenPanel {
  private readonly productosApi = inject(ApiProductos);
  private readonly clientesApi = inject(ApiClientes);
  private readonly lector = inject(LectorBitacora);
  private readonly marcasEstado = inject(EstadoMarcas);
  private readonly importacionEstado = inject(EstadoImportacion);

  readonly productos = signal<Seccion<ResumenProductos>>({ estado: 'cargando' });
  readonly marcas = signal<Seccion<ResumenMarcas>>({ estado: 'cargando' });
  readonly clientes = signal<Seccion<ResumenClientes>>({ estado: 'cargando' });
  readonly importaciones = signal<Seccion<ResumenImportaciones>>({ estado: 'cargando' });
  readonly actividad = signal<Seccion<readonly RegistroActividad[]>>({ estado: 'cargando' });

  /** Consulta todas las secciones a la vez; cada una se resuelve por su cuenta. */
  async cargar(): Promise<void> {
    const marcas = this.marcasEstado.cargar();
    // Evita un rechazo sin atender si ninguna sección llega a esperar esta promesa.
    marcas.catch(() => undefined);
    await Promise.all([
      this.cargarMarcas(marcas),
      this.cargarProductos(marcas),
      this.cargarClientes(),
      this.cargarImportaciones(),
      this.cargarActividad(),
    ]);
  }

  private async cargarMarcas(marcas: ReturnType<EstadoMarcas['cargar']>): Promise<void> {
    await this.resolver(this.marcas, async () => {
      const lista = await marcas;
      return { activas: lista.filter((m) => m.activa).length, total: lista.length };
    });
  }

  private async cargarProductos(marcas: ReturnType<EstadoMarcas['cargar']>): Promise<void> {
    await this.resolver(this.productos, async () => {
      const total = (disponibilidad?: Disponibilidad, marcaId?: string): Promise<number> =>
        this.productosApi
          .listar({ pagina: 1, tamanio: 1, disponibilidad, marcaId })
          .then((pagina) => pagina.total);

      const [disponibles, agotados, pendientes] = await Promise.all([
        total('DISPONIBLE'),
        total('AGOTADO'),
        total('PENDIENTE_REPOSICION'),
      ]);

      // El gráfico por marca es un extra: si las marcas fallan, las tarjetas siguen.
      let porMarca: ProductosPorMarca[];
      try {
        const activas = (await marcas).filter((m) => m.activa).slice(0, MAXIMO_MARCAS_EN_GRAFICO);
        porMarca = await Promise.all(
          activas.map(async (m) => ({
            id: m.id,
            nombre: m.nombre,
            color: m.color,
            total: await total(undefined, m.id),
          })),
        );
      } catch {
        porMarca = [];
      }

      return {
        total: disponibles + agotados + pendientes,
        porDisponibilidad: {
          DISPONIBLE: disponibles,
          AGOTADO: agotados,
          PENDIENTE_REPOSICION: pendientes,
        },
        porMarca,
      };
    });
  }

  private async cargarClientes(): Promise<void> {
    await this.resolver(this.clientes, async () => {
      const [activos, desactivados, sinVerificar] = await Promise.all([
        this.clientesApi.listar({ pagina: 1, tamanio: 1, activo: true }).then((p) => p.total),
        this.clientesApi.listar({ pagina: 1, tamanio: 1, activo: false }).then((p) => p.total),
        this.clientesApi.contarSinCorreoVerificado(),
      ]);
      return {
        activos,
        desactivados,
        sinVerificar,
        verificados: Math.max(0, activos + desactivados - sinVerificar),
      };
    });
  }

  private async cargarImportaciones(): Promise<void> {
    await this.resolver(this.importaciones, async () => {
      await this.importacionEstado.cargarRecientes();
      const recientes = this.importacionEstado.recientes();
      return {
        recientes,
        borradoresPendientes: recientes.reduce((suma, i) => suma + i.totales.pendientes, 0),
      };
    });
  }

  private async cargarActividad(): Promise<void> {
    await this.resolver(this.actividad, async () => {
      const pagina = await this.lector.consultar({ pagina: 1, tamanio: ACTIVIDADES_RECIENTES });
      return pagina.elementos;
    });
  }

  private async resolver<T>(
    destino: WritableSignal<Seccion<T>>,
    obtener: () => Promise<T>,
  ): Promise<void> {
    destino.set({ estado: 'cargando' });
    try {
      destino.set({ estado: 'listo', datos: await obtener() });
    } catch {
      destino.set({ estado: 'error' });
    }
  }
}
