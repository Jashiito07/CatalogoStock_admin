import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';

import { EstadoMarcas } from '../../aplicacion/estado-marcas';
import { ApiMarcas } from '../../aplicacion/puertos';
import {
  erroresPorCampo,
  mensajeDeErrorDeMarca,
} from '../../aplicacion/mensajes-marcas';
import {
  COLOR_MARCA_PREDETERMINADO,
  esColorValido,
  LONGITUD_MAXIMA_NOMBRE,
  nombreRepetido,
  validarNombre,
} from '../../dominio/marca';
import { SelectorColor } from '../selector-color/selector-color';
import { VistaPreviaMarca } from '../vista-previa-marca/vista-previa-marca';

export const RUTA_DESPUES_DE_CONFIGURAR = '/marcas';

/** Una marca que el Vendedor puede elegir: sugerida o propia. */
export interface OpcionMarca {
  readonly clave: string;
  readonly nombre: string;
  readonly color: string;
  readonly colorAcento: string | null;
  readonly yaCreada: boolean;
  readonly elegida: boolean;
  readonly propia: boolean;
  readonly error: string | null;
}

export function opcionValida(opcion: OpcionMarca): boolean {
  return (
    validarNombre(opcion.nombre) === null &&
    esColorValido(opcion.color) &&
    (opcion.colorAcento === null || esColorValido(opcion.colorAcento))
  );
}

/**
 * «Configura tu negocio» (D-48, RF-PRO-06): el Vendedor elige las marcas sugeridas con su
 * color, edita los colores y puede agregar una marca propia. «Continuar» crea con
 * `POST /marcas` solo las elegidas (al menos una).
 */
@Component({
  selector: 'app-configura-negocio',
  imports: [
    FormsModule,
    CardModule,
    CheckboxModule,
    ButtonModule,
    InputTextModule,
    MessageModule,
    TagModule,
    SelectorColor,
    VistaPreviaMarca,
  ],
  templateUrl: './configura-negocio.html',
  styleUrl: './configura-negocio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfiguraNegocio implements OnInit {
  private readonly api = inject(ApiMarcas);
  private readonly estado = inject(EstadoMarcas);
  private readonly router = inject(Router);
  private readonly avisos = inject(MessageService);

  protected readonly longitudMaximaNombre = LONGITUD_MAXIMA_NOMBRE;
  protected readonly opciones = signal<readonly OpcionMarca[]>([]);
  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly guardando = signal(false);

  protected readonly nombrePropia = signal('');
  protected readonly colorPropia = signal(COLOR_MARCA_PREDETERMINADO);
  protected readonly propiaTocada = signal(false);
  private contadorPropias = 0;

  protected readonly elegidas = computed(() =>
    this.opciones().filter((opcion) => opcion.elegida && !opcion.yaCreada),
  );
  protected readonly puedeContinuar = computed(
    () => this.elegidas().length > 0 && this.elegidas().every(opcionValida) && !this.guardando(),
  );

  protected readonly errorPropia = computed(() => {
    const nombre = this.nombrePropia();
    const local = validarNombre(nombre);
    if (local !== null) {
      return this.propiaTocada() ? local : null;
    }
    return nombreRepetido(
      nombre,
      this.opciones().map((opcion) => opcion.nombre),
    )
      ? 'Esa marca ya está en la lista.'
      : null;
  });
  protected readonly puedeAgregarPropia = computed(
    () =>
      validarNombre(this.nombrePropia()) === null &&
      this.errorPropia() === null &&
      esColorValido(this.colorPropia()),
  );

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.error.set(null);
    this.cargando.set(true);
    try {
      const sugeridas = await this.api.sugeridas();
      const propias = this.opciones().filter((opcion) => opcion.propia);
      this.opciones.set([
        ...sugeridas.map<OpcionMarca>((s) => ({
          clave: `sugerida-${s.nombre}`,
          nombre: s.nombre,
          color: s.color,
          colorAcento: s.colorAcento,
          yaCreada: s.yaCreada,
          elegida: false,
          propia: false,
          error: null,
        })),
        ...propias,
      ]);
    } catch (error) {
      this.error.set(mensajeDeErrorDeMarca(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected elegir(clave: string, elegida: boolean): void {
    this.cambiar(clave, { elegida, error: null });
  }

  protected cambiarColor(clave: string, color: string): void {
    this.cambiar(clave, { color });
  }

  protected cambiarAcento(clave: string, colorAcento: string): void {
    this.cambiar(clave, { colorAcento });
  }

  protected quitarPropia(clave: string): void {
    this.opciones.update((lista) => lista.filter((opcion) => opcion.clave !== clave));
  }

  protected agregarPropia(): void {
    this.propiaTocada.set(true);
    if (!this.puedeAgregarPropia()) {
      return;
    }
    const nueva: OpcionMarca = {
      clave: `propia-${++this.contadorPropias}`,
      nombre: this.nombrePropia().trim(),
      color: this.colorPropia(),
      colorAcento: null,
      yaCreada: false,
      elegida: true,
      propia: true,
      error: null,
    };
    this.opciones.update((lista) => [...lista, nueva]);
    this.nombrePropia.set('');
    this.colorPropia.set(COLOR_MARCA_PREDETERMINADO);
    this.propiaTocada.set(false);
  }

  /**
   * Crea las elegidas una por una, en el orden de la pantalla. Si alguna falla (409
   * `MARCA_DUPLICADA`, 400 por campo…), queda marcada con su mensaje y las demás se crean.
   */
  async continuar(): Promise<void> {
    if (!this.puedeContinuar()) {
      return;
    }
    this.guardando.set(true);
    let creadas = 0;
    let fallidas = 0;
    try {
      for (const opcion of this.elegidas()) {
        try {
          await this.estado.crear({
            nombre: opcion.nombre.trim(),
            color: opcion.color,
            colorAcento: opcion.colorAcento,
          });
          creadas++;
          this.cambiar(opcion.clave, { yaCreada: true, elegida: false, error: null });
        } catch (error) {
          fallidas++;
          const porCampo = erroresPorCampo(error);
          const detalle = Object.values(porCampo)[0];
          this.cambiar(opcion.clave, { error: detalle ?? mensajeDeErrorDeMarca(error) });
        }
      }
    } finally {
      this.guardando.set(false);
    }

    if (fallidas === 0) {
      this.avisos.add({
        severity: 'success',
        summary: 'Negocio configurado',
        detail: creadas === 1 ? 'Se creó 1 marca.' : `Se crearon ${creadas} marcas.`,
        life: 4000,
      });
      await this.router.navigateByUrl(RUTA_DESPUES_DE_CONFIGURAR);
    } else {
      this.avisos.add({
        severity: 'warn',
        summary: 'Algunas marcas no se crearon',
        detail: 'Corrige las marcas señaladas y pulsa «Continuar» de nuevo.',
        life: 6000,
      });
    }
  }

  private cambiar(clave: string, cambios: Partial<OpcionMarca>): void {
    this.opciones.update((lista) =>
      lista.map((opcion) => (opcion.clave === clave ? { ...opcion, ...cambios } : opcion)),
    );
  }
}
