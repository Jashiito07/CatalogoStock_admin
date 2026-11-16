import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { interceptorErrores } from '../../compartido/infraestructura/http/interceptor-errores';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { ApiClientesHttp } from './api-clientes.http';

const API = 'http://api.prueba/api/v1';
const ID = '6f1c0000-0000-4000-8000-000000000001';

describe('ApiClientesHttp: estado de la cuenta (contrato usuarios-gestion, D-53)', () => {
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

  it.each([true, false])('PATCH /usuarios/{id}/estado con { activo: %s }', async (activo) => {
    const respuesta = api.cambiarEstado(ID, activo);
    const solicitud = controlador.expectOne(`${API}/usuarios/${ID}/estado`);
    expect(solicitud.request.method).toBe('PATCH');
    expect(solicitud.request.body).toEqual({ activo });
    solicitud.flush({ id: ID, activo });
    await expect(respuesta).resolves.toEqual({ id: ID, activo });
  });

  it.each([
    [false, 'false'],
    [true, 'true'],
  ])('GET /usuarios acepta ?activo=%s', async (activo, texto) => {
    const respuesta = api.listar({ pagina: 1, tamanio: 20, activo });
    const solicitud = controlador.expectOne((s) => s.url === `${API}/usuarios`);
    expect(solicitud.request.params.get('activo')).toBe(texto);
    solicitud.flush({ elementos: [], pagina: 1, tamanio: 20, total: 0 });
    await respuesta;
  });

  it('GET /usuarios sin filtro no envía ?activo=', async () => {
    const respuesta = api.listar({ pagina: 1, tamanio: 20 });
    const solicitud = controlador.expectOne((s) => s.url === `${API}/usuarios`);
    expect(solicitud.request.params.has('activo')).toBe(false);
    solicitud.flush({ elementos: [], pagina: 1, tamanio: 20, total: 0 });
    await respuesta;
  });

  it.each([
    [403, 'NO_AUTORIZADO'],
    [404, 'USUARIO_NO_ENCONTRADO'],
    [422, 'OPERACION_NO_PERMITIDA'],
  ])('el %s llega como ErrorApi %s', async (estado, codigo) => {
    const respuesta = api.cambiarEstado(ID, false).catch((e: unknown) => e);
    controlador
      .expectOne(`${API}/usuarios/${ID}/estado`)
      .flush({ codigo, mensaje: 'Mensaje de la API.' }, { status: estado, statusText: 'Error' });
    const error = (await respuesta) as ErrorApi;
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.estado).toBe(estado);
    expect(error.codigo).toBe(codigo);
  });
});
