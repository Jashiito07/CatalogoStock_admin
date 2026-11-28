import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import {
  ApiProductosFalsa,
  archivoPrueba,
  crearApiProductosFalsa,
  imagenPrueba,
  paginaPrueba,
  productoPrueba,
} from '../pruebas/dobles-productos';
import { ESPERA, ESPERA_TRAS_LIMITE_MS, EstadoFotosLote } from './estado-fotos-lote';
import { MENSAJE_DIMENSIONES_NO_ADMITIDAS } from './mensajes-productos';
import { ApiProductos } from './puertos';

describe('EstadoFotosLote (RF-PRO-01, D-62, DEC-07)', () => {
  let api: ApiProductosFalsa;
  let esperas: number[];
  let estado: EstadoFotosLote;

  const jpg = (nombre: string) => archivoPrueba(nombre, 50_000, 'image/jpeg');

  beforeEach(async () => {
    api = crearApiProductosFalsa();
    esperas = [];
    api.listar.mockResolvedValue(
      paginaPrueba([
        productoPrueba('p1', 'Crema', { codigo: '12345' }),
        productoPrueba('p2', 'Labial', { codigo: '777', imagenes: [imagenPrueba('i1', 0)] }),
      ]),
    );
    api.subirImagen.mockImplementation((id: string) => Promise.resolve(imagenPrueba(`nueva-${id}`, 1)));
    TestBed.configureTestingModule({
      providers: [
        EstadoFotosLote,
        { provide: ApiProductos, useValue: api },
        {
          provide: ESPERA,
          useValue: (ms: number) => {
            esperas.push(ms);
            return Promise.resolve();
          },
        },
      ],
    });
    estado = TestBed.inject(EstadoFotosLote);
    await estado.cargarProductos();
  });

  it('trae todos los productos aunque ocupen varias páginas de 100', async () => {
    api.listar.mockReset();
    const primera = Array.from({ length: 100 }, (_, i) => productoPrueba(`a${i}`, `A ${i}`));
    api.listar
      .mockResolvedValueOnce(paginaPrueba(primera, { pagina: 1, tamanio: 100 }, 101))
      .mockResolvedValueOnce(paginaPrueba([productoPrueba('b', 'B')], { pagina: 2, tamanio: 100 }, 101));

    await estado.cargarProductos();

    expect(api.listar).toHaveBeenNthCalledWith(1, { pagina: 1, tamanio: 100 });
    expect(api.listar).toHaveBeenNthCalledWith(2, { pagina: 2, tamanio: 100 });
    expect(estado.productos()).toHaveLength(101);
  });

  it('empareja por código y sube en orden, con 2 s entre fotos (30 por minuto)', async () => {
    estado.agregar([jpg('12345-2.jpg'), jpg('777.jpg'), jpg('12345.jpg')]);
    expect(estado.resumen()).toMatchObject({ listas: 3, productos: 2 });

    const subidas = await estado.subir();

    expect(subidas).toBe(3);
    // Por código (777 antes que 12345) y, dentro de cada uno, la foto sin sufijo primero.
    expect(api.subirImagen.mock.calls.map(([id, archivo]) => [id, archivo.name])).toEqual([
      ['p2', '777.jpg'],
      ['p1', '12345.jpg'],
      ['p1', '12345-2.jpg'],
    ]);
    expect(esperas).toEqual([2000, 2000]);
    expect(estado.subidas()).toBe(3);
    expect(estado.fallidas()).toBe(0);
  });

  it('las fotos sin producto elegido no se suben; al elegirlo a mano, sí', async () => {
    estado.agregar([jpg('IMG_0001.jpg'), jpg('12345.jpg')]);
    expect(estado.resumen().listas).toBe(1);

    const sinCodigo = estado.revisadas().find((f) => f.nombre === 'IMG_0001.jpg');
    estado.asignarProducto(sinCodigo?.clave ?? -1, 'p2');

    expect(estado.resumen().listas).toBe(2);
    await estado.subir();
    expect(api.subirImagen).toHaveBeenCalledTimes(2);
  });

  it('una foto quitada no se sube', async () => {
    estado.agregar([jpg('12345.jpg'), jpg('777.jpg')]);
    const crema = estado.revisadas().find((f) => f.nombre === '12345.jpg');
    estado.alternarExclusion(crema?.clave ?? -1);

    await estado.subir();

    expect(api.subirImagen.mock.calls.map(([id]) => id)).toEqual(['p2']);
  });

  it('ante un 429 espera y reintenta la misma foto', async () => {
    api.subirImagen
      .mockRejectedValueOnce(new ErrorApi('DEMASIADAS_SOLICITUDES', 'Demasiadas', 429))
      .mockResolvedValueOnce(imagenPrueba('x', 0));
    estado.agregar([jpg('12345.jpg')]);

    await estado.subir();

    expect(esperas).toEqual([ESPERA_TRAS_LIMITE_MS]);
    expect(api.subirImagen).toHaveBeenCalledTimes(2);
    expect(estado.subidas()).toBe(1);
  });

  it('un error no detiene el lote: la foto queda fallida con su motivo y se puede reintentar', async () => {
    api.subirImagen
      .mockRejectedValueOnce(new ErrorApi('DIMENSIONES_NO_ADMITIDAS', 'grande', 422))
      .mockResolvedValue(imagenPrueba('x', 0));
    estado.agregar([jpg('12345.jpg'), jpg('777.jpg')]);

    await estado.subir();

    const primera = estado.revisadas()[0];
    expect(estado.progreso().get(primera.clave)).toEqual({
      estado: 'FALLIDA',
      mensaje: MENSAJE_DIMENSIONES_NO_ADMITIDAS,
    });
    expect(estado.subidas()).toBe(1);

    await estado.reintentarFallidas();

    expect(estado.fallidas()).toBe(0);
    expect(estado.subidas()).toBe(2);
  });

  it('detener deja las restantes en espera; continuar sube solo esas', async () => {
    estado.agregar([jpg('12345.jpg'), jpg('12345-2.jpg'), jpg('777.jpg')]);
    api.subirImagen.mockImplementationOnce(() => {
      estado.detener();
      return Promise.resolve(imagenPrueba('x', 0));
    });

    await estado.subir();

    expect(estado.subidas()).toBe(1);
    expect([...estado.progreso().values()].filter((p) => p.estado === 'PENDIENTE')).toHaveLength(2);

    await estado.subir();

    expect(estado.subidas()).toBe(3);
    expect(api.subirImagen).toHaveBeenCalledTimes(3);
  });

  it('después de empezar no se agregan fotos; un lote nuevo limpia y recarga los productos', async () => {
    estado.agregar([jpg('12345.jpg')]);
    await estado.subir();
    estado.agregar([jpg('777.jpg')]);
    expect(estado.revisadas()).toHaveLength(1);

    await estado.nuevoLote();

    expect(estado.revisadas()).toHaveLength(0);
    expect(estado.iniciado()).toBe(false);
    expect(api.listar).toHaveBeenCalledTimes(2);
  });

  it('si no se pueden cargar los productos, muestra el mensaje', async () => {
    api.listar.mockRejectedValueOnce(new ErrorApi('SIN_CONEXION', 'Sin conexión con el servidor.', 0));

    await estado.cargarProductos();

    expect(estado.errorCarga()).toBe('Sin conexión con el servidor.');
  });
});
