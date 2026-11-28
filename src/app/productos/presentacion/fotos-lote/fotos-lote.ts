import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { FileSelectEvent, FileUpload, FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { EstadoFotosLote, ProgresoFoto } from '../../aplicacion/estado-fotos-lote';
import {
  AvisoFoto,
  FotoRevisada,
  minutosEstimados,
  SUBIDAS_POR_MINUTO,
  textoAviso,
} from '../../dominio/fotos-lote';
import { formatearTamano } from '../../dominio/producto';

interface OpcionProducto {
  readonly id: string;
  readonly etiqueta: string;
}

type Severidad = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

/** Avisos que impiden subir la foto (los demás se resuelven eligiendo el producto). */
const AVISOS_GRAVES: readonly AvisoFoto[] = ['ARCHIVO_NO_VALIDO', 'DUPLICADA', 'SIN_CUPO'];

const ETIQUETAS_PROGRESO: Readonly<Record<ProgresoFoto['estado'], { texto: string; severidad: Severidad; icono: string }>> = {
  PENDIENTE: { texto: 'En espera', severidad: 'secondary', icono: 'pi pi-clock' },
  SUBIENDO: { texto: 'Subiendo…', severidad: 'info', icono: 'pi pi-spin pi-spinner' },
  SUBIDA: { texto: 'Subida', severidad: 'success', icono: 'pi pi-check' },
  FALLIDA: { texto: 'No se subió', severidad: 'danger', icono: 'pi pi-times' },
};

/** Más filas que esto se paginan para que la pantalla siga ágil en el celular. */
export const FILAS_POR_PAGINA = 25;

/**
 * «Subir fotos en lote» (RF-PRO-01, D-46, D-62; DEC-07): el Vendedor elige o arrastra muchas
 * fotos; se emparejan con los productos por el código del nombre del archivo; revisa, corrige el
 * producto o quita fotos, y confirma. La subida va a 30 por minuto, con progreso, detener y
 * reintentar. Componentes PrimeNG (D-06); en el celular la tabla se apila (D-61).
 */
@Component({
  selector: 'app-fotos-lote',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    ConfirmDialogModule,
    FileUploadModule,
    MessageModule,
    ProgressBarModule,
    SelectModule,
    TableModule,
    TagModule,
  ],
  providers: [EstadoFotosLote, ConfirmationService],
  templateUrl: './fotos-lote.html',
  styleUrl: './fotos-lote.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FotosLote implements OnInit, OnDestroy {
  protected readonly estado = inject(EstadoFotosLote);
  private readonly confirmacion = inject(ConfirmationService);
  private readonly avisos = inject(MessageService);
  private readonly cargador = viewChild<FileUpload>('cargador');
  private readonly vistas = new Map<number, string>();

  protected readonly formatearTamano = formatearTamano;
  protected readonly textoAviso = textoAviso;
  protected readonly subidasPorMinuto = SUBIDAS_POR_MINUTO;
  protected readonly filasPorPagina = FILAS_POR_PAGINA;

  /** Copias modificables: `p-table` y `p-select` no aceptan listas de solo lectura. */
  protected readonly filas = computed<FotoRevisada[]>(() => [...this.estado.revisadas()]);
  protected readonly resumen = this.estado.resumen;

  protected readonly opcionesProducto = computed<OpcionProducto[]>(() =>
    [...this.estado.productos()]
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((p) => ({ id: p.id, etiqueta: p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre })),
  );

  protected readonly porcentaje = computed(() => {
    const total = this.estado.totalLote();
    const hechas = this.estado.subidas() + this.estado.fallidas();
    return total === 0 ? 0 : Math.round((hechas / total) * 100);
  });

  protected readonly pendientes = computed(
    () => [...this.estado.progreso().values()].filter((p) => p.estado === 'PENDIENTE').length,
  );

  ngOnInit(): void {
    void this.estado.cargarProductos();
  }

  ngOnDestroy(): void {
    // Si el Vendedor sale de la pantalla, el lote se detiene tras la foto en curso.
    this.estado.detener();
    this.liberarVistas();
  }

  protected alSeleccionar(evento: FileSelectEvent): void {
    this.estado.agregar(Array.from(evento.currentFiles ?? evento.files ?? []));
    this.cargador()?.clear();
  }

  /** Vista previa local de la foto (no sale del navegador hasta que se sube). */
  protected vistaPrevia(fila: FotoRevisada): string | null {
    if (fila.errorArchivo !== null) {
      return null;
    }
    const existente = this.vistas.get(fila.clave);
    if (existente !== undefined) {
      return existente;
    }
    const archivo = this.estado.archivo(fila.clave);
    if (archivo === undefined || typeof URL.createObjectURL !== 'function') {
      return null;
    }
    const url = URL.createObjectURL(archivo);
    this.vistas.set(fila.clave, url);
    return url;
  }

  protected severidadAviso(aviso: AvisoFoto): Severidad {
    return AVISOS_GRAVES.includes(aviso) ? 'danger' : 'warn';
  }

  protected progresoDe(fila: FotoRevisada): { texto: string; severidad: Severidad; icono: string; mensaje?: string } | null {
    const progreso = this.estado.progreso().get(fila.clave);
    return progreso ? { ...ETIQUETAS_PROGRESO[progreso.estado], mensaje: progreso.mensaje } : null;
  }

  protected confirmarSubida(): void {
    const { listas, productos } = this.resumen();
    if (listas === 0) {
      return;
    }
    this.confirmacion.confirm({
      header: 'Subir fotos',
      icon: 'pi pi-images',
      message:
        `Se subirán ${listas} ${listas === 1 ? 'foto' : 'fotos'} a ${productos} ` +
        `${productos === 1 ? 'producto' : 'productos'}. Tardará unos ${minutosEstimados(listas)} min ` +
        `(${SUBIDAS_POR_MINUTO} por minuto). Mantén esta pantalla abierta hasta que termine.`,
      acceptLabel: 'Subir',
      rejectLabel: 'Seguir revisando',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => void this.subir(),
    });
  }

  protected async subir(): Promise<void> {
    await this.estado.subir();
    this.avisarResultado();
  }

  protected async reintentar(): Promise<void> {
    await this.estado.reintentarFallidas();
    this.avisarResultado();
  }

  protected async nuevoLote(): Promise<void> {
    this.liberarVistas();
    await this.estado.nuevoLote();
  }

  private avisarResultado(): void {
    const subidas = this.estado.subidas();
    const fallidas = this.estado.fallidas();
    if (fallidas === 0 && this.pendientes() === 0) {
      this.avisos.add({
        severity: 'success',
        summary: 'Fotos subidas',
        detail: `Se subieron ${subidas} ${subidas === 1 ? 'foto' : 'fotos'}.`,
      });
    } else if (fallidas > 0) {
      this.avisos.add({
        severity: 'warn',
        summary: 'Algunas fotos no se subieron',
        detail: `Subidas: ${subidas}. Con error: ${fallidas}. Revisa el motivo en la lista y reinténtalas.`,
      });
    }
  }

  private liberarVistas(): void {
    if (typeof URL.revokeObjectURL === 'function') {
      for (const url of this.vistas.values()) {
        URL.revokeObjectURL(url);
      }
    }
    this.vistas.clear();
  }
}
