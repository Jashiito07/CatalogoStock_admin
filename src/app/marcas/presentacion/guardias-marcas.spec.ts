import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';

import { EstadoMarcas } from '../aplicacion/estado-marcas';
import { ApiMarcas } from '../aplicacion/puertos';
import { Marca } from '../dominio/marca';
import { negocioConfigurado, negocioSinConfigurar } from './guardias-marcas';

const MARCA: Marca = {
  id: 'm1',
  nombre: 'Yanbal',
  color: '#FC5823',
  colorAcento: null,
  textoSobreColor: '#1E293B',
  textoSobreAcento: null,
  activa: true,
  orden: 0,
  creadaEn: '2026-11-11T10:00:00Z',
};

describe('guards de «Configura tu negocio» (D-48)', () => {
  const listar = vi.fn();

  beforeEach(() => {
    listar.mockReset();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), EstadoMarcas, { provide: ApiMarcas, useValue: { listar } }],
    });
  });

  const ejecutar = (guard: typeof negocioConfigurado) =>
    TestBed.runInInjectionContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    ) as Promise<boolean | UrlTree>;

  it('sin marcas, el panel lleva a /configura-tu-negocio', async () => {
    listar.mockResolvedValue([]);
    const resultado = await ejecutar(negocioConfigurado);
    expect(resultado).toBeInstanceOf(UrlTree);
    expect(String(resultado)).toBe('/configura-tu-negocio');
  });

  it('con marcas, deja pasar', async () => {
    listar.mockResolvedValue([MARCA]);
    expect(await ejecutar(negocioConfigurado)).toBe(true);
  });

  it('si la API falla no bloquea la navegación', async () => {
    listar.mockRejectedValue(new Error('sin red'));
    expect(await ejecutar(negocioConfigurado)).toBe(true);
    expect(await ejecutar(negocioSinConfigurar)).toBe(true);
  });

  it('«Configura tu negocio» con marcas redirige a /marcas; sin marcas se muestra', async () => {
    listar.mockResolvedValue([MARCA]);
    expect(String(await ejecutar(negocioSinConfigurar))).toBe('/marcas');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), EstadoMarcas, { provide: ApiMarcas, useValue: { listar } }],
    });
    listar.mockResolvedValue([]);
    expect(await ejecutar(negocioSinConfigurar)).toBe(true);
  });
});
