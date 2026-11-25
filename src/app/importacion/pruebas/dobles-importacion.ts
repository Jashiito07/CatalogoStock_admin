import { Mock } from 'vitest';

import { AlmacenImportacionesRecientes, ApiImportaciones } from '../aplicacion/puertos';
import {
  Borrador,
  CambiosBorrador,
  ConsultaBorradores,
  Importacion,
  PaginaBorradores,
  ResultadoBorrador,
} from '../dominio/importacion';

export const ID_IMPORTACION = '11111111-1111-4111-8111-111111111111';
export const ID_MARCA = '22222222-2222-4222-8222-222222222222';

export function importacionPrueba(parcial: Partial<Importacion> = {}): Importacion {
  return {
    id: ID_IMPORTACION,
    nombreArchivo: 'catalogo-prueba.pdf',
    marca: {
      id: ID_MARCA,
      nombre: 'Yanbal',
      color: '#FC5823',
      colorAcento: null,
      textoSobreColor: '#1E293B',
      textoSobreAcento: null,
    },
    paginas: 148,
    totales: { pendientes: 3, aprobados: 0, descartados: 0, conAdvertencias: 2 },
    creadaEn: '2026-11-16T15:00:00Z',
    ...parcial,
  };
}

export function borradorPrueba(id: string, parcial: Partial<Borrador> = {}): Borrador {
  return {
    id,
    idImportacion: ID_IMPORTACION,
    pagina: 12,
    codigo: '43873',
    nombre: `Producto ${id}`,
    descripcion: null,
    precio: '35.00',
    precioNormal: null,
    marcaId: ID_MARCA,
    disponibilidad: 'DISPONIBLE',
    estado: 'PENDIENTE',
    advertencias: [],
    idProducto: null,
    ...parcial,
  };
}

export function paginaBorradoresPrueba(
  elementos: readonly Borrador[],
  consulta: Partial<ConsultaBorradores> = {},
  total = elementos.length,
): PaginaBorradores {
  return { elementos, pagina: consulta.pagina ?? 1, tamanio: consulta.tamanio ?? 50, total };
}

/** Doble de `ApiImportaciones` con funciones de Vitest para comprobar las llamadas. */
export interface ApiImportacionesFalsa extends ApiImportaciones {
  analizar: Mock<
    (archivo: File, marcaId: string, alProgreso?: (porcentaje: number) => void) => Promise<Importacion>
  >;
  obtener: Mock<(id: string) => Promise<Importacion>>;
  listarBorradores: Mock<(id: string, c: ConsultaBorradores) => Promise<PaginaBorradores>>;
  editarBorrador: Mock<(id: string, c: CambiosBorrador) => Promise<Borrador>>;
  aprobar: Mock<(ids: readonly string[]) => Promise<readonly ResultadoBorrador[]>>;
  descartar: Mock<(ids: readonly string[]) => Promise<readonly ResultadoBorrador[]>>;
}

export function crearApiImportacionesFalsa(): ApiImportacionesFalsa {
  return {
    analizar: vi.fn(),
    obtener: vi.fn().mockResolvedValue(importacionPrueba()),
    listarBorradores: vi.fn().mockResolvedValue(paginaBorradoresPrueba([])),
    editarBorrador: vi.fn(),
    aprobar: vi.fn().mockResolvedValue([]),
    descartar: vi.fn().mockResolvedValue([]),
  } as unknown as ApiImportacionesFalsa;
}

/** Almacén de recientes en memoria. */
export class AlmacenRecientesMemoria extends AlmacenImportacionesRecientes {
  ids: readonly string[] = [];

  leer(): readonly string[] {
    return this.ids;
  }

  guardar(ids: readonly string[]): void {
    this.ids = ids;
  }
}
