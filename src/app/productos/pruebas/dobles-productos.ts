import { Mock } from 'vitest';

import { Marca } from '../../marcas/dominio/marca';
import { ApiProductos } from '../aplicacion/puertos';
import {
  CambiosProducto,
  ConsultaProductos,
  ImagenProducto,
  NuevoProducto,
  PaginaProductos,
  Producto,
} from '../dominio/producto';

export const API_PRUEBA = 'http://api.prueba';

export function marcaPrueba(id: string, nombre: string, parcial: Partial<Marca> = {}): Marca {
  return {
    id,
    nombre,
    color: '#FC5823',
    colorAcento: null,
    textoSobreColor: '#1E293B',
    textoSobreAcento: null,
    activa: true,
    orden: 0,
    creadaEn: '2026-11-11T10:00:00Z',
    ...parcial,
  };
}

export function imagenPrueba(id: string, orden: number): ImagenProducto {
  return { id, url: `/api/v1/imagenes/${id}.png`, orden, principal: orden === 0 };
}

export function productoPrueba(
  id: string,
  nombre: string,
  parcial: Partial<Producto> = {},
): Producto {
  return {
    id,
    nombre,
    marca: {
      id: 'm1',
      nombre: 'Yanbal',
      color: '#FC5823',
      colorAcento: null,
      textoSobreColor: '#1E293B',
      textoSobreAcento: null,
    },
    precio: '12.50',
    descripcion: 'Descripción de prueba.',
    disponibilidad: 'DISPONIBLE',
    imagenes: [],
    creadoEn: '2026-11-12T10:00:00Z',
    actualizadoEn: '2026-11-12T10:00:00Z',
    ...parcial,
  };
}

export function paginaPrueba(
  elementos: readonly Producto[],
  consulta: Partial<ConsultaProductos> = {},
  total = elementos.length,
): PaginaProductos {
  return { elementos, pagina: consulta.pagina ?? 1, tamanio: consulta.tamanio ?? 20, total };
}

/** Doble de `ApiProductos` con funciones de Vitest para comprobar las llamadas. */
export interface ApiProductosFalsa extends ApiProductos {
  listar: Mock<(c: ConsultaProductos) => Promise<PaginaProductos>>;
  obtener: Mock<(id: string) => Promise<Producto>>;
  crear: Mock<(p: NuevoProducto) => Promise<Producto>>;
  actualizar: Mock<(id: string, c: CambiosProducto) => Promise<Producto>>;
  eliminar: Mock<(id: string) => Promise<void>>;
  subirImagen: Mock<(id: string, archivo: File) => Promise<ImagenProducto>>;
  ordenarImagenes: Mock<(id: string, ids: readonly string[]) => Promise<readonly ImagenProducto[]>>;
  eliminarImagen: Mock<(id: string, imagenId: string) => Promise<void>>;
  urlImagen: Mock<(ruta: string) => string>;
}

export function crearApiProductosFalsa(): ApiProductosFalsa {
  return {
    listar: vi.fn().mockResolvedValue(paginaPrueba([])),
    obtener: vi.fn(),
    crear: vi.fn(),
    actualizar: vi.fn(),
    eliminar: vi.fn().mockResolvedValue(undefined),
    subirImagen: vi.fn(),
    ordenarImagenes: vi.fn().mockResolvedValue([]),
    eliminarImagen: vi.fn().mockResolvedValue(undefined),
    urlImagen: vi.fn((ruta: string) => `${API_PRUEBA}${ruta}`),
  } as unknown as ApiProductosFalsa;
}

export function archivoPrueba(nombre: string, tamano = 1000, tipo = 'image/png'): File {
  const archivo = new File([new Uint8Array(Math.min(tamano, 16))], nombre, { type: tipo });
  // El peso real no importa en las pruebas: se simula el tamaño que se quiere validar.
  Object.defineProperty(archivo, 'size', { value: tamano });
  return archivo;
}
