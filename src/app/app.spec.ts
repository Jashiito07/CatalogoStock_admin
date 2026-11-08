import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from 'primeng/api';

import { App } from './app';
import { routes } from './app.routes';
import { AlmacenTokenRenovacion, ApiAutenticacion } from './usuarios/aplicacion/puertos';
import { SesionVendedor } from './usuarios/aplicacion/sesion-vendedor';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
} from './usuarios/pruebas/dobles-sesion';

describe('App', () => {
  let api: ApiAutenticacionFalsa;

  beforeEach(async () => {
    api = crearApiFalsa();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        MessageService,
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: new AlmacenEnMemoria() },
      ],
    }).compileComponents();
  });

  it('se crea', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('RF-USU-03: sin sesión, la raíz lleva a la pantalla de ingreso', async () => {
    const arnes = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/ingreso');
    expect((arnes.routeNativeElement as HTMLElement).textContent).toContain('Panel del vendedor');
  });

  it('con la sesión del Vendedor, la raíz abre el Inicio dentro del diseño del panel', async () => {
    api.ingresarVendedor.mockResolvedValue(crearSesion('VENDEDOR'));
    await TestBed.inject(SesionVendedor).ingresar('vendedora@correo.com', 'Clave2026');

    const arnes = await RouterTestingHarness.create('/');
    expect(TestBed.inject(Router).url).toBe('/inicio');
    expect((arnes.routeNativeElement as HTMLElement).textContent).toContain(
      'Bienvenido al panel del vendedor',
    );
  });
});
