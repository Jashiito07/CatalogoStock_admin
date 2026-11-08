import { Routes } from '@angular/router';

import { proveerAuditoria } from './auditoria/infraestructura/lector-bitacora.http';
import { soloSinSesion, soloVendedor } from './usuarios/presentacion/guardias';

/**
 * Rutas del panel del vendedor. Cada sección se carga de forma diferida.
 * - `/ingreso`: ingreso del Vendedor (RF-USU-01, D-19); solo sin sesión.
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
    loadComponent: () =>
      import('./compartido/presentacion/diseno/diseno-panel').then((m) => m.DisenoPanel),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      {
        path: 'inicio',
        title: 'Inicio · CatálogoStock',
        loadComponent: () =>
          import('./compartido/presentacion/inicio/inicio').then((m) => m.Inicio),
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
