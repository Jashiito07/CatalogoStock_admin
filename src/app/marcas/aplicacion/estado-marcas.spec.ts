import { TestBed } from '@angular/core/testing';
import { Mock } from 'vitest';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { CambiosMarca, Marca } from '../dominio/marca';
import { EstadoMarcas } from './estado-marcas';
import {
  erroresPorCampo,
  MENSAJE_DATOS_INVALIDOS,
  MENSAJE_ERROR_INESPERADO,
  MENSAJE_MARCA_DUPLICADA,
  mensajeDeErrorDeMarca,
} from './mensajes-marcas';
import { ApiMarcas } from './puertos';

function marca(id: string, orden: number): Marca {
  return {
    id,
    nombre: id.toUpperCase(),
    color: '#2563EB',
    colorAcento: null,
    textoSobreColor: '#FFFFFF',
    textoSobreAcento: null,
    activa: true,
    orden,
    creadaEn: '2026-11-11T10:00:00Z',
  };
}

describe('EstadoMarcas (RF-PRO-04, D-48)', () => {
  let listar: Mock<(incluirInactivas: boolean) => Promise<readonly Marca[]>>;
  let actualizar: Mock<(id: string, cambios: CambiosMarca) => Promise<Marca>>;
  let estado: EstadoMarcas;

  beforeEach(() => {
    listar = vi.fn().mockResolvedValue([marca('a', 0), marca('b', 1), marca('c', 2)]);
    actualizar = vi.fn((id: string, cambios: CambiosMarca) =>
      Promise.resolve({ ...marca(id, 0), ...cambios }),
    );
    TestBed.configureTestingModule({
      providers: [EstadoMarcas, { provide: ApiMarcas, useValue: { listar, actualizar } }],
    });
    estado = TestBed.inject(EstadoMarcas);
  });

  it('cargar pide las inactivas también y las comparte entre llamadas simultáneas', async () => {
    await Promise.all([estado.cargar(), estado.cargar()]);
    expect(listar).toHaveBeenCalledTimes(1);
    expect(listar).toHaveBeenCalledWith(true);
    expect(estado.marcas()).toHaveLength(3);
    expect(estado.sinMarcas()).toBe(false);
  });

  it('sinMarcas solo es verdadero cuando la API confirmó la lista vacía', async () => {
    expect(estado.sinMarcas()).toBe(false);
    listar.mockResolvedValue([]);
    await estado.cargar();
    expect(estado.sinMarcas()).toBe(true);
  });

  it('asegurarCargada no vuelve a consultar si ya hay marcas', async () => {
    await estado.asegurarCargada();
    await estado.asegurarCargada();
    expect(listar).toHaveBeenCalledTimes(1);
  });

  it('mover sube una marca y solo envía los órdenes que cambian', async () => {
    await estado.cargar();
    await estado.mover('b', -1);
    expect(actualizar).toHaveBeenCalledTimes(2);
    expect(actualizar).toHaveBeenCalledWith('b', { orden: 0 });
    expect(actualizar).toHaveBeenCalledWith('a', { orden: 1 });
  });

  it('si falla un cambio de orden vuelve a consultar la API', async () => {
    await estado.cargar();
    actualizar.mockRejectedValueOnce(new ErrorApi('ERROR', 'Falló', 500));
    await expect(estado.mover('b', -1)).rejects.toBeInstanceOf(ErrorApi);
    expect(listar).toHaveBeenCalledTimes(2);
  });
});

describe('mensajes de marcas', () => {
  it('409 MARCA_DUPLICADA tiene un mensaje claro', () => {
    expect(mensajeDeErrorDeMarca(new ErrorApi('MARCA_DUPLICADA', 'x', 409))).toBe(
      MENSAJE_MARCA_DUPLICADA,
    );
  });

  it('400 DATOS_INVALIDOS devuelve el mensaje general y los errores por campo', () => {
    const error = new ErrorApi('DATOS_INVALIDOS', 'x', 400, {
      errores: [{ campo: 'color', errores: ['El color debe ser #RRGGBB.'] }],
    });
    expect(mensajeDeErrorDeMarca(error)).toBe(MENSAJE_DATOS_INVALIDOS);
    expect(erroresPorCampo(error)).toEqual({ color: 'El color debe ser #RRGGBB.' });
  });

  it('un error desconocido no muestra detalles técnicos', () => {
    expect(mensajeDeErrorDeMarca(new Error('boom'))).toBe(MENSAJE_ERROR_INESPERADO);
    expect(erroresPorCampo(new Error('boom'))).toEqual({});
  });
});
