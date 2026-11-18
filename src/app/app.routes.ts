import { Routes } from '@angular/router';

import { proveerAuditoria } from './auditoria/infraestructura/lector-bitacora.http';
import { proveerClientes } from './clientes/infraestructura/api-clientes.http';
import { proveerImportacion } from './importacion/infraestructura/api-importaciones.http';
import { proveerMarcas } from './marcas/infraestructura/api-marcas.http';
import { negocioConfigurado, negocioSinConfigurar } from './marcas/presentacion/guardias-marcas';
import { proveerProductos } from './productos/infraestructura/api-productos.http';
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
    path: 'recuperar-clave',
    title: 'Recuperar mi clave · CatálogoStock',
    canActivate: [soloSinSesion],
    loadComponent: () =>
      import('./usuarios/presentacion/recuperar-clave/recuperar-clave').then((m) => m.RecuperarClave),
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
        // Importación del catálogo en PDF y lista de revisión de borradores (RF-PRO-01, D-55).
        path: 'productos/importar',
        canActivate: [negocioConfigurado],
        providers: [proveerImportacion()],
        children: [
          {
            path: '',
            title: 'Importar catálogo (PDF) · CatálogoStock',
            loadComponent: () =>
              import('./importacion/presentacion/importar/importar').then((m) => m.Importar),
          },
          {
            path: ':id',
            title: 'Revisión de borradores · CatálogoStock',
            loadComponent: () =>
              import('./importacion/presentacion/revision/revision').then((m) => m.Revision),
          },
        ],
      },
      {
        path: 'productos',
        title: 'Productos — CatálogoStock',
        // Sin marcas, el guard existente lleva a «Configura tu negocio» (D-48).
        canActivate: [negocioConfigurado],
        providers: [proveerProductos()],
        loadComponent: () =>
          import('./productos/presentacion/productos/productos').then((m) => m.Productos),
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
