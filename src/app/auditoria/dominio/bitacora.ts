/**
 * Bitácora de actividades (RF-USU-04, docs/contrato-api/auditoria.md).
 * Capa de dominio: TypeScript puro, sin Angular ni HTTP.
 */
import { fechaHoraEcuador } from '../../compartido/dominio/fecha-ecuador';

/** Catálogo cerrado de acciones del contrato, con su nombre para el Vendedor. */
export const ETIQUETAS_ACCION = {
  USUARIO_REGISTRADO: 'Cliente registrado',
  VENDEDOR_CREADO: 'Vendedor creado',
  SESION_INICIADA: 'Sesión iniciada',
  SESION_FALLIDA: 'Ingreso fallido',
  SESION_CERRADA: 'Sesión cerrada',
  SESION_REUTILIZACION_DETECTADA: 'Reutilización de sesión detectada',
  ACCESO_DENEGADO: 'Acceso denegado',
  // RF-USU-05 (D-35, D-39): recuperación y cambio de clave.
  CODIGO_RECUPERACION_GENERADO: 'Código de recuperación generado',
  CLAVE_RESTABLECIDA: 'Clave restablecida',
  RECUPERACION_FALLIDA: 'Recuperación de clave fallida',
  CLAVE_CAMBIADA: 'Clave cambiada',
  PAGO_VERIFICADO: 'Pago verificado',
  PEDIDO_ESTADO_CAMBIADO: 'Cambio de estado de pedido',
} as const;

export type AccionAuditoria = keyof typeof ETIQUETAS_ACCION;

export const ACCIONES_AUDITORIA = Object.keys(ETIQUETAS_ACCION) as AccionAuditoria[];

export type Gravedad = 'exito' | 'neutral' | 'alerta';

const GRAVEDAD_ACCION: Readonly<Record<AccionAuditoria, Gravedad>> = {
  USUARIO_REGISTRADO: 'exito',
  VENDEDOR_CREADO: 'exito',
  SESION_INICIADA: 'exito',
  SESION_FALLIDA: 'alerta',
  SESION_CERRADA: 'neutral',
  SESION_REUTILIZACION_DETECTADA: 'alerta',
  ACCESO_DENEGADO: 'alerta',
  CODIGO_RECUPERACION_GENERADO: 'neutral',
  CLAVE_RESTABLECIDA: 'exito',
  RECUPERACION_FALLIDA: 'alerta',
  CLAVE_CAMBIADA: 'exito',
  PAGO_VERIFICADO: 'neutral',
  PEDIDO_ESTADO_CAMBIADO: 'neutral',
};

const ETIQUETAS_ENTIDAD: Readonly<Record<string, string>> = {
  USUARIO: 'Usuario',
  SESION: 'Sesión',
  PEDIDO: 'Pedido',
  PAGO: 'Pago',
};

const ETIQUETAS_ROL: Readonly<Record<string, string>> = {
  CLIENTE: 'Cliente',
  VENDEDOR: 'Vendedor',
};

/** Usuario de una actividad. `rol` es `null` si el usuario fue eliminado (D-30). */
export interface UsuarioDeActividad {
  readonly id: string;
  readonly nombre: string;
  readonly rol: string | null;
}

export type ValorDetalle = string | number | boolean | null;

/** «Registro de actividad» del contrato. Las fechas llegan en UTC (D-31). */
export interface RegistroActividad {
  readonly id: string;
  readonly fecha: string;
  readonly accion: string;
  readonly usuario: UsuarioDeActividad | null;
  readonly entidad: string | null;
  readonly idEntidad: string | null;
  readonly detalle: Readonly<Record<string, ValorDetalle>>;
}

/** Formato de paginación del contrato (README). */
export interface PaginaBitacora {
  readonly elementos: readonly RegistroActividad[];
  readonly pagina: number;
  readonly tamanio: number;
  readonly total: number;
}

export const TAMANIO_PAGINA_POR_DEFECTO = 20;
export const TAMANIO_PAGINA_MAXIMO = 100;

export function etiquetaAccion(accion: string): string {
  return accion in ETIQUETAS_ACCION ? ETIQUETAS_ACCION[accion as AccionAuditoria] : accion;
}

export function gravedadAccion(accion: string): Gravedad {
  return accion in GRAVEDAD_ACCION ? GRAVEDAD_ACCION[accion as AccionAuditoria] : 'neutral';
}

export function etiquetaEntidad(entidad: string | null): string {
  return entidad === null ? '—' : (ETIQUETAS_ENTIDAD[entidad] ?? entidad);
}

export function etiquetaRol(rol: string | null): string | null {
  return rol === null ? null : (ETIQUETAS_ROL[rol] ?? rol);
}

export const NOMBRE_USUARIO_NO_IDENTIFICADO = 'No identificado';
export const NOMBRE_USUARIO_ELIMINADO = 'Usuario eliminado';

/** Cómo mostrar al usuario de una actividad (contrato: `null` o «Usuario eliminado», D-30). */
export interface DescripcionUsuario {
  readonly nombre: string;
  readonly rol: string | null;
  /** `false` cuando no se pudo identificar o fue eliminado. */
  readonly identificado: boolean;
  /** Se puede filtrar por él (tiene identificador). */
  readonly filtrable: boolean;
}

export function describirUsuario(usuario: UsuarioDeActividad | null): DescripcionUsuario {
  if (usuario === null) {
    return { nombre: NOMBRE_USUARIO_NO_IDENTIFICADO, rol: null, identificado: false, filtrable: false };
  }
  const eliminado = usuario.rol === null;
  return {
    nombre: eliminado ? NOMBRE_USUARIO_ELIMINADO : usuario.nombre,
    rol: etiquetaRol(usuario.rol),
    identificado: !eliminado,
    filtrable: true,
  };
}

const ETIQUETAS_CAMPO_DETALLE: Readonly<Record<string, string>> = {
  rol: 'Rol',
  canal: 'Canal',
  motivo: 'Motivo',
  correo: 'Correo intentado',
  metodo: 'Método',
  ruta: 'Ruta',
  rolUsuario: 'Rol del usuario',
  origen: 'Origen',
  familiaRevocada: 'Sesiones revocadas',
  venceEn: 'Vence',
  sesionesRevocadas: 'Sesiones cerradas',
};

/** Campos de `detalle` que son fechas en UTC: se muestran en hora de Ecuador (D-31). */
const CAMPOS_FECHA_DETALLE: ReadonlySet<string> = new Set(['venceEn']);

const ETIQUETAS_VALOR_DETALLE: Readonly<Record<string, string>> = {
  CLIENTE: 'Cliente',
  VENDEDOR: 'Vendedor',
  APP: 'App móvil',
  PANEL: 'Panel web',
  CREDENCIALES_INVALIDAS: 'Credenciales inválidas',
  ROL_NO_PERMITIDO: 'Rol no permitido en ese canal',
  COMANDO_SEMILLA: 'Comando de instalación',
  // Origen de CLAVE_RESTABLECIDA.
  CODIGO_VENDEDOR: 'Código del vendedor',
  COMANDO_SERVIDOR: 'Comando del servidor',
  // Motivos internos de RECUPERACION_FALLIDA (D-20); solo los ve el Vendedor.
  SIN_CODIGO: 'Sin código vigente',
  CODIGO_INCORRECTO: 'Código incorrecto',
  VENCIDO: 'Código vencido',
  AGOTADO: 'Intentos agotados',
  NO_CLIENTE: 'No es una cuenta de cliente',
};

export interface CampoDetalle {
  readonly etiqueta: string;
  readonly valor: string;
}

/** Convierte el `detalle` de una actividad en pares legibles para el Vendedor. */
export function describirDetalle(detalle: Readonly<Record<string, ValorDetalle>>): CampoDetalle[] {
  return Object.entries(detalle).map(([campo, valor]) => ({
    etiqueta: ETIQUETAS_CAMPO_DETALLE[campo] ?? campo,
    valor:
      CAMPOS_FECHA_DETALLE.has(campo) && typeof valor === 'string'
        ? fechaHoraEcuador(valor) || valor
        : describirValor(valor),
  }));
}

function describirValor(valor: ValorDetalle): string {
  if (valor === null) {
    return '—';
  }
  if (typeof valor === 'boolean') {
    return valor ? 'Sí' : 'No';
  }
  const texto = String(valor);
  return ETIQUETAS_VALOR_DETALLE[texto] ?? texto;
}

// ---------------------------------------------------------------------------
// Filtros de fecha (D-31): siempre con fecha, hora y zona horaria de Ecuador.
// ---------------------------------------------------------------------------

/** Ecuador continental usa UTC-5 todo el año (sin horario de verano). */
export const ZONA_ECUADOR = '-05:00';

/** Día del calendario elegido por el Vendedor, sin hora. */
export interface DiaCalendario {
  readonly anio: number;
  readonly mes: number;
  readonly dia: number;
}

/** Día del calendario que muestra un `Date` local (el que devuelve el selector de fecha). */
export function diaCalendarioDe(fecha: Date): DiaCalendario {
  return { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1, dia: fecha.getDate() };
}

function textoDia({ anio, mes, dia }: DiaCalendario): string {
  return `${String(anio).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Primer instante del día en hora de Ecuador: `2026-11-05T00:00:00.000-05:00`. */
export function inicioDelDiaEcuador(dia: DiaCalendario): string {
  return `${textoDia(dia)}T00:00:00.000${ZONA_ECUADOR}`;
}

/** Último instante del día en hora de Ecuador: `2026-11-05T23:59:59.999-05:00`. */
export function finDelDiaEcuador(dia: DiaCalendario): string {
  return `${textoDia(dia)}T23:59:59.999${ZONA_ECUADOR}`;
}

function compararDias(a: DiaCalendario, b: DiaCalendario): number {
  return textoDia(a).localeCompare(textoDia(b));
}

/** Filtros que elige el Vendedor en la pantalla. */
export interface FiltrosBitacora {
  readonly accion?: AccionAuditoria | null;
  readonly desde?: DiaCalendario | null;
  readonly hasta?: DiaCalendario | null;
  readonly idUsuario?: string | null;
}

/** Parámetros de `GET /auditoria` según el contrato. */
export interface ConsultaBitacora {
  readonly pagina: number;
  readonly tamanio: number;
  readonly accion?: AccionAuditoria;
  readonly idUsuario?: string;
  readonly desde?: string;
  readonly hasta?: string;
}

export const MENSAJE_RANGO_FECHAS_INVALIDO =
  'La fecha «Hasta» debe ser igual o posterior a la fecha «Desde».';

export class ErrorFiltrosBitacora extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorFiltrosBitacora';
  }
}

/**
 * Construye la consulta para la API. `desde` incluye el día completo desde las 00:00 y
 * `hasta` hasta las 23:59:59.999, ambos en hora de Ecuador (-05:00), porque la API
 * rechaza una fecha sin hora ni zona (D-31). Falla si `hasta` < `desde`.
 */
export function construirConsultaBitacora(
  filtros: FiltrosBitacora,
  pagina: number,
  tamanio: number,
): ConsultaBitacora {
  if (!Number.isInteger(pagina) || pagina < 1) {
    throw new ErrorFiltrosBitacora('La página debe ser un entero mayor o igual a 1.');
  }
  if (!Number.isInteger(tamanio) || tamanio < 1 || tamanio > TAMANIO_PAGINA_MAXIMO) {
    throw new ErrorFiltrosBitacora(`El tamaño de página debe estar entre 1 y ${TAMANIO_PAGINA_MAXIMO}.`);
  }
  const { accion, desde, hasta, idUsuario } = filtros;
  if (desde && hasta && compararDias(hasta, desde) < 0) {
    throw new ErrorFiltrosBitacora(MENSAJE_RANGO_FECHAS_INVALIDO);
  }
  return {
    pagina,
    tamanio,
    ...(accion ? { accion } : {}),
    ...(idUsuario ? { idUsuario } : {}),
    ...(desde ? { desde: inicioDelDiaEcuador(desde) } : {}),
    ...(hasta ? { hasta: finDelDiaEcuador(hasta) } : {}),
  };
}

/** Página (desde 1) a partir del primer índice de la tabla. */
export function paginaDesdeIndice(primero: number, tamanio: number): number {
  return Math.floor(Math.max(0, primero) / tamanio) + 1;
}
