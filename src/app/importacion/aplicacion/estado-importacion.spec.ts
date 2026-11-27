import { TestBed } from '@angular/core/testing';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import {
  AlmacenRecientesMemoria,
  ApiImportacionesFalsa,
  borradorPrueba,
  crearApiImportacionesFalsa,
  ID_IMPORTACION,
  importacionPrueba,
  paginaBorradoresPrueba,
} from '../pruebas/dobles-importacion';
import { EstadoImportacion, MAXIMO_RECIENTES } from './estado-importacion';
import { AlmacenImportacionesRecientes, ApiImportaciones } from './puertos';

describe('EstadoImportacion (RF-PRO-01, RF-PRO-02)', () => {
  let api: ApiImportacionesFalsa;
  let almacen: AlmacenRecientesMemoria;
  let estado: EstadoImportacion;

  beforeEach(() => {
    api = crearApiImportacionesFalsa();
    almacen = new AlmacenRecientesMemoria();
    api.listarBorradores.mockResolvedValue(
      paginaBorradoresPrueba([borradorPrueba('b1'), borradorPrueba('b2')], {}, 120),
    );
    TestBed.configureTestingModule({
      providers: [
        EstadoImportacion,
        { provide: ApiImportaciones, useValue: api },
        { provide: AlmacenImportacionesRecientes, useValue: almacen },
      ],
    });
    estado = TestBed.inject(EstadoImportacion);
  });

  it('abrir consulta la importación y la primera página de pendientes', async () => {
    await estado.abrir(ID_IMPORTACION);
    expect(api.obtener).toHaveBeenCalledWith(ID_IMPORTACION);
    expect(api.listarBorradores).toHaveBeenCalledWith(ID_IMPORTACION, { pagina: 1, tamanio: 50, estado: 'PENDIENTE' });
    expect(estado.total()).toBe(120);
    expect(estado.elementos()).toHaveLength(2);
    expect(almacen.ids).toEqual([ID_IMPORTACION]);
  });

  it('un 404 al abrir deja un mensaje y no consulta borradores', async () => {
    api.obtener.mockRejectedValue(new ErrorApi('NO_ENCONTRADO', 'x', 404));
    await estado.abrir(ID_IMPORTACION);
    expect(estado.error()).toContain('No encontramos');
    expect(api.listarBorradores).not.toHaveBeenCalled();
    expect(estado.cargando()).toBe(false);
  });

  it('filtrar vuelve a la página 1, conserva el tamaño y omite lo vacío', async () => {
    await estado.abrir(ID_IMPORTACION);
    await estado.irA(50, 20);
    await estado.filtrar({ estado: 'DESCARTADO', conAdvertencias: true, busqueda: ' crema ', paginaPdf: 7 });
    expect(api.listarBorradores).toHaveBeenLastCalledWith(ID_IMPORTACION, {
      pagina: 1,
      tamanio: 20,
      estado: 'DESCARTADO',
      conAdvertencias: true,
      busqueda: 'crema',
      paginaPdf: 7,
    });
    expect(estado.hayFiltros()).toBe(true);
    await estado.filtrar({ estado: 'PENDIENTE', conAdvertencias: false, busqueda: '' });
    expect(estado.hayFiltros()).toBe(false);
  });

  it('irA calcula la página desde el primer registro', async () => {
    await estado.abrir(ID_IMPORTACION);
    await estado.irA(100, 50);
    expect(api.listarBorradores).toHaveBeenLastCalledWith(ID_IMPORTACION, { pagina: 3, tamanio: 50, estado: 'PENDIENTE' });
    expect(estado.primero()).toBe(100);
  });

  it('editar reemplaza la fila con la respuesta del servidor y refresca los contadores', async () => {
    await estado.abrir(ID_IMPORTACION);
    api.editarBorrador.mockResolvedValue(borradorPrueba('b1', { precio: '9.90', advertencias: [] }));
    const antes = api.obtener.mock.calls.length;
    await estado.editar('b1', { precio: '9.90' });
    expect(estado.elementos()[0]?.precio).toBe('9.90');
    expect(api.obtener.mock.calls.length).toBe(antes + 1);
  });

  it('aprobar devuelve el resumen y recarga contadores y lista', async () => {
    await estado.abrir(ID_IMPORTACION);
    api.aprobar.mockResolvedValue([
      { id: 'b1', estado: 'APROBADO', idProducto: 'p1' },
      { id: 'b2', error: 'SIN_PRECIO' },
    ]);
    const listas = () =>
      api.listarBorradores.mock.calls.filter(([, consulta]) => consulta.conAdvertencias !== true).length;
    const llamadas = listas();
    const resumen = await estado.aprobar(['b1', 'b2']);
    expect(resumen.correctos).toEqual(['b1']);
    expect(resumen.fallidos).toEqual([{ id: 'b2', error: 'SIN_PRECIO' }]);
    expect(listas()).toBe(llamadas + 1);
  });

  describe('precio heredado de la ficha (RN-11)', () => {
    const heredado = (id: string) =>
      borradorPrueba(id, { advertencias: ['PRECIO_HEREDADO'], precio: '19.50' });

    it('cuenta los pendientes por confirmar recorriendo las páginas de pendientes con advertencias', async () => {
      api.listarBorradores.mockImplementation(async (_id, consulta) => {
        if (consulta.conAdvertencias !== true) {
          return paginaBorradoresPrueba([borradorPrueba('b1')], consulta, 1);
        }
        const elementos =
          consulta.pagina === 1
            ? [heredado('h1'), borradorPrueba('x', { advertencias: ['SIN_CODIGO'] })]
            : [heredado('h2')];
        return paginaBorradoresPrueba(elementos, consulta, 150); // 2 páginas de 100
      });
      await estado.abrir(ID_IMPORTACION);
      expect(api.listarBorradores).toHaveBeenCalledWith(ID_IMPORTACION, {
        pagina: 2,
        tamanio: 100,
        estado: 'PENDIENTE',
        conAdvertencias: true,
      });
      expect(estado.porConfirmar()).toBe(2);
    });

    it('sin borradores con advertencias no consulta y el contador queda en 0', async () => {
      api.obtener.mockResolvedValue(
        importacionPrueba({ totales: { pendientes: 3, aprobados: 0, descartados: 0, conAdvertencias: 0 } }),
      );
      await estado.abrir(ID_IMPORTACION);
      expect(estado.porConfirmar()).toBe(0);
      expect(api.listarBorradores.mock.calls.every(([, c]) => c.conAdvertencias !== true)).toBe(true);
    });

    it('el modo «solo por confirmar» filtra y pagina en local', async () => {
      api.listarBorradores.mockResolvedValue(
        paginaBorradoresPrueba([heredado('h1'), heredado('h2'), heredado('h3'), borradorPrueba('x', { advertencias: ['SIN_CODIGO'] })]),
      );
      await estado.abrir(ID_IMPORTACION);
      await estado.filtrar({ estado: 'PENDIENTE', soloPorConfirmar: true });
      expect(estado.elementos().map((b) => b.id)).toEqual(['h1', 'h2', 'h3']);
      expect(estado.total()).toBe(3);
      expect(estado.hayFiltros()).toBe(true);
      // Fuera de «Pendientes» el filtro no aplica.
      await estado.filtrar({ estado: 'APROBADO', soloPorConfirmar: true });
      expect(estado.soloPorConfirmar()).toBe(false);
    });

    it('confirmarPrecio envía el precio actual en el PATCH y actualiza el contador', async () => {
      api.listarBorradores.mockResolvedValue(paginaBorradoresPrueba([heredado('h1'), heredado('h2')]));
      await estado.abrir(ID_IMPORTACION);
      expect(estado.porConfirmar()).toBe(2);
      api.editarBorrador.mockResolvedValue(borradorPrueba('h1', { advertencias: [], precio: '19.50' }));
      api.listarBorradores.mockResolvedValue(paginaBorradoresPrueba([heredado('h2')]));
      const confirmado = await estado.confirmarPrecio(heredado('h1'));
      expect(api.editarBorrador).toHaveBeenCalledWith('h1', { precio: '19.50' });
      expect(confirmado.advertencias).toEqual([]);
      expect(estado.porConfirmar()).toBe(1);
    });

    it('si el recuento falla conserva el contador anterior y no lanza error', async () => {
      api.listarBorradores.mockResolvedValue(paginaBorradoresPrueba([heredado('h1')]));
      await estado.abrir(ID_IMPORTACION);
      api.listarBorradores.mockRejectedValue(new ErrorApi('SIN_CONEXION', 'x', 0));
      await expect(estado.contarPorConfirmar()).resolves.toBeUndefined();
      expect(estado.porConfirmar()).toBe(1);
    });
  });

  it('descartar llama a la API y recarga', async () => {
    await estado.abrir(ID_IMPORTACION);
    api.descartar.mockResolvedValue([{ id: 'b1', estado: 'DESCARTADO' }]);
    expect((await estado.descartar(['b1'])).correctos).toEqual(['b1']);
  });

  it('descarta una respuesta atrasada de filtros anteriores', async () => {
    await estado.abrir(ID_IMPORTACION);
    let tarde: (p: ReturnType<typeof paginaBorradoresPrueba>) => void = () => undefined;
    api.listarBorradores.mockReturnValueOnce(new Promise((resolver) => (tarde = resolver)));
    const lenta = estado.filtrar({ estado: 'PENDIENTE', busqueda: 'a' });
    api.listarBorradores.mockResolvedValueOnce(paginaBorradoresPrueba([borradorPrueba('nuevo')], {}, 1));
    await estado.filtrar({ estado: 'PENDIENTE', busqueda: 'ab' });
    tarde(paginaBorradoresPrueba([borradorPrueba('viejo')], {}, 1));
    await lenta;
    expect(estado.elementos().map((b) => b.id)).toEqual(['nuevo']);
  });

  describe('recientes', () => {
    it('analizar recuerda la importación (sin duplicados) y limita la lista', async () => {
      api.analizar.mockResolvedValue(importacionPrueba());
      almacen.ids = Array.from({ length: 8 }, (_v, i) => `00000000-0000-4000-8000-00000000000${i}`);
      await estado.analizar(new File(['%PDF-'], 'a.pdf'), 'm');
      expect(almacen.ids[0]).toBe(ID_IMPORTACION);
      expect(almacen.ids).toHaveLength(MAXIMO_RECIENTES);
    });

    it('una falla de red al consultar no borra lo recordado', async () => {
      almacen.ids = [ID_IMPORTACION];
      api.obtener.mockRejectedValue(new ErrorApi('SIN_CONEXION', 'x', 0));
      await estado.cargarRecientes();
      expect(estado.recientes()).toEqual([]);
      expect(almacen.ids).toEqual([ID_IMPORTACION]);
    });
  });
});
