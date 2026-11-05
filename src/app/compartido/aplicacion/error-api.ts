/**
 * Error de la API con el formato del contrato (docs/contrato-api/README.md):
 * `{ "codigo": "STOCK_INSUFICIENTE", "mensaje": "…", "detalles": {…} }`.
 *
 * Los casos de uso y las pantallas trabajan con este tipo y nunca con los errores
 * del cliente HTTP. El `mensaje` es apto para mostrarse al vendedor.
 */
export type DetallesErrorApi = Readonly<Record<string, unknown>>;

/** Códigos propios del panel cuando la respuesta no trae el formato del contrato. */
export const CODIGOS_ERROR_LOCALES = {
  sinConexion: 'SIN_CONEXION',
  desconocido: 'ERROR_DESCONOCIDO',
} as const;

export class ErrorApi extends Error {
  constructor(
    readonly codigo: string,
    readonly mensaje: string,
    /** Código de estado HTTP; 0 cuando no hubo respuesta del servidor. */
    readonly estado: number,
    readonly detalles?: DetallesErrorApi,
  ) {
    super(mensaje);
    this.name = 'ErrorApi';
  }

  /** La API no respondió (sin conexión, servidor caído o CORS). */
  get esSinConexion(): boolean {
    return this.codigo === CODIGOS_ERROR_LOCALES.sinConexion;
  }
}
