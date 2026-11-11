import { ErrorApi } from '../../compartido/aplicacion/error-api';

export const MENSAJE_SIN_PERMISO = 'No tienes permiso para esta acción.';
export const MENSAJE_CLIENTE_NO_ENCONTRADO =
  'No encontramos a este cliente. Actualiza la lista e inténtalo de nuevo.';
export const MENSAJE_CUENTA_INACTIVA =
  'La cuenta de este cliente está inactiva. No se puede generar un código.';
export const MENSAJE_ERROR_INESPERADO = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Mensaje claro para un error al generar el código (404, 422, 403…), sin detalles técnicos. */
export function mensajeDeErrorAlGenerarCodigo(error: unknown): string {
  if (!(error instanceof ErrorApi)) {
    return MENSAJE_ERROR_INESPERADO;
  }
  if (error.estado === 403) {
    return MENSAJE_SIN_PERMISO;
  }
  if (error.estado === 404) {
    return MENSAJE_CLIENTE_NO_ENCONTRADO;
  }
  if (error.codigo === 'CUENTA_INACTIVA') {
    return MENSAJE_CUENTA_INACTIVA;
  }
  return error.mensaje;
}

/** Mensaje claro para un error al consultar la lista de clientes. */
export function mensajeDeErrorAlListar(error: unknown): string {
  if (!(error instanceof ErrorApi)) {
    return MENSAJE_ERROR_INESPERADO;
  }
  return error.estado === 403 ? MENSAJE_SIN_PERMISO : error.mensaje;
}
