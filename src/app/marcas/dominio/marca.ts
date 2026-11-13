import { CONTRASTE_MINIMO, razonDeContraste } from '../../compartido/dominio/contraste';

/**
 * Marcas del catálogo (RF-PRO-04, RF-PRO-06, D-43, D-48). Contrato: docs/contrato-api/productos.md.
 * Esta capa no depende de Angular ni de PrimeNG.
 */

export interface Marca {
  readonly id: string;
  readonly nombre: string;
  /** Color principal, `#RRGGBB` en mayúsculas. */
  readonly color: string;
  /** Color de acento opcional (D-43). */
  readonly colorAcento: string | null;
  /** Solo lectura: texto con contraste ≥ 4.5:1 sobre `color`, calculado por el servidor. */
  readonly textoSobreColor: string;
  readonly textoSobreAcento: string | null;
  readonly activa: boolean;
  readonly orden: number;
  readonly creadaEn: string;
}

/** Marca que ofrece «Configura tu negocio» (D-48). */
export interface MarcaSugerida {
  readonly nombre: string;
  readonly color: string;
  readonly colorAcento: string | null;
  readonly yaCreada: boolean;
}

/** Cuerpo de `POST /marcas`. `orden` se omite: el servidor la deja al final. */
export interface NuevaMarca {
  readonly nombre: string;
  readonly color: string;
  readonly colorAcento: string | null;
}

/** Cuerpo parcial de `PATCH /marcas/{id}`; `colorAcento: null` quita el acento. */
export interface CambiosMarca {
  readonly nombre?: string;
  readonly color?: string;
  readonly colorAcento?: string | null;
  readonly activa?: boolean;
  readonly orden?: number;
}

/** Sin color elegido, la marca usa el Primario corporativo (docs/diseno/colores-marcas.md). */
export const COLOR_MARCA_PREDETERMINADO = '#2563EB';

export const LONGITUD_MINIMA_NOMBRE = 2;
export const LONGITUD_MAXIMA_NOMBRE = 40;

/** Textos candidatos, en el mismo orden que usa el servidor para `textoSobreColor` (RNF-11). */
export const TEXTOS_CANDIDATOS: readonly string[] = ['#FFFFFF', '#1E293B', '#0F172A', '#000000'];

const COLOR_HEX = /^#[0-9A-Fa-f]{6}$/;

/** `#RRGGBB` (el contrato guarda en mayúsculas pero acepta minúsculas). */
export function esColorValido(valor: string): boolean {
  return COLOR_HEX.test(valor);
}

/**
 * Deja el color como `#RRGGBB` en mayúsculas. Acepta que falte el `#`. Si no es un color
 * completo devuelve el texto sin cambios (para que la validación lo rechace).
 */
export function normalizarColor(valor: string): string {
  const limpio = valor.trim();
  const conAlmohadilla = limpio.startsWith('#') ? limpio : `#${limpio}`;
  return esColorValido(conAlmohadilla) ? conAlmohadilla.toUpperCase() : limpio;
}

export interface ContrasteMarca {
  /** Color de texto elegido: el primero de los candidatos que llega a 4.5:1. */
  readonly texto: string;
  readonly razon: number;
  readonly cumple: boolean;
}

/**
 * Calcula el texto y el contraste igual que el servidor: el primero de blanco, `#1E293B`,
 * `#0F172A` y negro que llegue a 4.5:1. Solo para la vista previa; el valor oficial de una
 * marca guardada es el que devuelve la API.
 */
export function calcularContraste(color: string): ContrasteMarca {
  let mejor: ContrasteMarca | null = null;
  for (const texto of TEXTOS_CANDIDATOS) {
    const razon = razonDeContraste(color, texto);
    if (razon >= CONTRASTE_MINIMO) {
      return { texto, razon, cumple: true };
    }
    if (mejor === null || razon > mejor.razon) {
      mejor = { texto, razon, cumple: false };
    }
  }
  return mejor ?? { texto: '#000000', razon: 0, cumple: false };
}

/** Razón con un decimal, como en docs/diseno/colores-marcas.md. El ✔ usa el valor exacto. */
export function formatearRazon(razon: number): string {
  return `${razon.toFixed(1)}:1`;
}

/** Mensaje del contraste para la interfaz: «Contraste 4.9:1 ✔». */
export function textoContraste(contraste: ContrasteMarca): string {
  return `Contraste ${formatearRazon(contraste.razon)} ${contraste.cumple ? '✔' : '✘'}`;
}

/** Nombre sin espacios sobrantes, minúsculas ni tildes: así lo compara el servidor. */
export function claveDeNombre(nombre: string): string {
  return nombre
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function nombreRepetido(nombre: string, existentes: readonly string[]): boolean {
  const clave = claveDeNombre(nombre);
  return existentes.some((otro) => claveDeNombre(otro) === clave);
}

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

/** Mismo orden que la API: por `orden` y luego por nombre. */
export function ordenarMarcas(marcas: readonly Marca[]): Marca[] {
  return [...marcas].sort(
    (a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  );
}

export interface CambioDeOrden {
  readonly id: string;
  readonly orden: number;
}

/**
 * Mueve una marca una posición (`-1` arriba, `1` abajo) y devuelve solo las marcas cuyo
 * `orden` debe cambiar al numerar la lista 0, 1, 2… Lista vacía si no hay movimiento.
 */
export function cambiosAlMover(
  ordenadas: readonly Marca[],
  id: string,
  direccion: -1 | 1,
): CambioDeOrden[] {
  const desde = ordenadas.findIndex((marca) => marca.id === id);
  const hacia = desde + direccion;
  if (desde < 0 || hacia < 0 || hacia >= ordenadas.length) {
    return [];
  }
  const resultado = [...ordenadas];
  const [movida] = resultado.splice(desde, 1);
  if (movida === undefined) {
    return [];
  }
  resultado.splice(hacia, 0, movida);
  return resultado.flatMap((marca, posicion) =>
    marca.orden === posicion ? [] : [{ id: marca.id, orden: posicion }],
  );
}
