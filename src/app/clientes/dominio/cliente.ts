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
  /**
   * Fecha ISO en que confirmó su correo, o `null` si aún no (contrato usuarios-gestion.md,
   * «Correo verificado en la lista de clientes»). Ausente en una API antigua: estado
   * desconocido, nunca «sin verificar».
   */
  readonly correoVerificadoEn?: string | null;
}

/** Estado del correo de un cliente. `desconocido`: la API no envió el campo. */
export type EstadoCorreo = 'verificado' | 'sin-verificar' | 'desconocido';

export function estadoCorreoDe(cliente: Pick<Cliente, 'correoVerificadoEn'>): EstadoCorreo {
  const fecha = cliente.correoVerificadoEn;
  if (fecha === undefined) {
    return 'desconocido';
  }
  return fecha === null ? 'sin-verificar' : 'verificado';
}

export const ETIQUETA_CORREO_VERIFICADO = 'Verificado';
export const ETIQUETA_CORREO_SIN_VERIFICAR = 'Sin verificar';
export const AYUDA_CORREO_SIN_VERIFICAR =
  'Aún no confirmó su correo. No podrá recuperar su clave por correo; solo con tu ayuda.';

/** Texto del aviso sobre la tabla: «N clientes tienen el correo sin verificar». */
export function textoAvisoSinVerificar(cantidad: number): string {
  return cantidad === 1
    ? '1 cliente tiene el correo sin verificar'
    : `${cantidad} clientes tienen el correo sin verificar`;
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
  /** `?activo=true|false` (D-53); ausente = todos los clientes. */
  readonly activo?: boolean;
  /** `?correoVerificado=true|false`; ausente = todos los clientes. */
  readonly correoVerificado?: boolean;
}

/** Filtro «Correo» de la tabla. */
export type FiltroCorreoCliente = 'todos' | 'verificados' | 'sin-verificar';

export const OPCIONES_FILTRO_CORREO: { etiqueta: string; valor: FiltroCorreoCliente }[] = [
  { etiqueta: 'Todos', valor: 'todos' },
  { etiqueta: 'Verificados', valor: 'verificados' },
  { etiqueta: 'Sin verificar', valor: 'sin-verificar' },
];

/** Valor de `?correoVerificado=` para el filtro, o `undefined` para no filtrar. */
export function correoVerificadoDeFiltro(filtro: FiltroCorreoCliente): boolean | undefined {
  if (filtro === 'verificados') {
    return true;
  }
  return filtro === 'sin-verificar' ? false : undefined;
}

/** Filtro de estado de la tabla (D-53). */
export type FiltroEstadoCliente = 'todos' | 'activos' | 'desactivados';

export const OPCIONES_FILTRO_ESTADO: { etiqueta: string; valor: FiltroEstadoCliente }[] = [
  { etiqueta: 'Todos', valor: 'todos' },
  { etiqueta: 'Activos', valor: 'activos' },
  { etiqueta: 'Desactivados', valor: 'desactivados' },
];

/** Valor de `?activo=` para el filtro, o `undefined` para no filtrar. */
export function activoDeFiltro(filtro: FiltroEstadoCliente): boolean | undefined {
  if (filtro === 'activos') {
    return true;
  }
  return filtro === 'desactivados' ? false : undefined;
}

/** Texto del estado de la cuenta (D-53). */
export function etiquetaEstado(activo: boolean): 'Activo' | 'Desactivado' {
  return activo ? 'Activo' : 'Desactivado';
}

/**
 * Respuesta de `PATCH /usuarios/{id}/estado`: el usuario público con `activo` actualizado.
 * Solo se usan estos campos; la lista se vuelve a consultar para mostrar lo oficial.
 */
export interface EstadoClienteActualizado {
  readonly id: string;
  readonly activo: boolean;
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
  activo?: boolean,
  correoVerificado?: boolean,
): ConsultaClientes {
  const paginaValida = Number.isInteger(pagina) && pagina >= 1 ? pagina : 1;
  const tamanioValido =
    Number.isInteger(tamanio) && tamanio >= 1 && tamanio <= TAMANIO_PAGINA_CLIENTES_MAXIMO
      ? tamanio
      : TAMANIO_PAGINA_CLIENTES;
  const texto = [...(busqueda ?? '').trim()].slice(0, LONGITUD_MAXIMA_BUSQUEDA).join('');
  return {
    pagina: paginaValida,
    tamanio: tamanioValido,
    ...(texto ? { busqueda: texto } : {}),
    ...(activo === undefined ? {} : { activo }),
    ...(correoVerificado === undefined ? {} : { correoVerificado }),
  };
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
