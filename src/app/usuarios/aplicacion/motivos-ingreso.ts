/**
 * Motivos con los que se llega a la pantalla de ingreso (parámetro `motivo`).
 * Archivo aparte para no cargar la pantalla de ingreso desde otras partes del panel.
 */
export const MOTIVOS_INGRESO = {
  /** La sesión terminó sola: renovación rechazada o 401 (contrato de usuarios). */
  sesionTerminada: 'sesion-terminada',
  /** No se pudo recuperar la sesión porque la API no respondió. */
  sinConexion: 'sin-conexion',
  /** El Vendedor cerró sesión. */
  salida: 'salida',
} as const;
