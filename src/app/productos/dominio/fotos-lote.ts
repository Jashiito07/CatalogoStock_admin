import { DatosArchivo, MAX_IMAGENES, validarArchivoImagen } from './producto';

/**
 * Subida de fotos en lote (RF-PRO-01, D-46, D-62; DEC-07): las fotos se emparejan con los
 * productos por el **código** que llevan en el nombre del archivo (`12345.jpg`, `12345-2.jpg`,
 * `12345_b.jpg`, `12345 (2).jpg`). El Vendedor revisa y corrige antes de guardar. Esta capa no
 * depende de Angular ni del navegador.
 */

/** Avisos de una foto del lote. Los que impiden subirla se marcan con `bloquea`. */
export type AvisoFoto =
  | 'ARCHIVO_NO_VALIDO'
  | 'DUPLICADA'
  | 'SIN_CODIGO'
  | 'CODIGO_DESCONOCIDO'
  | 'CODIGO_AMBIGUO'
  | 'SIN_CUPO';

/** Lo mínimo de un producto para emparejar sus fotos. */
export interface ProductoParaFotos {
  readonly id: string;
  readonly nombre: string;
  readonly codigo: string | null;
  /** Fotos que ya tiene en el servidor (máximo 5 en total, D-46). */
  readonly fotosActuales: number;
}

/** Una foto elegida, ya emparejada (o no) con un producto. */
export interface FotoLote {
  /** Clave estable de la fila (posición en la que se eligió). */
  readonly clave: number;
  readonly nombre: string;
  readonly tamano: number;
  /** Código leído del nombre, en mayúsculas; `null` si el nombre no lo trae. */
  readonly codigo: string | null;
  /** Producto elegido (por código o a mano); `null` si falta elegirlo. */
  readonly productoId: string | null;
  /** `true` si el Vendedor la quitó del lote. */
  readonly excluida: boolean;
  /** Mensaje si el archivo no es una imagen admitida (tipo o peso). */
  readonly errorArchivo: string | null;
  /** Otra foto del lote con el mismo nombre y peso: probablemente elegida dos veces. */
  readonly duplicada: boolean;
  /** Avisos del emparejamiento por código (antes de que el Vendedor corrija). */
  readonly avisoCodigo: 'SIN_CODIGO' | 'CODIGO_DESCONOCIDO' | 'CODIGO_AMBIGUO' | null;
}

/** Foto con los avisos que tiene **ahora** (el cupo depende de las demás filas). */
export interface FotoRevisada extends FotoLote {
  readonly avisos: readonly AvisoFoto[];
  /** Se subirá al confirmar. */
  readonly lista: boolean;
}

const PATRON_CODIGO = /^([A-Za-z0-9]{1,20})(?:[\s_\-(.].*)?$/;

/** Código en la forma en que se compara: sin espacios y en mayúsculas. */
export function normalizarCodigo(codigo: string): string {
  return codigo.trim().toUpperCase();
}

/**
 * Código que trae el nombre del archivo: lo que hay antes del primer `-`, `_`, espacio o `(`
 * (sin la extensión). `12345-2.jpg` → `12345`; `ab12_frente.png` → `AB12`; `foto.jpg` → `FOTO`
 * (luego no coincidirá con ningún producto). `null` si el nombre no empieza por letras o números.
 */
export function codigoDeNombre(nombreArchivo: string): string | null {
  const coincidencia = PATRON_CODIGO.exec(nombreSinExtension(nombreArchivo));
  return coincidencia?.[1] ? normalizarCodigo(coincidencia[1]) : null;
}

/** Nombre del archivo sin carpetas ni extensión. */
function nombreSinExtension(nombreArchivo: string): string {
  const sinRuta = nombreArchivo.split(/[\\/]/).pop() ?? '';
  const punto = sinRuta.lastIndexOf('.');
  return (punto > 0 ? sinRuta.slice(0, punto) : sinRuta).trim();
}

const comparadorNatural = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

/**
 * Orden del lote: por código; dentro de un código, primero la foto sin sufijo (`12345.jpg`,
 * que será la principal) y luego las demás en orden natural (`-2` antes que `-10`).
 */
function compararArchivos(a: DatosArchivo, b: DatosArchivo): number {
  const codigoA = codigoDeNombre(a.name) ?? '';
  const codigoB = codigoDeNombre(b.name) ?? '';
  const porCodigo = comparadorNatural.compare(codigoA, codigoB);
  if (porCodigo !== 0) {
    return porCodigo;
  }
  const sufijoA = nombreSinExtension(a.name).toUpperCase() === codigoA ? 0 : 1;
  const sufijoB = nombreSinExtension(b.name).toUpperCase() === codigoB ? 0 : 1;
  return sufijoA - sufijoB || comparadorNatural.compare(a.name, b.name);
}

/**
 * Empareja las fotos elegidas con los productos por código. Se ordenan por código y, dentro de
 * cada uno, la foto sin sufijo primero (`12345.jpg` antes que `12345-2.jpg`), así la primera de
 * cada producto será su principal si aún no tiene fotos.
 */
export function emparejarFotos(
  archivos: readonly DatosArchivo[],
  productos: readonly ProductoParaFotos[],
): FotoLote[] {
  const porCodigo = new Map<string, ProductoParaFotos[]>();
  for (const producto of productos) {
    if (producto.codigo) {
      const clave = normalizarCodigo(producto.codigo);
      porCodigo.set(clave, [...(porCodigo.get(clave) ?? []), producto]);
    }
  }
  const ordenados = archivos
    .map((archivo, posicion) => ({ archivo, posicion }))
    .sort((a, b) => compararArchivos(a.archivo, b.archivo));
  const vistos = new Set<string>();
  return ordenados.map(({ archivo, posicion }) => {
    const firma = `${archivo.name.toLowerCase()}|${archivo.size}`;
    const duplicada = vistos.has(firma);
    vistos.add(firma);
    const codigo = codigoDeNombre(archivo.name);
    const candidatos = codigo === null ? [] : (porCodigo.get(codigo) ?? []);
    const avisoCodigo =
      codigo === null
        ? 'SIN_CODIGO'
        : candidatos.length === 0
          ? 'CODIGO_DESCONOCIDO'
          : candidatos.length > 1
            ? 'CODIGO_AMBIGUO'
            : null;
    return {
      clave: posicion,
      nombre: archivo.name,
      tamano: archivo.size,
      codigo,
      productoId: candidatos.length === 1 ? (candidatos[0]?.id ?? null) : null,
      excluida: false,
      errorArchivo: validarArchivoImagen(archivo),
      duplicada,
      avisoCodigo,
    };
  });
}

/**
 * Avisos actuales de cada foto y si está lista para subir. El cupo (5 por producto) cuenta las
 * fotos que el producto ya tiene más las del lote asignadas a él, en orden: las que pasan de 5
 * quedan con `SIN_CUPO`.
 */
export function revisarLote(
  fotos: readonly FotoLote[],
  productos: readonly ProductoParaFotos[],
): FotoRevisada[] {
  const actuales = new Map(productos.map((p) => [p.id, p.fotosActuales]));
  const usadas = new Map<string, number>();
  return fotos.map((foto) => {
    const avisos: AvisoFoto[] = [];
    if (foto.errorArchivo !== null) {
      avisos.push('ARCHIVO_NO_VALIDO');
    }
    if (foto.duplicada) {
      avisos.push('DUPLICADA');
    }
    if (foto.avisoCodigo !== null && foto.productoId === null) {
      avisos.push(foto.avisoCodigo);
    }
    const valida = foto.errorArchivo === null && !foto.duplicada && !foto.excluida;
    if (valida && foto.productoId !== null) {
      const ocupadas = (actuales.get(foto.productoId) ?? 0) + (usadas.get(foto.productoId) ?? 0);
      if (ocupadas >= MAX_IMAGENES) {
        avisos.push('SIN_CUPO');
      } else {
        usadas.set(foto.productoId, (usadas.get(foto.productoId) ?? 0) + 1);
      }
    }
    const lista = valida && foto.productoId !== null && !avisos.includes('SIN_CUPO');
    return { ...foto, avisos, lista };
  });
}

const TEXTOS_AVISO: Readonly<Record<AvisoFoto, string>> = {
  ARCHIVO_NO_VALIDO: 'No es una imagen admitida',
  DUPLICADA: 'Repetida en el lote',
  SIN_CODIGO: 'El nombre no trae código: elige el producto',
  CODIGO_DESCONOCIDO: 'Ningún producto tiene ese código: elige el producto',
  CODIGO_AMBIGUO: 'Varios productos tienen ese código: elige el producto',
  SIN_CUPO: 'El producto ya llega a 5 fotos',
};

export function textoAviso(aviso: AvisoFoto): string {
  return TEXTOS_AVISO[aviso];
}

/** Cuántas fotos se subirán, cuántas tienen avisos y cuántas quitó el Vendedor. */
export function resumenLote(fotos: readonly FotoRevisada[]): {
  readonly listas: number;
  readonly conAviso: number;
  readonly excluidas: number;
  readonly productos: number;
} {
  const listas = fotos.filter((f) => f.lista);
  return {
    listas: listas.length,
    conAviso: fotos.filter((f) => !f.lista && !f.excluida).length,
    excluidas: fotos.filter((f) => f.excluida).length,
    productos: new Set(listas.map((f) => f.productoId)).size,
  };
}

/** DEC-07: el panel sube como máximo 30 fotos por minuto (límite del servidor). */
export const SUBIDAS_POR_MINUTO = 30;
export const PAUSA_ENTRE_SUBIDAS_MS = Math.ceil(60_000 / SUBIDAS_POR_MINUTO);

/** Minutos aproximados que tardará subir `cantidad` fotos (al menos 1). */
export function minutosEstimados(cantidad: number): number {
  return Math.max(1, Math.ceil(cantidad / SUBIDAS_POR_MINUTO));
}
