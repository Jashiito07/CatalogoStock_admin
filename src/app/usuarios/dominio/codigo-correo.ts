/**
 * Código de 6 dígitos del correo (RF-USU-05, D-50; docs/contrato-api/correo.md).
 * Capa de dominio: TypeScript puro, sin Angular ni HTTP.
 */
export const LONGITUD_CODIGO = 6;

/** El código admite 5 intentos fallidos; al quinto queda invalidado (correo.md, principio 3). */
export const INTENTOS_MAXIMOS_CODIGO = 5;

/** Espera antes de poder pedir otro código (máximo 3 envíos por hora por cuenta). */
export const ESPERA_REENVIO_SEGUNDOS = 60;

/** Deja solo dígitos y corta a 6 (también cuando el navegador autocompleta el código recibido). */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/\D/gu, '').slice(0, LONGITUD_CODIGO);
}

/** El código del contrato: exactamente 6 dígitos. */
export function esCodigoCorreoValido(codigo: string): boolean {
  return /^\d{6}$/u.test(codigo);
}

/** `75` → `1:15`. */
export function formatearEspera(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = String(segundos % 60).padStart(2, '0');
  return `${minutos}:${resto}`;
}

/**
 * El aviso «Verifica tu correo» se muestra mientras `correoVerificadoEn` no tenga fecha.
 * Si el dato falta, se trata como no verificado.
 */
export function correoVerificado(
  usuario: { readonly correoVerificadoEn?: string | null } | null | undefined,
): boolean {
  return Boolean(usuario?.correoVerificadoEn);
}
