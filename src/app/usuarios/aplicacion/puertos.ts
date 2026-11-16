import { Sesion, Usuario } from '../dominio/usuario';

/**
 * Puerto hacia la API de autenticación (contrato de usuarios). Los adaptadores
 * HTTP lo implementan en `infraestructura`; las pruebas usan dobles.
 * Los errores llegan como `ErrorApi` (compartido/aplicacion/error-api.ts).
 */
export abstract class ApiAutenticacion {
  /** POST /autenticacion/ingreso/vendedor: única ruta de ingreso del panel (D-19). */
  abstract ingresarVendedor(correo: string, clave: string): Promise<Sesion>;

  /** POST /autenticacion/renovacion: devuelve una sesión nueva y revoca el token usado (D-09). */
  abstract renovar(tokenRenovacion: string): Promise<Sesion>;

  /** POST /autenticacion/salida: revoca la familia del token de renovación (D-09). */
  abstract salir(tokenRenovacion: string): Promise<void>;

  /** GET /usuarios/yo. */
  abstract obtenerUsuarioActual(): Promise<Usuario>;

  /**
   * POST /usuarios/yo/clave (RF-USU-05, contrato recuperacion-clave.md): 204 sin cuerpo.
   * Con `tokenRenovacionActual` la API conserva esta sesión y revoca las demás.
   */
  abstract cambiarClave(solicitud: SolicitudCambioClave): Promise<void>;

  /**
   * POST /usuarios/yo/correo/verificacion (RF-USU-05, D-50, correo.md): envía el código al
   * correo registrado de la cuenta. 204. Errores: 409, 429, 503.
   */
  abstract solicitarVerificacionCorreo(): Promise<void>;

  /** POST /usuarios/yo/correo/confirmacion `{ codigo }`: 204. Errores: 400, 422 `CODIGO_INVALIDO`, 429. */
  abstract confirmarVerificacionCorreo(codigo: string): Promise<void>;

  /**
   * POST /autenticacion/recuperacion/solicitud `{ correo }` (público): responde 204 siempre,
   * exista o no la cuenta (correo.md, principio 2). Errores: 400, 429.
   */
  abstract solicitarRecuperacionPorCorreo(correo: string): Promise<void>;

  /** POST /autenticacion/recuperacion (público): 204; 422 `CODIGO_INVALIDO`; 429. */
  abstract restablecerClave(solicitud: SolicitudRestablecerClave): Promise<void>;
}

/** Cuerpo de `POST /autenticacion/recuperacion`. Nunca se guarda ni se escribe en registros. */
export interface SolicitudRestablecerClave {
  readonly correo: string;
  readonly codigo: string;
  readonly claveNueva: string;
}

/** Cuerpo de `POST /usuarios/yo/clave`. Nunca se guarda ni se escribe en registros. */
export interface SolicitudCambioClave {
  readonly claveActual: string;
  readonly claveNueva: string;
  readonly tokenRenovacionActual?: string;
}

/**
 * Dónde se guarda el token de renovación entre recargas de la página.
 * El contrato del panel exige `sessionStorage` (se pierde al cerrar la pestaña);
 * el token de acceso nunca pasa por aquí: vive solo en memoria.
 */
export abstract class AlmacenTokenRenovacion {
  abstract leer(): string | null;
  abstract guardar(token: string): void;
  abstract borrar(): void;
}
