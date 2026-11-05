import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { interceptorErrores } from './interceptor-errores';

/** URL base de la API (`…/api/v1`). Los servicios HTTP la inyectan en lugar de leer el entorno. */
export const URL_API = new InjectionToken<string>('URL_API', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});

/**
 * Cliente HTTP del panel con sus interceptores. En la Fase 1 se agregará aquí el
 * interceptor del token del vendedor, antes del de errores.
 */
export function proveerHttp(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(withFetch(), withInterceptors([interceptorErrores])),
  ]);
}
