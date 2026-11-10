import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { interceptorErrores } from '../../compartido/infraestructura/http/interceptor-errores';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { CodigoRecuperacion, PaginaClientes } from '../dominio/cliente';
import { ApiClientesHttp } from './api-clientes.http';

const API = 'http://api.prueba/api/v1';
const ID_CLIENTE = '6f1c0000-0000-4000-8000-000000000001';

const PAGINA: PaginaClientes = {
  elementos: [
    {
      id: ID_CLIENTE,
      nombre: 'María Zambrano',
      correo: 'maria.zambrano@correo.com',
      telefono: '+593991234567',
      activo: true,
      creadoEn: '2026-11-05T15:15:00Z',
      codigoRecuperacionVigenteHasta: null,
    },
  ],
  pagina: 1,
  tamanio: 20,
  total: 1,
};

describe('ApiClientesHttp (contrato recuperacion-clave, RF-USU-05)', () => {
  let api: ApiClientesHttp;
  let controlador: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptorErrores])),
        provideHttpClientTesting(),
        { provide: URL_API, useValue: API },
        ApiClientesHttp,
      ],
    });
    api = TestBed.inject(ApiClientesHttp);
    controlador = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controlador.verify());

  it('GET /usuarios con pagina y tamanio, sin búsqueda', async () => {
    const respuesta = api.listar({ pagina: 1, tamanio: 20 });
    const solicitud = controlador.expectOne((s) => s.url === `${API}/usuarios`);
    expect(solicitud.request.method).toBe('GET');
    expect(solicitud.request.params.get('pagina')).toBe('1');
    expect(solicitud.request.params.get('tamanio')).toBe('20');
    expect(solicitud.request.params.has('busqueda')).toBe(false);
    solicitud.flush(PAGINA);
    await expect(respuesta).resolves.toEqual(PAGINA);
  });

  it('GET /usuarios envía la búsqueda', async () => {
    const respuesta = api.listar({ pagina: 2, tamanio: 50, busqueda: 'maría' });
    const solicitud = controlador.expectOne((s) => s.url === `${API}/usuarios`);
    expect(solicitud.request.urlWithParams).toBe(
      `${API}/usuarios?pagina=2&tamanio=50&busqueda=mar%C3%ADa`,
    );
    solicitud.flush({ ...PAGINA, pagina: 2, tamanio: 50 });
    await respuesta;
  });

  it('CA-02: un 403 llega como ErrorApi NO_AUTORIZADO', async () => {
    const respuesta = api.listar({ pagina: 1, tamanio: 20 }).catch((e: unknown) => e);
    controlador
      .expectOne((s) => s.url === `${API}/usuarios`)
      .flush(
        { codigo: 'NO_AUTORIZADO', mensaje: 'No tiene permiso para esta acción.' },
        { status: 403, statusText: 'Forbidden' },
      );
    const error = (await respuesta) as ErrorApi;
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.estado).toBe(403);
  });

  it('POST /usuarios/{id}/codigo-recuperacion sin cuerpo → 201 con el código', async () => {
    const codigo: CodigoRecuperacion = {
      codigo: '482913',
      venceEn: '2026-11-09T15:30:00Z',
      cliente: { id: ID_CLIENTE, nombre: 'María Zambrano', correo: 'maria.zambrano@correo.com' },
    };
    const respuesta = api.generarCodigoRecuperacion(ID_CLIENTE);
    const solicitud = controlador.expectOne(`${API}/usuarios/${ID_CLIENTE}/codigo-recuperacion`);
    expect(solicitud.request.method).toBe('POST');
    expect(solicitud.request.body).toBeNull();
    solicitud.flush(codigo, { status: 201, statusText: 'Created' });
    await expect(respuesta).resolves.toEqual(codigo);
  });

  it.each([
    [404, 'NO_ENCONTRADO', 'No existe el cliente.'],
    [422, 'CUENTA_INACTIVA', 'La cuenta está inactiva.'],
  ])('un %i %s llega como ErrorApi', async (estado, codigoError, mensaje) => {
    const respuesta = api.generarCodigoRecuperacion(ID_CLIENTE).catch((e: unknown) => e);
    controlador
      .expectOne(`${API}/usuarios/${ID_CLIENTE}/codigo-recuperacion`)
      .flush({ codigo: codigoError, mensaje }, { status: estado, statusText: 'Error' });
    const error = (await respuesta) as ErrorApi;
    expect(error.codigo).toBe(codigoError);
    expect(error.estado).toBe(estado);
  });
});
