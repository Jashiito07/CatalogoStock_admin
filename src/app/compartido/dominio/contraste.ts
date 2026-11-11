/** Razón de contraste WCAG entre dos colores `#RRGGBB` (RNF-11: mínimo 4.5 en texto normal). */

function canal(valor: number): number {
  const c = valor / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const limpio = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(limpio)) throw new Error(`Color no válido: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => canal(parseInt(limpio.slice(i, i + 2), 16)));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

export function razonDeContraste(colorA: string, colorB: string): number {
  const [claro, oscuro] = [luminancia(colorA), luminancia(colorB)].sort((a, b) => b - a);
  return ((claro ?? 0) + 0.05) / ((oscuro ?? 0) + 0.05);
}

/** Contraste mínimo para texto normal (RNF-11). */
export const CONTRASTE_MINIMO = 4.5;
