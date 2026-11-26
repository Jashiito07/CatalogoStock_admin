import { NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DrawerModule } from 'primeng/drawer';
import { MenuModule } from 'primeng/menu';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';

import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { SesionVendedor } from '../../../usuarios/aplicacion/sesion-vendedor';
import { MOTIVOS_INGRESO } from '../../../usuarios/aplicacion/motivos-ingreso';
import { rutaLogoHorizontal } from '../marca';
import { senalPantallaMovil } from '../pantalla/pantalla-movil';
import { SelectorTema } from '../tema/selector-tema';
import { ServicioTema } from '../tema/servicio-tema';
import { crearSeccionesPanel } from './secciones-panel';

export const RUTA_CAMBIAR_CLAVE = '/mi-clave';

/**
 * Diseño general del panel del vendedor: barra superior con el logo (D-38), el nombre del
 * Vendedor, «Cambiar mi clave» (RF-USU-05) y «Cerrar sesión», menú lateral y contenido (PLAN 1.7, RF-USU-01). Solo se muestra con
 * la sesión del Vendedor (guard `soloVendedor`, RF-USU-03).
 */
@Component({
  selector: 'app-diseno-panel',
  imports: [
    NgTemplateOutlet,
    RouterOutlet,
    ToolbarModule,
    MenuModule,
    DrawerModule,
    ToastModule,
    ButtonModule,
    SelectorTema,
  ],
  templateUrl: './diseno-panel.html',
  styleUrl: './diseno-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DisenoPanel {
  private readonly sesion = inject(SesionVendedor);
  private readonly router = inject(Router);

  private readonly tema = inject(ServicioTema);

  /** Logo horizontal (D-38): variante para fondo oscuro cuando la barra es oscura (D-41). */
  protected readonly logo = computed(() => rutaLogoHorizontal(this.tema.temaAplicado()));
  protected readonly subtitulo = 'Panel del vendedor';
  private readonly marcas = inject(EstadoMarcas);
  protected readonly secciones = computed(() => crearSeccionesPanel(this.marcas.sinMarcas()));
  protected readonly nombreVendedor = computed(() => this.sesion.usuario()?.nombre ?? '');
  protected readonly cerrando = signal(false);

  /** Menos de 768 px: el menú lateral pasa a un cajón con botón de hamburguesa. */
  protected readonly esMovil = senalPantallaMovil();
  protected readonly cajonAbierto = signal(false);

  constructor() {
    // Al navegar desde el cajón, se cierra (solo cambia la presentación, no las rutas).
    this.router.events
      .pipe(
        filter((evento) => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.cajonAbierto.set(false));

    // El menú muestra «Configura tu negocio» solo si la API confirma que no hay marcas (D-48).
    void this.marcas.asegurarCargada().catch(() => undefined);
  }

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
