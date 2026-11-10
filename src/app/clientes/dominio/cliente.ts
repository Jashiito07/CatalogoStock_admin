/**
 * Clientes del panel y código de recuperación de la clave (RF-USU-05, D-35, D-39;
 * docs/contrato-api/recuperacion-clave.md). Capa de dominio: TypeScript puro.
 */

/** Elemento de `GET /usuarios`: solo usuarios con rol CLIENTE. Nunca incluye el código. */
export interface Cliente {
  readonly id: string;
  readonly nombre: string;
  readonly correo: string;
  /** Formato `+5939XXXXXXXX` (D-14). */
  readonly telefono: string;
  readonly activo: boolean;
  readonly creadoEn: string;
  /** Vencimiento (UTC) del código vigente, o `null` si no hay uno. */
  readonly codigoRecuperacionVigenteHasta: string | null;
}

/** Formato de paginación del contrato (README). */
export interface PaginaClientes {
  readonly elementos: readonly Cliente[];
  readonly pagina: number;
  readonly tamanio: number;
  readonly total: number;
}

/**
 * Respuesta 201 de `POST /usuarios/{id}/codigo-recuperacion`: la **única** vez que el
 * código viaja por la red. El panel lo muestra una vez y no lo guarda en ningún lugar.
 */
export interface CodigoRecuperacion {
  readonly codigo: string;
  readonly venceEn: string;
  readonly cliente: { readonly id: string; readonly nombre: string; readonly correo: string };
}

/** Parámetros de `GET /usuarios`. */
export interface ConsultaClientes {
  readonly pagina: number;
  readonly tamanio: number;
  readonly busqueda?: string;
}

export const TAMANIO_PAGINA_CLIENTES = 20;
export const TAMANIO_PAGINA_CLIENTES_MAXIMO = 100;
export const LONGITUD_MAXIMA_BUSQUEDA = 100;

/**
 * Construye la consulta del contrato: la búsqueda se recorta y se omite si queda vacía;
 * se limita a 100 caracteres (más larga, la API respondería 400).
 */
export function construirConsultaClientes(
  busqueda: string | null | undefined,
  pagina: number,
  tamanio: number,
): ConsultaClientes {
  const paginaValida = Number.isInteger(pagina) && pagina >= 1 ? pagina : 1;
  const tamanioValido =
    Number.isInteger(tamanio) && tamanio >= 1 && tamanio <= TAMANIO_PAGINA_CLIENTES_MAXIMO
      ? tamanio
      : TAMANIO_PAGINA_CLIENTES;
  const texto = [...(busqueda ?? '').trim()].slice(0, LONGITUD_MAXIMA_BUSQUEDA).join('');
  return { pagina: paginaValida, tamanio: tamanioValido, ...(texto ? { busqueda: texto } : {}) };
}

/** Página (desde 1) a partir del primer índice de la tabla. */
export function paginaDesdeIndice(primero: number, tamanio: number): number {
  return Math.floor(Math.max(0, primero) / tamanio) + 1;
}

/**
 * Celular de Ecuador en formato legible: `+593991234567` → `099 123 4567`.
 * Si no tiene el formato esperado, se devuelve tal cual.
 */
export function formatearTelefono(telefono: string): string {
  const coincidencia = /^\+593(9\d{8})$/.exec(telefono);
  if (coincidencia === null) {
    return telefono;
  }
  const local = `0${coincidencia[1]}`;
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

/** Hay un código vigente si su vencimiento es posterior al instante `ahora`. */
export function tieneCodigoVigente(
  cliente: Pick<Cliente, 'codigoRecuperacionVigenteHasta'>,
  ahora: Date,
): boolean {
  const hasta = cliente.codigoRecuperacionVigenteHasta;
  if (hasta === null) {
    return false;
  }
  const vence = Date.parse(hasta);
  return !Number.isNaN(vence) && vence > ahora.getTime();
}

/** El código del contrato: exactamente 6 dígitos. */
export function esCodigoValido(codigo: string): boolean {
  return /^\d{6}$/.test(codigo);
}
