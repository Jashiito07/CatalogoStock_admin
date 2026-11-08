import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { MOTIVOS_INGRESO } from '../aplicacion/motivos-ingreso';
import { SesionVendedor } from '../aplicacion/sesion-vendedor';
import { RUTAS_PUBLICAS_AUTENTICACION } from './api-autenticacion.http';

/** Indica si la solicitud va a una ruta protegida de la API (no a otro servidor ni al ingreso). */
export function esRutaProtegidaDeLaApi(url: string, urlApi: string): boolean {
  if (!url.startsWith(`${urlApi}/`)) {
    return false;
  }
  const ruta = url.slice(urlApi.length).split('?')[0];
  return !RUTAS_PUBLICAS_AUTENTICACION.includes(ruta);
}

function conToken(solicitud: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token === null
    ? solicitud
    : solicitud.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function esNoAutenticado(error: unknown): error is ErrorApi {
  return error instanceof ErrorApi && error.estado === 401;
}

/**
 * Interceptor de sesión del panel (contrato de usuarios y README del contrato):
 *
 * 1. Adjunta `Authorization: Bearer <tokenAcceso>` a las rutas protegidas de la API.
 * 2. Ante un 401 `TOKEN_VENCIDO` renueva la sesión **una sola vez** (las solicitudes que
 *    fallan a la vez comparten la renovación) y repite la solicitud **una sola vez**.
 * 3. Cualquier otro 401, o una renovación rechazada, descarta la sesión y lleva al ingreso.
 *    Si la renovación no se pudo hacer por falta de conexión, la sesión se conserva.
 *
 * Va antes del interceptor de errores, así que recibe los errores ya como `ErrorApi`.
 * No escribe tokens en la consola ni en registros.
 */
export const interceptorAutenticacion: HttpInterceptorFn = (solicitud, siguiente) => {
  if (!esRutaProtegidaDeLaApi(solicitud.url, inject(URL_API))) {
    return siguiente(solicitud);
  }
  const sesion = inject(SesionVendedor);
  const router = inject(Router);

  const terminarSesion = (): void => {
    sesion.descartar();
    void router.navigate(['/ingreso'], { queryParams: { motivo: MOTIVOS_INGRESO.sesionTerminada } });
  };

  const tokenUsado = sesion.obtenerTokenAcceso();
  return siguiente(conToken(solicitud, tokenUsado)).pipe(
    catchError((error: unknown) => {
      if (!esNoAutenticado(error)) {
        return throwError(() => error);
      }
      if (error.codigo !== 'TOKEN_VENCIDO') {
        terminarSesion();
        return throwError(() => error);
      }
      return reintentarConTokenNuevo(solicitud, siguiente, sesion, tokenUsado, terminarSesion);
    }),
  );
};

function reintentarConTokenNuevo(
  solicitud: HttpRequest<unknown>,
  siguiente: HttpHandlerFn,
  sesion: SesionVendedor,
  tokenUsado: string | null,
  terminarSesion: () => void,
) {
  // Si otra solicitud ya renovó mientras esta viajaba, basta con el token actual.
  const tokenActual = sesion.obtenerTokenAcceso();
  const tokenNuevo =
    tokenActual !== null && tokenActual !== tokenUsado
      ? Promise.resolve(tokenActual)
      : sesion.renovar();

  return from(tokenNuevo).pipe(
    catchError((errorRenovacion: unknown) => {
      if (!sesion.activa()) {
        terminarSesion();
      }
      return throwError(() => errorRenovacion);
    }),
    switchMap((token) =>
      siguiente(conToken(solicitud, token)).pipe(
        catchError((errorReintento: unknown) => {
          // Un segundo 401 no vuelve a renovar: se termina la sesión.
          if (esNoAutenticado(errorReintento)) {
            terminarSesion();
          }
          return throwError(() => errorReintento);
        }),
      ),
    ),
  );
}
