import {
  Borrador,
  CambiosBorrador,
  ConsultaBorradores,
  Importacion,
  PaginaBorradores,
  ResultadoBorrador,
} from '../dominio/importacion';

/**
 * Puerto hacia la API de importación del catálogo en PDF (docs/contrato-api/productos-importacion.md).
 * Los errores llegan como `ErrorApi` (compartido/aplicacion/error-api.ts).
 */
export abstract class ApiImportaciones {
  /**
   * POST /productos/importaciones (multipart: `marcaId` y `archivo`). 201 con la importación.
   * 400, 404 `MARCA_NO_ENCONTRADA`, 409 `IMPORTACION_DUPLICADA`, 413, 415, 422 `PDF_ILEGIBLE` o
   * `MARCA_INACTIVA`, 429. `alProgreso` recibe el porcentaje real de subida (0 a 100); al llegar a
   * 100 el PDF ya está en el servidor y solo falta esperar el análisis.
   */
  abstract analizar(
    archivo: File,
    marcaId: string,
    alProgreso?: (porcentaje: number) => void,
  ): Promise<Importacion>;

  /** GET /productos/importaciones/{id}: la importación con sus totales. 404 si no existe. */
  abstract obtener(id: string): Promise<Importacion>;

  /** GET /productos/importaciones/{id}/borradores: paginado, con filtros. */
  abstract listarBorradores(id: string, consulta: ConsultaBorradores): Promise<PaginaBorradores>;

  /** PATCH /productos/importaciones/borradores/{id}. 400, 404, 422 `BORRADOR_NO_EDITABLE`. */
  abstract editarBorrador(id: string, cambios: CambiosBorrador): Promise<Borrador>;

  /** POST /productos/importaciones/borradores/aprobar (1 a 100 ids). Resultado por borrador. */
  abstract aprobar(ids: readonly string[]): Promise<readonly ResultadoBorrador[]>;

  /** POST /productos/importaciones/borradores/descartar (1 a 100 ids). Resultado por borrador. */
  abstract descartar(ids: readonly string[]): Promise<readonly ResultadoBorrador[]>;
}

/**
 * Importaciones abiertas hace poco, en la sesión del navegador. El contrato no tiene un endpoint
 * para listarlas, así que solo se guardan sus ids (UUID: ningún dato del catálogo ni personal).
 */
export abstract class AlmacenImportacionesRecientes {
  abstract leer(): readonly string[];
  abstract guardar(ids: readonly string[]): void;
}
