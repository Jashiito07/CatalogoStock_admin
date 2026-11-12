import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken, isDevMode, OnDestroy, signal } from '@angular/core';

import { AlmacenPreferenciaTema } from '../../aplicacion/preferencia-tema.puerto';
import {
  esPreferenciaTema,
  minutosDelDia,
  PREFERENCIA_TEMA_POR_DEFECTO,
  PreferenciaTema,
  resolverTema,
  TemaAplicado,
} from '../../dominio/tema';

/** Puerto donde se guarda la preferencia de tema (adaptador: `localStorage`). */
export const ALMACEN_PREFERENCIA_TEMA = new InjectionToken<AlmacenPreferenciaTema>(
  'ALMACEN_PREFERENCIA_TEMA',
);

/** Reloj del equipo; las pruebas lo sustituyen. */
export const AHORA = new InjectionToken<() => Date>('AHORA', {
  providedIn: 'root',
  factory: () => () => new Date(),
});

/** Clase que activa el modo oscuro de PrimeNG (`darkModeSelector`) y las variables `--cs-*`. */
export const CLASE_TEMA_OSCURO = 'app-oscuro';
/** Cada cuánto se revisa la hora con el panel abierto. */
export const INTERVALO_REVISION_TEMA_MS = 30_000;

/** Parámetro de depuración (`?tema=oscuro`): solo se acepta fuera de producción. */
const PARAMETRO_DEPURACION = 'tema';

/**
 * Aplica el tema claro u oscuro (D-41). «Automático» sigue la hora local del equipo:
 * oscuro de 18:40 a 06:45. Revisa cada 30 s y al volver a la pestaña (`visibilitychange`).
 */
@Injectable({ providedIn: 'root' })
export class ServicioTema implements OnDestroy {
  private readonly documento = inject(DOCUMENT);
  private readonly ahora = inject(AHORA);
  private readonly almacen = inject(ALMACEN_PREFERENCIA_TEMA, { optional: true });

  readonly preferencia = signal<PreferenciaTema>(PREFERENCIA_TEMA_POR_DEFECTO);
  readonly temaAplicado = signal<TemaAplicado>('claro');

  private temporizador: ReturnType<typeof setInterval> | null = null;
  private readonly alCambiarVisibilidad = () => {
    if (this.documento.visibilityState !== 'hidden') this.revisar();
  };
  private depuracion: PreferenciaTema | null = null;
  private destruido = false;

  /**
   * Lee la preferencia guardada (síncrona), aplica el tema y programa la revisión. Se llama
   * en el arranque (`provideAppInitializer`), antes de la primera pantalla.
   */
  iniciar(): void {
    this.depuracion = this.leerParametroDepuracion();
    this.preferencia.set(this.almacen?.leer() ?? PREFERENCIA_TEMA_POR_DEFECTO);
    this.revisar();
    this.programar();
  }

  /** Cambia y guarda la preferencia del Vendedor. */
  seleccionar(preferencia: PreferenciaTema): void {
    this.preferencia.set(preferencia);
    this.depuracion = null;
    this.revisar();
    this.almacen?.guardar(preferencia);
  }

  /** Recalcula el tema con la hora actual y lo aplica. */
  revisar(): void {
    const preferencia = this.depuracion ?? this.preferencia();
    const tema = resolverTema(preferencia, minutosDelDia(this.ahora()));
    this.temaAplicado.set(tema);
    this.aplicar(tema);
  }

  ngOnDestroy(): void {
    this.destruido = true;
    if (this.temporizador !== null) clearInterval(this.temporizador);
    this.temporizador = null;
    this.documento.removeEventListener('visibilitychange', this.alCambiarVisibilidad);
  }

  private programar(): void {
    if (this.temporizador !== null || this.destruido) return;
    this.temporizador = setInterval(() => this.revisar(), INTERVALO_REVISION_TEMA_MS);
    this.documento.addEventListener('visibilitychange', this.alCambiarVisibilidad);
  }

  private leerParametroDepuracion(): PreferenciaTema | null {
    if (!isDevMode()) return null;
    const busqueda = this.documento.defaultView?.location.search ?? '';
    const valor = new URLSearchParams(busqueda).get(PARAMETRO_DEPURACION);
    return esPreferenciaTema(valor) ? valor : null;
  }

  private aplicar(tema: TemaAplicado): void {
    const raiz = this.documento.documentElement;
    raiz.classList.toggle(CLASE_TEMA_OSCURO, tema === 'oscuro');
    this.actualizarColorBarra(raiz);
  }

  /** `<meta name="theme-color">` con el fondo del tema, leído de la variable `--cs-fondo`. */
  private actualizarColorBarra(raiz: HTMLElement): void {
    const vista = this.documento.defaultView;
    const fondo = vista?.getComputedStyle(raiz).getPropertyValue('--cs-fondo').trim();
    if (!fondo) return;
    let meta = this.documento.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = this.documento.createElement('meta');
      meta.name = 'theme-color';
      this.documento.head.appendChild(meta);
    }
    meta.content = fondo;
  }
}
