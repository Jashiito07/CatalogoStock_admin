import { MenuItem } from 'primeng/api';

export const AVISO_PROXIMA_FASE = 'Disponible en una próxima fase';

/**
 * Secciones del menú lateral del panel (D-01). Solo «Inicio» está habilitada en la
 * Fase 0; las demás se habilitan cuando se implementen sus RF (ver docs/PLAN.md).
 */
export function crearSeccionesPanel(): MenuItem[] {
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
        proximamente('Productos', 'pi pi-box', 'productos'),
        proximamente('Inventario', 'pi pi-warehouse', 'inventario'),
        proximamente('Pedidos', 'pi pi-shopping-cart', 'pedidos'),
        proximamente('Pagos', 'pi pi-wallet', 'pagos'),
        proximamente('Conflictos', 'pi pi-exclamation-triangle', 'conflictos'),
        proximamente('Bitácora', 'pi pi-history', 'bitacora'),
      ],
    },
  ];
}
