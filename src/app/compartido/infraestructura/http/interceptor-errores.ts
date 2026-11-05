import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { CODIGOS_ERROR_LOCALES, DetallesErrorApi, ErrorApi } from '../../aplicacion/error-api';

export const MENSAJE_SIN_CONEXION =
  'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
export const MENSAJE_ERROR_DESCONOCIDO = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

interface CuerpoErrorApi {
  codigo: string;
  mensaje: string;
  detalles?: DetallesErrorApi;
}

function esCuerpoErrorApi(cuerpo: unknown): cuerpo is CuerpoErrorApi {
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return false;
  }
  const { codigo, mensaje, detalles } = cuerpo as Record<string, unknown>;
  return (
    typeof codigo === 'string' &&
    typeof mensaje === 'string' &&
    (detalles === undefined || (typeof detalles === 'object' && detalles !== null))
  );
}

/** Traduce cualquier error HTTP al tipo `ErrorApi` del contrato. */
export function traducirErrorHttp(error: HttpErrorResponse): ErrorApi {
  if (error.status === 0) {
    return new ErrorApi(CODIGOS_ERROR_LOCALES.sinConexion, MENSAJE_SIN_CONEXION, 0);
  }
  if (esCuerpoErrorApi(error.error)) {
    const { codigo, mensaje, detalles } = error.error;
    return new ErrorApi(codigo, mensaje, error.status, detalles);
  }
  return new ErrorApi(CODIGOS_ERROR_LOCALES.desconocido, MENSAJE_ERROR_DESCONOCIDO, error.status);
}

/**
 * Interceptor base del panel: las pantallas reciben siempre un `ErrorApi` con un
 * mensaje claro, sin detalles técnicos. No escribe en la consola ni en registros el
 * contenido de la solicitud (tokens o datos personales).
 */
export const interceptorErrores: HttpInterceptorFn = (solicitud, siguiente) =>
  siguiente(solicitud).pipe(
    catchError((error: unknown) =>
      throwError(() => (error instanceof HttpErrorResponse ? traducirErrorHttp(error) : error)),
    ),
  );
