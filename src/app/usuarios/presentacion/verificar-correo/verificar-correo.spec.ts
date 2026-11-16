import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { AlmacenTokenRenovacion, ApiAutenticacion } from '../../aplicacion/puertos';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
  crearUsuario,
} from '../../pruebas/dobles-sesion';
import { SesionVendedor } from '../../aplicacion/sesion-vendedor';
import { VerificarCorreo } from './verificar-correo';

describe('VerificarCorreo (RF-USU-05, D-50)', () => {
  let api: ApiAutenticacionFalsa;
  let fixture: ComponentFixture<VerificarCorreo>;
  let elemento: HTMLElement;

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  const clic = async (prueba: string): Promise<void> => {
    elemento.querySelector<HTMLButtonElement>(`[data-prueba="${prueba}"] button, button[data-prueba="${prueba}"]`)?.click();
    await estable();
  };

  async function escribirCodigo(valor: string): Promise<void> {
    const campo = elemento.querySelector<HTMLInputElement>('#verificar-codigo');
    if (!campo) throw new Error('Sin campo de código');
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    await estable();
  }

  beforeEach(async () => {
    api = crearApiFalsa();
    api.ingresarVendedor.mockResolvedValue(crearSesion());
    await TestBed.configureTestingModule({
      imports: [VerificarCorreo],
      providers: [
        MessageService,
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: new AlmacenEnMemoria() },
      ],
    }).compileComponents();
    await TestBed.inject(SesionVendedor).ingresar('vendedora@correo.com', 'Clave2026');
    fixture = TestBed.createComponent(VerificarCorreo);
    fixture.componentRef.setInput('correo', 'vendedora@correo.com');
    elemento = fixture.nativeElement as HTMLElement;
    await estable();
  });

  afterEach(() => fixture.destroy());

  it('muestra el correo de destino y solo «Enviar código» al empezar', () => {
    expect(elemento.textContent).toContain('vendedora@correo.com');
    expect(elemento.querySelector('#verificar-codigo')).toBeNull();
  });

  it('204: envía el código, muestra el campo y activa la cuenta regresiva de reenvío', async () => {
    await clic('enviar-codigo');
    expect(api.solicitarVerificacionCorreo).toHaveBeenCalledTimes(1);
    expect(elemento.querySelector('#verificar-codigo')).not.toBeNull();
    expect(elemento.querySelector('[data-prueba="espera"]')?.textContent).toContain('1:00');
    expect(elemento.querySelector<HTMLButtonElement>('[data-prueba="enviar-codigo"] button')?.disabled).toBe(true);
  });

  it.each([
    [new ErrorApi('CORREO_NO_DISPONIBLE', 'x', 503), 'No pudimos enviar el correo, inténtalo de nuevo.'],
    [new ErrorApi('CORREO_YA_VERIFICADO', 'x', 409), 'Tu correo ya está verificado.'],
  ])('un error al enviar (%s) se muestra claro y permite reintentar', async (error, texto) => {
    api.solicitarVerificacionCorreo.mockRejectedValue(error);
    api.obtenerUsuarioActual.mockResolvedValue(crearUsuario());
    await clic('enviar-codigo');
    expect(elemento.querySelector('[data-prueba="error-envio"]')?.textContent).toContain(texto);
    expect(elemento.querySelector<HTMLButtonElement>('[data-prueba="enviar-codigo"] button')?.disabled).toBe(false);
  });

  it('429: muestra los segundos y bloquea el reenvío con cuenta regresiva', async () => {
    api.solicitarVerificacionCorreo.mockRejectedValue(
      new ErrorApi('DEMASIADAS_SOLICITUDES', 'x', 429, { reintentarEnSegundos: 90 }),
    );
    await clic('enviar-codigo');
    expect(elemento.querySelector('[data-prueba="error-envio"]')?.textContent).toContain('(90 s)');
    expect(elemento.querySelector('[data-prueba="espera"]')?.textContent).toContain('1:30');
  });

  it('el campo admite solo dígitos y un máximo de 6', async () => {
    await clic('enviar-codigo');
    await escribirCodigo('48a29-13999');
    expect(elemento.querySelector<HTMLInputElement>('#verificar-codigo')?.value).toBe('482913');
  });

  it('un código incompleto no llama a la API', async () => {
    await clic('enviar-codigo');
    await escribirCodigo('123');
    await clic('confirmar-codigo');
    expect(api.confirmarVerificacionCorreo).not.toHaveBeenCalled();
    expect(elemento.querySelector('[data-prueba="error-codigo"]')?.textContent).toContain('6 dígitos');
  });

  it('204: confirmar con 6 dígitos verifica el correo y actualiza la sesión', async () => {
    api.obtenerUsuarioActual.mockResolvedValue({ ...crearUsuario(), correoVerificadoEn: '2026-11-15T10:00:00.000Z' });
    await clic('enviar-codigo');
    await escribirCodigo('482913');
    await clic('confirmar-codigo');
    expect(api.confirmarVerificacionCorreo).toHaveBeenCalledWith('482913');
    expect(TestBed.inject(SesionVendedor).usuario()?.correoVerificadoEn).toBe('2026-11-15T10:00:00.000Z');
  });

  it('422: código incorrecto cuenta intentos y 429 en la confirmación activa la espera', async () => {
    api.confirmarVerificacionCorreo.mockRejectedValue(new ErrorApi('CODIGO_INVALIDO', 'x', 422));
    await clic('enviar-codigo');
    await escribirCodigo('000000');
    await clic('confirmar-codigo');
    expect(elemento.querySelector('[data-prueba="error-codigo"]')?.textContent).toContain('Intento 1 de 5');
    await clic('confirmar-codigo');
    expect(elemento.querySelector('[data-prueba="error-codigo"]')?.textContent).toContain('Intento 2 de 5');

    api.confirmarVerificacionCorreo.mockRejectedValue(new ErrorApi('DEMASIADAS_SOLICITUDES', 'x', 429));
    await clic('confirmar-codigo');
    expect(elemento.querySelector('[data-prueba="error-codigo"]')?.textContent).toContain('Demasiados intentos');
  });
});
