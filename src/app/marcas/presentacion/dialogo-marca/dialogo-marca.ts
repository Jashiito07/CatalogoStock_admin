import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import { EstadoMarcas } from '../../aplicacion/estado-marcas';
import {
  erroresPorCampo,
  ErroresPorCampo,
  mensajeDeErrorDeMarca,
} from '../../aplicacion/mensajes-marcas';
import {
  CambiosMarca,
  COLOR_MARCA_PREDETERMINADO,
  esColorValido,
  LONGITUD_MAXIMA_NOMBRE,
  Marca,
  nombreRepetido,
  validarNombre,
} from '../../dominio/marca';
import { SelectorColor } from '../selector-color/selector-color';
import { VistaPreviaMarca } from '../vista-previa-marca/vista-previa-marca';

/**
 * Diálogo para crear o editar una marca (RF-PRO-04, D-43): nombre, color principal, color de
 * acento opcional, orden (solo al editar) y vista previa de la cabecera con su contraste.
 */
@Component({
  selector: 'app-dialogo-marca',
  imports: [
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    MessageModule,
    SelectorColor,
    VistaPreviaMarca,
  ],
  templateUrl: './dialogo-marca.html',
  styleUrl: './dialogo-marca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoMarca {
  private readonly estado = inject(EstadoMarcas);

  readonly visible = model(false);
  /** `null`: crear una marca nueva. */
  readonly marca = input<Marca | null>(null);
  readonly guardada = output<Marca | null>();

  protected readonly longitudMaximaNombre = LONGITUD_MAXIMA_NOMBRE;
  protected readonly nombre = signal('');
  protected readonly color = signal(COLOR_MARCA_PREDETERMINADO);
  protected readonly colorAcento = signal<string | null>(null);
  protected readonly orden = signal<number | null>(0);
  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresServidor = signal<ErroresPorCampo>({});
  protected readonly nombreTocado = signal(false);

  protected readonly titulo = computed(() => (this.marca() ? 'Editar marca' : 'Nueva marca'));

  protected readonly errorNombre = computed(() => {
    const local = validarNombre(this.nombre());
    if (local !== null) {
      return this.nombreTocado() ? local : null;
    }
    const otros = this.estado
      .marcas()
      .filter((m) => m.id !== this.marca()?.id)
      .map((m) => m.nombre);
    if (nombreRepetido(this.nombre(), otros)) {
      return 'Ya existe una marca con ese nombre.';
    }
    return this.erroresServidor()['nombre'] ?? null;
  });

  protected readonly formularioValido = computed(
    () =>
      validarNombre(this.nombre()) === null &&
      this.errorNombre() === null &&
      esColorValido(this.color()) &&
      (this.colorAcento() === null || esColorValido(this.colorAcento() ?? '')) &&
      (this.marca() === null || (this.orden() !== null && this.orden() !== undefined)),
  );

  constructor() {
    // Al abrir, el formulario se llena con la marca (o con valores nuevos).
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const marca = untracked(() => this.marca());
      this.nombre.set(marca?.nombre ?? '');
      this.color.set(marca?.color ?? COLOR_MARCA_PREDETERMINADO);
      this.colorAcento.set(marca?.colorAcento ?? null);
      this.orden.set(marca?.orden ?? 0);
      this.errorGeneral.set(null);
      this.erroresServidor.set({});
      this.nombreTocado.set(false);
    });
  }

  protected agregarAcento(): void {
    this.colorAcento.set(COLOR_MARCA_PREDETERMINADO);
  }

  protected quitarAcento(): void {
    this.colorAcento.set(null);
  }

  protected cancelar(): void {
    this.visible.set(false);
  }

  protected async guardar(): Promise<void> {
    this.nombreTocado.set(true);
    if (this.guardando() || !this.formularioValido()) {
      return;
    }
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.erroresServidor.set({});
    try {
      const existente = this.marca();
      if (existente === null) {
        const creada = await this.estado.crear({
          nombre: this.nombre().trim(),
          color: this.color(),
          colorAcento: this.colorAcento(),
        });
        this.guardada.emit(creada);
      } else {
        const cambios = this.cambiosDe(existente);
        const actualizada =
          Object.keys(cambios).length > 0 ? await this.estado.actualizar(existente.id, cambios) : null;
        this.guardada.emit(actualizada);
      }
      this.visible.set(false);
    } catch (error) {
      this.erroresServidor.set(erroresPorCampo(error));
      this.errorGeneral.set(mensajeDeErrorDeMarca(error));
    } finally {
      this.guardando.set(false);
    }
  }

  /** PATCH parcial: solo los campos que cambiaron. */
  private cambiosDe(existente: Marca): CambiosMarca {
    const cambios: { -readonly [K in keyof CambiosMarca]: CambiosMarca[K] } = {};
    const nombre = this.nombre().trim();
    if (nombre !== existente.nombre) {
      cambios.nombre = nombre;
    }
    if (this.color() !== existente.color) {
      cambios.color = this.color();
    }
    if (this.colorAcento() !== existente.colorAcento) {
      cambios.colorAcento = this.colorAcento();
    }
    const orden = this.orden();
    if (orden !== null && orden !== existente.orden) {
      cambios.orden = orden;
    }
    return cambios;
  }
}
