/**
 * Fechas en hora de Ecuador continental (UTC-5 todo el año, sin horario de verano; D-31).
 * La API envía las fechas en UTC (`…Z`); el panel las muestra siempre en hora de Ecuador.
 * Capa de dominio: TypeScript puro, sin Angular. No depende de la zona del navegador.
 */
const DESFASE_ECUADOR_MS = -5 * 60 * 60 * 1000;

function dosDigitos(valor: number): string {
  return String(valor).padStart(2, '0');
}

/** La fecha tal como se ve en un reloj de Ecuador, o `null` si el texto no es una fecha. */
function enEcuador(iso: string): Date | null {
  const instante = Date.parse(iso);
  return Number.isNaN(instante) ? null : new Date(instante + DESFASE_ECUADOR_MS);
}

/** `HH:mm` en hora de Ecuador (`2026-11-09T15:30:00Z` → `10:30`); `''` si no es una fecha. */
export function horaEcuador(iso: string): string {
  const fecha = enEcuador(iso);
  return fecha === null ? '' : `${dosDigitos(fecha.getUTCHours())}:${dosDigitos(fecha.getUTCMinutes())}`;
}

/** `dd/MM/yyyy HH:mm` en hora de Ecuador; `''` si no es una fecha. */
export function fechaHoraEcuador(iso: string): string {
  const fecha = enEcuador(iso);
  if (fecha === null) {
    return '';
  }
  const dia = `${dosDigitos(fecha.getUTCDate())}/${dosDigitos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`;
  return `${dia} ${horaEcuador(iso)}`;
}
