import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { PaginaBitacora } from '../dominio/bitacora';
import { LectorBitacoraHttp } from './lector-bitacora.http';

const API = 'http://api.prueba/api/v1';

describe('LectorBitacoraHttp (GET /auditoria)', () => {
  let lector: LectorBitacoraHttp;
  let controlador: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: URL_API, useValue: API },
        LectorBitacoraHttp,
      ],
    });
    lector = TestBed.inject(LectorBitacoraHttp);
    controlador = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controlador.verify());

  it('envía los parámetros del contrato, con fecha, hora y zona sin alterar (D-31)', async () => {
    const pagina: PaginaBitacora = { elementos: [], pagina: 2, tamanio: 50, total: 0 };
    const respuesta = lector.consultar({
      pagina: 2,
      tamanio: 50,
      accion: 'SESION_FALLIDA',
      idUsuario: '6f1c0000-0000-4000-8000-000000000000',
      desde: '2026-11-01T00:00:00.000-05:00',
      hasta: '2026-11-05T23:59:59.999-05:00',
    });

    const solicitud = controlador.expectOne((req) => req.url === `${API}/auditoria`);
    expect(solicitud.request.method).toBe('GET');
    const params = solicitud.request.params;
    expect(params.get('pagina')).toBe('2');
    expect(params.get('tamanio')).toBe('50');
    expect(params.get('accion')).toBe('SESION_FALLIDA');
    expect(params.get('idUsuario')).toBe('6f1c0000-0000-4000-8000-000000000000');
    expect(params.get('desde')).toBe('2026-11-01T00:00:00.000-05:00');
    expect(params.get('hasta')).toBe('2026-11-05T23:59:59.999-05:00');
    // La URL final conserva la zona: «-» y «:» no necesitan codificarse.
    expect(solicitud.request.urlWithParams).toContain('desde=2026-11-01T00:00:00.000-05:00');
    solicitud.flush(pagina);

    await expect(respuesta).resolves.toEqual(pagina);
  });

  it('no envía los filtros ausentes', async () => {
    const respuesta = lector.consultar({ pagina: 1, tamanio: 20 });
    const solicitud = controlador.expectOne((req) => req.url === `${API}/auditoria`);
    expect(solicitud.request.params.keys().sort()).toEqual(['pagina', 'tamanio']);
    solicitud.flush({ elementos: [], pagina: 1, tamanio: 20, total: 0 });
    await respuesta;
  });
});
