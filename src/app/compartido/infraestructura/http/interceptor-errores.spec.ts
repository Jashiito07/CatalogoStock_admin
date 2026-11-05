import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { ErrorApi } from '../../aplicacion/error-api';
import {
  interceptorErrores,
  MENSAJE_ERROR_DESCONOCIDO,
  MENSAJE_SIN_CONEXION,
} from './interceptor-errores';

const URL = 'http://localhost:3000/api/v1/prueba';

describe('interceptorErrores', () => {
  let http: HttpClient;
  let controlador: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([interceptorErrores])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controlador = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controlador.verify());

  async function capturarError(): Promise<unknown> {
    const respuesta = firstValueFrom(http.get(URL)).then(
      () => {
        throw new Error('Se esperaba un error');
      },
      (error: unknown) => error,
    );
    return respuesta;
  }

  it('traduce el formato { codigo, mensaje, detalles } del contrato a ErrorApi', async () => {
    const promesa = capturarError();
    controlador
      .expectOne(URL)
      .flush(
        { codigo: 'STOCK_INSUFICIENTE', mensaje: 'No hay stock suficiente.', detalles: { disponible: 1 } },
        { status: 409, statusText: 'Conflict' },
      );

    const error = await promesa;
    expect(error).toBeInstanceOf(ErrorApi);
    const errorApi = error as ErrorApi;
    expect(errorApi.codigo).toBe('STOCK_INSUFICIENTE');
    expect(errorApi.mensaje).toBe('No hay stock suficiente.');
    expect(errorApi.estado).toBe(409);
    expect(errorApi.detalles).toEqual({ disponible: 1 });
    expect(errorApi.esSinConexion).toBe(false);
  });

  it('acepta errores del contrato sin detalles', async () => {
    const promesa = capturarError();
    controlador
      .expectOne(URL)
      .flush(
        { codigo: 'NO_AUTORIZADO', mensaje: 'No tienes permiso.' },
        { status: 403, statusText: 'Forbidden' },
      );

    const errorApi = (await promesa) as ErrorApi;
    expect(errorApi.codigo).toBe('NO_AUTORIZADO');
    expect(errorApi.detalles).toBeUndefined();
  });

  it('indica SIN_CONEXION cuando la API no responde', async () => {
    const promesa = capturarError();
    controlador.expectOne(URL).error(new ProgressEvent('error'), { status: 0, statusText: '' });

    const errorApi = (await promesa) as ErrorApi;
    expect(errorApi).toBeInstanceOf(ErrorApi);
    expect(errorApi.codigo).toBe('SIN_CONEXION');
    expect(errorApi.mensaje).toBe(MENSAJE_SIN_CONEXION);
    expect(errorApi.esSinConexion).toBe(true);
  });

  it('usa un mensaje genérico, sin detalles técnicos, si la respuesta no sigue el contrato', async () => {
    const promesa = capturarError();
    controlador
      .expectOne(URL)
      .flush('<html>Error interno</html>', { status: 500, statusText: 'Server Error' });

    const errorApi = (await promesa) as ErrorApi;
    expect(errorApi.codigo).toBe('ERROR_DESCONOCIDO');
    expect(errorApi.mensaje).toBe(MENSAJE_ERROR_DESCONOCIDO);
    expect(errorApi.estado).toBe(500);
  });

  it('no altera las respuestas correctas', async () => {
    const promesa = firstValueFrom(http.get<{ estado: string }>(URL));
    controlador.expectOne(URL).flush({ estado: 'ok' });
    expect(await promesa).toEqual({ estado: 'ok' });
  });
});
