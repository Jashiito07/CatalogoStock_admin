import { ErrorApi } from '../../compartido/aplicacion/error-api';
import {
  idDeImportacionDuplicada,
  MENSAJE_ARCHIVO_GRANDE,
  MENSAJE_DATOS_INVALIDOS,
  MENSAJE_DEMASIADOS_ANALISIS,
  MENSAJE_DUPLICADA,
  MENSAJE_ERROR_INESPERADO,
  MENSAJE_FORMATO,
  MENSAJE_MARCA_INACTIVA,
  MENSAJE_MARCA_NO_ENCONTRADA,
  MENSAJE_NO_EDITABLE,
  MENSAJE_PDF_ILEGIBLE,
  MENSAJE_CONEXION_LENTA,
  MENSAJE_SIN_CONEXION_SUBIDA,
  mensajeDeErrorDeAnalisis,
  mensajeDeErrorDeImportacion,
} from './mensajes-importacion';

const ID = '11111111-1111-4111-8111-111111111111';

describe('mensajeDeErrorDeImportacion (contrato productos-importacion.md, «Errores»)', () => {
  const casos: [string, ErrorApi, string][] = [
    ['400', new ErrorApi('DATOS_INVALIDOS', 'x', 400), MENSAJE_DATOS_INVALIDOS],
    ['404 marca', new ErrorApi('MARCA_NO_ENCONTRADA', 'x', 404), MENSAJE_MARCA_NO_ENCONTRADA],
    ['409', new ErrorApi('IMPORTACION_DUPLICADA', 'x', 409, { idImportacion: ID }), MENSAJE_DUPLICADA],
    ['413', new ErrorApi('ARCHIVO_DEMASIADO_GRANDE', 'x', 413), MENSAJE_ARCHIVO_GRANDE],
    ['413 sin cuerpo', new ErrorApi('ERROR_DESCONOCIDO', 'x', 413), MENSAJE_ARCHIVO_GRANDE],
    ['415', new ErrorApi('FORMATO_NO_PERMITIDO', 'x', 415), MENSAJE_FORMATO],
    ['422 ilegible', new ErrorApi('PDF_ILEGIBLE', 'x', 422), MENSAJE_PDF_ILEGIBLE],
    ['422 marca inactiva', new ErrorApi('MARCA_INACTIVA', 'x', 422), MENSAJE_MARCA_INACTIVA],
    ['422 no editable', new ErrorApi('BORRADOR_NO_EDITABLE', 'x', 422), MENSAJE_NO_EDITABLE],
    ['429', new ErrorApi('LIMITE_EXCEDIDO', 'x', 429), MENSAJE_DEMASIADOS_ANALISIS],
  ];

  it.each(casos)('%s tiene un mensaje claro en español', (_nombre, error, esperado) => {
    expect(mensajeDeErrorDeImportacion(error)).toBe(esperado);
  });

  it('sin conexión usa el mensaje del interceptor; lo desconocido, uno genérico', () => {
    expect(mensajeDeErrorDeImportacion(new ErrorApi('SIN_CONEXION', 'Sin conexión.', 0))).toBe('Sin conexión.');
    expect(mensajeDeErrorDeImportacion(new Error('x'))).toBe(MENSAJE_ERROR_INESPERADO);
  });

  it('D-61: el análisis distingue un corte de red y una conexión lenta (408, 502, 503, 504)', () => {
    expect(mensajeDeErrorDeAnalisis(new ErrorApi('SIN_CONEXION', 'x', 0))).toBe(MENSAJE_SIN_CONEXION_SUBIDA);
    for (const estado of [408, 502, 503, 504]) {
      expect(mensajeDeErrorDeAnalisis(new ErrorApi('ERROR_DESCONOCIDO', 'x', estado))).toBe(MENSAJE_CONEXION_LENTA);
    }
    expect(mensajeDeErrorDeAnalisis(new ErrorApi('LIMITE_EXCEDIDO', 'x', 429))).toBe(MENSAJE_DEMASIADOS_ANALISIS);
    expect(mensajeDeErrorDeAnalisis(new ErrorApi('PDF_ILEGIBLE', 'x', 422))).toBe(MENSAJE_PDF_ILEGIBLE);
  });

  it('extrae el id de la importación existente del 409, solo si es un UUID', () => {
    expect(idDeImportacionDuplicada(new ErrorApi('IMPORTACION_DUPLICADA', 'x', 409, { idImportacion: ID }))).toBe(ID);
    expect(idDeImportacionDuplicada(new ErrorApi('IMPORTACION_DUPLICADA', 'x', 409, { idImportacion: '../x' }))).toBeNull();
    expect(idDeImportacionDuplicada(new ErrorApi('OTRO', 'x', 409, { idImportacion: ID }))).toBeNull();
  });
});
