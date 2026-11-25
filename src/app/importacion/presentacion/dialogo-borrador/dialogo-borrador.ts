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
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { senalPantallaMovil } from '../../../compartido/presentacion/pantalla/pantalla-movil';
import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { erroresPorCampo, ErroresPorCampo } from '../../../marcas/aplicacion/mensajes-marcas';
import {
  Disponibilidad,
  DISPONIBILIDADES,
  etiquetaDisponibilidad,
  LONGITUD_MAXIMA_DESCRIPCION,
  LONGITUD_MAXIMA_NOMBRE,
  validarDescripcion,
  validarNombre,
  validarPrecio,
} from '../../../productos/dominio/producto';
import { EstadoImportacion } from '../../aplicacion/estado-importacion';
import { mensajeDeErrorDeImportacion } from '../../aplicacion/mensajes-importacion';
import {
  Borrador,
  cambiosDeBorrador,
  precioDeBorrador,
} from '../../dominio/importacion';

interface OpcionMarca {
  readonly id: string;
  readonly nombre: string;
  readonly inactiva: boolean;
}

const OPCIONES_DISPONIBILIDAD = DISPONIBILIDADES.map((valor) => ({
  valor,
  etiqueta: etiquetaDisponibilidad(valor),
}));

/**
 * Edición de un borrador en un diálogo (RF-PRO-01, RF-PRO-02): nombre, descripción, precio con 2
 * decimales (texto exacto), marca activa y disponibilidad. Solo se envían los campos cambiados. Los
 * errores 400 se muestran junto a cada campo y `BORRADOR_NO_EDITABLE` como aviso general.
 */
@Component({
  selector: 'app-dialogo-borrador',
  imports: [
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    MessageModule,
  ],
  templateUrl: './dialogo-borrador.html',
  styleUrl: './dialogo-borrador.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoBorrador {
  private readonly estado = inject(EstadoImportacion);
  private readonly marcasEstado = inject(EstadoMarcas);

  readonly visible = model(false);
  readonly borrador = input<Borrador | null>(null);
  /** El borrador se guardó en el servidor. */
  readonly guardado = output<Borrador>();
  /** El servidor dijo que ya no es editable: la lista debe refrescarse. */
  readonly noEditable = output<void>();

  protected readonly longitudMaximaNombre = LONGITUD_MAXIMA_NOMBRE;
  protected readonly longitudMaximaDescripcion = LONGITUD_MAXIMA_DESCRIPCION;
  protected readonly opcionesDisponibilidad = OPCIONES_DISPONIBILIDAD;
  protected readonly precioDeBorrador = precioDeBorrador;

  /** En el celular el diálogo ocupa toda la pantalla (D-61). */
  protected readonly esMovil = senalPantallaMovil();
  protected readonly estiloDialogo = computed(() =>
    this.esMovil()
      ? {
          width: '100vw',
          height: '100dvh',
          'max-width': '100vw',
          'max-height': '100dvh',
          margin: '0',
          'border-radius': '0',
        }
      : { width: '40rem', 'max-width': '96vw' },
  );
  protected readonly estiloContenido = computed(() =>
    this.esMovil() ? { flex: '1 1 auto', 'max-height': 'none' } : { 'max-height': '75vh' },
  );

  protected readonly nombre = signal('');
  protected readonly descripcion = signal('');
  protected readonly precio = signal('');
  protected readonly marcaId = signal<string | null>(null);
  protected readonly disponibilidad = signal<Disponibilidad>('DISPONIBLE');

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresServidor = signal<ErroresPorCampo>({});
  protected readonly tocado = signal({ nombre: false, precio: false });

  /** Solo marcas activas; la marca actual del borrador se agrega (deshabilitada) si está inactiva. */
  protected readonly opcionesMarca = computed<OpcionMarca[]>(() => {
    const opciones: OpcionMarca[] = this.marcasEstado
      .marcas()
      .filter((m) => m.activa)
      .map((m) => ({ id: m.id, nombre: m.nombre, inactiva: false }));
    const actual = this.borrador()?.marcaId;
    if (actual && !opciones.some((o) => o.id === actual)) {
      const marca = this.marcasEstado.marcas().find((m) => m.id === actual);
      opciones.push({ id: actual, nombre: marca?.nombre ?? 'Marca desconocida', inactiva: true });
    }
    return opciones;
  });

  /** Precio: obligatorio si el borrador ya tenía uno; si no, puede quedar vacío (sin cambio). */
  private readonly errorLocalPrecio = computed<string | null>(() => {
    const texto = this.precio().trim();
    if (texto === '' && this.borrador()?.precio === null) {
      return null;
    }
    return validarPrecio(texto);
  });

  protected readonly errorNombre = computed(
    () =>
      (this.tocado().nombre ? validarNombre(this.nombre()) : null) ??
      this.erroresServidor()['nombre'] ??
      null,
  );
  protected readonly errorPrecio = computed(
    () =>
      (this.tocado().precio ? this.errorLocalPrecio() : null) ??
      this.erroresServidor()['precio'] ??
      null,
  );
  protected readonly errorDescripcion = computed(
    () => validarDescripcion(this.descripcion()) ?? this.erroresServidor()['descripcion'] ?? null,
  );
  protected readonly errorMarca = computed(() => this.erroresServidor()['marcaId'] ?? null);

  protected readonly formularioValido = computed(
    () =>
      validarNombre(this.nombre()) === null &&
      this.errorLocalPrecio() === null &&
      validarDescripcion(this.descripcion()) === null &&
      this.marcaId() !== null,
  );

  constructor() {
    // Al abrir, el formulario se llena con el borrador.
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const borrador = untracked(() => this.borrador());
      untracked(() => this.reiniciar(borrador));
    });
  }

  private reiniciar(borrador: Borrador | null): void {
    this.nombre.set(borrador?.nombre ?? '');
    this.descripcion.set(borrador?.descripcion ?? '');
    this.precio.set(borrador?.precio ?? '');
    this.marcaId.set(borrador?.marcaId ?? null);
    this.disponibilidad.set(borrador?.disponibilidad ?? 'DISPONIBLE');
    this.errorGeneral.set(null);
    this.erroresServidor.set({});
    this.tocado.set({ nombre: false, precio: false });
  }

  protected tocar(campo: 'nombre' | 'precio'): void {
    this.tocado.update((t) => ({ ...t, [campo]: true }));
  }

  protected cancelar(): void {
    this.visible.set(false);
  }

  protected async guardar(): Promise<void> {
    const original = this.borrador();
    const marcaId = this.marcaId();
    this.tocado.set({ nombre: true, precio: true });
    if (original === null || marcaId === null || this.guardando() || !this.formularioValido()) {
      return;
    }
    const cambios = cambiosDeBorrador(original, {
      nombre: this.nombre(),
      descripcion: this.descripcion(),
      precio: this.precio(),
      marcaId,
      disponibilidad: this.disponibilidad(),
    });
    if (Object.keys(cambios).length === 0) {
      this.visible.set(false);
      return;
    }
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.erroresServidor.set({});
    try {
      const actualizado = await this.estado.editar(original.id, cambios);
      this.guardado.emit(actualizado);
      this.visible.set(false);
    } catch (error) {
      const porCampo = erroresPorCampo(error);
      this.erroresServidor.set(porCampo);
      if (typeof error === 'object' && error !== null && 'codigo' in error) {
        if (error.codigo === 'BORRADOR_NO_EDITABLE') {
          this.noEditable.emit();
        }
        if (error.codigo === 'MARCA_INACTIVA') {
          this.erroresServidor.set({ marcaId: mensajeDeErrorDeImportacion(error) });
        }
      }
      this.errorGeneral.set(
        Object.keys(porCampo).length > 0
          ? 'Revisa los campos marcados e inténtalo de nuevo.'
          : mensajeDeErrorDeImportacion(error),
      );
    } finally {
      this.guardando.set(false);
    }
  }
}
