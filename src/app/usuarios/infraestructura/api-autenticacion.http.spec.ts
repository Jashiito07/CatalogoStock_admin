import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { interceptorErrores } from '../../compartido/infraestructura/http/interceptor-errores';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { crearSesion, crearUsuario } from '../pruebas/dobles-sesion';
import { ApiAutenticacionHttp } from './api-autenticacion.http';

const API = 'http://api.prueba/api/v1';

describe('ApiAutenticacionHttp (contrato de usuarios)', () => {
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

  it('D-19: el panel ingresa solo por /autenticacion/ingreso/vendedor', async () => {
    const sesion = crearSesion();
    const respuesta = api.ingresarVendedor('vendedora@correo.com', 'Clave2026');

    const solicitud = controlador.expectOne(`${API}/autenticacion/ingreso/vendedor`);
    expect(solicitud.request.method).toBe('POST');
    expect(solicitud.request.body).toEqual({ correo: 'vendedora@correo.com', clave: 'Clave2026' });
    solicitud.flush(sesion);

    await expect(respuesta).resolves.toEqual(sesion);
    controlador.expectNone(`${API}/autenticacion/ingreso/cliente`);
  });

  it('CA-01: credenciales incorrectas llegan como ErrorApi CREDENCIALES_INVALIDAS', async () => {
    const respuesta = api.ingresarVendedor('cliente@correo.com', 'Clave2026').catch((e: unknown) => e);
    controlador
      .expectOne(`${API}/autenticacion/ingreso/vendedor`)
      .flush(
        { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Correo o clave incorrectos.' },
        { status: 401, statusText: 'Unauthorized' },
      );

    const error = (await respuesta) as ErrorApi;
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.codigo).toBe('CREDENCIALES_INVALIDAS');
    expect(error.mensaje).toBe('Correo o clave incorrectos.');
  });

  it('renueva con POST /autenticacion/renovacion y el token de renovación', async () => {
    const sesion = crearSesion();
    const respuesta = api.renovar('renovacion-anterior');
    const solicitud = controlador.expectOne(`${API}/autenticacion/renovacion`);
    expect(solicitud.request.method).toBe('POST');
    expect(solicitud.request.body).toEqual({ tokenRenovacion: 'renovacion-anterior' });
    solicitud.flush(sesion);
    await expect(respuesta).resolves.toEqual(sesion);
  });

  it('cierra sesión con POST /autenticacion/salida (204 sin cuerpo)', async () => {
    const respuesta = api.salir('renovacion-actual');
    const solicitud = controlador.expectOne(`${API}/autenticacion/salida`);
    expect(solicitud.request.method).toBe('POST');
    expect(solicitud.request.body).toEqual({ tokenRenovacion: 'renovacion-actual' });
    solicitud.flush(null, { status: 204, statusText: 'No Content' });
    await expect(respuesta).resolves.toBeUndefined();
  });

  it('consulta el usuario actual con GET /usuarios/yo', async () => {
    const usuario = crearUsuario();
    const respuesta = api.obtenerUsuarioActual();
    const solicitud = controlador.expectOne(`${API}/usuarios/yo`);
    expect(solicitud.request.method).toBe('GET');
    solicitud.flush(usuario);
    await expect(respuesta).resolves.toEqual(usuario);
  });

  describe('POST /usuarios/yo/clave (RF-USU-05)', () => {
    const cuerpo = {
      claveActual: 'Catalogo2026',
      claveNueva: 'NuevaClave2026',
      tokenRenovacionActual: 'renovacion-actual',
    };

    it('envía la clave actual, la nueva y el token de renovación; 204 sin cuerpo', async () => {
      const respuesta = api.cambiarClave(cuerpo);
      const solicitud = controlador.expectOne(`${API}/usuarios/yo/clave`);
      expect(solicitud.request.method).toBe('POST');
      expect(solicitud.request.body).toEqual(cuerpo);
      solicitud.flush(null, { status: 204, statusText: 'No Content' });
      await expect(respuesta).resolves.toBeUndefined();
    });

    it('422 CLAVE_ACTUAL_INCORRECTA llega como ErrorApi', async () => {
      const respuesta = api.cambiarClave(cuerpo).catch((e: unknown) => e);
      controlador
        .expectOne(`${API}/usuarios/yo/clave`)
        .flush(
          { codigo: 'CLAVE_ACTUAL_INCORRECTA', mensaje: 'La clave actual no es correcta.' },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      const error = (await respuesta) as ErrorApi;
      expect(error).toBeInstanceOf(ErrorApi);
      expect(error.codigo).toBe('CLAVE_ACTUAL_INCORRECTA');
      expect(error.estado).toBe(422);
    });
  });
});
