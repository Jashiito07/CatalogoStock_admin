import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';

import { SesionVendedor } from '../../../usuarios/aplicacion/sesion-vendedor';
import { MOTIVOS_INGRESO } from '../../../usuarios/aplicacion/motivos-ingreso';
import { RUTA_LOGO_HORIZONTAL } from '../marca';
import { crearSeccionesPanel } from './secciones-panel';

export const RUTA_CAMBIAR_CLAVE = '/mi-clave';

/**
 * Diseño general del panel del vendedor: barra superior con el logo (D-38), el nombre del
 * Vendedor, «Cambiar mi clave» (RF-USU-05) y «Cerrar sesión», menú lateral y contenido (PLAN 1.7, RF-USU-01). Solo se muestra con
 * la sesión del Vendedor (guard `soloVendedor`, RF-USU-03).
 */
@Component({
  selector: 'app-diseno-panel',
  imports: [RouterOutlet, ToolbarModule, MenuModule, ToastModule, ButtonModule],
  templateUrl: './diseno-panel.html',
  styleUrl: './diseno-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisenoPanel {
  private readonly sesion = inject(SesionVendedor);
  private readonly router = inject(Router);

  /** Logo horizontal para fondo claro: la barra superior es clara (D-38). */
  protected readonly logo = RUTA_LOGO_HORIZONTAL;
  protected readonly subtitulo = 'Panel del vendedor';
  protected readonly secciones = crearSeccionesPanel();
  protected readonly nombreVendedor = computed(() => this.sesion.usuario()?.nombre ?? '');
  protected readonly cerrando = signal(false);

  /** «Cambiar mi clave» (RF-USU-05): pantalla dentro del panel. */
  protected async irACambiarClave(): Promise<void> {
    await this.router.navigateByUrl(RUTA_CAMBIAR_CLAVE);
  }

  protected async cerrarSesion(): Promise<void> {
    if (this.cerrando()) {
      return;
    }
    this.cerrando.set(true);
    try {
      await this.sesion.cerrarSesion();
    } finally {
      this.cerrando.set(false);
      await this.router.navigate(['/ingreso'], { queryParams: { motivo: MOTIVOS_INGRESO.salida } });
    }
  }
}
