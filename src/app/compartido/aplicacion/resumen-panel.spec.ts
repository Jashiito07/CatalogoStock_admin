import { TestBed } from '@angular/core/testing';

import { LectorBitacora } from '../../auditoria/aplicacion/puertos';
import { ApiClientes } from '../../clientes/aplicacion/puertos';
import { ConsultaClientes } from '../../clientes/dominio/cliente';
import { EstadoImportacion } from '../../importacion/aplicacion/estado-importacion';
import { ApiImportaciones, AlmacenImportacionesRecientes } from '../../importacion/aplicacion/puertos';
import {
  AlmacenRecientesMemoria,
  crearApiImportacionesFalsa,
  ID_IMPORTACION,
  importacionPrueba,
} from '../../importacion/pruebas/dobles-importacion';
import { ApiMarcas } from '../../marcas/aplicacion/puertos';
import { EstadoMarcas } from '../../marcas/aplicacion/estado-marcas';
import { ApiProductos } from '../../productos/aplicacion/puertos';
import { ConsultaProductos } from '../../productos/dominio/producto';
import { crearApiProductosFalsa, marcaPrueba } from '../../productos/pruebas/dobles-productos';
import { ResumenPanel } from './resumen-panel';

describe('ResumenPanel (Inicio del panel)', () => {
  const productos = crearApiProductosFalsa();
  const clientes = {
    listar: vi.fn(),
    contarSinCorreoVerificado: vi.fn(),
  };
  const lector = { consultar: vi.fn() };
  const marcas = { listar: vi.fn(), sugeridas: vi.fn(), crear: vi.fn(), actualizar: vi.fn() };
  let servicio: ResumenPanel;

  function conTotales(totales: Record<string, number>): void {
    productos.listar.mockImplementation((c: ConsultaProductos) =>
      Promise.resolve({
        elementos: [],
        pagina: 1,
        tamanio: 1,
        total: totales[c.marcaId ?? c.disponibilidad ?? 'todos'] ?? 0,
      }),
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
    conTotales({ DISPONIBLE: 7, AGOTADO: 2, PENDIENTE_REPOSICION: 1, m1: 6, m2: 4 });
    marcas.listar.mockResolvedValue([
      marcaPrueba('m1', 'Yanbal', { orden: 0 }),
      marcaPrueba('m2', "L'Bel", { orden: 1 }),
      marcaPrueba('m3', 'Avon', { orden: 2, activa: false }),
    ]);
    clientes.listar.mockImplementation((c: ConsultaClientes) =>
      Promise.resolve({ elementos: [], pagina: 1, tamanio: 1, total: c.activo ? 9 : 3 }),
    );
    clientes.contarSinCorreoVerificado.mockResolvedValue(5);
    lector.consultar.mockResolvedValue({
      elementos: [{ id: 'a1', fecha: '2026-11-05T15:16:02Z', accion: 'SESION_INICIADA', usuario: null, entidad: null, idEntidad: null, detalle: {} }],
      pagina: 1,
      tamanio: 5,
      total: 1,
    });
    const apiImportaciones = crearApiImportacionesFalsa();
    const almacen = new AlmacenRecientesMemoria();
    almacen.ids = [ID_IMPORTACION];
    apiImportaciones.obtener.mockResolvedValue(
      importacionPrueba({ totales: { pendientes: 4, aprobados: 1, descartados: 0, conAdvertencias: 0 } }),
    );

    TestBed.configureTestingModule({
      providers: [
        ResumenPanel,
        EstadoMarcas,
        EstadoImportacion,
        { provide: ApiProductos, useValue: productos },
        { provide: ApiClientes, useValue: clientes },
        { provide: LectorBitacora, useValue: lector },
        { provide: ApiMarcas, useValue: marcas },
        { provide: ApiImportaciones, useValue: apiImportaciones },
        { provide: AlmacenImportacionesRecientes, useValue: almacen },
      ],
    });
    servicio = TestBed.inject(ResumenPanel);
  });

  it('productos: suma por disponibilidad y cuenta por marca activa', async () => {
    await servicio.cargar();
    const seccion = servicio.productos();
    expect(seccion.estado).toBe('listo');
    if (seccion.estado === 'listo') {
      expect(seccion.datos.total).toBe(10);
      expect(seccion.datos.porDisponibilidad).toEqual({ DISPONIBLE: 7, AGOTADO: 2, PENDIENTE_REPOSICION: 1 });
      expect(seccion.datos.porMarca.map((m) => [m.nombre, m.total])).toEqual([
        ['Yanbal', 6],
        ["L'Bel", 4],
      ]);
    }
  });

  it('marcas: cuenta solo las activas y el total', async () => {
    await servicio.cargar();
    expect(servicio.marcas()).toEqual({ estado: 'listo', datos: { activas: 2, total: 3 } });
  });

  it('clientes: activos, desactivados, sin verificar y verificados (total menos sin verificar)', async () => {
    await servicio.cargar();
    expect(servicio.clientes()).toEqual({
      estado: 'listo',
      datos: { activos: 9, desactivados: 3, sinVerificar: 5, verificados: 7 },
    });
  });

  it('importaciones: suma los borradores pendientes de las recientes', async () => {
    await servicio.cargar();
    const seccion = servicio.importaciones();
    expect(seccion.estado === 'listo' && seccion.datos.borradoresPendientes).toBe(4);
  });

  it('actividad: pide solo las 5 más recientes de la bitácora', async () => {
    await servicio.cargar();
    expect(lector.consultar).toHaveBeenCalledWith({ pagina: 1, tamanio: 5 });
    expect(servicio.actividad().estado).toBe('listo');
  });

  it('una sección que falla no tumba a las demás', async () => {
    clientes.listar.mockRejectedValue(new Error('sin red'));
    await servicio.cargar();
    expect(servicio.clientes().estado).toBe('error');
    expect(servicio.productos().estado).toBe('listo');
    expect(servicio.actividad().estado).toBe('listo');
  });

  it('si fallan las marcas, los productos se cuentan igual pero sin gráfico por marca', async () => {
    marcas.listar.mockRejectedValue(new Error('sin red'));
    await servicio.cargar();
    expect(servicio.marcas().estado).toBe('error');
    const seccion = servicio.productos();
    expect(seccion.estado === 'listo' && seccion.datos.porMarca).toEqual([]);
  });
});
