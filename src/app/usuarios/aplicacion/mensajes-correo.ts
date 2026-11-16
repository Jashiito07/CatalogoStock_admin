import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { ESPERA_REENVIO_SEGUNDOS, INTENTOS_MAXIMOS_CODIGO } from '../dominio/codigo-correo';

const MENSAJE_ERROR_DESCONOCIDO = 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/** Textos de la verificación del correo y la recuperación por correo (D-50, correo.md). */
export const MENSAJES_CORREO = {
  sinConexion: 'Necesitas conexión para esta acción. Revisa tu conexión e inténtalo de nuevo.',
  correoInvalido: 'Ingresa un correo válido.',
  codigoInvalido: 'Ingresa el código de 6 dígitos.',
  /** 422 `CODIGO_INVALIDO`: mensaje único, no revela el motivo. */
  codigoIncorrecto: 'El código no es válido o ya venció. Pide uno nuevo.',
  correoNoDisponible: 'No pudimos enviar el correo, inténtalo de nuevo.',
  correoYaVerificado: 'Tu correo ya está verificado.',
  demasiadasSolicitudes: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  sinPermiso: 'No tienes permiso para esta acción.',
  /** Respuesta idéntica exista o no la cuenta: no revela qué correos están registrados. */
  recuperacionSolicitada: 'Si el correo está registrado y verificado, te enviamos un código.',
} as const;

/** Dónde ocurrió el error: el 422 de la verificación y el de la recuperación se leen igual. */
export type ContextoCorreo = 'verificacion' | 'recuperacion';

/** Validación local previa al envío (antes de llamar a la API). */
export class ErrorDatosCorreo extends Error {
  constructor(
    readonly campo: 'correo' | 'codigo' | 'claveNueva',
    readonly mensaje: string,
  ) {
    super(mensaje);
    this.name = 'ErrorDatosCorreo';
  }
}

/** Segundos que pide esperar el 429 (`detalles.reintentarEnSegundos`), o `null`. */
export function segundosDeEspera(error: unknown): number | null {
  if (!(error instanceof ErrorApi)) {
    return null;
  }
  const segundos = error.detalles?.['reintentarEnSegundos'];
  return typeof segundos === 'number' && segundos > 0 ? Math.ceil(segundos) : null;
}

/** El 429 pide esperar; si la API no dice cuánto, se usa la espera por defecto. */
export function esperaTrasLimite(error: unknown): number {
  return segundosDeEspera(error) ?? ESPERA_REENVIO_SEGUNDOS;
}

/**
 * Mensaje claro para un error de correo (sin detalles técnicos):
 * 409 ya verificado, 422 código inválido, 429 límite, 503 correo no disponible, sin conexión.
 */
export function mensajeDeErrorDeCorreo(error: unknown): string {
  if (error instanceof ErrorDatosCorreo) {
    return error.mensaje;
  }
  if (!(error instanceof ErrorApi)) {
    return MENSAJE_ERROR_DESCONOCIDO;
  }
  if (error.esSinConexion) {
    return MENSAJES_CORREO.sinConexion;
  }
  if (error.estado === 503 || error.codigo === 'CORREO_NO_DISPONIBLE') {
    return MENSAJES_CORREO.correoNoDisponible;
  }
  switch (error.codigo) {
    case 'CODIGO_INVALIDO':
      return MENSAJES_CORREO.codigoIncorrecto;
    case 'CORREO_YA_VERIFICADO':
      return MENSAJES_CORREO.correoYaVerificado;
    case 'DEMASIADAS_SOLICITUDES': {
      const segundos = segundosDeEspera(error);
      return segundos === null
        ? MENSAJES_CORREO.demasiadasSolicitudes
        : `${MENSAJES_CORREO.demasiadasSolicitudes} (${segundos} s)`;
    }
    case 'NO_AUTORIZADO':
      return MENSAJES_CORREO.sinPermiso;
    case 'DATOS_INVALIDOS':
      return error.mensaje;
    default:
      return error.estado === 403 ? MENSAJES_CORREO.sinPermiso : MENSAJE_ERROR_DESCONOCIDO;
  }
}

/** ¿El error es 422 `CODIGO_INVALIDO`? (se cuentan los intentos en la pantalla). */
export function esCodigoIncorrecto(error: unknown): boolean {
  return error instanceof ErrorApi && error.codigo === 'CODIGO_INVALIDO';
}

/** El servidor no devuelve los intentos restantes: se cuentan localmente (como en la app). */
export function mensajeCodigoIncorrecto(intentosFallidos: number): string {
  if (intentosFallidos >= INTENTOS_MAXIMOS_CODIGO) {
    return `${MENSAJES_CORREO.codigoIncorrecto} Agotaste los ${INTENTOS_MAXIMOS_CODIGO} intentos de este código.`;
  }
  return `${MENSAJES_CORREO.codigoIncorrecto} Intento ${intentosFallidos} de ${INTENTOS_MAXIMOS_CODIGO}.`;
}
