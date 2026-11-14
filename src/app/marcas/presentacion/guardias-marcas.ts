import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { EstadoMarcas } from '../aplicacion/estado-marcas';

export const RUTA_CONFIGURA_NEGOCIO = '/configura-tu-negocio';
export const RUTA_MARCAS_PANEL = '/marcas';

/**
 * D-48: sin marcas, el panel abre «Configura tu negocio». Si la API no responde no se
 * bloquea la navegación: la pantalla de destino muestra su propio error con «Reintentar».
 */
export const negocioConfigurado: CanActivateFn = async () => {
  const router = inject(Router);
  try {
    const marcas = await inject(EstadoMarcas).asegurarCargada();
    return marcas.length > 0 ? true : router.createUrlTree([RUTA_CONFIGURA_NEGOCIO]);
  } catch {
    return true;
  }
};

/** «Configura tu negocio» solo tiene sentido sin marcas; con marcas lleva a la sección Marcas. */
export const negocioSinConfigurar: CanActivateFn = async () => {
  const router = inject(Router);
  try {
    const marcas = await inject(EstadoMarcas).asegurarCargada();
    return marcas.length > 0 ? router.createUrlTree([RUTA_MARCAS_PANEL]) : true;
  } catch {
    return true;
  }
};
