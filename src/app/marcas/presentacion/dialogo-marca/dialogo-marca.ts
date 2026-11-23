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
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import { EstadoMarcas } from '../../aplicacion/estado-marcas';
import {
  erroresPorCampo,
  ErroresPorCampo,
  mensajeDeErrorDeMarca,
} from '../../aplicacion/mensajes-marcas';
import {
  CambiosMarca,
  CLAVE_NUEVA_MARCA,
  COLOR_MARCA_PREDETERMINADO,
  buscarMarcaConocida,
  esColorValido,
  estanTodasAgregadas,
  LONGITUD_MAXIMA_NOMBRE,
  Marca,
  mismaMarcaConocida,
  nombreRepetido,
  OpcionMarca,
  opcionesDeMarcas,
  validarNombre,
} from '../../dominio/marca';
import { SelectorColor } from '../selector-color/selector-color';
import { VistaPreviaMarca } from '../vista-previa-marca/vista-previa-marca';

/** Opción del combobox con el texto extra que usa el filtro. */
interface OpcionCombo extends OpcionMarca {
  readonly busqueda: string;
}

interface GrupoOpciones {
  readonly etiqueta: string;
  readonly items: OpcionCombo[];
}

/**
 * Diálogo para crear o editar una marca (RF-PRO-04, RF-PRO-06, D-43, D-56).
 *
 * - Crear: un combobox con las marcas conocidas (`GET /marcas/sugeridas`; las ya agregadas
 *   aparecen deshabilitadas) y, al final, «Agregar nueva marca…» con nombre y colores libres.
 *   Una conocida fija el nombre y los colores oficiales.
 * - Editar: sin combobox; el nombre y los colores de una conocida siguen protegidos.
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
    SelectModule,
    TagModule,
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
  protected readonly esCreacion = computed(() => this.marca() === null);

  /** Id de la nota que explica por qué los colores están bloqueados (aria-describedby). */
  protected readonly idNotaColores = 'nota-colores-fijos';

  // --- Combobox de marcas (solo al crear; D-43, D-56) -------------------------------------------

  /** Elección del combobox: `null` (nada), el nombre de una conocida o `CLAVE_NUEVA_MARCA`. */
  protected readonly eleccion = signal<string | null>(null);
  protected readonly cargandoSugeridas = this.estado.cargandoSugeridas;
  protected readonly falloSugeridas = this.estado.falloSugeridas;

  private readonly opciones = computed(() =>
    opcionesDeMarcas(this.estado.sugeridas(), this.estado.marcas()),
  );
  protected readonly todasAgregadas = computed(() => estanTodasAgregadas(this.opciones()));

  /** Grupos del combobox: las conocidas y, al final y separada, «Agregar nueva marca…». */
  protected readonly grupos = computed<GrupoOpciones[]>(() => {
    const conocidas: OpcionCombo[] = this.opciones().map((o) => ({ ...o, busqueda: '' }));
    const nueva: OpcionCombo = {
      clave: CLAVE_NUEVA_MARCA,
      nombre: 'Agregar nueva marca…',
      color: '',
      colorAcento: null,
      yaAgregada: false,
      busqueda: 'agregar nueva marca otra propia',
    };
    return [
      ...(conocidas.length > 0 ? [{ etiqueta: 'Marcas conocidas', items: conocidas }] : []),
      { etiqueta: 'Otra marca', items: [nueva] },
    ];
  });

  protected readonly claveNueva = CLAVE_NUEVA_MARCA;
  protected readonly esNueva = computed(
    () => this.esCreacion() && this.eleccion() === CLAVE_NUEVA_MARCA,
  );

  /** Conocida elegida en el combobox (nombre y colores oficiales fijados). */
  private readonly sugeridaElegida = computed(() => {
    const clave = this.eleccion();
    if (!this.esCreacion() || clave === null || clave === CLAVE_NUEVA_MARCA) {
      return null;
    }
    return this.estado.sugeridas().find((s) => s.nombre === clave) ?? null;
  });

  /** Al crear hay que elegir en el combobox antes de mostrar el resto del formulario. */
  protected readonly formularioVisible = computed(
    () => !this.esCreacion() || this.eleccion() !== null,
  );

  /** Nombre que se valida, se previsualiza y se envía: el oficial si se eligió una conocida. */
  protected readonly nombreEfectivo = computed(
    () => this.sugeridaElegida()?.nombre ?? this.nombre(),
  );

  // --- Colores fijos (D-56) ---------------------------------------------------------------------

  /** Marca conocida a la que pertenece la marca que se edita (sus colores no cambian, D-56). */
  private readonly conocidaOriginal = computed(() => {
    const existente = this.marca();
    return existente ? buscarMarcaConocida(existente.nombre, this.estado.sugeridas()) : null;
  });

  /**
   * Marca conocida que corresponde al formulario (D-56). Al crear, la elegida en el combobox. Al
   * editar, la del nombre escrito o, si la propia marca es conocida, ella misma aunque el nombre
   * esté a medio escribir. `null`: marca propia con colores libres.
   */
  protected readonly conocida = computed(() =>
    this.esCreacion()
      ? this.sugeridaElegida()
      : (buscarMarcaConocida(this.nombre(), this.estado.sugeridas()) ?? this.conocidaOriginal()),
  );
  protected readonly bloqueada = computed(() => this.conocida() !== null);

  /** Colores que se muestran y se envían: los oficiales si es conocida; si no, los elegidos. */
  protected readonly colorMostrado = computed(() => this.conocida()?.color ?? this.color());
  protected readonly acentoMostrado = computed(() =>
    this.conocida() ? (this.conocida()?.colorAcento ?? null) : this.colorAcento(),
  );

  protected readonly errorNombre = computed(() => {
    const nombre = this.nombreEfectivo();
    const local = validarNombre(nombre);
    if (local !== null) {
      return this.nombreTocado() ? local : null;
    }
    const original = this.conocidaOriginal();
    if (original !== null && !mismaMarcaConocida(nombre, original.nombre)) {
      return `El nombre de ${original.nombre} no se puede cambiar por otro; solo puedes corregir mayúsculas o tildes.`;
    }
    const otros = this.estado
      .marcas()
      .filter((m) => m.id !== this.marca()?.id)
      .map((m) => m.nombre);
    if (nombreRepetido(nombre, otros)) {
      return 'Ya existe una marca con ese nombre.';
    }
    // D-56: una marca nueva con el nombre de una conocida no puede llevar colores propios.
    if (this.esNueva() && buscarMarcaConocida(nombre, this.estado.sugeridas()) !== null) {
      return 'Esa marca ya está en la lista: elígela arriba.';
    }
    return this.erroresServidor()['nombre'] ?? null;
  });

  protected readonly formularioValido = computed(
    () =>
      this.formularioVisible() &&
      validarNombre(this.nombreEfectivo()) === null &&
      this.errorNombre() === null &&
      esColorValido(this.colorMostrado()) &&
      (this.acentoMostrado() === null || esColorValido(this.acentoMostrado() ?? '')) &&
      (this.marca() === null || (this.orden() !== null && this.orden() !== undefined)),
  );

  constructor() {
    // Al abrir, el formulario se llena con la marca (o con valores nuevos).
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const marca = untracked(() => this.marca());
      void untracked(() => this.estado.cargarSugeridas());
      this.eleccion.set(null);
      this.nombre.set(marca?.nombre ?? '');
      this.color.set(marca?.color ?? COLOR_MARCA_PREDETERMINADO);
      this.colorAcento.set(marca?.colorAcento ?? null);
      this.orden.set(marca?.orden ?? 0);
      this.errorGeneral.set(null);
      this.erroresServidor.set({});
      this.nombreTocado.set(false);
    });
  }

  /** El Vendedor eligió algo en el combobox: una conocida o «Agregar nueva marca…». */
  protected elegir(clave: string | null): void {
    this.eleccion.set(clave);
    this.errorGeneral.set(null);
    this.erroresServidor.set({});
    this.nombreTocado.set(false);
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
          nombre: this.conocida()?.nombre ?? this.nombreEfectivo().trim(),
          color: this.colorMostrado(),
          colorAcento: this.acentoMostrado(),
        });
        this.guardada.emit(creada);
      } else {
        const cambios = this.cambiosDe(existente);
        const actualizada =
          Object.keys(cambios).length > 0
            ? await this.estado.actualizar(existente.id, cambios)
            : null;
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
    // Una marca propia que pasa a llamarse como una conocida toma el nombre oficial; una
    // conocida conserva lo que escribió el Vendedor (solo mayúsculas o tildes).
    const oficial = this.conocidaOriginal() === null ? this.conocida()?.nombre : undefined;
    const nombre = oficial ?? this.nombre().trim();
    if (nombre !== existente.nombre) {
      cambios.nombre = nombre;
    }
    if (this.colorMostrado() !== existente.color) {
      cambios.color = this.colorMostrado();
    }
    if (this.acentoMostrado() !== existente.colorAcento) {
      cambios.colorAcento = this.acentoMostrado();
    }
    const orden = this.orden();
    if (orden !== null && orden !== existente.orden) {
      cambios.orden = orden;
    }
    return cambios;
  }
}
