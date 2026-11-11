import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';

import { horaEcuador } from '../../../compartido/dominio/fecha-ecuador';
import {
  mensajeDeErrorAlGenerarCodigo,
  mensajeDeErrorAlListar,
} from '../../aplicacion/mensajes-clientes';
import { ApiClientes } from '../../aplicacion/puertos';
import {
  Cliente,
  CodigoRecuperacion,
  construirConsultaClientes,
  formatearTelefono,
  LONGITUD_MAXIMA_BUSQUEDA,
  paginaDesdeIndice,
  TAMANIO_PAGINA_CLIENTES,
  tieneCodigoVigente,
} from '../../dominio/cliente';
import { DialogoCodigo } from '../dialogo-codigo/dialogo-codigo';

/** Retardo de la búsqueda mientras el Vendedor escribe. */
export const RETARDO_BUSQUEDA_MS = 400;

export const MENSAJE_NO_SE_GENERO = 'No se generó el código';

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
  /** UTC tal como llega de la API; la vista lo muestra en hora de Ecuador. */
  readonly creadoEn: string;
  readonly estadoCodigo: EstadoCodigoFila;
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
    creadoEn: cliente.creadoEn,
    estadoCodigo,
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

  protected readonly filas = signal<FilaCliente[]>([]);
  protected readonly total = signal(0);
  protected readonly primero = signal(0);
  protected readonly tamanio = signal(TAMANIO_PAGINA_CLIENTES);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busquedaAplicada = signal('');
  protected readonly generandoPara = signal<string | null>(null);
  /** Código recién generado. Solo en memoria mientras el diálogo está abierto. */
  protected readonly codigoGenerado = signal<CodigoRecuperacion | null>(null);

  /** Evita que una respuesta lenta reemplace a una más reciente. */
  private consultaActual = 0;

  constructor() {
    this.busqueda.valueChanges
      .pipe(
        debounceTime(RETARDO_BUSQUEDA_MS),
        map((texto) => texto.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((texto) => this.aplicarBusqueda(texto));
  }

  /** La tabla pide una página (al iniciar, al paginar o al cambiar las filas por página). */
  protected alCargarPagina(evento: TableLazyLoadEvent): void {
    this.primero.set(evento.first ?? 0);
    this.tamanio.set(evento.rows ?? TAMANIO_PAGINA_CLIENTES);
    void this.cargar();
  }

  protected limpiarBusqueda(): void {
    this.busqueda.setValue('', { emitEvent: false });
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
    );
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

  /** Al cerrar el diálogo, el código se descarta: no se vuelve a mostrar. */
  protected descartarCodigo(): void {
    this.codigoGenerado.set(null);
  }
}
