import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { interceptorAutenticacion } from '../../../usuarios/infraestructura/interceptor-autenticacion';
import { interceptorErrores } from './interceptor-errores';

export { URL_API } from './url-api';

/**
 * Cliente HTTP del panel con sus interceptores, en este orden:
 * 1. `interceptorAutenticacion`: adjunta el token del Vendedor y renueva ante
 *    `TOKEN_VENCIDO` (RF-USU-01, D-09).
 * 2. `interceptorErrores`: traduce cualquier error al `ErrorApi` del contrato.
 */
export function proveerHttp(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(
      withFetch(),
      withInterceptors([interceptorAutenticacion, interceptorErrores]),
    ),
  ]);
}
