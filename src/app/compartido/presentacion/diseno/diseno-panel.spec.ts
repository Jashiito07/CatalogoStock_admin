import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MenuItem, MessageService } from 'primeng/api';

import { AlmacenTokenRenovacion, ApiAutenticacion } from '../../../usuarios/aplicacion/puertos';
import { SesionVendedor } from '../../../usuarios/aplicacion/sesion-vendedor';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
} from '../../../usuarios/pruebas/dobles-sesion';
import { ServicioTema } from '../tema/servicio-tema';
import { DisenoPanel } from './diseno-panel';
import { AVISO_PROXIMA_FASE, crearSeccionesPanel } from './secciones-panel';

const SECCIONES_FUTURAS = ['Productos', 'Inventario', 'Pedidos', 'Pagos', 'Conflictos'];

function itemsDe(secciones: MenuItem[]): MenuItem[] {
  return secciones.flatMap((grupo) => grupo.items ?? []);
}

describe('DisenoPanel', () => {
  let api: ApiAutenticacionFalsa;
  let almacen: AlmacenEnMemoria;

  beforeEach(async () => {
    api = crearApiFalsa();
    almacen = new AlmacenEnMemoria();
    await TestBed.configureTestingModule({
      imports: [DisenoPanel],
      providers: [
        provideRouter([]),
        MessageService,
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: almacen },
      ],
    }).compileComponents();
    api.ingresarVendedor.mockResolvedValue(crearSesion('VENDEDOR'));
    await TestBed.inject(SesionVendedor).ingresar('vendedora@correo.com', 'Clave2026');
  });

  it('se crea con la barra superior, el nombre del Vendedor y «Cerrar sesión»', async () => {
    const fixture = TestBed.createComponent(DisenoPanel);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('h1')?.textContent?.trim()).toBe('Panel del vendedor');
    expect(elemento.querySelector('[data-prueba="nombre-vendedor"]')?.textContent).toContain(
      'Rosa Vendedora',
    );
    expect(elemento.textContent).toContain('Cerrar sesión');
    expect(elemento.querySelector('nav[aria-label="Secciones del panel"]')).not.toBeNull();
    expect(elemento.querySelector('main#contenido-principal')).not.toBeNull();
  });

  it('D-38: muestra el logo horizontal oficial como imagen, no como SVG en línea', async () => {
    const fixture = TestBed.createComponent(DisenoPanel);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;
    const logo = elemento.querySelector<HTMLImageElement>('h1 img');

    expect(logo?.getAttribute('src')).toBe('marca/catalogostock-logo-horizontal.svg');
    expect(logo?.getAttribute('alt')).toBe('CatálogoStock');
    expect(elemento.querySelector('svg title')).toBeNull();
  });

  it('D-41: en modo oscuro la barra usa el logo para fondo oscuro y muestra el selector de tema', async () => {
    TestBed.inject(ServicioTema).temaAplicado.set('oscuro');
    const fixture = TestBed.createComponent(DisenoPanel);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('h1 img')?.getAttribute('src')).toBe(
      'marca/catalogostock-logo-horizontal-fondo-oscuro.svg',
    );
    expect(elemento.querySelector('app-selector-tema')).not.toBeNull();
  });

  it('RF-USU-05: «Cambiar mi clave» en la barra superior lleva a /mi-clave', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(DisenoPanel);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-prueba="cambiar-mi-clave"] button')
      ?.click();
    await fixture.whenStable();

    expect(navegar).toHaveBeenCalledWith('/mi-clave');
  });

  it('muestra todas las secciones en el menú lateral', async () => {
    const fixture = TestBed.createComponent(DisenoPanel);
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    for (const seccion of ['Inicio', 'Clientes', 'Bitácora', ...SECCIONES_FUTURAS]) {
      expect(texto).toContain(seccion);
    }
  });

  it('RF-USU-01: «Cerrar sesión» revoca la sesión en la API y lleva al ingreso', async () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(DisenoPanel);
    await fixture.whenStable();
    const boton = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Cerrar sesión'),
    );

    boton?.click();
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));

    expect(api.salir).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(SesionVendedor).activa()).toBe(false);
    expect(almacen.valor).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/ingreso'], { queryParams: { motivo: 'salida' } });
  });
});

describe('crearSeccionesPanel', () => {
  it('habilita Inicio y Bitácora (RF-USU-04)', () => {
    const items = itemsDe(crearSeccionesPanel());

    expect(items.find((i) => i.label === 'Inicio')?.routerLink).toBe('/inicio');
    const bitacora = items.find((i) => i.label === 'Bitácora');
    expect(bitacora?.disabled).toBeFalsy();
    expect(bitacora?.routerLink).toBe('/bitacora');
  });

  it('RF-USU-05: habilita Clientes', () => {
    const clientes = itemsDe(crearSeccionesPanel()).find((i) => i.label === 'Clientes');
    expect(clientes?.disabled).toBeFalsy();
    expect(clientes?.routerLink).toBe('/clientes');
  });

  it('deshabilita las secciones de las próximas fases con un aviso', () => {
    const items = itemsDe(crearSeccionesPanel());

    for (const seccion of SECCIONES_FUTURAS) {
      const item = items.find((i) => i.label === seccion);
      expect(item, seccion).toBeDefined();
      expect(item?.disabled).toBe(true);
      expect(item?.title).toBe(AVISO_PROXIMA_FASE);
      expect(item?.routerLink).toBeUndefined();
    }
  });
});
