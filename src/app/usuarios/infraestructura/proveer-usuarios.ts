import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';

import { AlmacenTokenRenovacion, ApiAutenticacion } from '../aplicacion/puertos';
import { AlmacenTokenRenovacionSessionStorage } from './almacen-token-renovacion.session-storage';
import { ApiAutenticacionHttp } from './api-autenticacion.http';

/** Adaptadores del módulo `usuarios` para los puertos de `aplicacion`. */
export function proveerUsuarios(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ApiAutenticacion, useClass: ApiAutenticacionHttp },
    { provide: AlmacenTokenRenovacion, useClass: AlmacenTokenRenovacionSessionStorage },
  ]);
}
