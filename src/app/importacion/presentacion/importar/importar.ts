import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { FileSelectEvent, FileUpload, FileUploadModule } from 'primeng/fileupload';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';

import { fechaHoraEcuador } from '../../../compartido/dominio/fecha-ecuador';
import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { formatearTamano } from '../../../productos/dominio/producto';
import { EstadoImportacion } from '../../aplicacion/estado-importacion';
import {
  idDeImportacionDuplicada,
  mensajeDeErrorDeImportacion,
} from '../../aplicacion/mensajes-importacion';
import {
  Importacion,
  MAX_MB_PDF,
  resumenDeAnalisis,
  validarArchivoPdf,
} from '../../dominio/importacion';

interface OpcionMarca {
  readonly id: string;
  readonly nombre: string;
  readonly color: string;
}

/**
 * Pantalla «Importar catálogo (PDF)» (RF-PRO-01, D-49, D-55): elegir la marca (solo activas) y el PDF
 * (un archivo, hasta 60 MB), analizarlo y ver el resultado. El servidor lee el texto del PDF y crea
 * borradores que no llegan a los clientes hasta aprobarlos en la lista de revisión. El PDF no se
 * guarda en el panel.
 */
@Component({
  selector: 'app-importar',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    FileUploadModule,
    MessageModule,
    ProgressBarModule,
    SelectModule,
    TableModule,
  ],
  templateUrl: './importar.html',
  styleUrl: './importar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Importar implements OnInit {
  protected readonly estado = inject(EstadoImportacion);
  private readonly marcas = inject(EstadoMarcas);

  private readonly cargador = viewChild<FileUpload>('cargador');

  protected readonly maxMb = MAX_MB_PDF;
  protected readonly formatearTamano = formatearTamano;
  protected readonly fechaHora = fechaHoraEcuador;

  protected readonly marcaId = signal<string | null>(null);
  protected readonly archivo = signal<File | null>(null);
  protected readonly errorArchivo = signal<string | null>(null);
  protected readonly analizando = signal(false);
  protected readonly errorAnalisis = signal<string | null>(null);
  /** Id de la importación existente cuando el servidor responde 409. */
  protected readonly idExistente = signal<string | null>(null);
  protected readonly resultado = signal<Importacion | null>(null);

  protected readonly opcionesMarca = computed<OpcionMarca[]>(() =>
    this.marcas
      .marcas()
      .filter((m) => m.activa)
      .map((m) => ({ id: m.id, nombre: m.nombre, color: m.color })),
  );
  protected readonly sinMarcasActivas = computed(
    () => this.marcas.cargada() && this.opcionesMarca().length === 0,
  );
  protected readonly puedeAnalizar = computed(
    () => this.marcaId() !== null && this.archivo() !== null && !this.analizando(),
  );
  protected readonly resumen = computed(() => {
    const resultado = this.resultado();
    return resultado === null ? null : resumenDeAnalisis(resultado);
  });

  ngOnInit(): void {
    void this.marcas.asegurarCargada().catch(() => undefined);
    void this.estado.cargarRecientes();
  }

  protected alElegirMarca(id: string | null): void {
    this.marcaId.set(id);
    this.limpiarResultado();
  }

  /** `p-fileupload` entrega el archivo; se valida aquí (tipo, peso) y, si no sirve, se descarta. */
  protected alSeleccionar(evento: FileSelectEvent): void {
    const elegido = Array.from(evento.currentFiles ?? evento.files ?? [])[0] ?? null;
    this.limpiarResultado();
    if (elegido === null) {
      return;
    }
    const problema = validarArchivoPdf(elegido);
    if (problema !== null) {
      // `clear()` emite `onClear`, que borra el error: se limpia primero y luego se avisa.
      this.cargador()?.clear();
      this.archivo.set(null);
      this.errorArchivo.set(problema);
      return;
    }
    this.errorArchivo.set(null);
    this.archivo.set(elegido);
  }

  protected alQuitarArchivo(): void {
    this.archivo.set(null);
    this.errorArchivo.set(null);
    this.limpiarResultado();
  }

  protected async analizar(): Promise<void> {
    const archivo = this.archivo();
    const marcaId = this.marcaId();
    if (archivo === null || marcaId === null || this.analizando()) {
      return;
    }
    this.analizando.set(true);
    this.limpiarResultado();
    try {
      const importacion = await this.estado.analizar(archivo, marcaId);
      this.resultado.set(importacion);
      void this.estado.cargarRecientes();
    } catch (error) {
      this.idExistente.set(idDeImportacionDuplicada(error));
      this.errorAnalisis.set(mensajeDeErrorDeImportacion(error));
    } finally {
      this.analizando.set(false);
    }
  }

  private limpiarResultado(): void {
    this.resultado.set(null);
    this.errorAnalisis.set(null);
    this.idExistente.set(null);
  }
}
