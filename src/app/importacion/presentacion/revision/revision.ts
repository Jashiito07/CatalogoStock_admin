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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import {
  BUSQUEDA_MAXIMA,
  Disponibilidad,
  etiquetaDisponibilidad,
} from '../../../productos/dominio/producto';
import { EstadoImportacion } from '../../aplicacion/estado-importacion';
import { mensajeDeErrorDeImportacion } from '../../aplicacion/mensajes-importacion';
import {
  advertenciasDeRevision,
  advertenciasInformativas,
  Borrador,
  descripcionDeFallidos,
  EstadoBorrador,
  ESTADOS_BORRADOR,
  etiquetaEstadoBorrador,
  infoAdvertencia,
  MAXIMO_IDS_POR_LOTE,
  precioDeBorrador,
  puedeAprobar,
  puedeEditar,
  ResumenLote,
  resumenDeAnalisis,
  TAMANIOS_PAGINA_BORRADORES,
  tieneSinPrecio,
} from '../../dominio/importacion';
import { DialogoBorrador } from '../dialogo-borrador/dialogo-borrador';

/** Espera tras la última tecla antes de buscar (evita una consulta por letra). */
export const RETARDO_BUSQUEDA_MS = 350;

type SeveridadTag = 'success' | 'danger' | 'warn';
const SEVERIDAD_DISPONIBILIDAD: Readonly<Record<Disponibilidad, SeveridadTag>> = {
  DISPONIBLE: 'success',
  AGOTADO: 'danger',
  PENDIENTE_REPOSICION: 'warn',
};

export interface AvisoLote {
  readonly accion: 'aprobados' | 'descartados';
  readonly cantidad: number;
  /** «2 sin precio, 1 que ya no estaban pendientes»; vacío si todo salió bien. */
  readonly omitidos: string;
}

/**
 * Lista de revisión de borradores (RF-PRO-01, RF-PRO-02, D-55): `p-table` con paginación del
 * servidor, filtros por estado, «solo con advertencias», búsqueda con retardo y página del PDF.
 * Edición en un diálogo; «Aprobar seleccionados» y «Descartar» con confirmación (RNF-12). La API
 * decide qué se aprueba: el panel solo evita enviar los borradores sin precio y muestra el resultado
 * de cada uno. Los borradores no llegan a los clientes hasta aprobarse.
 */
@Component({
  selector: 'app-revision',
  imports: [
    FormsModule,
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    CheckboxModule,
    SelectButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    MessageModule,
    ConfirmDialogModule,
    DialogoBorrador,
  ],
  providers: [ConfirmationService],
  templateUrl: './revision.html',
  styleUrl: './revision.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Revision implements OnInit, OnDestroy {
  protected readonly estado = inject(EstadoImportacion);
  private readonly marcas = inject(EstadoMarcas);
  private readonly ruta = inject(ActivatedRoute);
  private readonly confirmacion = inject(ConfirmationService);
  private readonly avisos = inject(MessageService);

  protected readonly busquedaMaxima = BUSQUEDA_MAXIMA;
  protected readonly tamaniosPagina = [...TAMANIOS_PAGINA_BORRADORES];
  protected readonly filasTabla = computed(() => [...this.estado.elementos()]);
  protected readonly etiquetaDisponibilidad = etiquetaDisponibilidad;
  protected readonly precioDeBorrador = precioDeBorrador;
  protected readonly infoAdvertencia = infoAdvertencia;
  protected readonly advertenciasDeRevision = advertenciasDeRevision;
  protected readonly advertenciasInformativas = advertenciasInformativas;
  protected readonly puedeEditar = puedeEditar;
  protected readonly tieneSinPrecio = tieneSinPrecio;
  protected readonly resumenDeAnalisis = resumenDeAnalisis;

  protected readonly estadoFiltro = signal<EstadoBorrador>('PENDIENTE');
  protected readonly soloAdvertencias = signal(false);
  protected readonly texto = signal('');
  protected readonly paginaPdf = signal('');
  protected readonly errorPaginaPdf = signal<string | null>(null);

  protected readonly seleccion = signal<readonly Borrador[]>([]);
  protected readonly ocupado = signal(false);
  protected readonly aviso = signal<AvisoLote | null>(null);
  protected readonly dialogoVisible = signal(false);
  protected readonly enEdicion = signal<Borrador | null>(null);

  /** Estados con su contador: «Pendientes (143)». */
  protected readonly opcionesEstado = computed(() => {
    const totales = this.estado.importacion()?.totales;
    const cuenta: Readonly<Record<EstadoBorrador, number | null>> = {
      PENDIENTE: totales?.pendientes ?? null,
      APROBADO: totales?.aprobados ?? null,
      DESCARTADO: totales?.descartados ?? null,
    };
    return ESTADOS_BORRADOR.map((valor) => ({
      valor,
      etiqueta: `${etiquetaEstadoBorrador(valor)}${cuenta[valor] === null ? '' : ` (${cuenta[valor]})`}`,
    }));
  });

  protected readonly seleccionables = computed(() => this.estadoFiltro() === 'PENDIENTE');
  protected readonly aprobables = computed(() => this.seleccion().filter(puedeAprobar));
  protected readonly seleccionSinPrecio = computed(
    () => this.seleccion().filter((b) => tieneSinPrecio(b)).length,
  );

  private temporizador: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.marcas.asegurarCargada().catch(() => undefined);
    const id = this.ruta.snapshot.paramMap.get('id');
    if (id !== null) {
      void this.estado.abrir(id);
    }
  }

  ngOnDestroy(): void {
    this.cancelarTemporizador();
  }

  protected severidad(disponibilidad: Disponibilidad): SeveridadTag {
    return SEVERIDAD_DISPONIBILIDAD[disponibilidad];
  }

  protected nombreMarca(marcaId: string): string {
    return this.marcas.marcas().find((m) => m.id === marcaId)?.nombre ?? '—';
  }

  // ── Filtros y paginación ─────────────────────────────────────────────────────────────

  protected alElegirEstado(valor: EstadoBorrador | null): void {
    if (valor === null) {
      return; // el selector no admite quedar vacío
    }
    this.estadoFiltro.set(valor);
    this.alElegirFiltro();
  }

  protected alEscribir(texto: string): void {
    this.texto.set(texto);
    this.programarFiltros();
  }

  protected alEscribirPaginaPdf(texto: string): void {
    this.paginaPdf.set(texto);
    const limpio = texto.trim();
    if (limpio !== '' && !/^[1-9]\d{0,5}$/.test(limpio)) {
      this.errorPaginaPdf.set('Escribe un número de página, por ejemplo 12.');
      return;
    }
    this.errorPaginaPdf.set(null);
    this.programarFiltros();
  }

  protected alElegirFiltro(): void {
    this.cancelarTemporizador();
    void this.aplicarFiltros();
  }

  protected limpiarFiltros(): void {
    this.cancelarTemporizador();
    this.texto.set('');
    this.paginaPdf.set('');
    this.errorPaginaPdf.set(null);
    this.soloAdvertencias.set(false);
    void this.aplicarFiltros();
  }

  protected readonly hayFiltrosActivos = computed(
    () => this.soloAdvertencias() || this.texto() !== '' || this.paginaPdf() !== '',
  );

  protected alCambiarPagina(evento: TableLazyLoadEvent): void {
    this.seleccion.set([]);
    void this.estado.irA(evento.first ?? 0, evento.rows ?? this.estado.consulta().tamanio);
  }

  protected reintentar(): void {
    const id = this.ruta.snapshot.paramMap.get('id');
    if (this.estado.importacion() === null && id !== null) {
      void this.estado.abrir(id);
    } else {
      void this.estado.cargar();
    }
  }

  private programarFiltros(): void {
    this.cancelarTemporizador();
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      void this.aplicarFiltros();
    }, RETARDO_BUSQUEDA_MS);
  }

  private aplicarFiltros(): Promise<void> {
    this.seleccion.set([]);
    const pagina = this.paginaPdf().trim();
    return this.estado.filtrar({
      estado: this.estadoFiltro(),
      busqueda: this.texto(),
      ...(this.soloAdvertencias() ? { conAdvertencias: true } : {}),
      ...(/^[1-9]\d{0,5}$/.test(pagina) ? { paginaPdf: Number(pagina) } : {}),
    });
  }

  private cancelarTemporizador(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }

  // ── Editar ───────────────────────────────────────────────────────────────────────────

  protected editar(borrador: Borrador): void {
    this.enEdicion.set(borrador);
    this.dialogoVisible.set(true);
  }

  protected alGuardar(borrador: Borrador): void {
    this.seleccion.set([]);
    this.avisos.add({
      severity: 'success',
      summary: 'Borrador actualizado',
      detail: borrador.nombre,
      life: 3000,
    });
  }

  protected alNoEditable(): void {
    void this.estado.cargar();
    void this.estado.refrescarImportacion();
  }

  // ── Aprobar y descartar (RNF-12: siempre con confirmación) ───────────────────────────

  protected pedirAprobar(): void {
    const aprobables = this.aprobables();
    if (aprobables.length === 0 || this.ocupado()) {
      return;
    }
    const sinPrecio = this.seleccionSinPrecio();
    const omitidos =
      sinPrecio > 0
        ? ` ${sinPrecio === 1 ? '1 borrador sin precio no se aprobará' : `${sinPrecio} borradores sin precio no se aprobarán`}: escribe su precio primero.`
        : '';
    this.confirmacion.confirm({
      header: 'Aprobar borradores',
      message: `Se crearán ${aprobables.length === 1 ? '1 producto' : `${aprobables.length} productos`} y se publicarán en el catálogo de tus clientes.${omitidos}`,
      icon: 'pi pi-check-circle',
      acceptLabel: 'Aprobar',
      rejectLabel: 'Cancelar',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => void this.aprobar(aprobables),
    });
  }

  protected pedirDescartar(): void {
    const pendientes = this.seleccion().filter(puedeEditar);
    if (pendientes.length === 0 || this.ocupado()) {
      return;
    }
    this.confirmacion.confirm({
      header: 'Descartar borradores',
      message: `Se descartarán ${pendientes.length === 1 ? '1 borrador' : `${pendientes.length} borradores`}. No llegarán a los clientes y no se pueden recuperar.`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Descartar',
      acceptButtonProps: { severity: 'danger' },
      rejectLabel: 'Cancelar',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => void this.descartar(pendientes),
    });
  }

  async aprobar(borradores: readonly Borrador[]): Promise<void> {
    await this.ejecutarLote(borradores, 'aprobados', (ids) => this.estado.aprobar(ids));
  }

  async descartar(borradores: readonly Borrador[]): Promise<void> {
    await this.ejecutarLote(borradores, 'descartados', (ids) => this.estado.descartar(ids));
  }

  private async ejecutarLote(
    borradores: readonly Borrador[],
    accion: AvisoLote['accion'],
    enviar: (ids: readonly string[]) => Promise<ResumenLote>,
  ): Promise<void> {
    if (this.ocupado()) {
      return;
    }
    this.ocupado.set(true);
    this.aviso.set(null);
    try {
      const ids = borradores.map((b) => b.id).slice(0, MAXIMO_IDS_POR_LOTE);
      const resumen = await enviar(ids);
      this.seleccion.set([]);
      this.aviso.set({
        accion,
        cantidad: resumen.correctos.length,
        omitidos: descripcionDeFallidos(resumen.fallidos),
      });
      this.avisos.add({
        severity: resumen.fallidos.length > 0 ? 'warn' : 'success',
        summary: accion === 'aprobados' ? 'Borradores aprobados' : 'Borradores descartados',
        detail:
          `${resumen.correctos.length} ${accion}` +
          (resumen.fallidos.length > 0 ? `; ${resumen.fallidos.length} no se pudieron procesar` : ''),
        life: 4000,
      });
    } catch (error) {
      this.avisos.add({
        severity: 'error',
        summary: accion === 'aprobados' ? 'No se pudo aprobar' : 'No se pudo descartar',
        detail: mensajeDeErrorDeImportacion(error),
        life: 6000,
      });
      void this.estado.cargar();
    } finally {
      this.ocupado.set(false);
    }
  }
}
