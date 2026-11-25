import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
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
import { senalPantallaMovil } from '../../../compartido/presentacion/pantalla/pantalla-movil';
import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { formatearTamano } from '../../../productos/dominio/producto';
import { EstadoImportacion } from '../../aplicacion/estado-importacion';
import {
  AVISO_SUBIDA_LENTA,
  idDeImportacionDuplicada,
  mensajeDeErrorDeAnalisis,
} from '../../aplicacion/mensajes-importacion';
import {
  Importacion,
  marcaSugeridaPorArchivo,
  MAX_MB_PDF,
  PASOS_IMPORTACION,
  resumenDeAnalisis,
  validarArchivoPdf,
} from '../../dominio/importacion';

interface OpcionMarca {
  readonly id: string;
  readonly nombre: string;
  readonly color: string;
}

/** Tiempo sin terminar de subir tras el cual se avisa de que la conexión está lenta. */
export const ESPERA_SUBIDA_LENTA_MS = 30_000;

/**
 * Pantalla «Importar catálogo (PDF)» (RF-PRO-01, D-49, D-55, D-61): pensada primero para el celular,
 * porque el Vendedor recibe el catálogo por WhatsApp. Tres pasos: elegir la marca, elegir el PDF
 * (un archivo, hasta 60 MB; el selector nativo del teléfono muestra Descargas y WhatsApp) y
 * analizarlo. El servidor lee el texto del PDF y crea borradores que no llegan a los clientes hasta
 * aprobarlos en la lista de revisión. El PDF no se guarda en el panel.
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
export class Importar implements OnInit, OnDestroy {
  protected readonly estado = inject(EstadoImportacion);
  private readonly marcas = inject(EstadoMarcas);

  private readonly cargador = viewChild<FileUpload>('cargador');

  protected readonly esMovil = senalPantallaMovil();
  protected readonly pasos = PASOS_IMPORTACION;
  protected readonly maxMb = MAX_MB_PDF;
  protected readonly formatearTamano = formatearTamano;
  protected readonly fechaHora = fechaHoraEcuador;

  protected readonly marcaId = signal<string | null>(null);
  /** `true` si la marca elegida salió del nombre del archivo y el Vendedor no la cambió. */
  protected readonly marcaSugerida = signal(false);
  protected readonly archivo = signal<File | null>(null);
  protected readonly errorArchivo = signal<string | null>(null);
  protected readonly analizando = signal(false);
  /** Mientras `true`, el PDF todavía se está subiendo; después el servidor lo analiza. */
  protected readonly subiendo = signal(false);
  protected readonly porcentaje = signal(0);
  protected readonly subidaLenta = signal(false);
  protected readonly avisoSubidaLenta = AVISO_SUBIDA_LENTA;
  protected readonly errorAnalisis = signal<string | null>(null);
  /** Id de la importación existente cuando el servidor responde 409. */
  protected readonly idExistente = signal<string | null>(null);
  protected readonly resultado = signal<Importacion | null>(null);

  private marcaEligidaPorElVendedor = false;
  private temporizadorLento: ReturnType<typeof setTimeout> | null = null;

  protected readonly opcionesMarca = computed<OpcionMarca[]>(() =>
    this.marcas
      .marcas()
      .filter((m) => m.activa)
      .map((m) => ({ id: m.id, nombre: m.nombre, color: m.color })),
  );
  protected readonly nombreMarcaElegida = computed(
    () => this.opcionesMarca().find((m) => m.id === this.marcaId())?.nombre ?? null,
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

  ngOnDestroy(): void {
    this.detenerTemporizador();
  }

  protected alElegirMarca(id: string | null): void {
    this.marcaEligidaPorElVendedor = id !== null;
    this.marcaSugerida.set(false);
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
    this.sugerirMarca(elegido);
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
    this.subiendo.set(true);
    this.porcentaje.set(0);
    this.subidaLenta.set(false);
    this.limpiarResultado();
    this.programarAvisoLento();
    try {
      const importacion = await this.estado.analizar(archivo, marcaId, (porcentaje) =>
        this.alProgresar(porcentaje),
      );
      this.resultado.set(importacion);
      void this.estado.cargarRecientes();
    } catch (error) {
      this.idExistente.set(idDeImportacionDuplicada(error));
      this.errorAnalisis.set(mensajeDeErrorDeAnalisis(error));
    } finally {
      this.detenerTemporizador();
      this.subiendo.set(false);
      this.subidaLenta.set(false);
      this.analizando.set(false);
    }
  }

  private alProgresar(porcentaje: number): void {
    this.porcentaje.set(porcentaje);
    if (porcentaje >= 100) {
      // El PDF ya está en el servidor: ahora solo falta esperar el análisis.
      this.subiendo.set(false);
      this.subidaLenta.set(false);
      this.detenerTemporizador();
    }
  }

  /** Preselecciona la marca por el nombre del archivo, sin pisar una marca elegida a mano. */
  private sugerirMarca(archivo: File): void {
    if (this.marcaEligidaPorElVendedor) {
      return;
    }
    const sugerida = marcaSugeridaPorArchivo(archivo.name, this.opcionesMarca());
    this.marcaSugerida.set(sugerida !== null);
    this.marcaId.set(sugerida);
  }

  private programarAvisoLento(): void {
    this.detenerTemporizador();
    this.temporizadorLento = setTimeout(() => {
      this.temporizadorLento = null;
      if (this.subiendo()) {
        this.subidaLenta.set(true);
      }
    }, ESPERA_SUBIDA_LENTA_MS);
  }

  private detenerTemporizador(): void {
    if (this.temporizadorLento !== null) {
      clearTimeout(this.temporizadorLento);
      this.temporizadorLento = null;
    }
  }

  private limpiarResultado(): void {
    this.resultado.set(null);
    this.errorAnalisis.set(null);
    this.idExistente.set(null);
  }
}
