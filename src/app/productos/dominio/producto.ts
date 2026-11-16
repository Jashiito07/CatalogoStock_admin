import { Dinero } from '../../compartido/dominio/dinero';

/**
 * Productos del catálogo (RF-PRO-01 a RF-PRO-05, RF-INV-03, RN-09, D-46, D-47).
 * Contrato: docs/contrato-api/productos.md. Esta capa no depende de Angular ni de PrimeNG.
 */

export type Disponibilidad = 'DISPONIBLE' | 'AGOTADO' | 'PENDIENTE_REPOSICION';

/** Resumen de la marca que acompaña a cada producto. */
export interface MarcaDeProducto {
  readonly id: string;
  readonly nombre: string;
  readonly color: string;
  readonly colorAcento: string | null;
  readonly textoSobreColor: string;
  readonly textoSobreAcento: string | null;
}

export interface ImagenProducto {
  readonly id: string;
  /** Ruta pública `/api/v1/imagenes/<uuid>.<ext>` (D-46). */
  readonly url: string;
  readonly orden: number;
  /** `true` solo en la de `orden` 0. */
  readonly principal: boolean;
}

export interface Producto {
  readonly id: string;
  readonly nombre: string;
  readonly marca: MarcaDeProducto;
  /** Texto decimal `"12.50"`; nunca número de punto flotante. */
  readonly precio: string;
  readonly descripcion: string;
  readonly disponibilidad: Disponibilidad;
  /** Ordenadas; la primera es la principal. */
  readonly imagenes: readonly ImagenProducto[];
  readonly creadoEn: string;
  readonly actualizadoEn: string;
}

/** Cuerpo de `POST /productos`. */
export interface NuevoProducto {
  readonly nombre: string;
  readonly marcaId: string;
  readonly precio: string;
  readonly descripcion?: string;
  readonly disponibilidad?: Disponibilidad;
}

/** Cuerpo parcial de `PATCH /productos/{id}`. */
export interface CambiosProducto {
  readonly nombre?: string;
  readonly marcaId?: string;
  readonly precio?: string;
  readonly descripcion?: string;
  readonly disponibilidad?: Disponibilidad;
}

export interface ConsultaProductos {
  /** Página (desde 1). */
  readonly pagina: number;
  readonly tamanio: number;
  readonly marcaId?: string;
  readonly busqueda?: string;
  readonly disponibilidad?: Disponibilidad;
}

export interface PaginaProductos {
  readonly elementos: readonly Producto[];
  readonly pagina: number;
  readonly tamanio: number;
  readonly total: number;
}

export const TAMANIO_PAGINA_PREDETERMINADO = 20;
export const TAMANIOS_PAGINA: readonly number[] = [10, 20, 50];

// ── Disponibilidad (RN-09, D-47) ────────────────────────────────────────────────────────

export const DISPONIBILIDADES: readonly Disponibilidad[] = [
  'DISPONIBLE',
  'AGOTADO',
  'PENDIENTE_REPOSICION',
];

const ETIQUETAS_DISPONIBILIDAD: Readonly<Record<Disponibilidad, string>> = {
  DISPONIBLE: 'Disponible',
  AGOTADO: 'Agotado',
  PENDIENTE_REPOSICION: 'Pendiente de reposición',
};

export function etiquetaDisponibilidad(valor: Disponibilidad): string {
  return ETIQUETAS_DISPONIBILIDAD[valor];
}

export function esDisponibilidad(valor: unknown): valor is Disponibilidad {
  return typeof valor === 'string' && (DISPONIBILIDADES as readonly string[]).includes(valor);
}

// ── Nombre, descripción y precio (RNF-03) ───────────────────────────────────────────────

export const LONGITUD_MINIMA_NOMBRE = 2;
export const LONGITUD_MAXIMA_NOMBRE = 120;
export const LONGITUD_MAXIMA_DESCRIPCION = 2000;
export const BUSQUEDA_MAXIMA = 100;

/** `null` si el nombre es válido; si no, el mensaje para el Vendedor. */
export function validarNombre(nombre: string): string | null {
  const largo = nombre.trim().length;
  if (largo < LONGITUD_MINIMA_NOMBRE) {
    return `El nombre debe tener al menos ${LONGITUD_MINIMA_NOMBRE} caracteres.`;
  }
  if (largo > LONGITUD_MAXIMA_NOMBRE) {
    return `El nombre admite hasta ${LONGITUD_MAXIMA_NOMBRE} caracteres.`;
  }
  return null;
}

export function validarDescripcion(descripcion: string): string | null {
  return descripcion.length > LONGITUD_MAXIMA_DESCRIPCION
    ? `La descripción admite hasta ${LONGITUD_MAXIMA_DESCRIPCION} caracteres.`
    : null;
}

/** Forma que exige el servidor: hasta 5 enteros y hasta 2 decimales. */
const PATRON_PRECIO = /^\d{1,5}(\.\d{1,2})?$/;
export const PRECIO_MAXIMO = '99999.99';
export const PRECIO_MINIMO = '0.01';

/**
 * Deja el precio listo para validar: sin espacios y con punto decimal (en Ecuador se suele
 * escribir `12,50`). Solo manipula texto; nunca convierte a número.
 */
export function normalizarPrecio(texto: string): string {
  return texto.trim().replace(',', '.');
}

/** `null` si el precio es válido (de 0.01 a 99999.99, máximo 2 decimales); si no, el mensaje. */
export function validarPrecio(texto: string): string | null {
  const precio = normalizarPrecio(texto);
  if (precio === '') {
    return 'Escribe el precio.';
  }
  if (!PATRON_PRECIO.test(precio)) {
    return 'El precio debe ser un monto con hasta 2 decimales, por ejemplo 12.50.';
  }
  return Dinero.desdeTexto(precio).esCero()
    ? `El precio debe ser mayor que cero (mínimo ${PRECIO_MINIMO}).`
    : null;
}

/** Texto decimal exacto con 2 decimales (`"12.5"` → `"12.50"`), para enviar a la API. */
export function precioParaApi(texto: string): string {
  return Dinero.desdeTexto(normalizarPrecio(texto)).aTexto();
}

/** Precio para mostrar: `"12.5"` → `$12.50`. Texto exacto; no se usa `Number`. */
export function formatearPrecio(texto: string): string {
  return `$${Dinero.desdeTexto(texto).aTexto()}`;
}

// ── Imágenes (D-46) ─────────────────────────────────────────────────────────────────────

export const MAX_IMAGENES = 5;
export const MAX_BYTES_IMAGEN = 2 * 1024 * 1024;
export const TIPOS_IMAGEN: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

const EXTENSIONES_IMAGEN: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Datos mínimos de un archivo (compatible con `File`) para validarlo sin depender del DOM. */
export interface DatosArchivo {
  readonly name: string;
  readonly size: number;
  readonly type: string;
}

/**
 * `null` si el archivo es una imagen admitida (JPG, PNG o WebP, hasta 2 MB); si no, el mensaje.
 * Es solo una comodidad: el servidor vuelve a validar los primeros bytes (415, 413).
 */
export function validarArchivoImagen(archivo: DatosArchivo): string | null {
  const extension = archivo.name.split('.').pop()?.toLowerCase() ?? '';
  const tipo = archivo.type !== '' ? archivo.type : (EXTENSIONES_IMAGEN[extension] ?? '');
  if (!TIPOS_IMAGEN.includes(tipo)) {
    return `«${archivo.name}» no es una imagen admitida. Usa JPG, PNG o WebP.`;
  }
  if (archivo.size > MAX_BYTES_IMAGEN) {
    return `«${archivo.name}» pesa más de 2 MB.`;
  }
  if (archivo.size === 0) {
    return `«${archivo.name}» está vacío.`;
  }
  return null;
}

/** Peso legible: `1.5 MB`, `320 KB`. */
export function formatearTamano(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Mueve un elemento una posición (`-1` arriba, `1` abajo). Devuelve la lista nueva; si no hay
 * movimiento posible, la misma lista.
 */
export function moverElemento<T>(lista: readonly T[], indice: number, direccion: -1 | 1): readonly T[] {
  const destino = indice + direccion;
  if (indice < 0 || indice >= lista.length || destino < 0 || destino >= lista.length) {
    return lista;
  }
  const copia = [...lista];
  const [movido] = copia.splice(indice, 1);
  if (movido === undefined) {
    return lista;
  }
  copia.splice(destino, 0, movido);
  return copia;
}

/** Lleva un elemento al primer lugar (la primera imagen es la principal). */
export function hacerPrimero<T>(lista: readonly T[], indice: number): readonly T[] {
  if (indice <= 0 || indice >= lista.length) {
    return lista;
  }
  const copia = [...lista];
  const [elegido] = copia.splice(indice, 1);
  return elegido === undefined ? lista : [elegido, ...copia];
}

/** Dos listas de ids son iguales en contenido y orden. */
export function mismoOrden(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, posicion) => id === b[posicion]);
}

/** Imágenes ordenadas por `orden` (la API ya las entrega así). */
export function imagenesOrdenadas(imagenes: readonly ImagenProducto[]): ImagenProducto[] {
  return [...imagenes].sort((a, b) => a.orden - b.orden);
}

/** Imagen principal: la de `principal: true` o, si falta, la primera. */
export function imagenPrincipal(producto: Pick<Producto, 'imagenes'>): ImagenProducto | null {
  return producto.imagenes.find((i) => i.principal) ?? imagenesOrdenadas(producto.imagenes)[0] ?? null;
}
