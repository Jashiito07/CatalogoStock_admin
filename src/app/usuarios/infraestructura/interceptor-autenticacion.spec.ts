import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { interceptorErrores } from '../../compartido/infraestructura/http/interceptor-errores';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { AlmacenTokenRenovacion, ApiAutenticacion } from '../aplicacion/puertos';
import { SesionVendedor } from '../aplicacion/sesion-vendedor';
import { Sesion } from '../dominio/usuario';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
  errorSinConexion,
  errorTokenInvalido,
} from '../pruebas/dobles-sesion';
import { esRutaProtegidaDeLaApi, interceptorAutenticacion } from './interceptor-autenticacion';

const API = 'http://api.prueba/api/v1';

const TOKEN_VENCIDO = { codigo: 'TOKEN_VENCIDO', mensaje: 'La sesión venció.' };
const NO_AUTENTICADO = { codigo: 'NO_AUTENTICADO', mensaje: 'Inicie sesión.' };
const NO_AUTORIZADO_401 = { status: 401, statusText: 'Unauthorized' };

/** Deja correr las promesas y temporizadores pendientes. */
const esperar = () => new Promise<void>((resolver) => setTimeout(resolver, 0));

function diferida<T>() {
  let resolver!: (valor: T) => void;
  const promesa = new Promise<T>((r) => (resolver = r));
  return { promesa, resolver };
}

describe('interceptorAutenticacion', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;
  let api: ApiAutenticacionFalsa;
  let almacen: AlmacenEnMemoria;
  let sesion: SesionVendedor;
  let navegar: ReturnType<typeof vi.spyOn>;
  let sesionInicial: Sesion;

  beforeEach(async () => {
    api = crearApiFalsa();
    almacen = new AlmacenEnMemoria();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptorAutenticacion, interceptorErrores])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: URL_API, useValue: API },
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: almacen },
      ],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
    sesion = TestBed.inject(SesionVendedor);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    sesionInicial = crearSesion();
    api.ingresarVendedor.mockResolvedValue(sesionInicial);
    await sesion.ingresar('vendedora@correo.com', 'Clave2026');
  });

  afterEach(() => controlador.verify());

  it('adjunta Authorization: Bearer <tokenAcceso> a las rutas protegidas de la API', async () => {
    const respuesta = firstValueFrom(http.get(`${API}/auditoria`));
    const solicitud = controlador.expectOne(`${API}/auditoria`);
    expect(solicitud.request.headers.get('Authorization')).toBe(
      `Bearer ${sesionInicial.tokenAcceso}`,
    );
    solicitud.flush({ elementos: [] });
    await respuesta;
  });

  it('no adjunta el token al ingreso, a la renovación ni a otros servidores', async () => {
    for (const url of [
      `${API}/autenticacion/ingreso/vendedor`,
      `${API}/autenticacion/renovacion`,
      'https://otro.servidor/api/v1/auditoria',
    ]) {
      const respuesta = firstValueFrom(http.post(url, {}));
      const solicitud = controlador.expectOne(url);
      expect(solicitud.request.headers.has('Authorization')).toBe(false);
      solicitud.flush({});
      await respuesta;
    }
  });

  it('ante varias 401 TOKEN_VENCIDO simultáneas renueva una sola vez y repite cada solicitud una vez', async () => {
    const renovacion = diferida<Sesion>();
    api.renovar.mockReturnValue(renovacion.promesa);
    const rutas = ['/auditoria?pagina=1', '/usuarios/yo', '/auditoria?pagina=2'];

    const respuestas = rutas.map((ruta) => firstValueFrom(http.get(`${API}${ruta}`)));
    for (const ruta of rutas) {
      controlador.expectOne(`${API}${ruta}`).flush(TOKEN_VENCIDO, NO_AUTORIZADO_401);
    }
    await esperar();

    expect(api.renovar).toHaveBeenCalledTimes(1);
    expect(api.renovar).toHaveBeenCalledWith(sesionInicial.tokenRenovacion);

    const nueva = crearSesion();
    renovacion.resolver(nueva);
    await esperar();

    for (const ruta of rutas) {
      const reintento = controlador.expectOne(`${API}${ruta}`);
      expect(reintento.request.headers.get('Authorization')).toBe(`Bearer ${nueva.tokenAcceso}`);
      reintento.flush({ ruta });
    }
    await expect(Promise.all(respuestas)).resolves.toEqual(rutas.map((ruta) => ({ ruta })));
    expect(api.renovar).toHaveBeenCalledTimes(1);
    expect(almacen.valor).toBe(nueva.tokenRenovacion);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('si otra solicitud ya renovó, reintenta con el token actual sin volver a renovar', async () => {
    const nueva = crearSesion();
    api.renovar.mockResolvedValue(nueva);

    const primera = firstValueFrom(http.get(`${API}/auditoria`));
    const solicitudPrimera = controlador.expectOne(`${API}/auditoria`);
    const segunda = firstValueFrom(http.get(`${API}/usuarios/yo`));
    const solicitudSegunda = controlador.expectOne(`${API}/usuarios/yo`);

    solicitudPrimera.flush(TOKEN_VENCIDO, NO_AUTORIZADO_401);
    await esperar();
    controlador.expectOne(`${API}/auditoria`).flush({});
    await primera;

    solicitudSegunda.flush(TOKEN_VENCIDO, NO_AUTORIZADO_401);
    await esperar();
    const reintento = controlador.expectOne(`${API}/usuarios/yo`);
    expect(reintento.request.headers.get('Authorization')).toBe(`Bearer ${nueva.tokenAcceso}`);
    reintento.flush({});
    await segunda;

    expect(api.renovar).toHaveBeenCalledTimes(1);
  });

  it('si la renovación es rechazada (TOKEN_INVALIDO) cierra la sesión y lleva al ingreso', async () => {
    api.renovar.mockRejectedValue(errorTokenInvalido());

    const respuesta = firstValueFrom(http.get(`${API}/auditoria`)).catch((e: unknown) => e);
    controlador.expectOne(`${API}/auditoria`).flush(TOKEN_VENCIDO, NO_AUTORIZADO_401);
    const error = await respuesta;

    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).codigo).toBe('TOKEN_INVALIDO');
    expect(sesion.activa()).toBe(false);
    expect(sesion.obtenerTokenAcceso()).toBeNull();
    expect(almacen.valor).toBeNull();
    expect(navegar).toHaveBeenCalledWith(['/ingreso'], {
      queryParams: { motivo: 'sesion-terminada' },
    });
    controlador.expectNone(`${API}/auditoria`);
  });

  it('si la renovación falla por falta de conexión, conserva la sesión y no navega', async () => {
    api.renovar.mockRejectedValue(errorSinConexion());

    const respuesta = firstValueFrom(http.get(`${API}/auditoria`)).catch((e: unknown) => e);
    controlador.expectOne(`${API}/auditoria`).flush(TOKEN_VENCIDO, NO_AUTORIZADO_401);
    const error = (await respuesta) as ErrorApi;

    expect(error.codigo).toBe('SIN_CONEXION');
    expect(sesion.activa()).toBe(true);
    expect(navegar).not.toHaveBeenCalled();
  });

  it('un segundo 401 después de renovar no vuelve a renovar y cierra la sesión', async () => {
    api.renovar.mockResolvedValue(crearSesion());

    const respuesta = firstValueFrom(http.get(`${API}/auditoria`)).catch((e: unknown) => e);
    controlador.expectOne(`${API}/auditoria`).flush(TOKEN_VENCIDO, NO_AUTORIZADO_401);
    await esperar();
    controlador.expectOne(`${API}/auditoria`).flush(TOKEN_VENCIDO, NO_AUTORIZADO_401);
    const error = (await respuesta) as ErrorApi;

    expect(error.codigo).toBe('TOKEN_VENCIDO');
    expect(api.renovar).toHaveBeenCalledTimes(1);
    expect(sesion.activa()).toBe(false);
    expect(navegar).toHaveBeenCalledTimes(1);
  });

  it('cualquier otro 401 (NO_AUTENTICADO) cierra la sesión sin intentar renovar', async () => {
    const respuesta = firstValueFrom(http.get(`${API}/auditoria`)).catch((e: unknown) => e);
    controlador.expectOne(`${API}/auditoria`).flush(NO_AUTENTICADO, NO_AUTORIZADO_401);
    const error = (await respuesta) as ErrorApi;

    expect(error.codigo).toBe('NO_AUTENTICADO');
    expect(api.renovar).not.toHaveBeenCalled();
    expect(sesion.activa()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/ingreso'], {
      queryParams: { motivo: 'sesion-terminada' },
    });
  });

  it('CA-02: un 403 NO_AUTORIZADO no renueva ni cierra la sesión; llega a la pantalla', async () => {
    const respuesta = firstValueFrom(http.get(`${API}/auditoria`)).catch((e: unknown) => e);
    controlador
      .expectOne(`${API}/auditoria`)
      .flush(
        { codigo: 'NO_AUTORIZADO', mensaje: 'No tiene permiso.' },
        { status: 403, statusText: 'Forbidden' },
      );
    const error = (await respuesta) as ErrorApi;

    expect(error.estado).toBe(403);
    expect(api.renovar).not.toHaveBeenCalled();
    expect(sesion.activa()).toBe(true);
  });
});

describe('esRutaProtegidaDeLaApi', () => {
  it.each([
    [`${API}/auditoria`, true],
    [`${API}/auditoria?pagina=2`, true],
    [`${API}/autenticacion/salida`, true],
    [`${API}/usuarios/yo`, true],
    [`${API}/autenticacion/ingreso/vendedor`, false],
    [`${API}/autenticacion/renovacion`, false],
    ['http://otro/api/v1/auditoria', false],
    [`${API}x/auditoria`, false],
  ])('%s → %s', (url, esperado) => {
    expect(esRutaProtegidaDeLaApi(url, API)).toBe(esperado);
  });

  it('funciona con la URL relativa de producción', () => {
    expect(esRutaProtegidaDeLaApi('/api/v1/auditoria', '/api/v1')).toBe(true);
    expect(esRutaProtegidaDeLaApi('/api/v1/autenticacion/renovacion', '/api/v1')).toBe(false);
  });
});
