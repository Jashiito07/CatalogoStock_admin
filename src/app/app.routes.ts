import { Routes } from '@angular/router';

import { proveerAuditoria } from './auditoria/infraestructura/lector-bitacora.http';
import { proveerClientes } from './clientes/infraestructura/api-clientes.http';
import { proveerMarcas } from './marcas/infraestructura/api-marcas.http';
import { negocioConfigurado, negocioSinConfigurar } from './marcas/presentacion/guardias-marcas';
import { soloSinSesion, soloVendedor } from './usuarios/presentacion/guardias';

/**
 * Rutas del panel del vendedor. Cada sección se carga de forma diferida.
 * - `/ingreso`: ingreso del Vendedor (RF-USU-01, D-19); solo sin sesión.
 * - `/clientes` (RF-USU-05: código de recuperación) y `/mi-clave` (cambio de clave con
 *   sesión, RF-USU-05) viven dentro del diseño del panel.
 * - Todo lo demás vive dentro del diseño del panel y exige la sesión del Vendedor
 *   (guard `soloVendedor`, RF-USU-03). La API comprueba el rol en cada ruta (CA-02).
 */
export const routes: Routes = [
  {
    path: 'ingreso',
    title: 'Ingreso · CatálogoStock',
    canActivate: [soloSinSesion],
    loadComponent: () =>
      import('./usuarios/presentacion/ingreso/ingreso').then((m) => m.Ingreso),
  },
  {
    path: '',
    canActivate: [soloVendedor],
    canActivateChild: [soloVendedor],
    // Las marcas se comparten con el menú, el guard de «Configura tu negocio» y las pantallas.
    providers: [proveerMarcas()],
    loadComponent: () =>
      import('./compartido/presentacion/diseno/diseno-panel').then((m) => m.DisenoPanel),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio · CatálogoStock',
        // D-48: sin marcas, el ingreso termina en «Configura tu negocio».
        canActivate: [negocioConfigurado],
        loadComponent: () =>
          import('./compartido/presentacion/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'configura-tu-negocio',
        title: 'Configura tu negocio · CatálogoStock',
        canActivate: [negocioSinConfigurar],
        loadComponent: () =>
          import('./marcas/presentacion/configura-negocio/configura-negocio').then(
            (m) => m.ConfiguraNegocio,
          ),
      },
      {
        path: 'marcas',
        title: 'Marcas · CatálogoStock',
        canActivate: [negocioConfigurado],
        loadComponent: () => import('./marcas/presentacion/marcas/marcas').then((m) => m.Marcas),
      },
      {
        path: 'clientes',
        title: 'Clientes · CatálogoStock',
        providers: [proveerClientes()],
        loadComponent: () =>
          import('./clientes/presentacion/clientes/clientes').then((m) => m.Clientes),
      },
      {
        path: 'mi-clave',
        title: 'Cambiar mi clave · CatálogoStock',
        loadComponent: () =>
          import('./usuarios/presentacion/cambiar-clave/cambiar-clave').then(
            (m) => m.CambiarClave,
          ),
      },
      {
        path: 'bitacora',
        title: 'Bitácora · CatálogoStock',
        providers: [proveerAuditoria()],
        loadComponent: () =>
          import('./auditoria/presentacion/bitacora/bitacora').then((m) => m.Bitacora),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
