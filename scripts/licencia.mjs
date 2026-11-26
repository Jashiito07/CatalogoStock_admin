// Lógica pura de la clave de licencia de PrimeNG (D-59). Sin dependencias.
// NUNCA se imprime la clave: solo se informa «clave aplicada» o «sin clave».

const PATRON_ASIGNACION = /LICENCIA_PRIMENG\s*=\s*'((?:[^'\\]|\\.)*)'/;

/** Elimina espacios en los extremos; una clave interna con espacios o saltos es inválida. */
export function normalizarClave(valor) {
  const clave = (valor ?? '').trim();
  if (clave === '') return '';
  if (/\s/.test(clave)) {
    throw new Error('La clave de licencia no puede contener espacios ni saltos de línea.');
  }
  // Rechaza caracteres de control (seguridad del literal generado).
  if (/[\u0000-\u001f\u007f]/.test(clave)) {
    throw new Error('La clave de licencia contiene caracteres no válidos.');
  }
  return clave;
}

/** Escapa barras, comillas y separadores de línea para un literal TypeScript entre comillas simples. */
export function escaparLiteral(clave) {
  return clave
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Prioridad: variable de entorno → archivo de claves → vacío. */
export function resolverClave({ entorno, contenidoArchivo }) {
  const deEntorno = normalizarClave(entorno);
  if (deEntorno) return deEntorno;
  const deArchivo = normalizarClave(contenidoArchivo);
  return deArchivo || '';
}

export function generarContenido(clave) {
  return (
    '// Generado por scripts/preparar-licencia.mjs. IGNORADO por Git: no lo subas (D-59).\n' +
    `export const LICENCIA_PRIMENG = '${escaparLiteral(clave)}';\n`
  );
}

/** Indica si el contenido de un archivo local existente ya tiene una clave no vacía. */
export function tieneClave(contenido) {
  const coincidencia = PATRON_ASIGNACION.exec(contenido ?? '');
  return Boolean(coincidencia && coincidencia[1] !== '');
}

/**
 * Decide qué escribir. Devuelve { escribir, contenido, mensaje }.
 * No sustituye un archivo con clave por uno vacío.
 */
export function decidirEscritura({ clave, contenidoExistente }) {
  if (clave) {
    const contenido = generarContenido(clave);
    return { escribir: contenido !== contenidoExistente, contenido, mensaje: 'clave aplicada' };
  }
  if (tieneClave(contenidoExistente)) {
    return { escribir: false, contenido: contenidoExistente, mensaje: 'clave aplicada' };
  }
  const contenido = generarContenido('');
  return { escribir: contenido !== contenidoExistente, contenido, mensaje: 'sin clave' };
}