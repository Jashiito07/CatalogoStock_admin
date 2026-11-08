import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { MOTIVOS_INGRESO } from '../aplicacion/motivos-ingreso';
import { SesionVendedor } from '../aplicacion/sesion-vendedor';

export const RUTA_INICIO_PANEL = '/inicio';

/**
 * RF-USU-03: solo el Vendedor ve las pantallas del panel. Sin sesión (o con otro rol)
 * lleva al ingreso. Es comodidad de la interfaz: la API comprueba el rol en cada ruta (CA-02).
 */
export const soloVendedor: CanActivateFn = async () => {
  const router = inject(Router);
  const estado = await inject(SesionVendedor).asegurarSesion();
  if (estado === 'activa') {
    return true;
  }
  return router.createUrlTree(
    ['/ingreso'],
    estado === 'sin-conexion' ? { queryParams: { motivo: MOTIVOS_INGRESO.sinConexion } } : {},
  );
};

/** La pantalla de ingreso solo se muestra sin sesión; con sesión, lleva al panel. */
export const soloSinSesion: CanActivateFn = async () => {
  const router = inject(Router);
  const estado = await inject(SesionVendedor).asegurarSesion();
  return estado === 'activa' ? router.createUrlTree([RUTA_INICIO_PANEL]) : true;
};
