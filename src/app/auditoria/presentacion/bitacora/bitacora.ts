import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { MENSAJE_ERROR_DESCONOCIDO } from '../../../compartido/infraestructura/http/interceptor-errores';
import { LectorBitacora } from '../../aplicacion/puertos';
import {
  ACCIONES_AUDITORIA,
  AccionAuditoria,
  CampoDetalle,
  construirConsultaBitacora,
  DescripcionUsuario,
  describirDetalle,
  describirUsuario,
  diaCalendarioDe,
  ErrorFiltrosBitacora,
  etiquetaAccion,
  etiquetaEntidad,
  Gravedad,
  gravedadAccion,
  paginaDesdeIndice,
  RegistroActividad,
  TAMANIO_PAGINA_POR_DEFECTO,
} from '../../dominio/bitacora';

type SeveridadEtiqueta = 'success' | 'secondary' | 'danger';

const SEVERIDAD_POR_GRAVEDAD: Readonly<Record<Gravedad, SeveridadEtiqueta>> = {
  exito: 'success',
  neutral: 'secondary',
  alerta: 'danger',
};

export const MENSAJE_SIN_PERMISO = 'No tienes permiso para esta acción.';

/** Fila de la tabla ya preparada para mostrarse. */
export interface FilaBitacora {
  readonly id: string;
  /** Fecha en UTC tal como llega de la API; la vista la muestra en hora de Ecuador. */
  readonly fecha: string;
  readonly accion: string;
  readonly severidad: SeveridadEtiqueta;
  readonly idUsuario: string | null;
  readonly usuario: DescripcionUsuario;
  readonly entidad: string;
  readonly detalle: readonly CampoDetalle[];
}

export function aFilaBitacora(registro: RegistroActividad): FilaBitacora {
  return {
    id: registro.id,
    fecha: registro.fecha,
    accion: etiquetaAccion(registro.accion),
    severidad: SEVERIDAD_POR_GRAVEDAD[gravedadAccion(registro.accion)],
    idUsuario: registro.usuario?.id ?? null,
    usuario: describirUsuario(registro.usuario),
    entidad: etiquetaEntidad(registro.entidad),
    detalle: describirDetalle(registro.detalle ?? {}),
  };
}

interface UsuarioFiltrado {
  readonly id: string;
  readonly nombre: string;
}

/**
 * Bitácora de actividades (RF-USU-04): `p-table` paginada en el servidor, con filtros por
 * acción, rango de fechas (hora de Ecuador, D-31) y usuario. Solo lectura.
 */
@Component({
  selector: 'app-bitacora',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TableModule,
    SelectModule,
    DatePickerModule,
    ButtonModule,
    TagModule,
    ChipModule,
    MessageModule,
    TooltipModule,
  ],
  templateUrl: './bitacora.html',
  styleUrl: './bitacora.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Bitacora {
  private readonly lector = inject(LectorBitacora);

  /** Zona horaria para mostrar las fechas (Ecuador, UTC-5, sin horario de verano). */
  protected readonly zonaEcuador = '-0500';
  protected readonly opcionesFilas = [10, 20, 50, 100];
  protected readonly opcionesAccion = ACCIONES_AUDITORIA.map((valor) => ({
    valor,
    etiqueta: etiquetaAccion(valor),
  }));
  protected readonly hoy = new Date();

  protected readonly filtros = new FormGroup({
    accion: new FormControl<AccionAuditoria | null>(null),
    desde: new FormControl<Date | null>(null),
    hasta: new FormControl<Date | null>(null),
  });

  private readonly valoresFiltros = toSignal(this.filtros.valueChanges, {
    initialValue: this.filtros.getRawValue(),
  });

  protected readonly filas = signal<FilaBitacora[]>([]);
  protected readonly total = signal(0);
  protected readonly primero = signal(0);
  protected readonly tamanio = signal(TAMANIO_PAGINA_POR_DEFECTO);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly errorFiltros = signal<string | null>(null);
  protected readonly usuarioFiltrado = signal<UsuarioFiltrado | null>(null);

  /** Filtros que se enviaron en la última consulta. */
  private readonly filtrosAplicados = signal({
    accion: null as AccionAuditoria | null,
    desde: null as Date | null,
    hasta: null as Date | null,
  });

  /** Hay filtros aplicados o escritos en el formulario (habilita «Limpiar filtros», CA-11). */
  protected readonly hayFiltros = computed(() => {
    const valores = [
      ...Object.values(this.filtrosAplicados()),
      ...Object.values(this.valoresFiltros()),
      this.usuarioFiltrado(),
    ];
    return valores.some((valor) => valor !== null && valor !== undefined);
  });

  /** Evita que una respuesta lenta reemplace a una más reciente. */
  private consultaActual = 0;

  /** La tabla pide una página (al iniciar, al paginar o al cambiar las filas por página). */
  protected alCargarPagina(evento: TableLazyLoadEvent): void {
    this.primero.set(evento.first ?? 0);
    this.tamanio.set(evento.rows ?? TAMANIO_PAGINA_POR_DEFECTO);
    void this.cargar();
  }

  protected aplicarFiltros(): void {
    const { accion, desde, hasta } = this.filtros.getRawValue();
    this.filtrosAplicados.set({ accion, desde, hasta });
    this.primero.set(0);
    void this.cargar();
  }

  protected limpiarFiltros(): void {
    this.filtros.reset({ accion: null, desde: null, hasta: null });
    this.usuarioFiltrado.set(null);
    this.aplicarFiltros();
  }

  protected filtrarPorUsuario(fila: FilaBitacora): void {
    if (fila.idUsuario === null) {
      return;
    }
    this.usuarioFiltrado.set({ id: fila.idUsuario, nombre: fila.usuario.nombre });
    this.aplicarFiltros();
  }

  protected quitarFiltroUsuario(): void {
    this.usuarioFiltrado.set(null);
    this.aplicarFiltros();
  }

  /** Consulta la página actual con los filtros aplicados. */
  async cargar(): Promise<void> {
    const { accion, desde, hasta } = this.filtrosAplicados();
    let consulta;
    try {
      consulta = construirConsultaBitacora(
        {
          accion,
          desde: desde ? diaCalendarioDe(desde) : null,
          hasta: hasta ? diaCalendarioDe(hasta) : null,
          idUsuario: this.usuarioFiltrado()?.id ?? null,
        },
        paginaDesdeIndice(this.primero(), this.tamanio()),
        this.tamanio(),
      );
    } catch (error) {
      this.errorFiltros.set(
        error instanceof ErrorFiltrosBitacora ? error.message : MENSAJE_ERROR_DESCONOCIDO,
      );
      return;
    }

    const numero = ++this.consultaActual;
    this.errorFiltros.set(null);
    this.error.set(null);
    this.cargando.set(true);
    try {
      const pagina = await this.lector.consultar(consulta);
      if (numero !== this.consultaActual) {
        return;
      }
      this.filas.set(pagina.elementos.map(aFilaBitacora));
      this.total.set(pagina.total);
    } catch (error) {
      if (numero !== this.consultaActual) {
        return;
      }
      this.filas.set([]);
      this.total.set(0);
      this.error.set(mensajeDeErrorDeBitacora(error));
    } finally {
      if (numero === this.consultaActual) {
        this.cargando.set(false);
      }
    }
  }
}

/** Mensaje claro para un error de la consulta, sin detalles técnicos. */
export function mensajeDeErrorDeBitacora(error: unknown): string {
  if (!(error instanceof ErrorApi)) {
    return MENSAJE_ERROR_DESCONOCIDO;
  }
  if (error.estado === 403) {
    return MENSAJE_SIN_PERMISO;
  }
  return error.mensaje;
}
