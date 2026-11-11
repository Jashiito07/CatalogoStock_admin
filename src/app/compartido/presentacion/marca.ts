import { TemaAplicado } from '../dominio/tema';

/**
 * Logo oficial de CatálogoStock (D-38), copiado de `Contexto/catalogostock-logo` a
 * `public/marca/`. Se usa siempre como imagen (`<img>`), nunca como SVG en línea, para
 * evitar choques de los `id` internos del SVG.
 *
 * - Horizontal para fondo claro: Ingreso y barra superior en modo claro.
 * - Horizontal para fondo oscuro: los mismos lugares en modo oscuro (D-41).
 * - El favicon usa el ícono de 192 px (ver `src/index.html`).
 */
export const RUTA_LOGO_HORIZONTAL = 'marca/catalogostock-logo-horizontal.svg';
export const RUTA_LOGO_HORIZONTAL_FONDO_OSCURO =
  'marca/catalogostock-logo-horizontal-fondo-oscuro.svg';

/** Logo horizontal que corresponde al tema aplicado. */
export function rutaLogoHorizontal(tema: TemaAplicado): string {
  return tema === 'oscuro' ? RUTA_LOGO_HORIZONTAL_FONDO_OSCURO : RUTA_LOGO_HORIZONTAL;
}
