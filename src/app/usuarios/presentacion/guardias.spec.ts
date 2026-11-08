import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AlmacenTokenRenovacion, ApiAutenticacion } from '../aplicacion/puertos';
import { SesionVendedor } from '../aplicacion/sesion-vendedor';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
  errorSinConexion,
  errorTokenInvalido,
} from '../pruebas/dobles-sesion';
import { soloSinSesion, soloVendedor } from './guardias';

@Component({ template: 'Pantalla del panel' })
class PantallaPanel {}

@Component({ template: 'Pantalla de ingreso' })
class PantallaIngreso {}

describe('guards del panel', () => {
  let api: ApiAutenticacionFalsa;
  let almacen: AlmacenEnMemoria;

  beforeEach(() => {
    api = crearApiFalsa();
    almacen = new AlmacenEnMemoria();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'ingreso', component: PantallaIngreso, canActivate: [soloSinSesion] },
          { path: 'inicio', component: PantallaPanel, canActivate: [soloVendedor] },
          { path: 'bitacora', component: PantallaPanel, canActivate: [soloVendedor] },
        ]),
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: almacen },
      ],
    });
  });

  const urlActual = () => TestBed.inject(Router).url;

  describe('soloVendedor (RF-USU-03)', () => {
    it('sin sesión lleva al ingreso', async () => {
      const arnes = await RouterTestingHarness.create();
      await arnes.navigateByUrl('/bitacora');
      expect(urlActual()).toBe('/ingreso');
    });

    it('con la sesión del Vendedor deja entrar', async () => {
      api.ingresarVendedor.mockResolvedValue(crearSesion('VENDEDOR'));
      await TestBed.inject(SesionVendedor).ingresar('vendedora@correo.com', 'Clave2026');

      const arnes = await RouterTestingHarness.create();
      await arnes.navigateByUrl('/bitacora');
      expect(urlActual()).toBe('/bitacora');
      expect(arnes.routeNativeElement?.textContent).toContain('Pantalla del panel');
    });

    it('tras recargar la página recupera la sesión con el token de renovación', async () => {
      almacen.valor = 'renovacion-guardada';
      api.renovar.mockResolvedValue(crearSesion('VENDEDOR'));

      const arnes = await RouterTestingHarness.create();
      await arnes.navigateByUrl('/bitacora');
      expect(urlActual()).toBe('/bitacora');
    });

    it('CA-02: una sesión de Cliente no entra al panel', async () => {
      almacen.valor = 'renovacion-de-cliente';
      api.renovar.mockResolvedValue(crearSesion('CLIENTE'));

      const arnes = await RouterTestingHarness.create();
      await arnes.navigateByUrl('/bitacora');
      expect(urlActual()).toBe('/ingreso');
      expect(TestBed.inject(SesionVendedor).activa()).toBe(false);
    });

    it('con un token de renovación rechazado lleva al ingreso', async () => {
      almacen.valor = 'renovacion-revocada';
      api.renovar.mockRejectedValue(errorTokenInvalido());

      const arnes = await RouterTestingHarness.create();
      await arnes.navigateByUrl('/inicio');
      expect(urlActual()).toBe('/ingreso');
      expect(almacen.valor).toBeNull();
    });

    it('si la API no responde lleva al ingreso avisando la falta de conexión', async () => {
      almacen.valor = 'renovacion-guardada';
      api.renovar.mockRejectedValue(errorSinConexion());

      const arnes = await RouterTestingHarness.create();
      await arnes.navigateByUrl('/inicio');
      expect(urlActual()).toBe('/ingreso?motivo=sin-conexion');
    });
  });

  describe('soloSinSesion', () => {
    it('muestra el ingreso sin sesión', async () => {
      const arnes = await RouterTestingHarness.create();
      await arnes.navigateByUrl('/ingreso');
      expect(urlActual()).toBe('/ingreso');
    });

    it('con sesión del Vendedor lleva al inicio del panel', async () => {
      api.ingresarVendedor.mockResolvedValue(crearSesion('VENDEDOR'));
      await TestBed.inject(SesionVendedor).ingresar('vendedora@correo.com', 'Clave2026');

      const arnes = await RouterTestingHarness.create();
      await arnes.navigateByUrl('/ingreso');
      expect(urlActual()).toBe('/inicio');
    });
  });
});
