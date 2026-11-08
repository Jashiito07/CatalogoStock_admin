import { DOCUMENT } from '@angular/common';
import { inject, InjectionToken } from '@angular/core';

import { environment } from '../../../../environments/environment';

const HOSTS_LOCALES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** Parte de `window.location` que se necesita para resolver la URL de la API. */
export interface UbicacionPanel {
  readonly hostname: string;
}

/**
 * Resuelve la URL base de la API sin escribir IPs en archivos versionados.
 *
 * - Una URL relativa (`/api/v1`, producción) se usa tal cual: la API está en el mismo dominio.
 * - Una URL absoluta hacia `localhost` (desarrollo) se dirige al **mismo host** desde el que
 *   se abrió el panel. Así, si el panel se abre desde el celular en la red local
 *   (`http://<IP de la PC>:4201`), la API se busca en `http://<IP de la PC>:3000/api/v1`.
 *   En la propia PC (`localhost`) no cambia nada.
 */
export function resolverUrlApi(configurada: string, ubicacion: UbicacionPanel | null): string {
  if (!/^https?:\/\//i.test(configurada)) {
    return configurada;
  }
  const url = new URL(configurada);
  const hostPanel = ubicacion?.hostname ?? '';
  if (!HOSTS_LOCALES.has(url.hostname) || hostPanel === '' || HOSTS_LOCALES.has(hostPanel)) {
    return configurada;
  }
  url.hostname = hostPanel;
  return url.toString().replace(/\/$/, '');
}

/** URL base de la API (`…/api/v1`). Los servicios HTTP la inyectan en lugar de leer el entorno. */
export const URL_API = new InjectionToken<string>('URL_API', {
  providedIn: 'root',
  factory: () => resolverUrlApi(environment.apiUrl, inject(DOCUMENT).location ?? null),
});
