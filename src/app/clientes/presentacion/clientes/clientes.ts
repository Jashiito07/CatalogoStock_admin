import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { horaEcuador } from '../../../compartido/dominio/fecha-ecuador';
import {
  mensajeDeErrorAlCambiarEstado,
  mensajeDeErrorAlGenerarCodigo,
  mensajeDeErrorAlListar,
} from '../../aplicacion/mensajes-clientes';
import { ApiClientes } from '../../aplicacion/puertos';
import {
  activoDeFiltro,
  AYUDA_CORREO_SIN_VERIFICAR,
  Cliente,
  CodigoRecuperacion,
  construirConsultaClientes,
  correoVerificadoDeFiltro,
  EstadoCorreo,
  estadoCorreoDe,
  etiquetaEstado,
  ETIQUETA_CORREO_SIN_VERIFICAR,
  ETIQUETA_CORREO_VERIFICADO,
  FiltroCorreoCliente,
  FiltroEstadoCliente,
  formatearTelefono,
  LONGITUD_MAXIMA_BUSQUEDA,
  OPCIONES_FILTRO_CORREO,
  OPCIONES_FILTRO_ESTADO,
  paginaDesdeIndice,
  TAMANIO_PAGINA_CLIENTES,
  textoAvisoSinVerificar,
  tieneCodigoVigente,
} from '../../dominio/cliente';
import { DialogoCodigo } from '../dialogo-codigo/dialogo-codigo';

/** Retardo de la búsqueda mientras el Vendedor escribe. */
export const RETARDO_BUSQUEDA_MS = 400;

export const MENSAJE_NO_SE_GENERO = 'No se generó el código';
export const MENSAJE_NO_SE_DESACTIVO = 'No se desactivó la cuenta';
export const MENSAJE_NO_SE_REACTIVO = 'No se reactivó la cuenta';
export const MENSAJE_CONFIRMAR_DESACTIVAR =
  'El cliente no podrá ingresar a la app. Sus pedidos se conservan.';

/** Estado del código de recuperación de una fila, ya listo para mostrarse. */
export type EstadoCodigoFila =
  | { readonly tipo: 'inactiva' }
  | { readonly tipo: 'vigente'; readonly hasta: string }
  | { readonly tipo: 'ninguno' };

export interface FilaCliente {
  readonly id: string;
  readonly nombre: string;
  readonly correo: string;
  readonly telefono: string;
  readonly activo: boolean;
  readonly etiquetaEstado: 'Activo' | 'Desactivado';
  /** UTC tal como llega de la API; la vista lo muestra en hora de Ecuador. */
  readonly creadoEn: string;
  readonly estadoCodigo: EstadoCodigoFila;
  /** `desconocido` si la API no envió `correoVerificadoEn`: no se muestra etiqueta. */
  readonly estadoCorreo: EstadoCorreo;
}

export function aFilaCliente(cliente: Cliente, ahora: Date): FilaCliente {
  let estadoCodigo: EstadoCodigoFila = { tipo: 'ninguno' };
  if (!cliente.activo) {
    estadoCodigo = { tipo: 'inactiva' };
  } else if (tieneCodigoVigente(cliente, ahora) && cliente.codigoRecuperacionVigenteHasta) {
    estadoCodigo = { tipo: 'vigente', hasta: horaEcuador(cliente.codigoRecuperacionVigenteHasta) };
  }
  return {
    id: cliente.id,
    nombre: cliente.nombre,
    correo: cliente.correo,
    telefono: formatearTelefono(cliente.telefono),
    activo: cliente.activo,
    etiquetaEstado: etiquetaEstado(cliente.activo),
    creadoEn: cliente.creadoEn,
    estadoCodigo,
    estadoCorreo: estadoCorreoDe(cliente),
  };
}

/**
 * Sección «Clientes» del panel (RF-USU-05, D-35, D-39): `p-table` paginada en el servidor
 * con búsqueda, y la acción «Generar código de recuperación» con confirmación. El código
 * se muestra una sola vez en `DialogoCodigo` y se descarta al cerrarlo.
 */
@Component({
  selector: 'app-clientes',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TableModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    ButtonModule,
    TagModule,
    MessageModule,
    SelectModule,
    TooltipModule,
    ConfirmDialogModule,
    DialogoCodigo,
  ],
  providers: [ConfirmationService],
  templateUrl: './clientes.html',
  styleUrl: './clientes.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clientes {
  private readonly api = inject(ApiClientes);
  private readonly confirmacion = inject(ConfirmationService);
  private readonly avisos = inject(MessageService);

  protected readonly zonaEcuador = '-0500';
  protected readonly opcionesFilas = [10, 20, 50, 100];
  protected readonly longitudMaximaBusqueda = LONGITUD_MAXIMA_BUSQUEDA;

  protected readonly busqueda = new FormControl('', { nonNullable: true });
  protected readonly filtroEstado = new FormControl<FiltroEstadoCliente>('todos', {
    nonNullable: true,
  });
  protected readonly opcionesEstado = OPCIONES_FILTRO_ESTADO;
  protected readonly filtroCorreo = new FormControl<FiltroCorreoCliente>('todos', {
    nonNullable: true,
  });
  protected readonly opcionesCorreo = OPCIONES_FILTRO_CORREO;
  protected readonly etiquetaVerificado = ETIQUETA_CORREO_VERIFICADO;
  protected readonly etiquetaSinVerificar = ETIQUETA_CORREO_SIN_VERIFICAR;
  protected readonly ayudaSinVerificar = AYUDA_CORREO_SIN_VERIFICAR;

  protected readonly filas = signal<FilaCliente[]>([]);
  protected readonly total = signal(0);
  protected readonly primero = signal(0);
  protected readonly tamanio = signal(TAMANIO_PAGINA_CLIENTES);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busquedaAplicada = signal('');
  protected readonly generandoPara = signal<string | null>(null);
  /** Cliente cuyo estado se está cambiando (evita dobles clics). */
  protected readonly cambiandoEstadoPara = signal<string | null>(null);
  protected readonly filtroAplicado = signal<FiltroEstadoCliente>('todos');
  protected readonly filtroCorreoAplicado = signal<FiltroCorreoCliente>('todos');
  /** Clientes con el correo sin verificar (0 = aviso oculto, también si la consulta falla). */
  protected readonly sinVerificar = signal(0);
  protected readonly textoAviso = computed(() => textoAvisoSinVerificar(this.sinVerificar()));
  /** Texto de «sin resultados» según los filtros activos. */
  protected readonly textoVacioFiltros = computed(() => {
    const estado = this.filtroAplicado() !== 'todos';
    const correo = this.filtroCorreoAplicado() !== 'todos';
    if (estado && correo) {
      return 'No hay clientes con esos filtros.';
    }
    return correo ? 'No hay clientes con ese estado de correo.' : 'No hay clientes con ese estado.';
  });
  /** Código recién generado. Solo en memoria mientras el diálogo está abierto. */
  protected readonly codigoGenerado = signal<CodigoRecuperacion | null>(null);

  /** Evita que una respuesta lenta reemplace a una más reciente. */
  private consultaActual = 0;
  private consultaAviso = 0;

  constructor() {
    this.busqueda.valueChanges
      .pipe(
        debounceTime(RETARDO_BUSQUEDA_MS),
        map((texto) => texto.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((texto) => this.aplicarBusqueda(texto));

    this.filtroEstado.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((filtro) => {
        this.filtroAplicado.set(filtro);
        this.primero.set(0);
        void this.cargar();
      });

    this.filtroCorreo.valueChanges
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((filtro) => {
        this.filtroCorreoAplicado.set(filtro);
        this.primero.set(0);
        void this.cargar();
      });
  }

  /** Atajo del aviso: muestra solo los clientes con el correo sin verificar. */
  protected verSinVerificar(): void {
    this.filtroCorreo.setValue('sin-verificar');
  }

  /** La tabla pide una página (al iniciar, al paginar o al cambiar las filas por página). */
  protected alCargarPagina(evento: TableLazyLoadEvent): void {
    this.primero.set(evento.first ?? 0);
    this.tamanio.set(evento.rows ?? TAMANIO_PAGINA_CLIENTES);
    void this.cargar();
  }

  /** Quita la búsqueda y el filtro de estado y vuelve a consultar una sola vez. */
  protected limpiarFiltros(): void {
    this.busqueda.setValue('', { emitEvent: false });
    this.filtroEstado.setValue('todos', { emitEvent: false });
    this.filtroAplicado.set('todos');
    this.filtroCorreo.setValue('todos', { emitEvent: false });
    this.filtroCorreoAplicado.set('todos');
    this.aplicarBusqueda('');
  }

  private aplicarBusqueda(texto: string): void {
    this.busquedaAplicada.set(texto);
    this.primero.set(0);
    void this.cargar();
  }

  /** Consulta la página actual con la búsqueda aplicada. */
  async cargar(): Promise<void> {
    const consulta = construirConsultaClientes(
      this.busquedaAplicada(),
      paginaDesdeIndice(this.primero(), this.tamanio()),
      this.tamanio(),
      activoDeFiltro(this.filtroAplicado()),
      correoVerificadoDeFiltro(this.filtroCorreoAplicado()),
    );
    void this.actualizarAviso();
    const numero = ++this.consultaActual;
    this.error.set(null);
    this.cargando.set(true);
    try {
      const pagina = await this.api.listar(consulta);
      if (numero !== this.consultaActual) {
        return;
      }
      const ahora = new Date();
      this.filas.set(pagina.elementos.map((cliente) => aFilaCliente(cliente, ahora)));
      this.total.set(pagina.total);
    } catch (error) {
      if (numero !== this.consultaActual) {
        return;
      }
      this.filas.set([]);
      this.total.set(0);
      this.error.set(mensajeDeErrorAlListar(error));
    } finally {
      if (numero === this.consultaActual) {
        this.cargando.set(false);
      }
    }
  }

  /**
   * Cuenta los clientes sin correo verificado (todos, sin importar los filtros). Si la
   * consulta falla, el aviso se oculta: no es crítico y no debe tapar la tabla.
   */
  private async actualizarAviso(): Promise<void> {
    const numero = ++this.consultaAviso;
    const cantidad = await this.api.contarSinCorreoVerificado().then(
      (total) => (Number.isInteger(total) && total > 0 ? total : 0),
      () => 0,
    );
    if (numero === this.consultaAviso) {
      this.sinVerificar.set(cantidad);
    }
  }

  /** Pide confirmación (el código anterior deja de servir) y luego genera el código. */
  protected confirmarGenerarCodigo(fila: FilaCliente): void {
    this.confirmacion.confirm({
      header: 'Generar código de recuperación',
      message: `¿Generar un código para ${fila.nombre}? El anterior dejará de servir.`,
      icon: 'pi pi-key',
      acceptLabel: 'Generar código',
      rejectLabel: 'Cancelar',
      acceptIcon: 'pi pi-key',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => void this.generarCodigo(fila),
    });
  }

  async generarCodigo(fila: FilaCliente): Promise<void> {
    if (this.generandoPara() !== null) {
      return;
    }
    this.generandoPara.set(fila.id);
    try {
      this.codigoGenerado.set(await this.api.generarCodigoRecuperacion(fila.id));
      // La fila mostrará «Código vigente hasta…» según el servidor.
      void this.cargar();
    } catch (error) {
      this.avisos.add({
        severity: 'error',
        summary: MENSAJE_NO_SE_GENERO,
        detail: mensajeDeErrorAlGenerarCodigo(error),
        life: 6000,
      });
    } finally {
      this.generandoPara.set(null);
    }
  }

  /** D-53: desactivar pide confirmación; los pedidos del cliente se conservan. */
  protected confirmarDesactivar(fila: FilaCliente): void {
    this.confirmacion.confirm({
      header: `Desactivar a ${fila.nombre}`,
      message: MENSAJE_CONFIRMAR_DESACTIVAR,
      icon: 'pi pi-ban',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      acceptIcon: 'pi pi-ban',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => void this.cambiarEstado(fila, false),
    });
  }

  /** Reactivar es directo (no destruye nada) y avisa con un toast. */
  protected reactivar(fila: FilaCliente): void {
    void this.cambiarEstado(fila, true);
  }

  /** `PATCH /usuarios/{id}/estado`. La lista se vuelve a consultar: lo oficial es del servidor. */
  async cambiarEstado(fila: FilaCliente, activo: boolean): Promise<void> {
    if (this.cambiandoEstadoPara() !== null) {
      return;
    }
    this.cambiandoEstadoPara.set(fila.id);
    try {
      await this.api.cambiarEstado(fila.id, activo);
      this.avisos.add({
        severity: 'success',
        summary: activo ? 'Cuenta reactivada' : 'Cuenta desactivada',
        detail: activo
          ? `${fila.nombre} ya puede ingresar a la app.`
          : `${fila.nombre} ya no puede ingresar a la app. Sus pedidos se conservan.`,
        life: 4000,
      });
      void this.cargar();
    } catch (error) {
      this.avisos.add({
        severity: 'error',
        summary: activo ? MENSAJE_NO_SE_REACTIVO : MENSAJE_NO_SE_DESACTIVO,
        detail: mensajeDeErrorAlCambiarEstado(error),
        life: 6000,
      });
      if (error instanceof ErrorApi && error.estado === 404) {
        void this.cargar(); // El cliente ya no existe: se actualiza la lista.
      }
    } finally {
      this.cambiandoEstadoPara.set(null);
    }
  }

  /** Al cerrar el diálogo, el código se descarta: no se vuelve a mostrar. */
  protected descartarCodigo(): void {
    this.codigoGenerado.set(null);
  }
}
