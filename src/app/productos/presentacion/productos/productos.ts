import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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

import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { EstadoProductos } from '../../aplicacion/estado-productos';
import { mensajeDeErrorDeProducto } from '../../aplicacion/mensajes-productos';
import {
  BUSQUEDA_MAXIMA,
  Disponibilidad,
  DISPONIBILIDADES,
  etiquetaDisponibilidad,
  iconoDisponibilidad,
  formatearPrecio,
  imagenPrincipal,
  Producto,
  TAMANIOS_PAGINA,
} from '../../dominio/producto';
import { DialogoProducto } from '../dialogo-producto/dialogo-producto';

/** Espera tras la última tecla antes de buscar (evita una consulta por letra). */
export const RETARDO_BUSQUEDA_MS = 350;

export const MENSAJE_ELIMINAR =
  'Dejará de verse en el catálogo. El historial de los pedidos que lo incluyen se conserva.';

type SeveridadTag = 'success' | 'danger' | 'warn';
const SEVERIDAD_DISPONIBILIDAD: Readonly<Record<Disponibilidad, SeveridadTag>> = {
  DISPONIBLE: 'success',
  AGOTADO: 'danger',
  PENDIENTE_REPOSICION: 'warn',
};

interface OpcionFiltro<T> {
  readonly valor: T;
  readonly etiqueta: string;
}

/**
 * Sección «Productos» del panel (RF-PRO-01 a RF-PRO-05, RF-INV-03): `p-table` con paginación del
 * servidor, búsqueda con retardo, filtros por marca y disponibilidad, miniatura, marca con su
 * color, precio exacto (texto) y disponibilidad con cambio rápido. Crear y editar en un diálogo;
 * eliminar con confirmación (RNF-12).
 */
@Component({
  selector: 'app-productos',
  imports: [
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    SelectModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    MessageModule,
    ConfirmDialogModule,
    DialogoProducto,
  ],
  providers: [ConfirmationService],
  templateUrl: './productos.html',
  styleUrl: './productos.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Productos implements OnInit, OnDestroy {
  protected readonly estado = inject(EstadoProductos);
  private readonly marcas = inject(EstadoMarcas);
  private readonly confirmacion = inject(ConfirmationService);
  private readonly avisos = inject(MessageService);

  protected readonly busquedaMaxima = BUSQUEDA_MAXIMA;
  protected readonly tamaniosPagina = [...TAMANIOS_PAGINA];
  /** `p-table` pide una lista mutable. */
  protected readonly filasTabla = computed(() => [...this.estado.elementos()]);
  protected readonly etiquetaDisponibilidad = etiquetaDisponibilidad;
  protected readonly iconoDisponibilidad = iconoDisponibilidad;
  protected readonly formatearPrecio = formatearPrecio;
  protected readonly imagenPrincipal = imagenPrincipal;

  protected readonly texto = signal('');
  protected readonly marcaFiltro = signal<string | null>(null);
  protected readonly disponibilidadFiltro = signal<Disponibilidad | null>(null);
  protected readonly ocupado = signal<string | null>(null);
  protected readonly dialogoVisible = signal(false);
  protected readonly productoEnEdicion = signal<Producto | null>(null);

  protected readonly opcionesMarca = computed<OpcionFiltro<string>[]>(() =>
    this.marcas.marcas().map((m) => ({
      valor: m.id,
      etiqueta: m.activa ? m.nombre : `${m.nombre} (inactiva)`,
    })),
  );
  protected readonly opcionesDisponibilidad: OpcionFiltro<Disponibilidad>[] = DISPONIBILIDADES.map(
    (valor) => ({ valor, etiqueta: etiquetaDisponibilidad(valor) }),
  );

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private huboCambios = false;

  ngOnInit(): void {
    void this.marcas.asegurarCargada().catch(() => undefined);
    void this.estado.cargar();
  }

  ngOnDestroy(): void {
    this.cancelarTemporizador();
  }

  protected severidad(disponibilidad: Disponibilidad): SeveridadTag {
    return SEVERIDAD_DISPONIBILIDAD[disponibilidad];
  }

  protected urlMiniatura(producto: Producto): string | null {
    const imagen = this.imagenPrincipal(producto);
    return imagen === null ? null : this.estado.urlImagen(imagen.url);
  }

  // ── Filtros y paginación ─────────────────────────────────────────────────────────────

  /** La búsqueda espera a que el Vendedor deje de escribir. */
  protected alEscribir(texto: string): void {
    this.texto.set(texto);
    this.cancelarTemporizador();
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      void this.aplicarFiltros();
    }, RETARDO_BUSQUEDA_MS);
  }

  protected alElegirFiltro(): void {
    this.cancelarTemporizador();
    void this.aplicarFiltros();
  }

  protected limpiarFiltros(): void {
    this.cancelarTemporizador();
    this.texto.set('');
    this.marcaFiltro.set(null);
    this.disponibilidadFiltro.set(null);
    void this.estado.limpiarFiltros();
  }

  protected alCambiarPagina(evento: TableLazyLoadEvent): void {
    void this.estado.irA(evento.first ?? 0, evento.rows ?? this.estado.consulta().tamanio);
  }

  protected reintentar(): void {
    void this.estado.cargar();
  }

  private aplicarFiltros(): Promise<void> {
    const marcaId = this.marcaFiltro();
    const disponibilidad = this.disponibilidadFiltro();
    return this.estado.filtrar({
      busqueda: this.texto(),
      ...(marcaId !== null ? { marcaId } : {}),
      ...(disponibilidad !== null ? { disponibilidad } : {}),
    });
  }

  private cancelarTemporizador(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  // ── Crear y editar ───────────────────────────────────────────────────────────────────

  protected nuevo(): void {
    this.productoEnEdicion.set(null);
    this.dialogoVisible.set(true);
  }

  protected editar(producto: Producto): void {
    this.productoEnEdicion.set(producto);
    this.dialogoVisible.set(true);
  }

  protected alCambiarDialogo(visible: boolean): void {
    this.dialogoVisible.set(visible);
    if (!visible && this.huboCambios) {
      this.huboCambios = false;
      void this.estado.cargar();
    }
  }

  protected marcarCambios(): void {
    this.huboCambios = true;
  }

  protected alGuardar(producto: Producto): void {
    this.avisos.add({
      severity: 'success',
      summary: this.productoEnEdicion() === null ? 'Producto creado' : 'Producto actualizado',
      detail: producto.nombre,
      life: 3000,
    });
  }

  // ── Disponibilidad rápida y eliminar ────────────────────────────────────────────────

  /** RF-PRO-05, CA-07: cambia la disponibilidad desde la tabla; la fila refleja la respuesta. */
  async cambiarDisponibilidad(producto: Producto, disponibilidad: Disponibilidad): Promise<void> {
    if (disponibilidad === producto.disponibilidad || this.ocupado() !== null) {
      return;
    }
    this.ocupado.set(producto.id);
    try {
      await this.estado.cambiarDisponibilidad(producto.id, disponibilidad);
      this.avisos.add({
        severity: 'success',
        summary: 'Disponibilidad actualizada',
        detail: `${producto.nombre}: ${etiquetaDisponibilidad(disponibilidad)}`,
        life: 3000,
      });
    } catch (error) {
      this.avisarError('No se pudo cambiar la disponibilidad', error);
      // Vuelve a consultar para que la fila no muestre un valor que el servidor rechazó.
      await this.estado.cargar();
    } finally {
      this.ocupado.set(null);
    }
  }

  /** RNF-12: eliminar siempre pide confirmación. */
  protected pedirEliminar(producto: Producto): void {
    this.confirmacion.confirm({
      header: `Eliminar ${producto.nombre}`,
      message: MENSAJE_ELIMINAR,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancelar',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => void this.eliminar(producto),
    });
  }

  async eliminar(producto: Producto): Promise<void> {
    if (this.ocupado() !== null) {
      return;
    }
    this.ocupado.set(producto.id);
    try {
      await this.estado.eliminar(producto.id);
      this.avisos.add({
        severity: 'success',
        summary: 'Producto eliminado',
        detail: producto.nombre,
        life: 3000,
      });
    } catch (error) {
      this.avisarError('No se pudo eliminar el producto', error);
      await this.estado.cargar();
    } finally {
      this.ocupado.set(null);
    }
  }

  private avisarError(resumen: string, error: unknown): void {
    this.avisos.add({
      severity: 'error',
      summary: resumen,
      detail: mensajeDeErrorDeProducto(error),
      life: 6000,
    });
  }
}
