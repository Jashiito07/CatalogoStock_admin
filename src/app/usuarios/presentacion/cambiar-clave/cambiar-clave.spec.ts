import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { AlmacenTokenRenovacion, ApiAutenticacion } from '../../aplicacion/puertos';
import { SesionVendedor } from '../../aplicacion/sesion-vendedor';
import {
  MENSAJE_CLAVE_DEBIL,
  MENSAJE_CLAVE_IGUAL_A_LA_ACTUAL,
  MENSAJE_CLAVES_NO_COINCIDEN,
} from '../../dominio/clave';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
} from '../../pruebas/dobles-sesion';
import {
  CambiarClave,
  MENSAJE_CLAVE_ACTUAL_INCORRECTA,
  MENSAJE_CLAVE_CAMBIADA,
  mensajeDeErrorDeCambioClave,
} from './cambiar-clave';

describe('CambiarClave (RF-USU-05)', () => {
  let api: ApiAutenticacionFalsa;
  let almacen: AlmacenEnMemoria;
  let fixture: ComponentFixture<CambiarClave>;
  let elemento: HTMLElement;
  let tokenRenovacion: string;

  beforeEach(async () => {
    api = crearApiFalsa();
    almacen = new AlmacenEnMemoria();
    await TestBed.configureTestingModule({
      imports: [CambiarClave],
      providers: [
        provideRouter([]),
        MessageService,
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: almacen },
      ],
    }).compileComponents();
    const sesion = crearSesion('VENDEDOR');
    tokenRenovacion = sesion.tokenRenovacion;
    api.ingresarVendedor.mockResolvedValue(sesion);
    await TestBed.inject(SesionVendedor).ingresar('vendedora@correo.com', 'Clave2026');
    fixture = TestBed.createComponent(CambiarClave);
    elemento = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const formulario = () => fixture.componentInstance['formulario'];

  async function enviar(valores: { claveActual: string; claveNueva: string; confirmacion: string }) {
    formulario().setValue(valores);
    elemento.querySelector<HTMLButtonElement>('form button[type="submit"]')?.click();
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  const texto = (prueba: string) =>
    elemento.querySelector(`[data-prueba="${prueba}"]`)?.textContent?.trim() ?? null;

  it('tiene los campos clave actual, nueva y confirmación con etiquetas', () => {
    for (const id of ['clave-actual', 'clave-nueva', 'clave-confirmacion']) {
      expect(elemento.querySelector(`label[for="${id}"]`)).not.toBeNull();
      expect(elemento.querySelector(`input#${id}`)).not.toBeNull();
    }
  });

  it('valida la regla de la clave nueva sin llamar a la API', async () => {
    await enviar({ claveActual: 'Clave2026', claveNueva: 'corta1', confirmacion: 'corta1' });
    expect(texto('error-clave-nueva')).toBe(MENSAJE_CLAVE_DEBIL);
    expect(api.cambiarClave).not.toHaveBeenCalled();
  });

  it('exige que la confirmación coincida', async () => {
    await enviar({
      claveActual: 'Clave2026',
      claveNueva: 'NuevaClave2026',
      confirmacion: 'NuevaClave2027',
    });
    expect(texto('error-confirmacion')).toBe(MENSAJE_CLAVES_NO_COINCIDEN);
    expect(api.cambiarClave).not.toHaveBeenCalled();
  });

  it('la clave nueva debe ser distinta de la actual', async () => {
    await enviar({ claveActual: 'Clave2026', claveNueva: 'Clave2026', confirmacion: 'Clave2026' });
    expect(texto('error-clave-nueva')).toBe(MENSAJE_CLAVE_IGUAL_A_LA_ACTUAL);
    expect(api.cambiarClave).not.toHaveBeenCalled();
  });

  it('pide la clave actual', async () => {
    await enviar({ claveActual: '', claveNueva: 'NuevaClave2026', confirmacion: 'NuevaClave2026' });
    expect(texto('error-clave-actual')).toBe('Ingresa tu clave actual.');
  });

  it('con datos válidos envía el token de renovación, avisa «Tu clave se cambió» y vuelve al inicio', async () => {
    const agregar = vi.spyOn(TestBed.inject(MessageService), 'add');
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    await enviar({
      claveActual: 'Clave2026',
      claveNueva: 'NuevaClave2026',
      confirmacion: 'NuevaClave2026',
    });

    expect(api.cambiarClave).toHaveBeenCalledWith({
      claveActual: 'Clave2026',
      claveNueva: 'NuevaClave2026',
      tokenRenovacionActual: tokenRenovacion,
    });
    expect(agregar).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'success', summary: MENSAJE_CLAVE_CAMBIADA }),
    );
    expect(navegar).toHaveBeenCalledWith('/inicio');
    expect(TestBed.inject(SesionVendedor).activa()).toBe(true);
  });

  it('422 CLAVE_ACTUAL_INCORRECTA muestra un mensaje claro', async () => {
    api.cambiarClave.mockRejectedValue(
      new ErrorApi('CLAVE_ACTUAL_INCORRECTA', 'La clave actual no es correcta.', 422),
    );
    await enviar({
      claveActual: 'Otra2026x',
      claveNueva: 'NuevaClave2026',
      confirmacion: 'NuevaClave2026',
    });
    expect(texto('error-cambio-clave')).toBe(MENSAJE_CLAVE_ACTUAL_INCORRECTA);
  });

  it('400 DATOS_INVALIDOS muestra el mensaje del contrato', async () => {
    api.cambiarClave.mockRejectedValue(
      new ErrorApi('DATOS_INVALIDOS', 'La clave nueva debe ser distinta de la actual.', 400),
    );
    await enviar({
      claveActual: 'Clave2026',
      claveNueva: 'NuevaClave2026',
      confirmacion: 'NuevaClave2026',
    });
    expect(texto('error-cambio-clave')).toBe('La clave nueva debe ser distinta de la actual.');
  });
});

describe('mensajeDeErrorDeCambioClave', () => {
  it('429 indica cuándo reintentar', () => {
    const error = new ErrorApi('DEMASIADAS_SOLICITUDES', 'Demasiados intentos.', 429, {
      reintentarEnSegundos: 30,
    });
    expect(mensajeDeErrorDeCambioClave(error)).toContain('30 segundos');
  });

  it('un error desconocido no muestra detalles técnicos', () => {
    expect(mensajeDeErrorDeCambioClave(new Error('x'))).not.toContain('x');
  });
});
