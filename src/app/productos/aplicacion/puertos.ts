import {
  CambiosProducto,
  ConsultaProductos,
  ImagenProducto,
  NuevoProducto,
  PaginaProductos,
  Producto,
} from '../dominio/producto';

/**
 * Puerto hacia la API de productos e imágenes (docs/contrato-api/productos.md, «Endpoints:
 * productos» y «Endpoints: imágenes»). Los errores llegan como `ErrorApi`
 * (compartido/aplicacion/error-api.ts).
 */
export abstract class ApiProductos {
  /** GET /productos: paginado, con `marcaId`, `busqueda` y `disponibilidad`. */
  abstract listar(consulta: ConsultaProductos): Promise<PaginaProductos>;

  /** GET /productos/{id}. 404 si no existe o fue eliminado. */
  abstract obtener(id: string): Promise<Producto>;

  /** POST /productos. 400 `DATOS_INVALIDOS`, 404 `NO_ENCONTRADO` (marca), 422 `MARCA_INACTIVA`. */
  abstract crear(producto: NuevoProducto): Promise<Producto>;

  /** PATCH /productos/{id}: cuerpo parcial. */
  abstract actualizar(id: string, cambios: CambiosProducto): Promise<Producto>;

  /** DELETE /productos/{id}: eliminación lógica (RF-PRO-03, PA-07). 204. */
  abstract eliminar(id: string): Promise<void>;

  /**
   * POST /productos/{id}/imagenes (multipart, campo `archivo`). 413, 415 y 422
   * `LIMITE_IMAGENES` son errores del servidor.
   */
  abstract subirImagen(productoId: string, archivo: File): Promise<ImagenProducto>;

  /** PUT /productos/{id}/imagenes/orden con **todos** los ids en el orden nuevo. */
  abstract ordenarImagenes(
    productoId: string,
    ids: readonly string[],
  ): Promise<readonly ImagenProducto[]>;

  /** DELETE /productos/{id}/imagenes/{imagenId}. 204. */
  abstract eliminarImagen(productoId: string, imagenId: string): Promise<void>;

  /** URL completa para mostrar una imagen a partir de la ruta pública que devuelve la API. */
  abstract urlImagen(ruta: string): string;
}
