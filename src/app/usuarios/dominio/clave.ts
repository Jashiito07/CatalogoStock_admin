/**
 * Regla de la clave del contrato de usuarios («Validaciones») y D-22, la misma que aplica
 * la API: de 8 a 72 caracteres, al menos una letra y un número, y como máximo 72 bytes en
 * UTF-8 (límite de bcrypt). El panel avisa antes de enviar; la API valida siempre.
 * Capa de dominio: TypeScript puro (`TextEncoder` es estándar de JavaScript).
 */
export const LONGITUD_MINIMA_CLAVE = 8;
export const LONGITUD_MAXIMA_CLAVE = 72;
export const BYTES_MAXIMOS_CLAVE = 72;

export const MENSAJE_CLAVE_DEBIL =
  'La clave debe tener entre 8 y 72 caracteres, con letras y números.';
export const MENSAJE_CLAVE_IGUAL_A_LA_ACTUAL = 'La clave nueva debe ser distinta de la actual.';
export const MENSAJE_CLAVES_NO_COINCIDEN = 'Las claves no coinciden.';

const TIENE_LETRA = /\p{L}/u;
const TIENE_NUMERO = /\p{Nd}/u;
const codificador = new TextEncoder();

/** Bytes que ocupa el texto en UTF-8. */
export function bytesUtf8(texto: string): number {
  return codificador.encode(texto).length;
}

/** La clave se valida tal como se escribió: no se recorta ni se normaliza. */
export function cumpleReglaClave(clave: string): boolean {
  const longitud = [...clave].length;
  return (
    longitud >= LONGITUD_MINIMA_CLAVE &&
    longitud <= LONGITUD_MAXIMA_CLAVE &&
    bytesUtf8(clave) <= BYTES_MAXIMOS_CLAVE &&
    TIENE_LETRA.test(clave) &&
    TIENE_NUMERO.test(clave)
  );
}
