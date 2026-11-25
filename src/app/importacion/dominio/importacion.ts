import {
  DatosArchivo,
  Disponibilidad,
  formatearPrecio,
  MarcaDeProducto,
  precioParaApi,
} from '../../productos/dominio/producto';

/**
 * Importación asistida del catálogo en PDF (RF-PRO-01, RF-PRO-02, D-49, D-55).
 * Contrato: docs/contrato-api/productos-importacion.md. Esta capa no depende de Angular ni de
 * PrimeNG. Un borrador nunca es un producto: solo al aprobarlo el servidor crea el producto.
 */

export type EstadoBorrador = 'PENDIENTE' | 'APROBADO' | 'DESCARTADO';

export const ESTADOS_BORRADOR: readonly EstadoBorrador[] = ['PENDIENTE', 'APROBADO', 'DESCARTADO'];

const ETIQUETAS_ESTADO: Readonly<Record<EstadoBorrador, string>> = {
  PENDIENTE: 'Pendientes',
  APROBADO: 'Aprobados',
  DESCARTADO: 'Descartados',
};

export function etiquetaEstadoBorrador(estado: EstadoBorrador): string {
  return ETIQUETAS_ESTADO[estado];
}

export interface TotalesImportacion {
  readonly pendientes: number;
  readonly aprobados: number;
  readonly descartados: number;
  readonly conAdvertencias: number;
}

export interface Importacion {
  readonly id: string;
  readonly nombreArchivo: string;
  readonly marca: MarcaDeProducto;
  readonly paginas: number;
  readonly totales: TotalesImportacion;
  readonly creadaEn: string;
}

export interface Borrador {
  readonly id: string;
  readonly idImportacion: string;
  /** Página del PDF de donde salió el producto. */
  readonly pagina: number;
  readonly codigo: string | null;
  readonly nombre: string;
  readonly descripcion: string | null;
  /** Texto decimal `"37.00"`; nunca número de punto flotante. */
  readonly precio: string | null;
  readonly precioNormal: string | null;
  readonly marcaId: string;
  readonly disponibilidad: Disponibilidad;
  readonly estado: EstadoBorrador;
  /** Códigos del contrato; un código desconocido se trata como advertencia de revisión. */
  readonly advertencias: readonly string[];
  readonly idProducto: string | null;
  /**
   * Producto de la misma marca que se actualizará al aprobar (catálogos mensuales, D-57). Es
   * opcional: si la API no lo envía, la lista solo muestra el precio del borrador.
   */
  readonly productoExistente?: { readonly id: string; readonly nombre: string; readonly precio: string } | null;
}

/** Precio actual del producto que el borrador actualizaría, o `null` si no aplica o es igual. */
export function precioActualDistinto(
  borrador: Pick<Borrador, 'precio' | 'productoExistente'>,
): string | null {
  const actual = borrador.productoExistente?.precio;
  if (actual === undefined || borrador.precio === null) {
    return null;
  }
  return precioParaApi(actual) === precioParaApi(borrador.precio) ? null : actual;
}

/** Cuerpo parcial de `PATCH /productos/importaciones/borradores/{id}` (nada admite `null`). */
export interface CambiosBorrador {
  readonly nombre?: string;
  readonly descripcion?: string;
  readonly precio?: string;
  readonly marcaId?: string;
  readonly disponibilidad?: Disponibilidad;
}

export interface ConsultaBorradores {
  /** Página (desde 1). */
  readonly pagina: number;
  readonly tamanio: number;
  /** El servidor usa `PENDIENTE` si se omite; el panel siempre lo envía. */
  readonly estado: EstadoBorrador;
  readonly conAdvertencias?: boolean;
  readonly busqueda?: string;
  /** Página del PDF. */
  readonly paginaPdf?: number;
}

export interface PaginaBorradores {
  readonly elementos: readonly Borrador[];
  readonly pagina: number;
  readonly tamanio: number;
  readonly total: number;
}

export const TAMANIO_PAGINA_BORRADORES = 50;
/** El servidor admite hasta 100 por página y hasta 100 ids por lote. */
export const TAMANIOS_PAGINA_BORRADORES: readonly number[] = [20, 50, 100];
export const MAXIMO_IDS_POR_LOTE = 100;

// ── Archivo PDF (D-55: un archivo, hasta 60 MB) ───────────────────────────────────────────

export const MAX_BYTES_PDF = 60 * 1024 * 1024;
export const MAX_MB_PDF = 60;

/**
 * `null` si el archivo parece un PDF de hasta 60 MB; si no, el mensaje para el Vendedor. Es solo una
 * comodidad: el servidor comprueba la firma real `%PDF-` (415), el peso (413) y el contenido (422).
 */
export function validarArchivoPdf(archivo: DatosArchivo): string | null {
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  const tipoValido = archivo.type === '' || archivo.type === 'application/pdf';
  if (extension !== 'pdf' || !tipoValido) {
    return `«${archivo.name}» no es un PDF. Elige el catálogo en formato PDF.`;
  }
  if (archivo.size === 0) {
    return `«${archivo.name}» está vacío.`;
  }
  if (archivo.size > MAX_BYTES_PDF) {
    return `«${archivo.name}» pesa más de ${MAX_MB_PDF} MB.`;
  }
  return null;
}

// ── Advertencias ────────────────────────────────────────────────────────────────────────

/** Pasos de la pantalla de importar, en el orden en que los ve el Vendedor (D-61). */
export const PASOS_IMPORTACION: readonly string[] = ['Elige la marca', 'Elige el PDF', 'Analizar'];

/** Minúsculas, sin tildes ni signos: «Catálogo L'Bel-C13.pdf» → «catalogolbelc13pdf». */
function claveDeTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Id de la marca que coincide con el nombre del archivo («Yanbal_C14.pdf» → Yanbal), o `null` si no
 * se reconoce ninguna o hay duda. Solo se consideran las marcas dadas (las activas): la sugerida es
 * aquella cuyo nombre («Yanbal», «Leonisa», «Avon», «Cyzone», «Ésika», «L'Bel»...) aparece en el
 * archivo, sin importar mayúsculas, tildes ni signos. Es solo una sugerencia: el Vendedor siempre
 * puede cambiarla.
 */
export function marcaSugeridaPorArchivo(
  nombreArchivo: string,
  marcas: readonly { readonly id: string; readonly nombre: string }[],
): string | null {
  const archivo = claveDeTexto(nombreArchivo.replace(/\.pdf$/i, ''));
  const coincidencias = marcas.filter((marca) => {
    const clave = claveDeTexto(marca.nombre);
    return clave.length >= 3 && archivo.includes(clave);
  });
  return coincidencias.length === 1 ? (coincidencias[0]?.id ?? null) : null;
}

/** Porcentaje entero de subida (0 a 100); sin total conocido, 0. */
export function porcentajeDeSubida(cargados: number, total: number | undefined): number {
  if (total === undefined || total <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.floor((cargados / total) * 100)));
}

export interface InfoAdvertencia {
  readonly etiqueta: string;
  readonly ayuda: string;
  /** Informativa: no exige revisar (`PRECIO_EN_OFERTA`, `VARIAS_REFERENCIAS`). */
  readonly informativa: boolean;
}

const ADVERTENCIAS: Readonly<Record<string, InfoAdvertencia>> = {
  SIN_PRECIO: {
    etiqueta: 'Sin precio',
    ayuda: 'No se encontró el precio. Escríbelo para poder aprobarlo.',
    informativa: false,
  },
  SIN_CODIGO: {
    etiqueta: 'Sin código',
    ayuda: 'No se reconoció el código del catálogo.',
    informativa: false,
  },
  NOMBRE_DUDOSO: {
    etiqueta: 'Nombre dudoso',
    ayuda: 'El nombre es muy corto, solo números o muy largo. Revísalo.',
    informativa: false,
  },
  CODIGO_REPETIDO: {
    etiqueta: 'Código repetido',
    ayuda: 'El mismo código aparece dos veces en el PDF.',
    informativa: false,
  },
  YA_IMPORTADO: {
    etiqueta: 'Ya importado',
    ayuda: 'Este código ya se aprobó en otra importación.',
    informativa: false,
  },
  PRECIO_EN_OFERTA: {
    etiqueta: 'Precio en oferta',
    ayuda: 'El catálogo trae un precio normal distinto del vigente.',
    informativa: true,
  },
  VARIAS_REFERENCIAS: {
    etiqueta: 'Varias referencias',
    ayuda: 'El producto tiene varias referencias; todas están en la descripción.',
    informativa: true,
  },
};

export function infoAdvertencia(codigo: string): InfoAdvertencia {
  return (
    ADVERTENCIAS[codigo] ?? {
      etiqueta: codigo,
      ayuda: 'Advertencia desconocida: revisa este borrador con cuidado.',
      informativa: false,
    }
  );
}

/** Advertencias que sí piden revisión (las informativas se muestran con otro estilo). */
export function advertenciasDeRevision(borrador: Pick<Borrador, 'advertencias'>): string[] {
  return borrador.advertencias.filter((codigo) => !infoAdvertencia(codigo).informativa);
}

export function advertenciasInformativas(borrador: Pick<Borrador, 'advertencias'>): string[] {
  return borrador.advertencias.filter((codigo) => infoAdvertencia(codigo).informativa);
}

/** Un borrador sin precio no se puede aprobar hasta que el Vendedor escriba uno válido. */
export function tieneSinPrecio(borrador: Pick<Borrador, 'precio' | 'advertencias'>): boolean {
  return borrador.precio === null || borrador.advertencias.includes('SIN_PRECIO');
}

/** Solo un borrador pendiente y con precio se puede aprobar (el servidor lo vuelve a comprobar). */
export function puedeAprobar(
  borrador: Pick<Borrador, 'estado' | 'precio' | 'advertencias'>,
): boolean {
  return borrador.estado === 'PENDIENTE' && !tieneSinPrecio(borrador);
}

export function puedeEditar(borrador: Pick<Borrador, 'estado'>): boolean {
  return borrador.estado === 'PENDIENTE';
}

// ── Resumen de la importación ───────────────────────────────────────────────────────────

export function totalDeBorradores(totales: TotalesImportacion): number {
  return totales.pendientes + totales.aprobados + totales.descartados;
}

/** «Se encontraron 143 productos; 12 con advertencias.» */
export function resumenDeAnalisis(importacion: Pick<Importacion, 'totales'>): string {
  const total = totalDeBorradores(importacion.totales);
  const avisos = importacion.totales.conAdvertencias;
  const encontrados =
    total === 1 ? 'Se encontró 1 producto' : `Se encontraron ${total} productos`;
  const conAvisos = avisos === 1 ? '1 con advertencias' : `${avisos} con advertencias`;
  return `${encontrados}; ${conAvisos}.`;
}

/** Precio para la tabla: `$37.00`, o un guion si el borrador no tiene precio. */
export function precioDeBorrador(precio: string | null): string {
  return precio === null ? '—' : formatearPrecio(precio);
}

// ── Resultado de aprobar o descartar ────────────────────────────────────────────────────

export type ErrorDeBorrador = 'SIN_PRECIO' | 'MARCA_INACTIVA' | 'NO_PENDIENTE' | 'NO_ENCONTRADO';

export type ResultadoBorrador =
  | { readonly id: string; readonly estado: EstadoBorrador; readonly idProducto?: string | null }
  | { readonly id: string; readonly error: ErrorDeBorrador | string };

export interface ResumenLote {
  readonly correctos: readonly string[];
  readonly fallidos: readonly { readonly id: string; readonly error: string }[];
}

export function resumirLote(resultados: readonly ResultadoBorrador[]): ResumenLote {
  const correctos: string[] = [];
  const fallidos: { id: string; error: string }[] = [];
  for (const resultado of resultados) {
    if ('error' in resultado) {
      fallidos.push({ id: resultado.id, error: resultado.error });
    } else {
      correctos.push(resultado.id);
    }
  }
  return { correctos, fallidos };
}

const MENSAJES_ERROR_BORRADOR: Readonly<Record<string, string>> = {
  SIN_PRECIO: 'sin precio',
  MARCA_INACTIVA: 'con la marca desactivada',
  NO_PENDIENTE: 'que ya no estaban pendientes',
  NO_ENCONTRADO: 'que ya no existen',
};

/**
 * Cuenta los fallidos por motivo: «2 sin precio, 1 con la marca desactivada». Un motivo que el
 * panel no conoce se agrupa como «por otro motivo».
 */
export function descripcionDeFallidos(fallidos: ResumenLote['fallidos']): string {
  const cuentas = new Map<string, number>();
  for (const { error } of fallidos) {
    const texto = MENSAJES_ERROR_BORRADOR[error] ?? 'por otro motivo';
    cuentas.set(texto, (cuentas.get(texto) ?? 0) + 1);
  }
  return [...cuentas].map(([texto, cantidad]) => `${cantidad} ${texto}`).join(', ');
}

// ── Edición de un borrador ──────────────────────────────────────────────────────────────

export interface FormularioBorrador {
  readonly nombre: string;
  readonly descripcion: string;
  readonly precio: string;
  readonly marcaId: string;
  readonly disponibilidad: Disponibilidad;
}

/**
 * Solo los campos que cambiaron. El precio se compara y se envía como texto exacto con 2
 * decimales; el servidor no admite `null`, así que un campo vacío que ya estaba vacío no se envía.
 */
export function cambiosDeBorrador(
  original: Borrador,
  formulario: FormularioBorrador,
): CambiosBorrador {
  const cambios: { -readonly [K in keyof CambiosBorrador]: CambiosBorrador[K] } = {};
  const nombre = formulario.nombre.trim();
  if (nombre !== original.nombre) {
    cambios.nombre = nombre;
  }
  if (formulario.descripcion !== (original.descripcion ?? '')) {
    cambios.descripcion = formulario.descripcion;
  }
  const precio = formulario.precio.trim();
  if (precio !== '') {
    const nuevo = precioParaApi(precio);
    if (original.precio === null || nuevo !== precioParaApi(original.precio)) {
      cambios.precio = nuevo;
    }
  }
  if (formulario.marcaId !== original.marcaId) {
    cambios.marcaId = formulario.marcaId;
  }
  if (formulario.disponibilidad !== original.disponibilidad) {
    cambios.disponibilidad = formulario.disponibilidad;
  }
  return cambios;
}
