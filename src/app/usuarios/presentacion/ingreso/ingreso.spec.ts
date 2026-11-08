import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { AlmacenTokenRenovacion, ApiAutenticacion } from '../../aplicacion/puertos';
import { SesionVendedor } from '../../aplicacion/sesion-vendedor';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
  errorCredenciales,
} from '../../pruebas/dobles-sesion';
import {
  Ingreso,
  MENSAJE_CLAVE_OBLIGATORIA,
  MENSAJE_CORREO_INVALIDO,
  MENSAJE_SALIDA,
  mensajeDeErrorDeIngreso,
} from './ingreso';

@Component({ template: '' })
class PantallaInicio {}

describe('Ingreso del Vendedor (RF-USU-01, RF-USU-03, D-19)', () => {
  let api: ApiAutenticacionFalsa;
  let almacen: AlmacenEnMemoria;
  let fixture: ComponentFixture<Ingreso>;
  let elemento: HTMLElement;

  beforeEach(async () => {
    api = crearApiFalsa();
    almacen = new AlmacenEnMemoria();
    await TestBed.configureTestingModule({
      imports: [Ingreso],
      providers: [
        provideRouter([{ path: 'inicio', component: PantallaInicio }]),
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: almacen },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Ingreso);
    elemento = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  function escribir(id: string, valor: string): void {
    const campo = elemento.querySelector<HTMLInputElement>(`#${id}`);
    if (!campo) {
      throw new Error(`No existe el campo #${id}`);
    }
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
  }

  async function enviar(): Promise<void> {
    elemento.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  it('muestra el formulario con etiquetas, la nota para clientes y el botón Ingresar', () => {
    expect(elemento.querySelector('label[for="correo"]')?.textContent).toContain('Correo');
    expect(elemento.querySelector('label[for="clave"]')?.textContent).toContain('Clave');
    expect(elemento.querySelector('#clave')?.getAttribute('type')).toBe('password');
    expect(elemento.textContent).toContain('Los clientes compran desde la app móvil');
    expect(elemento.querySelector('button[type="submit"]')?.textContent).toContain('Ingresar');
  });

  it('valida los campos antes de llamar a la API', async () => {
    escribir('correo', 'no-es-correo');
    await enviar();

    expect(api.ingresarVendedor).not.toHaveBeenCalled();
    expect(elemento.textContent).toContain(MENSAJE_CORREO_INVALIDO);
    expect(elemento.textContent).toContain(MENSAJE_CLAVE_OBLIGATORIA);
    expect(elemento.querySelector('#correo')?.getAttribute('aria-invalid')).toBe('true');
  });

  it('CA-01: con credenciales del Vendedor inicia sesión y abre el inicio del panel', async () => {
    api.ingresarVendedor.mockResolvedValue(crearSesion('VENDEDOR'));
    escribir('correo', 'vendedora@correo.com');
    escribir('clave', 'Clave2026');
    await enviar();

    expect(api.ingresarVendedor).toHaveBeenCalledWith('vendedora@correo.com', 'Clave2026');
    expect(TestBed.inject(SesionVendedor).activa()).toBe(true);
    expect(TestBed.inject(Router).url).toBe('/inicio');
  });

  it('RF-USU-03: un Cliente recibe «Correo o clave incorrectos.» y no obtiene sesión', async () => {
    api.ingresarVendedor.mockRejectedValue(errorCredenciales());
    escribir('correo', 'cliente@correo.com');
    escribir('clave', 'Clave2026');
    await enviar();

    const error = elemento.querySelector('[data-prueba="error-ingreso"]');
    expect(error?.textContent).toContain('Correo o clave incorrectos.');
    expect(TestBed.inject(SesionVendedor).activa()).toBe(false);
    expect(almacen.valor).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('RF-USU-03: si la API devolviera una sesión de Cliente, la rechaza con el mismo mensaje genérico', async () => {
    const ajena = crearSesion('CLIENTE');
    api.ingresarVendedor.mockResolvedValue(ajena);
    escribir('correo', 'cliente@correo.com');
    escribir('clave', 'Clave2026');
    await enviar();

    expect(elemento.querySelector('[data-prueba="error-ingreso"]')?.textContent).toContain(
      'Correo o clave incorrectos.',
    );
    expect(api.salir).toHaveBeenCalledWith(ajena.tokenRenovacion);
    expect(TestBed.inject(SesionVendedor).activa()).toBe(false);
    expect(almacen.valor).toBeNull();
  });

  it('muestra el aviso del motivo recibido (cierre de sesión)', async () => {
    fixture.componentRef.setInput('motivo', 'salida');
    await fixture.whenStable();
    expect(elemento.textContent).toContain(MENSAJE_SALIDA);
  });
});

describe('mensajeDeErrorDeIngreso', () => {
  it('usa el mensaje en español del contrato', () => {
    expect(mensajeDeErrorDeIngreso(errorCredenciales())).toBe('Correo o clave incorrectos.');
  });

  it('D-17: indica cuántos segundos esperar ante DEMASIADAS_SOLICITUDES', () => {
    const error = new ErrorApi(
      'DEMASIADAS_SOLICITUDES',
      'Demasiados intentos. Espere un momento e inténtelo de nuevo.',
      429,
      { reintentarEnSegundos: 42 },
    );
    expect(mensajeDeErrorDeIngreso(error)).toBe(
      'Demasiados intentos. Espere un momento e inténtelo de nuevo. Podrás intentarlo de nuevo en 42 segundos.',
    );
  });

  it('no muestra detalles técnicos de errores desconocidos', () => {
    expect(mensajeDeErrorDeIngreso(new TypeError('x is undefined'))).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
  });
});
