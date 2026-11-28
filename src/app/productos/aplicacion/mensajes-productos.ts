import { ErrorApi } from '../../compartido/aplicacion/error-api';

export const MENSAJE_SIN_PERMISO = 'No tienes permiso para esta acción.';
export const MENSAJE_PRODUCTO_NO_ENCONTRADO =
  'No encontramos este producto. Puede haber sido eliminado; actualiza la lista.';
export const MENSAJE_MARCA_NO_ENCONTRADA =
  'La marca elegida ya no existe. Actualiza la lista de marcas e inténtalo de nuevo.';
export const MENSAJE_DATOS_INVALIDOS = 'Revisa los datos del producto e inténtalo de nuevo.';
export const MENSAJE_MARCA_INACTIVA =
  'La marca está desactivada. Actívala en Marcas o elige otra marca.';
export const MENSAJE_ARCHIVO_GRANDE = 'La imagen pesa más de 2 MB.';
export const MENSAJE_TIPO_NO_ADMITIDO =
  'El archivo no es una imagen válida. Usa JPG, PNG o WebP.';
export const MENSAJE_LIMITE_IMAGENES = 'Un producto admite hasta 5 imágenes.';
export const MENSAJE_DIMENSIONES_NO_ADMITIDAS =
  'La imagen es demasiado grande: hasta 8000 px por lado y 40 megapíxeles. Redúcela e inténtalo de nuevo.';
export const MENSAJE_DEMASIADAS_SUBIDAS =
  'Estás subiendo imágenes muy rápido. Espera un momento e inténtalo de nuevo.';
export const MENSAJE_ERROR_INESPERADO = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/**
 * Mensaje claro para un error de productos o imágenes (400, 403, 404, 413, 415, 422, 429.),
 * sin detalles técnicos. Sin respuesta del servidor usa el mensaje de conexión del interceptor.
 */
export function mensajeDeErrorDeProducto(
  error: unknown,
  opciones: { readonly alGuardarConMarca?: boolean } = {},
): string {
  if (!(error instanceof ErrorApi)) {
    return MENSAJE_ERROR_INESPERADO;
  }
  if (error.esSinConexion) {
    return error.mensaje;
  }
  switch (error.codigo) {
    case 'MARCA_INACTIVA':
      return MENSAJE_MARCA_INACTIVA;
    case 'LIMITE_IMAGENES':
      return MENSAJE_LIMITE_IMAGENES;
    case 'DIMENSIONES_NO_ADMITIDAS':
      return MENSAJE_DIMENSIONES_NO_ADMITIDAS;
    case 'ARCHIVO_DEMASIADO_GRANDE':
      return MENSAJE_ARCHIVO_GRANDE;
    case 'TIPO_NO_ADMITIDO':
      return MENSAJE_TIPO_NO_ADMITIDO;
    case 'DATOS_INVALIDOS':
      return MENSAJE_DATOS_INVALIDOS;
    default:
      break;
  }
  switch (error.estado) {
    case 403:
      return MENSAJE_SIN_PERMISO;
    case 404:
      // En POST /productos el 404 significa que `marcaId` no existe (contrato).
      return opciones.alGuardarConMarca ? MENSAJE_MARCA_NO_ENCONTRADA : MENSAJE_PRODUCTO_NO_ENCONTRADO;
    case 413:
      return MENSAJE_ARCHIVO_GRANDE;
    case 415:
      return MENSAJE_TIPO_NO_ADMITIDO;
    case 429:
      return MENSAJE_DEMASIADAS_SUBIDAS;
    default:
      return error.mensaje;
  }
}
