import { DestroyRef, inject, Signal, signal } from '@angular/core';

/** Por debajo de este ancho (px) el panel usa el diseño de celular (D-61). */
export const ANCHO_MAXIMO_MOVIL_PX = 768;

export const CONSULTA_PANTALLA_MOVIL = `(max-width: ${ANCHO_MAXIMO_MOVIL_PX - 0.02}px)`;

/**
 * Señal que vale `true` mientras la pantalla mide menos de 768 px y se actualiza al girar el
 * teléfono o cambiar el tamaño de la ventana. Debe llamarse en un contexto de inyección. Sin
 * `matchMedia` (pruebas o entornos sin navegador) vale `false`: diseño de escritorio.
 */
export function senalPantallaMovil(): Signal<boolean> {
  const consulta =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(CONSULTA_PANTALLA_MOVIL)
      : null;
  const esMovil = signal(consulta?.matches === true);
  if (consulta !== null && typeof consulta.addEventListener === 'function') {
    const alCambiar = (evento: MediaQueryListEvent): void => esMovil.set(evento.matches);
    consulta.addEventListener('change', alCambiar);
    inject(DestroyRef).onDestroy(() => consulta.removeEventListener('change', alCambiar));
  }
  return esMovil.asReadonly();
}
