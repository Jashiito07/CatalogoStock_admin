import { ErrorApi } from '../../compartido/aplicacion/error-api';

export const MENSAJE_SIN_PERMISO = 'No tienes permiso para esta acción.';
export const MENSAJE_MARCA_DUPLICADA = 'Ya existe una marca con ese nombre.';
export const MENSAJE_MARCA_NO_ENCONTRADA =
  'No encontramos esta marca. Actualiza la lista e inténtalo de nuevo.';
export const MENSAJE_DATOS_INVALIDOS = 'Revisa los datos de la marca e inténtalo de nuevo.';
export const MENSAJE_ERROR_INESPERADO = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Mensaje claro para un error de marcas (400, 403, 404, 409…), sin detalles técnicos. */
export function mensajeDeErrorDeMarca(error: unknown): string {
  if (!(error instanceof ErrorApi)) {
    return MENSAJE_ERROR_INESPERADO;
  }
  if (error.estado === 403) {
    return MENSAJE_SIN_PERMISO;
  }
  if (error.estado === 404) {
    return MENSAJE_MARCA_NO_ENCONTRADA;
  }
  if (error.codigo === 'MARCA_DUPLICADA') {
    return MENSAJE_MARCA_DUPLICADA;
  }
  if (error.codigo === 'DATOS_INVALIDOS') {
    return MENSAJE_DATOS_INVALIDOS;
  }
  return error.mensaje;
}

export type ErroresPorCampo = Readonly<Record<string, string>>;

/**
 * Errores de validación por campo de un 400 `DATOS_INVALIDOS`
 * (`detalles.errores: [{ campo, errores: [...] }]`, contrato README). Vacío si no aplica.
 */
export function erroresPorCampo(error: unknown): ErroresPorCampo {
  if (!(error instanceof ErrorApi) || error.codigo !== 'DATOS_INVALIDOS') {
    return {};
  }
  const lista = error.detalles?.['errores'];
  if (!Array.isArray(lista)) {
    return {};
  }
  const resultado: Record<string, string> = {};
  for (const elemento of lista as unknown[]) {
    if (typeof elemento !== 'object' || elemento === null) {
      continue;
    }
    const { campo, errores } = elemento as { campo?: unknown; errores?: unknown };
    if (typeof campo === 'string' && Array.isArray(errores) && typeof errores[0] === 'string') {
      resultado[campo] = errores[0];
    }
  }
  return resultado;
}
