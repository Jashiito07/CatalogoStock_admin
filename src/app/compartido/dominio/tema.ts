/**
 * Tema visual de la app (requisito N2): reglas puras, sin frameworks ni reloj propio.
 * La hora llega siempre como dato (hora local del dispositivo), por lo que las pruebas no
 * dependen de la zona horaria del equipo.
 */

export type TemaAplicado = 'claro' | 'oscuro';
export type PreferenciaTema = 'automatico' | TemaAplicado;

export const PREFERENCIAS_TEMA: readonly PreferenciaTema[] = ['automatico', 'claro', 'oscuro'];
export const PREFERENCIA_TEMA_POR_DEFECTO: PreferenciaTema = 'automatico';

/** 18:40, en minutos desde la medianoche: inicio del modo oscuro. */
export const INICIO_OSCURO_MINUTOS = 18 * 60 + 40;
/** 06:45, en minutos desde la medianoche: fin del modo oscuro (ya es claro). */
export const FIN_OSCURO_MINUTOS = 6 * 60 + 45;

const MINUTOS_POR_DIA = 24 * 60;

export function esPreferenciaTema(valor: unknown): valor is PreferenciaTema {
  return PREFERENCIAS_TEMA.some((preferencia) => preferencia === valor);
}

/** Minutos transcurridos desde las 00:00 en la hora local de la fecha recibida. */
export function minutosDelDia(fecha: Date): number {
  return fecha.getHours() * 60 + fecha.getMinutes();
}

/**
 * Tema por horario: oscuro en el intervalo [18:40, 06:45), claro en el resto.
 * Un valor fuera de 0..1439 se normaliza al día (módulo 1440).
 */
export function temaPorHora(minutos: number): TemaAplicado {
  const minutoDelDia = ((Math.floor(minutos) % MINUTOS_POR_DIA) + MINUTOS_POR_DIA) % MINUTOS_POR_DIA;
  return minutoDelDia >= INICIO_OSCURO_MINUTOS || minutoDelDia < FIN_OSCURO_MINUTOS
    ? 'oscuro'
    : 'claro';
}

/** Tema que se aplica: la preferencia fija gana; «automático» sigue el horario. */
export function resolverTema(preferencia: PreferenciaTema, minutos: number): TemaAplicado {
  return preferencia === 'automatico' ? temaPorHora(minutos) : preferencia;
}
