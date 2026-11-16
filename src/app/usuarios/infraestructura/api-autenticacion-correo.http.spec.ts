import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { interceptorErrores } from '../../compartido/infraestructura/http/interceptor-errores';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { ApiAutenticacionHttp } from './api-autenticacion.http';

const API = 'http://api.prueba/api/v1';

describe('ApiAutenticacionHttp: correo y recuperación (contrato correo.md, D-50)', () => {
  let api: ApiAutenticacionHttp;
  let controlador: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptorErrores])),
        provideHttpClientTesting(),
        { provide: URL_API, useValue: API },
        ApiAutenticacionHttp,
      ],
    });
    api = TestBed.inject(ApiAutenticacionHttp);
    controlador = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controlador.verify());

  const error = (
    codigo: string,
    estado: number,
    detalles?: Record<string, unknown>,
  ): { cuerpo: object; opciones: { status: number; statusText: string } } => ({
    cuerpo: { codigo, mensaje: 'Mensaje de la API.', ...(detalles ? { detalles } : {}) },
    opciones: { status: estado, statusText: 'Error' },
  });

  it('POST /usuarios/yo/correo/verificacion sin cuerpo → 204', async () => {
    const respuesta = api.solicitarVerificacionCorreo();
    const solicitud = controlador.expectOne(`${API}/usuarios/yo/correo/verificacion`);
    expect(solicitud.request.method).toBe('POST');
    expect(solicitud.request.body).toBeNull();
    solicitud.flush(null, { status: 204, statusText: 'No Content' });
    await expect(respuesta).resolves.toBeUndefined();
  });

  it.each([
    ['CORREO_YA_VERIFICADO', 409],
    ['DEMASIADAS_SOLICITUDES', 429],
    ['CORREO_NO_DISPONIBLE', 503],
  ])('verificación: %s (%s) llega como ErrorApi', async (codigo, estado) => {
    const respuesta = api.solicitarVerificacionCorreo().catch((e: unknown) => e);
    const { cuerpo, opciones } = error(codigo, estado, estado === 429 ? { reintentarEnSegundos: 42 } : undefined);
    controlador.expectOne(`${API}/usuarios/yo/correo/verificacion`).flush(cuerpo, opciones);
    const resultado = (await respuesta) as ErrorApi;
    expect(resultado).toBeInstanceOf(ErrorApi);
    expect(resultado.estado).toBe(estado);
    expect(resultado.codigo).toBe(codigo);
    if (estado === 429) {
      expect(resultado.detalles?.['reintentarEnSegundos']).toBe(42);
    }
  });

  it('POST /usuarios/yo/correo/confirmacion con { codigo } → 204', async () => {
    const respuesta = api.confirmarVerificacionCorreo('482913');
    const solicitud = controlador.expectOne(`${API}/usuarios/yo/correo/confirmacion`);
    expect(solicitud.request.method).toBe('POST');
    expect(solicitud.request.body).toEqual({ codigo: '482913' });
    solicitud.flush(null, { status: 204, statusText: 'No Content' });
    await expect(respuesta).resolves.toBeUndefined();
  });

  it.each([
    ['CODIGO_INVALIDO', 422],
    ['DEMASIADAS_SOLICITUDES', 429],
  ])('confirmación: %s (%s) llega como ErrorApi', async (codigo, estado) => {
    const respuesta = api.confirmarVerificacionCorreo('000000').catch((e: unknown) => e);
    const { cuerpo, opciones } = error(codigo, estado);
    controlador.expectOne(`${API}/usuarios/yo/correo/confirmacion`).flush(cuerpo, opciones);
    expect(((await respuesta) as ErrorApi).codigo).toBe(codigo);
  });

  it('POST /autenticacion/recuperacion/solicitud con { correo } → 204 (público)', async () => {
    const respuesta = api.solicitarRecuperacionPorCorreo('vendedora@correo.com');
    const solicitud = controlador.expectOne(`${API}/autenticacion/recuperacion/solicitud`);
    expect(solicitud.request.method).toBe('POST');
    expect(solicitud.request.body).toEqual({ correo: 'vendedora@correo.com' });
    solicitud.flush(null, { status: 204, statusText: 'No Content' });
    await expect(respuesta).resolves.toBeUndefined();
  });

  it('la solicitud de recuperación responde 429 como ErrorApi', async () => {
    const respuesta = api.solicitarRecuperacionPorCorreo('a@b.com').catch((e: unknown) => e);
    const { cuerpo, opciones } = error('DEMASIADAS_SOLICITUDES', 429);
    controlador.expectOne(`${API}/autenticacion/recuperacion/solicitud`).flush(cuerpo, opciones);
    expect(((await respuesta) as ErrorApi).estado).toBe(429);
  });

  it('POST /autenticacion/recuperacion con correo, código y clave nueva → 204', async () => {
    const cuerpo = { correo: 'vendedora@correo.com', codigo: '482913', claveNueva: 'NuevaClave2026' };
    const respuesta = api.restablecerClave(cuerpo);
    const solicitud = controlador.expectOne(`${API}/autenticacion/recuperacion`);
    expect(solicitud.request.method).toBe('POST');
    expect(solicitud.request.body).toEqual(cuerpo);
    solicitud.flush(null, { status: 204, statusText: 'No Content' });
    await expect(respuesta).resolves.toBeUndefined();
  });

  it('la recuperación con código inválido responde 422 CODIGO_INVALIDO', async () => {
    const respuesta = api
      .restablecerClave({ correo: 'a@b.com', codigo: '111111', claveNueva: 'NuevaClave2026' })
      .catch((e: unknown) => e);
    const { cuerpo, opciones } = error('CODIGO_INVALIDO', 422);
    controlador.expectOne(`${API}/autenticacion/recuperacion`).flush(cuerpo, opciones);
    expect(((await respuesta) as ErrorApi).codigo).toBe('CODIGO_INVALIDO');
  });
});
