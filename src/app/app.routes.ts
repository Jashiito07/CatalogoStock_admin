import { Routes } from '@angular/router';

/**
 * Rutas del panel del vendedor. Cada sección se carga de forma diferida.
 * En la Fase 1 se agregan el ingreso y el guard de rol Vendedor (RF-USU-03).
 */
export const routes: Routes = [
  {
    path: '',
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
    ],
  },
  { path: '**', redirectTo: '' },
];
