import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { CONTRASTE_MINIMO, razonDeContraste } from '../src/app/compartido/dominio/contraste.ts';

/**
 * RNF-11 (rediseño, etapa 1): mide el contraste sobre los tokens REALES de `colores.css`
 * (no sobre copias), con las parejas de la maqueta combinada
 * (docs/diseno/ideas-interfaz/combinada/contraste.md). Texto ≥ 4.5:1; no textual ≥ 3:1.
 */
const RAIZ = join(import.meta.dirname, '..', 'src');
const CSS_TEMA = join(RAIZ, 'app', 'compartido', 'presentacion', 'tema');
const colores = readFileSync(join(CSS_TEMA, 'colores.css'), 'utf8');

/** Variables `--nombre: valor;` de un bloque de reglas. */
function variablesDe(bloque) {
  const mapa = {};
  for (const [, nombre, valor] of bloque.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    mapa[nombre] = valor.replace(/\/\*.*?\*\//g, '').trim();
  }
  return mapa;
}

const bloque = (selector) => {
  const inicio = colores.indexOf(selector);
  expect(inicio, `no existe «${selector}» en colores.css`).toBeGreaterThanOrEqual(0);
  return colores.slice(colores.indexOf('{', inicio) + 1, colores.indexOf('\n}', inicio));
};

const CLARO = variablesDe(bloque(':root {'));
const OSCURO = { ...CLARO, ...variablesDe(bloque(':root.app-oscuro {')) };

/** Resuelve `var(--otro)` hasta llegar a un `#RRGGBB`. */
function color(tema, nombre) {
  let valor = tema[nombre];
  for (let i = 0; i < 5 && valor?.startsWith('var('); i += 1) {
    valor = tema[valor.slice(4, -1).split(',')[0].trim()];
  }
  expect(valor, `${nombre} debe ser #RRGGBB`).toMatch(/^#[0-9a-f]{6}$/i);
  return valor;
}

const TEMAS = { claro: CLARO, oscuro: OSCURO };

/** [texto, fondo, descripción] de la maqueta (contraste.md). */
const TEXTO = [
  ['--cs-texto', '--cs-fondo', 'texto sobre fondo'],
  ['--cs-texto', '--cs-sup', 'texto sobre tarjeta'],
  ['--cs-texto', '--cs-sup2', 'texto sobre superficie secundaria'],
  ['--cs-texto2', '--cs-fondo', 'texto secundario sobre fondo'],
  ['--cs-texto2', '--cs-sup', 'texto secundario sobre tarjeta'],
  ['--cs-texto2', '--cs-sup2', 'texto secundario sobre superficie secundaria'],
  ['--cs-pri-t', '--cs-fondo', 'enlace primario sobre fondo'],
  ['--cs-pri-t', '--cs-sup', 'enlace primario sobre tarjeta'],
  ['--cs-pri-t', '--cs-sup2', 'enlace primario sobre superficie secundaria'],
  ['--cs-sec-t', '--cs-sup', 'secundario como texto sobre tarjeta'],
  ['--cs-sec-t', '--cs-fondo', 'secundario como texto sobre fondo'],
  ['--cs-sobre-pri', '--cs-pri', 'blanco sobre botón primario'],
  ['--cs-sobre-sec', '--cs-sec', 'blanco sobre secundario'],
  ['--cs-sobre-acento', '--cs-acento', '#1E293B sobre acento'],
  ['--cs-sobre-primario', '--cs-primario', 'alias: texto sobre --cs-primario'],
  ['--cs-kick', '--cs-fondo', 'etiqueta de sección sobre fondo'],
  ['--cs-kick', '--cs-sup', 'etiqueta de sección sobre tarjeta'],
  ['--cs-lat-t', '--cs-lat', 'menú lateral: texto sobre barra'],
  ['--cs-lat-on-t', '--cs-lat-on', 'menú lateral: elemento activo'],
  ['--cs-ok', '--cs-ok-bg', 'etiqueta Disponible'],
  ['--cs-warn', '--cs-warn-bg', 'etiqueta Pendiente / advertencia'],
  ['--cs-mal', '--cs-mal-bg', 'etiqueta Agotado / error'],
  ['--cs-info', '--cs-info-bg', 'etiqueta informativa'],
  ['--cs-marca-yanbal-t', '--cs-marca-yanbal', 'texto sobre Yanbal'],
  ['--cs-marca-avon-t', '--cs-marca-avon', 'texto sobre Avon'],
  ['--cs-marca-lbel-t', '--cs-marca-lbel', 'texto sobre L’Bel'],
  ['--cs-marca-cyzone-t', '--cs-marca-cyzone', 'texto sobre Cyzone'],
  ['--cs-marca-esika-t', '--cs-marca-esika', 'texto sobre Esika'],
  ['--cs-marca-leonisa-t', '--cs-marca-leonisa', 'texto sobre Leonisa'],
  ['--cs-marca-leonisa-acento-t', '--cs-marca-leonisa-acento', 'texto sobre naranja de Leonisa'],
];

/** Elementos no textuales (bordes de controles, gráficos): ≥ 3:1. */
const NO_TEXTUAL = [
  ['--cs-ctl', '--cs-sup', 'borde de controles sobre tarjeta'],
  ['--cs-ctl', '--cs-fondo', 'borde de controles sobre fondo'],
  ...['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].map((g) => [`--cs-${g}`, '--cs-sup', `gráfico ${g}`]),
];

describe('Contraste de los tokens reales de colores.css (RNF-11)', () => {
  for (const [tema, variables] of Object.entries(TEMAS)) {
    describe(`tema ${tema}`, () => {
      for (const [texto, fondo, descripcion] of TEXTO) {
        it(`${descripcion} ≥ 4.5:1 (${texto} sobre ${fondo})`, () => {
          const razon = razonDeContraste(color(variables, texto), color(variables, fondo));
          expect(razon).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
        });
      }
      for (const [elemento, fondo, descripcion] of NO_TEXTUAL) {
        it(`${descripcion} ≥ 3:1 (no textual)`, () => {
          const razon = razonDeContraste(color(variables, elemento), color(variables, fondo));
          expect(razon).toBeGreaterThanOrEqual(3);
        });
      }
    });
  }

  it('el blanco sobre el Acento NO cumple y el Acento como texto sobre el fondo tampoco (D-06)', () => {
    for (const variables of Object.values(TEMAS)) {
      const acento = color(variables, '--cs-acento');
      expect(razonDeContraste('#FFFFFF', acento)).toBeLessThan(CONTRASTE_MINIMO);
    }
    // Como texto sobre el fondo claro tampoco (2.68:1); en oscuro el naranja sí se lee, pero la
    // regla del proyecto es no usarlo como texto (ver la prueba de «Estilos sin colores sueltos»).
    expect(
      razonDeContraste(color(CLARO, '--cs-acento'), color(CLARO, '--cs-fondo')),
    ).toBeLessThan(CONTRASTE_MINIMO);
  });

  it('la paleta corporativa de D-06 se conserva en los tokens', () => {
    expect(color(CLARO, '--cs-pri').toLowerCase()).toBe('#2563eb');
    expect(color(CLARO, '--cs-sec').toLowerCase()).toBe('#7c3aed');
    expect(color(CLARO, '--cs-acento').toLowerCase()).toBe('#f97316');
    expect(color(CLARO, '--cs-fondo').toLowerCase()).toBe('#f8fafc');
    expect(color(CLARO, '--cs-texto').toLowerCase()).toBe('#1e293b');
  });
});

describe('Estilos sin colores sueltos (D-06)', () => {
  /** Hojas de estilo fuera de los dos lugares donde se definen los colores. */
  function archivos(directorio, salida = []) {
    for (const nombre of readdirSync(directorio)) {
      const ruta = join(directorio, nombre);
      if (statSync(ruta).isDirectory()) archivos(ruta, salida);
      else if (/\.(scss|css)$/.test(nombre) && nombre !== 'colores.css') salida.push(ruta);
    }
    return salida;
  }

  it('ningún componente ni hoja global escribe hexadecimales', () => {
    const conHex = archivos(RAIZ).filter((ruta) => {
      const sinComentarios = readFileSync(ruta, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      // Un color es `#` + 3 o 6 dígitos hexadecimales precedido de espacio, `:` o `(`.
      return /[\s:(]#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b(?![\w-])/.test(sinComentarios);
    });
    expect(conHex).toEqual([]);
  });

  it('el Acento no se usa como color de texto ni el texto sobre él es blanco', () => {
    for (const ruta of archivos(RAIZ)) {
      const contenido = readFileSync(ruta, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(contenido, ruta).not.toMatch(/(^|[\s;{])color\s*:\s*var\(--cs-acento\)/);
    }
  });

  it('las animaciones tienen su regla de «reducir movimiento» y no se usa backdrop-filter', () => {
    const utilidades = readFileSync(join(CSS_TEMA, 'utilidades.css'), 'utf8');
    const global = readFileSync(join(RAIZ, 'styles.scss'), 'utf8');
    expect(utilidades).toContain('prefers-reduced-motion: reduce');
    expect(global).toContain('prefers-reduced-motion: reduce');
    for (const ruta of archivos(RAIZ)) {
      expect(readFileSync(ruta, 'utf8'), ruta).not.toMatch(/backdrop-filter\s*:/);
    }
  });
});
