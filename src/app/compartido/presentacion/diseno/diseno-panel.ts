import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';

import { crearSeccionesPanel } from './secciones-panel';

/**
 * Diseño general del panel del vendedor: barra superior, menú lateral y contenido.
 * El ingreso del vendedor y el guard de rol llegan en la Fase 1 (RF-USU-01, RF-USU-03).
 */
@Component({
  selector: 'app-diseno-panel',
  imports: [RouterOutlet, ToolbarModule, MenuModule, ToastModule],
  templateUrl: './diseno-panel.html',
  styleUrl: './diseno-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisenoPanel {
  protected readonly titulo = 'CatálogoStock · Panel del vendedor';
  protected readonly secciones = crearSeccionesPanel();
}
