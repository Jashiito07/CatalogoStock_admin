/**
 * Cálculos de los gráficos pequeños del Inicio (HTML/CSS/SVG, sin librerías). Capa de dominio:
 * TypeScript puro. Solo preparan proporciones para dibujar; los conteos vienen de la API.
 */

/** Ancho relativo (0 a 100, entero) de `valor` respecto al mayor valor de la serie. */
export function anchoRelativo(valor: number, maximo: number): number {
  if (maximo <= 0 || valor <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(2, Math.round((valor / maximo) * 100)));
}

/** Porcentaje entero de `parte` sobre `total`; 0 si no hay total. */
export function porcentaje(parte: number, total: number): number {
  if (total <= 0 || parte <= 0) {
    return 0;
  }
  return Math.round((parte / total) * 100);
}

/** Radio del círculo del donut tal que su circunferencia mide exactamente 100 unidades. */
export const RADIO_DONA = 100 / (2 * Math.PI);

export interface ArcoDona {
  /** `stroke-dasharray`: «largo hueco» sobre una circunferencia de 100. */
  readonly trazo: string;
  /** `stroke-dashoffset` que coloca el arco tras los anteriores (empieza arriba). */
  readonly desfase: number;
}

/**
 * Arcos de un donut para una serie de valores. Cada arco ocupa su parte proporcional de la
 * circunferencia (100 unidades). Serie sin datos: sin arcos.
 */
export function arcosDona(valores: readonly number[]): ArcoDona[] {
  const total = valores.reduce((suma, valor) => suma + Math.max(0, valor), 0);
  if (total <= 0) {
    return [];
  }
  let acumulado = 0;
  return valores.map((valor) => {
    const largo = (Math.max(0, valor) / total) * 100;
    const arco: ArcoDona = { trazo: `${largo} ${100 - largo}`, desfase: 25 - acumulado };
    acumulado += largo;
    return arco;
  });
}
