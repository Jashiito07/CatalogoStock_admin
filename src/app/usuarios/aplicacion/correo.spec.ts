import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
  crearUsuario,
  errorSinConexion,
} from '../pruebas/dobles-sesion';
import {
  esperaTrasLimite,
  ErrorDatosCorreo,
  mensajeCodigoIncorrecto,
  mensajeDeErrorDeCorreo,
  MENSAJES_CORREO,
} from './mensajes-correo';
import { AlmacenTokenRenovacion, ApiAutenticacion } from './puertos';
import {
  RestablecerClavePorCorreo,
  SolicitarRecuperacionPorCorreo,
} from './recuperacion-por-correo';
import { SesionVendedor } from './sesion-vendedor';
import { ConfirmarVerificacionCorreo, SolicitarVerificacionCorreo } from './verificacion-correo';

describe('Verificación del correo (RF-USU-05, D-50)', () => {
  let api: ApiAutenticacionFalsa;
  let sesion: SesionVendedor;

  beforeEach(async () => {
    api = crearApiFalsa();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: new AlmacenEnMemoria() },
      ],
    });
    sesion = TestBed.inject(SesionVendedor);
    api.ingresarVendedor.mockResolvedValue(crearSesion());
    await sesion.ingresar('vendedora@correo.com', 'Clave2026');
  });

  it('solicitar: llama a la API solo con la sesión (sin correo) y deja pasar el 429', async () => {
    await TestBed.inject(SolicitarVerificacionCorreo).ejecutar();
    expect(api.solicitarVerificacionCorreo).toHaveBeenCalledWith();

    api.solicitarVerificacionCorreo.mockRejectedValue(new ErrorApi('DEMASIADAS_SOLICITUDES', 'x', 429));
    await expect(TestBed.inject(SolicitarVerificacionCorreo).ejecutar()).rejects.toMatchObject({ estado: 429 });
  });

  it('solicitar: un 409 CORREO_YA_VERIFICADO refresca el usuario para ocultar el aviso', async () => {
    api.solicitarVerificacionCorreo.mockRejectedValue(new ErrorApi('CORREO_YA_VERIFICADO', 'x', 409));
    api.obtenerUsuarioActual.mockResolvedValue({
      ...crearUsuario(),
      correoVerificadoEn: '2026-11-15T10:00:00.000Z',
    });

    await expect(TestBed.inject(SolicitarVerificacionCorreo).ejecutar()).rejects.toMatchObject({ estado: 409 });
    expect(sesion.usuario()?.correoVerificadoEn).toBe('2026-11-15T10:00:00.000Z');
  });

  it('confirmar: rechaza un código que no tiene 6 dígitos sin llamar a la API', async () => {
    await expect(TestBed.inject(ConfirmarVerificacionCorreo).ejecutar('12345')).rejects.toBeInstanceOf(
      ErrorDatosCorreo,
    );
    expect(api.confirmarVerificacionCorreo).not.toHaveBeenCalled();
  });

  it('RF-USU-05: confirmar con el código correcto actualiza al usuario con la fecha del servidor', async () => {
    api.obtenerUsuarioActual.mockResolvedValue({
      ...crearUsuario(),
      correoVerificadoEn: '2026-11-15T10:00:00.000Z',
    });

    await TestBed.inject(ConfirmarVerificacionCorreo).ejecutar('482913');

    expect(api.confirmarVerificacionCorreo).toHaveBeenCalledWith('482913');
    expect(sesion.usuario()?.correoVerificadoEn).toBe('2026-11-15T10:00:00.000Z');
  });

  it('confirmar: si el refresco falla, igual oculta el aviso con una fecha local', async () => {
    api.obtenerUsuarioActual.mockRejectedValue(errorSinConexion());
    await TestBed.inject(ConfirmarVerificacionCorreo).ejecutar('482913');
    expect(sesion.usuario()?.correoVerificadoEn).toBeTruthy();
  });

  it('confirmar: un 422 CODIGO_INVALIDO se propaga y no cambia al usuario', async () => {
    api.confirmarVerificacionCorreo.mockRejectedValue(new ErrorApi('CODIGO_INVALIDO', 'x', 422));
    await expect(TestBed.inject(ConfirmarVerificacionCorreo).ejecutar('000000')).rejects.toMatchObject({
      codigo: 'CODIGO_INVALIDO',
    });
    expect(sesion.usuario()?.correoVerificadoEn).toBeNull();
  });
});

describe('Recuperación de la clave por correo (RF-USU-05, D-50)', () => {
  let api: ApiAutenticacionFalsa;

  beforeEach(() => {
    api = crearApiFalsa();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: new AlmacenEnMemoria() },
      ],
    });
  });

  it('solicitar: recorta el correo y lo envía tal cual a la API', async () => {
    await TestBed.inject(SolicitarRecuperacionPorCorreo).ejecutar('  vendedora@correo.com ');
    expect(api.solicitarRecuperacionPorCorreo).toHaveBeenCalledWith('vendedora@correo.com');
  });

  it.each(['', 'sin-arroba', 'a@b'])('solicitar: rechaza el correo inválido %j sin llamar a la API', async (correo) => {
    await expect(TestBed.inject(SolicitarRecuperacionPorCorreo).ejecutar(correo)).rejects.toMatchObject({
      campo: 'correo',
    });
    expect(api.solicitarRecuperacionPorCorreo).not.toHaveBeenCalled();
  });

  it('restablecer: valida correo, código y clave antes de llamar a la API', async () => {
    const caso = TestBed.inject(RestablecerClavePorCorreo);
    await expect(caso.ejecutar({ correo: 'x', codigo: '123456', claveNueva: 'Clave2026' })).rejects.toMatchObject({ campo: 'correo' });
    await expect(caso.ejecutar({ correo: 'a@b.com', codigo: '12', claveNueva: 'Clave2026' })).rejects.toMatchObject({ campo: 'codigo' });
    await expect(caso.ejecutar({ correo: 'a@b.com', codigo: '123456', claveNueva: 'corta' })).rejects.toMatchObject({ campo: 'claveNueva' });
    expect(api.restablecerClave).not.toHaveBeenCalled();
  });

  it('restablecer: con datos válidos envía correo, código y clave nueva', async () => {
    await TestBed.inject(RestablecerClavePorCorreo).ejecutar({
      correo: ' a@b.com ',
      codigo: '123456',
      claveNueva: 'NuevaClave2026',
    });
    expect(api.restablecerClave).toHaveBeenCalledWith({
      correo: 'a@b.com',
      codigo: '123456',
      claveNueva: 'NuevaClave2026',
    });
  });
});

describe('mensajes de correo', () => {
  it('traduce 409, 422, 429, 503 y sin conexión a mensajes claros', () => {
    expect(mensajeDeErrorDeCorreo(new ErrorApi('CORREO_YA_VERIFICADO', 'x', 409))).toBe(MENSAJES_CORREO.correoYaVerificado);
    expect(mensajeDeErrorDeCorreo(new ErrorApi('CODIGO_INVALIDO', 'x', 422))).toBe(MENSAJES_CORREO.codigoIncorrecto);
    expect(mensajeDeErrorDeCorreo(new ErrorApi('CORREO_NO_DISPONIBLE', 'x', 503))).toBe(MENSAJES_CORREO.correoNoDisponible);
    expect(mensajeDeErrorDeCorreo(new ErrorApi('ERROR', 'x', 503))).toBe(MENSAJES_CORREO.correoNoDisponible);
    expect(mensajeDeErrorDeCorreo(errorSinConexion())).toBe(MENSAJES_CORREO.sinConexion);
    expect(mensajeDeErrorDeCorreo(new Error('interno'))).toBe('Ocurrió un error inesperado. Inténtalo de nuevo.');
  });

  it('429 agrega los segundos de espera cuando la API los da', () => {
    const conEspera = new ErrorApi('DEMASIADAS_SOLICITUDES', 'x', 429, { reintentarEnSegundos: 30 });
    expect(mensajeDeErrorDeCorreo(conEspera)).toContain('(30 s)');
    expect(esperaTrasLimite(conEspera)).toBe(30);
    const sinEspera = new ErrorApi('DEMASIADAS_SOLICITUDES', 'x', 429);
    expect(mensajeDeErrorDeCorreo(sinEspera)).toBe(MENSAJES_CORREO.demasiadasSolicitudes);
    expect(esperaTrasLimite(sinEspera)).toBe(60);
  });

  it('cuenta los intentos del código y avisa al agotarlos', () => {
    expect(mensajeCodigoIncorrecto(2)).toContain('Intento 2 de 5');
    expect(mensajeCodigoIncorrecto(5)).toContain('Agotaste los 5 intentos');
  });
});
