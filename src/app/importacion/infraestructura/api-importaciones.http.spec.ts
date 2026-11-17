import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { interceptorErrores } from '../../compartido/infraestructura/http/interceptor-errores';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import {
  borradorPrueba,
  ID_IMPORTACION,
  ID_MARCA,
  importacionPrueba,
  paginaBorradoresPrueba,
} from '../pruebas/dobles-importacion';
import { ApiImportacionesHttp } from './api-importaciones.http';

const API = 'http://api.prueba/api/v1';
const BASE = `${API}/productos/importaciones`;

describe('ApiImportacionesHttp (contrato productos-importacion.md, «Endpoints»)', () => {
  let api: ApiImportacionesHttp;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptorErrores])),
        provideHttpClientTesting(),
        { provide: URL_API, useValue: API },
        ApiImportacionesHttp,
      ],
    });
    api = TestBed.inject(ApiImportacionesHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('RF-PRO-01: POST /productos/importaciones en multipart con marcaId y archivo', async () => {
    const archivo = new File(['%PDF-1.4'], 'catalogo.pdf', { type: 'application/pdf' });
    const promesa = api.analizar(archivo, ID_MARCA);
    const peticion = http.expectOne(BASE);
    expect(peticion.request.method).toBe('POST');
    const cuerpo = peticion.request.body as FormData;
    expect(cuerpo).toBeInstanceOf(FormData);
    expect(cuerpo.get('marcaId')).toBe(ID_MARCA);
    expect((cuerpo.get('archivo') as File).name).toBe('catalogo.pdf');
    // El navegador fija el Content-Type con su límite.
    expect(peticion.request.headers.has('Content-Type')).toBe(false);
    peticion.flush(importacionPrueba(), { status: 201, statusText: 'Created' });
    expect((await promesa).id).toBe(ID_IMPORTACION);
  });

  it.each([
    [400, 'DATOS_INVALIDOS'],
    [404, 'MARCA_NO_ENCONTRADA'],
    [413, 'ARCHIVO_DEMASIADO_GRANDE'],
    [415, 'FORMATO_NO_PERMITIDO'],
    [422, 'PDF_ILEGIBLE'],
    [422, 'MARCA_INACTIVA'],
    [429, 'LIMITE_EXCEDIDO'],
  ])('al analizar, el %i %s llega como ErrorApi', async (estado, codigo) => {
    const promesa = api.analizar(new File(['x'], 'a.pdf'), ID_MARCA);
    http.expectOne(BASE).flush({ codigo, mensaje: 'm' }, { status: estado, statusText: 'Error' });
    await expect(promesa).rejects.toMatchObject({ codigo, estado });
  });

  it('409 IMPORTACION_DUPLICADA conserva el id de la importación existente', async () => {
    const promesa = api.analizar(new File(['x'], 'a.pdf'), ID_MARCA);
    http
      .expectOne(BASE)
      .flush(
        { codigo: 'IMPORTACION_DUPLICADA', mensaje: 'Este PDF ya fue importado.', detalles: { idImportacion: ID_IMPORTACION } },
        { status: 409, statusText: 'Conflict' },
      );
    const error = (await promesa.catch((e: unknown) => e)) as ErrorApi;
    expect(error).toBeInstanceOf(ErrorApi);
    expect(error.detalles?.['idImportacion']).toBe(ID_IMPORTACION);
  });

  it('GET /productos/importaciones/{id}', async () => {
    const promesa = api.obtener(ID_IMPORTACION);
    const peticion = http.expectOne(`${BASE}/${ID_IMPORTACION}`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(importacionPrueba());
    expect((await promesa).totales.pendientes).toBe(3);
  });

  it('GET …/borradores con pagina, tamanio, estado y filtros', async () => {
    const promesa = api.listarBorradores(ID_IMPORTACION, {
      pagina: 2,
      tamanio: 50,
      estado: 'PENDIENTE',
      conAdvertencias: true,
      busqueda: 'crema',
      paginaPdf: 12,
    });
    const peticion = http.expectOne((p) => p.url === `${BASE}/${ID_IMPORTACION}/borradores`);
    expect(peticion.request.params.get('pagina')).toBe('2');
    expect(peticion.request.params.get('tamanio')).toBe('50');
    expect(peticion.request.params.get('estado')).toBe('PENDIENTE');
    expect(peticion.request.params.get('conAdvertencias')).toBe('true');
    expect(peticion.request.params.get('busqueda')).toBe('crema');
    expect(peticion.request.params.get('paginaPdf')).toBe('12');
    peticion.flush(paginaBorradoresPrueba([borradorPrueba('b1')], {}, 1));
    expect((await promesa).elementos).toHaveLength(1);
  });

  it('GET …/borradores omite los filtros vacíos y siempre envía el estado', async () => {
    const promesa = api.listarBorradores(ID_IMPORTACION, { pagina: 1, tamanio: 20, estado: 'APROBADO' });
    const peticion = http.expectOne((p) => p.url === `${BASE}/${ID_IMPORTACION}/borradores`);
    expect(peticion.request.params.keys().sort()).toEqual(['estado', 'pagina', 'tamanio']);
    peticion.flush(paginaBorradoresPrueba([]));
    await promesa;
  });

  it('PATCH …/borradores/{id} con el cuerpo parcial y precio como texto', async () => {
    const promesa = api.editarBorrador('b1', { precio: '12.50', nombre: 'Crema' });
    const peticion = http.expectOne(`${BASE}/borradores/b1`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ precio: '12.50', nombre: 'Crema' });
    peticion.flush(borradorPrueba('b1', { precio: '12.50' }));
    expect((await promesa).precio).toBe('12.50');
  });

  it('PATCH: 400 por campo y 422 BORRADOR_NO_EDITABLE llegan como ErrorApi', async () => {
    const primera = api.editarBorrador('b1', { precio: '12.505' });
    http.expectOne(`${BASE}/borradores/b1`).flush(
      { codigo: 'DATOS_INVALIDOS', mensaje: 'x', detalles: { errores: [{ campo: 'precio', errores: ['Precio inválido'] }] } },
      { status: 400, statusText: 'Bad Request' },
    );
    await expect(primera).rejects.toMatchObject({ estado: 400, codigo: 'DATOS_INVALIDOS' });

    const segunda = api.editarBorrador('b2', { nombre: 'Otro' });
    http.expectOne(`${BASE}/borradores/b2`).flush(
      { codigo: 'BORRADOR_NO_EDITABLE', mensaje: 'x' },
      { status: 422, statusText: 'Unprocessable' },
    );
    await expect(segunda).rejects.toMatchObject({ estado: 422, codigo: 'BORRADOR_NO_EDITABLE' });
  });

  it('RF-PRO-01: POST …/borradores/aprobar con { ids } y resultado por borrador', async () => {
    const promesa = api.aprobar(['a', 'b']);
    const peticion = http.expectOne(`${BASE}/borradores/aprobar`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ ids: ['a', 'b'] });
    peticion.flush({
      resultados: [
        { id: 'a', estado: 'APROBADO', idProducto: 'p1' },
        { id: 'b', error: 'SIN_PRECIO' },
      ],
    });
    expect(await promesa).toEqual([
      { id: 'a', estado: 'APROBADO', idProducto: 'p1' },
      { id: 'b', error: 'SIN_PRECIO' },
    ]);
  });

  it('POST …/borradores/descartar con { ids }', async () => {
    const promesa = api.descartar(['a']);
    const peticion = http.expectOne(`${BASE}/borradores/descartar`);
    expect(peticion.request.body).toEqual({ ids: ['a'] });
    peticion.flush({ resultados: [{ id: 'a', estado: 'DESCARTADO' }] });
    expect(await promesa).toHaveLength(1);
  });

  it('un 404 al abrir una importación llega como ErrorApi', async () => {
    const promesa = api.obtener(ID_IMPORTACION);
    http.expectOne(`${BASE}/${ID_IMPORTACION}`).flush({ codigo: 'NO_ENCONTRADO', mensaje: 'x' }, { status: 404, statusText: 'Not Found' });
    await expect(promesa).rejects.toMatchObject({ estado: 404 });
  });
});
