import { ErrorApi } from '../../compartido/aplicacion/error-api';

export const MENSAJE_SIN_PERMISO = 'No tienes permiso para esta acción.';
export const MENSAJE_DATOS_INVALIDOS =
  'Revisa los datos: elige una marca activa y un archivo PDF e inténtalo de nuevo.';
export const MENSAJE_MARCA_NO_ENCONTRADA =
  'La marca elegida ya no existe. Actualiza la lista de marcas e inténtalo de nuevo.';
export const MENSAJE_NO_ENCONTRADO =
  'No encontramos lo que buscas. Puede haber sido eliminado; vuelve a Importar catálogo.';
export const MENSAJE_DUPLICADA = 'Este PDF ya fue importado antes.';
export const MENSAJE_ARCHIVO_GRANDE = 'El PDF pesa más de 60 MB. Elige un archivo más liviano.';
export const MENSAJE_FORMATO = 'El archivo no es un PDF válido. Elige el catálogo en formato PDF.';
export const MENSAJE_PDF_ILEGIBLE =
  'No pudimos leer el PDF: puede estar cifrado, dañado, tener más de 400 páginas o no tener texto.';
export const MENSAJE_MARCA_INACTIVA =
  'La marca está desactivada. Actívala en Marcas o elige otra marca.';
export const MENSAJE_NO_EDITABLE =
  'Este borrador ya no se puede editar: ya se aprobó o se descartó.';
export const MENSAJE_DEMASIADOS_ANALISIS =
  'Hiciste demasiados análisis seguidos (el límite es de 5 por hora). Espera un momento e inténtalo de nuevo.';
export const MENSAJE_ERROR_INESPERADO = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/**
 * Mensaje claro para un error de la importación (400, 403, 404, 409, 413, 415, 422, 429), sin
 * detalles técnicos. Sin respuesta del servidor usa el mensaje de conexión del interceptor.
 */
export function mensajeDeErrorDeImportacion(error: unknown): string {
  if (!(error instanceof ErrorApi)) {
    return MENSAJE_ERROR_INESPERADO;
  }
  if (error.esSinConexion) {
    return error.mensaje;
  }
  switch (error.codigo) {
    case 'IMPORTACION_DUPLICADA':
      return MENSAJE_DUPLICADA;
    case 'MARCA_NO_ENCONTRADA':
      return MENSAJE_MARCA_NO_ENCONTRADA;
    case 'MARCA_INACTIVA':
      return MENSAJE_MARCA_INACTIVA;
    case 'ARCHIVO_DEMASIADO_GRANDE':
      return MENSAJE_ARCHIVO_GRANDE;
    case 'FORMATO_NO_PERMITIDO':
      return MENSAJE_FORMATO;
    case 'PDF_ILEGIBLE':
      return MENSAJE_PDF_ILEGIBLE;
    case 'BORRADOR_NO_EDITABLE':
      return MENSAJE_NO_EDITABLE;
    case 'DATOS_INVALIDOS':
      return MENSAJE_DATOS_INVALIDOS;
    default:
      break;
  }
  switch (error.estado) {
    case 403:
      return MENSAJE_SIN_PERMISO;
    case 404:
      return MENSAJE_NO_ENCONTRADO;
    case 413:
      return MENSAJE_ARCHIVO_GRANDE;
    case 415:
      return MENSAJE_FORMATO;
    case 429:
      return MENSAJE_DEMASIADOS_ANALISIS;
    default:
      return error.mensaje;
  }
}

export const MENSAJE_SIN_CONEXION_SUBIDA =
  'Se perdió la conexión al subir el PDF. Revisa tu Wi-Fi o tus datos móviles y vuelve a tocar «Analizar»: el archivo sigue elegido.';
export const MENSAJE_CONEXION_LENTA =
  'La conexión está muy lenta o el servidor tardó demasiado. Prueba con Wi-Fi y vuelve a tocar «Analizar».';
/** Aviso mientras sube: la subida lleva rato sin terminar (no es un error). */
export const AVISO_SUBIDA_LENTA =
  'La subida está tardando por la conexión. No cierres esta pantalla; si sigue igual, prueba con Wi-Fi.';

/**
 * Como `mensajeDeErrorDeImportacion`, pero para el análisis del PDF, donde un corte de red o un
 * tiempo agotado (408, 502, 503, 504) piden volver a intentar con mejor conexión (D-61).
 */
export function mensajeDeErrorDeAnalisis(error: unknown): string {
  if (error instanceof ErrorApi) {
    if (error.esSinConexion) {
      return MENSAJE_SIN_CONEXION_SUBIDA;
    }
    if ([408, 502, 503, 504].includes(error.estado)) {
      return MENSAJE_CONEXION_LENTA;
    }
  }
  return mensajeDeErrorDeImportacion(error);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de la importación existente en un 409 `IMPORTACION_DUPLICADA` (`detalles.idImportacion`). */
export function idDeImportacionDuplicada(error: unknown): string | null {
  if (!(error instanceof ErrorApi) || error.codigo !== 'IMPORTACION_DUPLICADA') {
    return null;
  }
  const id = error.detalles?.['idImportacion'] ?? error.detalles?.['id'];
  return typeof id === 'string' && UUID.test(id) ? id : null;
}
