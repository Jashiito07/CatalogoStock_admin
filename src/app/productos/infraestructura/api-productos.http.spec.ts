import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { interceptorErrores } from '../../compartido/infraestructura/http/interceptor-errores';
import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { ImagenProducto, Producto } from '../dominio/producto';
import { ApiProductosHttp, resolverUrlImagen } from './api-productos.http';

const API = 'http://api.prueba/api/v1';
const ID = '9a1c0000-0000-4000-8000-000000000001';

const PRODUCTO: Producto = {
  id: ID,
  nombre: 'Crema hidratante Ésika 50 g',
  marca: {
    id: '6f1c0000-0000-4000-8000-000000000001',
    nombre: 'Esika',
    color: '#E1251B',
    colorAcento: null,
    textoSobreColor: '#FFFFFF',
    textoSobreAcento: null,
  },
  precio: '12.50',
  descripcion: 'Crema facial de uso diario.',
  disponibilidad: 'DISPONIBLE',
  imagenes: [],
  creadoEn: '2026-11-12T10:00:00Z',
  actualizadoEn: '2026-11-12T10:00:00Z',
};

const IMAGEN: ImagenProducto = {
  id: 'a1c00000-0000-4000-8000-000000000001',
  url: '/api/v1/imagenes/a1c00000-0000-4000-8000-000000000001.png',
  orden: 0,
  principal: true,
};

describe('ApiProductosHttp (contrato productos.md, «Endpoints: productos» e «imágenes»)', () => {
  let api: ApiProductosHttp;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptorErrores])),
        provideHttpClientTesting(),
        { provide: URL_API, useValue: API },
        ApiProductosHttp,
      ],
    });
    api = TestBed.inject(ApiProductosHttp);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('RF-CAT-03: GET /productos con pagina, tamanio, marcaId, busqueda y disponibilidad', async () => {
    const promesa = api.listar({
      pagina: 2,
      tamanio: 10,
      marcaId: PRODUCTO.marca.id,
      busqueda: 'crema',
      disponibilidad: 'AGOTADO',
    });
    const peticion = http.expectOne((p) => p.url === `${API}/productos`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('pagina')).toBe('2');
    expect(peticion.request.params.get('tamanio')).toBe('10');
    expect(peticion.request.params.get('marcaId')).toBe(PRODUCTO.marca.id);
    expect(peticion.request.params.get('busqueda')).toBe('crema');
    expect(peticion.request.params.get('disponibilidad')).toBe('AGOTADO');
    const cuerpo = { elementos: [PRODUCTO], pagina: 2, tamanio: 10, total: 11 };
    peticion.flush(cuerpo);
    expect(await promesa).toEqual(cuerpo);
  });

  it('GET /productos omite los filtros vacíos', async () => {
    const promesa = api.listar({ pagina: 1, tamanio: 20 });
    const peticion = http.expectOne((p) => p.url === `${API}/productos`);
    expect(peticion.request.params.keys().sort()).toEqual(['pagina', 'tamanio']);
    peticion.flush({ elementos: [], pagina: 1, tamanio: 20, total: 0 });
    expect((await promesa).total).toBe(0);
  });

  it('GET /productos/{id}', async () => {
    const promesa = api.obtener(ID);
    const peticion = http.expectOne(`${API}/productos/${ID}`);
    expect(peticion.request.method).toBe('GET');
    peticion.flush(PRODUCTO);
    expect(await promesa).toEqual(PRODUCTO);
  });

  it('CA-04: POST /productos envía el precio como texto decimal', async () => {
    const promesa = api.crear({
      nombre: PRODUCTO.nombre,
      marcaId: PRODUCTO.marca.id,
      precio: '12.50',
      descripcion: 'Crema facial de uso diario.',
      disponibilidad: 'DISPONIBLE',
    });
    const peticion = http.expectOne(`${API}/productos`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      nombre: PRODUCTO.nombre,
      marcaId: PRODUCTO.marca.id,
      precio: '12.50',
      descripcion: 'Crema facial de uso diario.',
      disponibilidad: 'DISPONIBLE',
    });
    expect(typeof (peticion.request.body as { precio: unknown }).precio).toBe('string');
    peticion.flush(PRODUCTO, { status: 201, statusText: 'Created' });
    expect(await promesa).toEqual(PRODUCTO);
  });

  it('422 MARCA_INACTIVA llega como ErrorApi', async () => {
    const promesa = api.crear({ nombre: 'X1', marcaId: 'm', precio: '1.00' });
    http
      .expectOne(`${API}/productos`)
      .flush(
        { codigo: 'MARCA_INACTIVA', mensaje: 'La marca está desactivada.' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    const error = await promesa.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).codigo).toBe('MARCA_INACTIVA');
    expect((error as ErrorApi).estado).toBe(422);
  });

  it('CA-05, CA-07: PATCH /productos/{id} con cuerpo parcial', async () => {
    const promesa = api.actualizar(ID, { precio: '15.00', disponibilidad: 'AGOTADO' });
    const peticion = http.expectOne(`${API}/productos/${ID}`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ precio: '15.00', disponibilidad: 'AGOTADO' });
    peticion.flush({ ...PRODUCTO, precio: '15.00', disponibilidad: 'AGOTADO' });
    expect((await promesa).precio).toBe('15.00');
  });

  it('400 DATOS_INVALIDOS conserva los detalles por campo', async () => {
    const promesa = api.actualizar(ID, { precio: '0' });
    http.expectOne(`${API}/productos/${ID}`).flush(
      {
        codigo: 'DATOS_INVALIDOS',
        mensaje: 'Datos inválidos.',
        detalles: { errores: [{ campo: 'precio', errores: ['Precio inválido'] }] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    const error = (await promesa.catch((e: unknown) => e)) as ErrorApi;
    expect(error.estado).toBe(400);
    expect(error.detalles).toEqual({ errores: [{ campo: 'precio', errores: ['Precio inválido'] }] });
  });

  it('CA-06: DELETE /productos/{id} responde 204', async () => {
    const promesa = api.eliminar(ID);
    const peticion = http.expectOne(`${API}/productos/${ID}`);
    expect(peticion.request.method).toBe('DELETE');
    peticion.flush(null, { status: 204, statusText: 'No Content' });
    await expect(promesa).resolves.toBeNull();
  });

  it('404 al eliminar llega como ErrorApi', async () => {
    const promesa = api.eliminar(ID);
    http
      .expectOne(`${API}/productos/${ID}`)
      .flush({ codigo: 'NO_ENCONTRADO', mensaje: 'No existe.' }, { status: 404, statusText: 'Not Found' });
    expect(((await promesa.catch((e: unknown) => e)) as ErrorApi).estado).toBe(404);
  });

  describe('imágenes (D-46)', () => {
    it('POST /productos/{id}/imagenes es multipart con el campo «archivo»', async () => {
      const archivo = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' });
      const promesa = api.subirImagen(ID, archivo);
      const peticion = http.expectOne(`${API}/productos/${ID}/imagenes`);
      expect(peticion.request.method).toBe('POST');
      const cuerpo = peticion.request.body as FormData;
      expect(cuerpo).toBeInstanceOf(FormData);
      expect(cuerpo.get('archivo')).toBeInstanceOf(File);
      expect((cuerpo.get('archivo') as File).name).toBe('foto.png');
      // No se fija Content-Type: el navegador agrega el límite del multipart.
      expect(peticion.request.headers.has('Content-Type')).toBe(false);
      peticion.flush(IMAGEN, { status: 201, statusText: 'Created' });
      expect(await promesa).toEqual(IMAGEN);
    });

    it.each([
      [413, 'ARCHIVO_DEMASIADO_GRANDE'],
      [415, 'TIPO_NO_ADMITIDO'],
      [422, 'LIMITE_IMAGENES'],
    ])('el error %i %s llega como ErrorApi', async (estado, codigo) => {
      const promesa = api.subirImagen(ID, new File(['x'], 'a.png', { type: 'image/png' }));
      http
        .expectOne(`${API}/productos/${ID}/imagenes`)
        .flush({ codigo, mensaje: 'Error.' }, { status: estado, statusText: 'Error' });
      const error = (await promesa.catch((e: unknown) => e)) as ErrorApi;
      expect(error.estado).toBe(estado);
      expect(error.codigo).toBe(codigo);
    });

    it('PUT /productos/{id}/imagenes/orden envía todos los ids y devuelve la lista', async () => {
      const promesa = api.ordenarImagenes(ID, ['b', 'a']);
      const peticion = http.expectOne(`${API}/productos/${ID}/imagenes/orden`);
      expect(peticion.request.method).toBe('PUT');
      expect(peticion.request.body).toEqual({ ids: ['b', 'a'] });
      peticion.flush([IMAGEN]);
      expect(await promesa).toEqual([IMAGEN]);
    });

    it('DELETE /productos/{id}/imagenes/{imagenId} responde 204', async () => {
      const promesa = api.eliminarImagen(ID, IMAGEN.id);
      const peticion = http.expectOne(`${API}/productos/${ID}/imagenes/${IMAGEN.id}`);
      expect(peticion.request.method).toBe('DELETE');
      peticion.flush(null, { status: 204, statusText: 'No Content' });
      await expect(promesa).resolves.toBeNull();
    });

    it('las URL públicas se resuelven contra el origen de la API', () => {
      expect(api.urlImagen(IMAGEN.url)).toBe(`http://api.prueba${IMAGEN.url}`);
      expect(resolverUrlImagen('/api/v1', IMAGEN.url)).toBe(IMAGEN.url);
      expect(resolverUrlImagen(API, 'https://cdn.prueba/x.jpg')).toBe('https://cdn.prueba/x.jpg');
    });
  });
});
