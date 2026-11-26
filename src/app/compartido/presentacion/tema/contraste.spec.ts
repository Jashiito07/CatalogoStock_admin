import { CONTRASTE_MINIMO, razonDeContraste } from '../../dominio/contraste';
import {
  COLORES_CORPORATIVOS as C,
  COLORES_OSCURO as O,
  TemaCatalogoStock,
} from './tema-catalogostock';

/** Escalas de PrimeNG (Tailwind) usadas por los estados; solo los tonos que se miden. */
const ESCALAS: Record<string, Record<number, string>> = {
  blue: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  yellow: {
    50: '#fefce8',
    100: '#fef9c3',
    200: '#fef08a',
    300: '#fde047',
    500: '#eab308',
    600: '#ca8a04',
    700: '#a16207',
    800: '#854d0e',
    900: '#713f12',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
};

type Rgb = [number, number, number];
const aRgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const aHex = (rgb: Rgb) =>
  '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** Color `frente` con opacidad `alfa` sobre `fondo` (equivale a `color-mix(..., transparent)`). */
const sobre = (frente: string, fondo: string, alfa: number) =>
  aHex(aRgb(frente).map((v, i) => v * alfa + aRgb(fondo)[i]! * (1 - alfa)) as Rgb);

/** Lee un token `light-dark({color.tono}, {color.tono})` del preset. */
function tonosDe(ruta: string, campo: 'color' | 'background') {
  const nodo = ruta
    .split('.')
    .reduce<unknown>((n, k) => (n as Record<string, unknown> | undefined)?.[k], TemaCatalogoStock);
  const valor = String((nodo as Record<string, string>)[campo]);
  const [, color, claro, oscuro] = /\{(\w+)\.(\d+)\}.*\{\w+\.(\d+)\}/.exec(valor) ?? [];
  const tono = (t: string | undefined) => ESCALAS[color!]![Number(t)]!;
  return { color: color!, claro: tono(claro), oscuro: tono(oscuro) };
}

/** RNF-11: texto de estado de `message` y `toast` sobre su fondo tintado de Aura. */
describe('Contraste del texto de estado de PrimeNG (RNF-11)', () => {
  const estados = ['info', 'success', 'warn', 'error'];
  for (const componente of ['message', 'toast']) {
    for (const severidad of estados) {
      const ruta = `components.${componente}.${severidad}`;
      it(`${componente}.${severidad}: ≥ 4.5 en claro (sobre blanco y fondo) y en oscuro (superficie y fondo)`, () => {
        const { color, claro, oscuro } = tonosDe(ruta, 'color');
        const e = ESCALAS[color]!;
        for (const base of ['#FFFFFF', C.fondo]) {
          // Aura: fondo = tono 50 al 95 % sobre la superficie.
          expect(razonDeContraste(claro, sobre(e[50]!, base, 0.95))).toBeGreaterThanOrEqual(
            CONTRASTE_MINIMO,
          );
        }
        for (const base of [O.superficie, O.fondo]) {
          // Aura: fondo = tono 500 al 16 % sobre la superficie.
          expect(razonDeContraste(oscuro, sobre(e[500]!, base, 0.16))).toBeGreaterThanOrEqual(
            CONTRASTE_MINIMO,
          );
        }
      });
    }
  }

  it('el tono 600 de Aura NO cumple en verde, amarillo ni rojo (por eso el tema usa 700/800)', () => {
    for (const color of ['green', 'yellow', 'red']) {
      const e = ESCALAS[color]!;
      const razon = razonDeContraste(e[600]!, sobre(e[50]!, C.fondo, 0.95));
      expect(razon).toBeLessThan(CONTRASTE_MINIMO);
    }
  });

  /** Lee `light-dark(#claro, #oscuro)` de un token del preset. */
  function paresHex(ruta: string, campo: 'color' | 'background'): [string, string] {
    const nodo = ruta
      .split('.')
      .reduce<unknown>(
        (n, k) => (n as Record<string, unknown> | undefined)?.[k],
        TemaCatalogoStock,
      );
    const valor = String((nodo as Record<string, string>)[campo]);
    const [, claro, oscuro] = /light-dark\((#\w{6}), (#\w{6})\)/.exec(valor) ?? [];
    return [claro!, oscuro!];
  }

  for (const severidad of ['success', 'danger', 'warn', 'info']) {
    it(`tag.${severidad}: texto ≥ 4.5 sobre su fondo en claro y en oscuro (pares de la maqueta)`, () => {
      const [textoClaro, textoOscuro] = paresHex(`components.tag.${severidad}`, 'color');
      const [fondoClaro, fondoOscuro] = paresHex(`components.tag.${severidad}`, 'background');
      expect(razonDeContraste(textoClaro, fondoClaro)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
      expect(razonDeContraste(textoOscuro, fondoOscuro)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    });
  }
});

/** RNF-11: contraste mínimo de 4.5:1 en texto normal, en modo claro y en modo oscuro. */
describe('Contraste de la paleta (RNF-11)', () => {
  it('calcula la razón de referencia (blanco/negro = 21)', () => {
    expect(razonDeContraste('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
  });

  describe('modo claro', () => {
    const pares: [string, string, string][] = [
      ['texto sobre fondo', C.texto, C.fondo],
      ['blanco sobre Primario', C.sobreColor, C.primario],
      ['blanco sobre Secundario', C.sobreColor, C.secundario],
      ['Primario como texto sobre fondo', C.primario, C.fondo],
      ['Secundario como texto sobre fondo', C.secundario, C.fondo],
      ['texto sobre el Acento', C.texto, C.acento],
    ];
    for (const [nombre, texto, fondo] of pares) {
      it(`${nombre} ≥ 4.5`, () => {
        expect(razonDeContraste(texto, fondo)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
      });
    }

    it('el blanco sobre el Acento NO cumple (por eso el texto del Acento es #1E293B)', () => {
      expect(razonDeContraste(C.sobreColor, C.acento)).toBeLessThan(CONTRASTE_MINIMO);
    });
  });

  describe('modo oscuro', () => {
    const pares: [string, string, string][] = [
      ['texto sobre fondo', O.texto, O.fondo],
      ['texto sobre superficie', O.texto, O.superficie],
      ['texto secundario sobre fondo', O.textoSecundario, O.fondo],
      ['texto secundario sobre superficie', O.textoSecundario, O.superficie],
      ['blanco sobre Primario (botón principal)', C.sobreColor, C.primario],
      ['blanco sobre Secundario', C.sobreColor, C.secundario],
      ['Primario claro como texto sobre superficie', O.primarioTexto, O.superficie],
      ['Primario claro como texto sobre fondo', O.primarioTexto, O.fondo],
      ['Primario claro como texto sobre superficie secundaria', O.primarioTexto, O.superficie2],
      ['violeta claro sobre superficie (texto del Secundario)', O.violetaClaro, O.superficie],
      ['violeta claro sobre fondo', O.violetaClaro, O.fondo],
      ['texto sobre superficie secundaria', O.texto, O.superficie2],
      ['#1E293B sobre el Acento', C.texto, C.acento],
      ['error sobre superficie', O.error, O.superficie],
      ['éxito sobre superficie', O.exito, O.superficie],
    ];
    for (const [nombre, texto, fondo] of pares) {
      it(`${nombre} ≥ 4.5`, () => {
        expect(razonDeContraste(texto, fondo)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
      });
    }

    it('el borde se distingue de la superficie (≠ colores iguales)', () => {
      expect(O.borde).not.toBe(O.superficie);
    });
  });
});
