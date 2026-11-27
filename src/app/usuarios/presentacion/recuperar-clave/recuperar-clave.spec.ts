import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { AlmacenTokenRenovacion, ApiAutenticacion } from '../../aplicacion/puertos';
import { AlmacenEnMemoria, ApiAutenticacionFalsa, crearApiFalsa } from '../../pruebas/dobles-sesion';
import { MENSAJE_CLAVE_RESTABLECIDA } from '../ingreso/ingreso';
import { RecuperarClave } from './recuperar-clave';

@Component({ template: '' })
class PantallaIngreso {}

describe('RecuperarClave del Vendedor (RF-USU-05, D-50)', () => {
  let api: ApiAutenticacionFalsa;
  let fixture: ComponentFixture<RecuperarClave>;
  let elemento: HTMLElement;
  let router: Router;

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  async function escribir(id: string, valor: string): Promise<void> {
    const campo = elemento.querySelector<HTMLInputElement>(`#${id}`);
    if (!campo) throw new Error(`Sin campo #${id}`);
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('blur'));
    await estable();
  }

  async function enviarFormulario(): Promise<void> {
    elemento.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click();
    await estable();
  }

  async function pasarAlPaso2(): Promise<void> {
    await escribir('correo-recuperacion', 'vendedora@correo.com');
    await enviarFormulario();
  }

  beforeEach(async () => {
    // Reloj falso solo para intervalos: la cuenta regresiva no depende del tiempo real.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    api = crearApiFalsa();
    await TestBed.configureTestingModule({
      imports: [RecuperarClave],
      providers: [
        provideRouter([{ path: 'ingreso', component: PantallaIngreso }]),
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: new AlmacenEnMemoria() },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(RecuperarClave);
    elemento = fixture.nativeElement as HTMLElement;
    await estable();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
  });

  it('paso 1: pide el correo y deja la nota del comando del servidor', () => {
    expect(elemento.querySelector('label[for="correo-recuperacion"]')?.textContent).toContain('Correo');
    expect(elemento.querySelector('[data-prueba="nota-comando"]')?.textContent).toContain(
      'npm run restablecer-clave-vendedor',
    );
  });

  it('un correo inválido no llama a la API', async () => {
    await escribir('correo-recuperacion', 'no-es-correo');
    await enviarFormulario();
    expect(api.solicitarRecuperacionPorCorreo).not.toHaveBeenCalled();
    expect(elemento.querySelector('[data-prueba="error-correo"]')).not.toBeNull();
  });

  it('204: siempre muestra el mensaje neutro y pasa al paso del código', async () => {
    await pasarAlPaso2();
    expect(api.solicitarRecuperacionPorCorreo).toHaveBeenCalledWith('vendedora@correo.com');
    expect(elemento.querySelector('[data-prueba="mensaje-neutro"]')?.textContent).toContain(
      'Si el correo está registrado y verificado, te enviamos un código.',
    );
    expect(elemento.querySelector('#codigo-recuperacion')).not.toBeNull();
  });

  it('429 en la solicitud muestra el mensaje con espera y se queda en el paso 1', async () => {
    api.solicitarRecuperacionPorCorreo.mockRejectedValue(
      new ErrorApi('DEMASIADAS_SOLICITUDES', 'x', 429, { reintentarEnSegundos: 45 }),
    );
    await pasarAlPaso2();
    expect(elemento.querySelector('[data-prueba="error-solicitud"]')?.textContent).toContain('(45 s)');
    expect(elemento.querySelector('#codigo-recuperacion')).toBeNull();
    expect(elemento.querySelector('[data-prueba="espera"]')?.textContent).toContain('0:45');
  });

  it('valida clave débil, confirmación distinta y código incompleto sin llamar a la API', async () => {
    await pasarAlPaso2();
    await escribir('codigo-recuperacion', '12');
    await escribir('clave-nueva-recuperacion', 'corta');
    await escribir('confirmacion-recuperacion', 'otra');
    await enviarFormulario();
    expect(api.restablecerClave).not.toHaveBeenCalled();
    expect(elemento.querySelector('[data-prueba="error-codigo"]')).not.toBeNull();
    expect(elemento.querySelector('[data-prueba="error-clave-nueva"]')?.textContent).toContain('8 y 72');
    expect(elemento.querySelector('[data-prueba="error-confirmacion"]')?.textContent).toContain('no coinciden');
  });

  it('204: restablece y vuelve al ingreso con el aviso de clave cambiada', async () => {
    const navegar = vi.spyOn(router, 'navigate');
    await pasarAlPaso2();
    await escribir('codigo-recuperacion', '482913');
    await escribir('clave-nueva-recuperacion', 'NuevaClave2026');
    await escribir('confirmacion-recuperacion', 'NuevaClave2026');
    await enviarFormulario();

    expect(api.restablecerClave).toHaveBeenCalledWith({
      correo: 'vendedora@correo.com',
      codigo: '482913',
      claveNueva: 'NuevaClave2026',
    });
    expect(navegar).toHaveBeenCalledWith(
      ['/ingreso'],
      expect.objectContaining({ queryParams: { motivo: 'clave-restablecida' } }),
    );
    expect(MENSAJE_CLAVE_RESTABLECIDA).toBe('Tu clave se cambió. Inicia sesión con tu nueva clave.');
  });

  it('422: código inválido muestra el mensaje único con el conteo de intentos y no sale', async () => {
    api.restablecerClave.mockRejectedValue(new ErrorApi('CODIGO_INVALIDO', 'x', 422));
    await pasarAlPaso2();
    await escribir('codigo-recuperacion', '000000');
    await escribir('clave-nueva-recuperacion', 'NuevaClave2026');
    await escribir('confirmacion-recuperacion', 'NuevaClave2026');
    await enviarFormulario();
    expect(elemento.querySelector('[data-prueba="error-general"]')?.textContent).toContain(
      'El código no es válido o ya venció. Pide uno nuevo. Intento 1 de 5.',
    );
    expect(elemento.querySelector('#codigo-recuperacion')).not.toBeNull();
  });

  it('503 y 429 al restablecer muestran un mensaje claro', async () => {
    await pasarAlPaso2();
    await escribir('codigo-recuperacion', '482913');
    await escribir('clave-nueva-recuperacion', 'NuevaClave2026');
    await escribir('confirmacion-recuperacion', 'NuevaClave2026');

    api.restablecerClave.mockRejectedValue(new ErrorApi('DEMASIADAS_SOLICITUDES', 'x', 429));
    await enviarFormulario();
    expect(elemento.querySelector('[data-prueba="error-general"]')?.textContent).toContain('Demasiados intentos');

    api.restablecerClave.mockRejectedValue(new ErrorApi('CORREO_NO_DISPONIBLE', 'x', 503));
    await enviarFormulario();
    expect(elemento.querySelector('[data-prueba="error-general"]')?.textContent).toContain('No pudimos enviar el correo');
  });

  it('«Usar otro correo» vuelve al paso 1', async () => {
    await pasarAlPaso2();
    const boton = Array.from(elemento.querySelectorAll('button')).find((b) => b.textContent?.includes('Usar otro correo'));
    boton?.click();
    await estable();
    expect(elemento.querySelector('#correo-recuperacion')).not.toBeNull();
  });
});
