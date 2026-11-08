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
