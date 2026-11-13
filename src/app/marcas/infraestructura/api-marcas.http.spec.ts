import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { interceptorErrores } from '../../compartido/infraestructura/http/interceptor-errores';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { Marca } from '../dominio/marca';
import { ApiMarcasHttp } from './api-marcas.http';

const API = 'http://api.prueba/api/v1';

const MARCA: Marca = {
  id: '6f1c0000-0000-4000-8000-000000000001',
  nombre: 'Yanbal',
  color: '#FC5823',
  colorAcento: null,
  textoSobreColor: '#1E293B',
  textoSobreAcento: null,
  activa: true,
  orden: 0,
  creadaEn: '2026-11-11T10:00:00Z',
};

describe('ApiMarcasHttp (contrato productos.md, «Endpoints: marcas»)', () => {
  let api: ApiMarcasHttp;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptorErrores])),
        provideHttpClientTesting(),
        { provide: URL_API, useValue: API },
        ApiMarcasHttp,
      ],
    });
    api = TestBed.inject(ApiMarcasHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('RF-PRO-04: GET /marcas?incluirInactivas=true devuelve `elementos`', async () => {
    const promesa = api.listar(true);
    const peticion = http.expectOne((p) => p.url === `${API}/marcas`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('incluirInactivas')).toBe('true');
    peticion.flush({ elementos: [MARCA] });
    expect(await promesa).toEqual([MARCA]);
  });

  it('GET /marcas sin el parámetro cuando no se piden inactivas', async () => {
    const promesa = api.listar(false);
    const peticion = http.expectOne(`${API}/marcas`);
    expect(peticion.request.params.has('incluirInactivas')).toBe(false);
    peticion.flush({ elementos: [] });
    expect(await promesa).toEqual([]);
  });

  it('RF-PRO-06: GET /marcas/sugeridas', async () => {
    const promesa = api.sugeridas();
    const peticion = http.expectOne(`${API}/marcas/sugeridas`);
    expect(peticion.request.method).toBe('GET');
    const sugerida = { nombre: 'Avon', color: '#FF2469', colorAcento: null, yaCreada: false };
    peticion.flush({ elementos: [sugerida] });
    expect(await promesa).toEqual([sugerida]);
  });

  it('POST /marcas envía nombre, color y colorAcento (sin orden)', async () => {
    const promesa = api.crear({ nombre: 'Leonisa', color: '#222221', colorAcento: '#F36E21' });
    const peticion = http.expectOne(`${API}/marcas`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      nombre: 'Leonisa',
      color: '#222221',
      colorAcento: '#F36E21',
    });
    peticion.flush(MARCA, { status: 201, statusText: 'Created' });
    expect(await promesa).toEqual(MARCA);
  });

  it('409 MARCA_DUPLICADA llega como ErrorApi', async () => {
    const promesa = api.crear({ nombre: 'Yanbal', color: '#FC5823', colorAcento: null });
    http
      .expectOne(`${API}/marcas`)
      .flush(
        { codigo: 'MARCA_DUPLICADA', mensaje: 'Ya existe.' },
        { status: 409, statusText: 'Conflict' },
      );
    const error = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).codigo).toBe('MARCA_DUPLICADA');
    expect((error as ErrorApi).estado).toBe(409);
  });

  it('PATCH /marcas/{id} con cuerpo parcial; colorAcento null lo quita', async () => {
    const promesa = api.actualizar(MARCA.id, { colorAcento: null, activa: false });
    const peticion = http.expectOne(`${API}/marcas/${MARCA.id}`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ colorAcento: null, activa: false });
    peticion.flush({ ...MARCA, activa: false });
    expect((await promesa).activa).toBe(false);
  });

  it('no existe DELETE: el adaptador no lo ofrece', () => {
    expect('eliminar' in api).toBe(false);
  });
});
