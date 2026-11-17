import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { interceptorErrores } from '../../compartido/infraestructura/http/interceptor-errores';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { ApiClientesHttp } from './api-clientes.http';

const API = 'http://api.prueba/api/v1';

describe('ApiClientesHttp: correo verificado (contrato usuarios-gestion)', () => {
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

  const solicitudLista = () => controlador.expectOne((s) => s.url === `${API}/usuarios`);

  it('GET /usuarios entrega correoVerificadoEn (fecha o null) tal como llega', async () => {
    const respuesta = api.listar({ pagina: 1, tamanio: 20 });
    solicitudLista().flush({
      elementos: [
        { id: 'a', correoVerificadoEn: '2026-11-10T12:00:00Z' },
        { id: 'b', correoVerificadoEn: null },
        { id: 'c' },
      ],
      pagina: 1,
      tamanio: 20,
      total: 3,
    });
    const { elementos } = await respuesta;
    expect(elementos.map((e) => e.correoVerificadoEn)).toEqual([
      '2026-11-10T12:00:00Z',
      null,
      undefined,
    ]);
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('GET /usuarios acepta ?correoVerificado=%s', async (valor, texto) => {
    const respuesta = api.listar({ pagina: 1, tamanio: 20, correoVerificado: valor });
    const solicitud = solicitudLista();
    expect(solicitud.request.params.get('correoVerificado')).toBe(texto);
    solicitud.flush({ elementos: [], pagina: 1, tamanio: 20, total: 0 });
    await respuesta;
  });

  it('GET /usuarios sin filtro no envía ?correoVerificado=', async () => {
    const respuesta = api.listar({ pagina: 1, tamanio: 20 });
    const solicitud = solicitudLista();
    expect(solicitud.request.params.has('correoVerificado')).toBe(false);
    solicitud.flush({ elementos: [], pagina: 1, tamanio: 20, total: 0 });
    await respuesta;
  });

  it('combina correoVerificado con activo, busqueda y paginación', async () => {
    const respuesta = api.listar({
      pagina: 2,
      tamanio: 10,
      busqueda: 'ana',
      activo: true,
      correoVerificado: false,
    });
    const solicitud = solicitudLista();
    expect(solicitud.request.params.get('pagina')).toBe('2');
    expect(solicitud.request.params.get('tamanio')).toBe('10');
    expect(solicitud.request.params.get('busqueda')).toBe('ana');
    expect(solicitud.request.params.get('activo')).toBe('true');
    expect(solicitud.request.params.get('correoVerificado')).toBe('false');
    solicitud.flush({ elementos: [], pagina: 2, tamanio: 10, total: 0 });
    await respuesta;
  });

  it('contarSinCorreoVerificado: ?correoVerificado=false&tamanio=1 y devuelve el total', async () => {
    const respuesta = api.contarSinCorreoVerificado();
    const solicitud = solicitudLista();
    expect(solicitud.request.method).toBe('GET');
    expect(solicitud.request.params.get('correoVerificado')).toBe('false');
    expect(solicitud.request.params.get('tamanio')).toBe('1');
    expect(solicitud.request.params.get('pagina')).toBe('1');
    solicitud.flush({ elementos: [{ id: 'b', correoVerificadoEn: null }], pagina: 1, tamanio: 1, total: 7 });
    await expect(respuesta).resolves.toBe(7);
  });

  it.each([
    ['sin el campo (API antigua que ignora el filtro)', { id: 'x' }],
    ['con un cliente ya verificado (filtro ignorado)', { id: 'x', correoVerificadoEn: '2026-11-10T12:00:00Z' }],
  ])('contarSinCorreoVerificado devuelve 0 si la API devolvió %s', async (_caso, elemento) => {
    const respuesta = api.contarSinCorreoVerificado();
    solicitudLista().flush({ elementos: [elemento], pagina: 1, tamanio: 1, total: 41 });
    await expect(respuesta).resolves.toBe(0);
  });

  it('contarSinCorreoVerificado devuelve 0 si no hay clientes sin verificar', async () => {
    const respuesta = api.contarSinCorreoVerificado();
    solicitudLista().flush({ elementos: [], pagina: 1, tamanio: 1, total: 0 });
    await expect(respuesta).resolves.toBe(0);
  });

  it('contarSinCorreoVerificado propaga el error de la API como ErrorApi', async () => {
    const respuesta = api.contarSinCorreoVerificado().catch((e: unknown) => e);
    solicitudLista().flush(
      { codigo: 'DATOS_INVALIDOS', mensaje: 'Valor inválido.' },
      { status: 400, statusText: 'Bad Request' },
    );
    const error = (await respuesta) as ErrorApi;
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.estado).toBe(400);
  });
});
