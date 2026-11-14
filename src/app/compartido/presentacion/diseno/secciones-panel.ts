import { MenuItem } from 'primeng/api';

export const AVISO_PROXIMA_FASE = 'Disponible en una próxima fase';

/**
 * Secciones del menú lateral del panel (D-01). En la Fase 1 están habilitadas «Inicio»,
 * «Clientes» (RF-USU-05) y «Bitácora» (RF-USU-04); las demás se habilitan cuando se implementen sus RF
 * (ver docs/PLAN.md).
 */
export function crearSeccionesPanel(sinMarcas = false): MenuItem[] {
  const proximamente = (label: string, icon: string, id: string): MenuItem => ({
    id,
    label,
    icon,
    disabled: true,
    title: AVISO_PROXIMA_FASE,
  });

  return [
    {
      label: 'General',
      items: [
        {
          id: 'inicio',
          label: 'Inicio',
          icon: 'pi pi-home',
          routerLink: '/inicio',
          routerLinkActiveOptions: { exact: true },
        },
      ],
    },
    {
      label: 'Administración',
      items: [
        // D-48: el enlace se muestra mientras el negocio no tenga marcas.
        ...(sinMarcas
          ? [
              {
                id: 'configura-tu-negocio',
                label: 'Configura tu negocio',
                icon: 'pi pi-cog',
                routerLink: '/configura-tu-negocio',
              } satisfies MenuItem,
            ]
          : []),
        {
          id: 'marcas',
          label: 'Marcas',
          icon: 'pi pi-tags',
          routerLink: '/marcas',
        },
        {
          id: 'clientes',
          label: 'Clientes',
          icon: 'pi pi-users',
          routerLink: '/clientes',
        },
        proximamente('Productos', 'pi pi-box', 'productos'),
        proximamente('Inventario', 'pi pi-warehouse', 'inventario'),
        proximamente('Pedidos', 'pi pi-shopping-cart', 'pedidos'),
        proximamente('Pagos', 'pi pi-wallet', 'pagos'),
        proximamente('Conflictos', 'pi pi-exclamation-triangle', 'conflictos'),
        {
          id: 'bitacora',
          label: 'Bitácora',
          icon: 'pi pi-history',
          routerLink: '/bitacora',
        },
      ],
    },
  ];
}
