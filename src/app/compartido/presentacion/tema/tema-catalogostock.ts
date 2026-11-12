import { definePreset, palette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Tema corporativo de CatálogoStock para el panel del vendedor (D-06, D-41). Único lugar,
 * junto con `colores.css`, donde se escriben los colores en hexadecimal. Tiene la misma
 * forma que el tema de la app móvil (CatalogoStock_frontend) para mantener la coherencia.
 *
 * Modo claro:
 * | Rol        | Color     |
 * |------------|-----------|
 * | Primario   | #2563EB   |
 * | Secundario | #7C3AED   |
 * | Acento     | #F97316   |
 * | Fondo      | #F8FAFC   |
 * | Texto      | #1E293B   |
 *
 * Modo oscuro con violeta (D-41): fondo #0F172A, superficies #1E293B, bordes
 * #334155, texto #E2E8F0 y #CBD5E1; el Secundario #7C3AED pasa a ser el color de acción
 * (botones, chips activos) y su tono claro #C4B5FD sirve para precios y enlaces.
 *
 * PrimeNG (Aura) resuelve ambos modos con `light-dark()`: la clase de `darkModeSelector`
 * (`app-oscuro`) fija `color-scheme: dark` y cada token usa su valor oscuro.
 *
 * Contraste (RNF-11): sobre el Acento el texto va en el color Texto, nunca en blanco.
 * Las escalas (50…950) se generan con `palette()`; el tono 500 es el color corporativo
 * y de las demás salen los estados hover, focus y activo.
 */
export const COLORES_CORPORATIVOS = {
  primario: '#2563EB',
  secundario: '#7C3AED',
  acento: '#F97316',
  fondo: '#F8FAFC',
  texto: '#1E293B',
  sobreColor: '#FFFFFF',
} as const;

/** Paleta del modo oscuro con violeta (maqueta D). */
export const COLORES_OSCURO = {
  fondo: '#0F172A',
  superficie: '#1E293B',
  borde: '#334155',
  texto: '#E2E8F0',
  textoSecundario: '#CBD5E1',
  /** Tono claro del Secundario para precios y enlaces. */
  violetaClaro: '#C4B5FD',
  /** Estados legibles sobre oscuro: error (rojo 300) y éxito (verde 300) de PrimeNG. */
  error: '#FCA5A5',
  exito: '#86EFAC',
} as const;

const TONOS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Tono = (typeof TONOS)[number];
type Escala = Record<Tono, string>;

function escalaDe(color: string): Escala {
  const escala = palette(color);
  return Object.fromEntries(
    TONOS.map((tono) => {
      const valor = escala[tono];
      if (!valor) {
        throw new Error(`No se generó el tono ${tono} de ${color}`);
      }
      return [tono, valor];
    }),
  ) as Escala;
}

const primario = escalaDe(COLORES_CORPORATIVOS.primario);
const secundario = escalaDe(COLORES_CORPORATIVOS.secundario);
const acento = escalaDe(COLORES_CORPORATIVOS.acento);
const { texto, sobreColor } = COLORES_CORPORATIVOS;

/** Valor `claro` en modo claro y `oscuro` en modo oscuro (CSS `light-dark()`). */
const segunModo = (claro: string, oscuro: string) => `light-dark(${claro}, ${oscuro})`;

/** Primario azul en claro; violeta (Secundario) en oscuro, tono a tono. */
const escalaPrimaria = Object.fromEntries(
  TONOS.map((tono) => [tono, segunModo(primario[tono], secundario[tono])]),
) as Escala;

const superficies = Object.fromEntries(
  TONOS.map((tono) => [tono, `{slate.${tono}}`]),
) as Escala;

type Estado = 'blue' | 'green' | 'yellow' | 'red';

/**
 * Tono del texto de estado en modo claro. En el panel el 600 de Aura queda cerca o por debajo
 * de 4.5:1 sobre su fondo claro (rojo ≈ 4.4, verde ≈ 3.1, amarillo muy por debajo): se usa
 * el 700 y, en advertencia, el 800.
 */
const TONO_CLARO_ESTADO: Record<Estado, 700 | 800> = {
  blue: 700,
  green: 700,
  yellow: 800,
  red: 700,
};

/**
 * Texto de un estado (info, éxito, advertencia, error): tono 600 en claro y tono 300 en
 * oscuro. El tono 500 que trae Aura en oscuro no llega a 4.5:1 sobre el fondo (RNF-11).
 */
const textoEstado = (color: Estado) =>
  segunModo(`{${color}.${TONO_CLARO_ESTADO[color]}}`, `{${color}.300}`);

const ESTADOS: Record<'info' | 'success' | 'warn' | 'error', Estado> = {
  info: 'blue',
  success: 'green',
  warn: 'yellow',
  error: 'red',
};

/** Tokens de texto de `message` y `toast` para los cuatro estados. */
const mensajesLegibles = Object.fromEntries(
  Object.entries(ESTADOS).map(([severidad, color]) => [
    severidad,
    {
      color: textoEstado(color),
      outlined: { color: textoEstado(color) },
      simple: { color: textoEstado(color) },
    },
  ]),
);

const avisosLegibles = Object.fromEntries(
  Object.entries(ESTADOS).map(([severidad, color]) => [severidad, { color: textoEstado(color) }]),
);

export const TemaCatalogoStock = definePreset(Aura, {
  semantic: {
    // Superficies: escala slate en ambos modos (Aura usa zinc en oscuro).
    surface: { 0: '#ffffff', ...superficies },
    primary: {
      ...escalaPrimaria,
      color: segunModo('{primary.500}', '{primary.300}'),
      contrastColor: segunModo(sobreColor, COLORES_OSCURO.fondo),
      hoverColor: segunModo('{primary.600}', '{primary.200}'),
      activeColor: segunModo('{primary.700}', '{primary.100}'),
    },
    text: {
      color: segunModo(texto, COLORES_OSCURO.texto),
      mutedColor: segunModo('{surface.500}', COLORES_OSCURO.textoSecundario),
    },
    content: {
      background: segunModo('{surface.0}', COLORES_OSCURO.superficie),
      hoverBackground: segunModo('{surface.100}', '{surface.700}'),
      borderColor: segunModo('{surface.200}', COLORES_OSCURO.borde),
    },
    overlay: {
      select: {
        background: segunModo('{surface.0}', COLORES_OSCURO.superficie),
        borderColor: segunModo('{surface.200}', COLORES_OSCURO.borde),
      },
      popover: {
        background: segunModo('{surface.0}', COLORES_OSCURO.superficie),
        borderColor: segunModo('{surface.200}', COLORES_OSCURO.borde),
      },
      modal: {
        background: segunModo('{surface.0}', COLORES_OSCURO.superficie),
        borderColor: segunModo('{surface.200}', COLORES_OSCURO.borde),
      },
    },
    formField: {
      // Campos más oscuros que la tarjeta que los contiene.
      background: segunModo('{surface.0}', COLORES_OSCURO.fondo),
      filledBackground: segunModo('{surface.50}', COLORES_OSCURO.fondo),
      filledHoverBackground: segunModo('{surface.50}', COLORES_OSCURO.fondo),
      filledFocusBackground: segunModo('{surface.50}', COLORES_OSCURO.fondo),
    },
  },
  components: {
    button: {
      root: {
        // Principal: Primario en claro; Secundario (violeta) con texto blanco en oscuro.
        primary: {
          background: '{primary.500}',
          hoverBackground: '{primary.600}',
          activeBackground: '{primary.700}',
          borderColor: '{primary.500}',
          hoverBorderColor: '{primary.600}',
          activeBorderColor: '{primary.700}',
          color: sobreColor,
          hoverColor: sobreColor,
          activeColor: sobreColor,
        },
        // Secundario: violeta con texto blanco en claro; superficie elevada en oscuro.
        secondary: {
          background: segunModo(secundario[500], COLORES_OSCURO.borde),
          hoverBackground: segunModo(secundario[600], '{surface.600}'),
          activeBackground: segunModo(secundario[700], '{surface.500}'),
          borderColor: segunModo(secundario[500], COLORES_OSCURO.borde),
          hoverBorderColor: segunModo(secundario[600], '{surface.600}'),
          activeBorderColor: segunModo(secundario[700], '{surface.500}'),
          color: segunModo(sobreColor, COLORES_OSCURO.texto),
          hoverColor: segunModo(sobreColor, COLORES_OSCURO.texto),
          activeColor: segunModo(sobreColor, COLORES_OSCURO.texto),
          focusRing: { color: segunModo(secundario[500], secundario[300]), shadow: 'none' },
        },
        // El Acento lleva texto oscuro: el blanco sobre naranja no cumple 4.5:1.
        warn: {
          background: acento[500],
          hoverBackground: acento[400],
          activeBackground: acento[300],
          borderColor: acento[500],
          hoverBorderColor: acento[400],
          activeBorderColor: acento[300],
          color: texto,
          hoverColor: texto,
          activeColor: texto,
          focusRing: { color: acento[500], shadow: 'none' },
        },
      },
      outlined: {
        secondary: {
          hoverBackground: segunModo(
            secundario[50],
            `color-mix(in srgb, ${secundario[400]}, transparent 88%)`,
          ),
          activeBackground: segunModo(
            secundario[100],
            `color-mix(in srgb, ${secundario[400]}, transparent 76%)`,
          ),
          borderColor: segunModo(secundario[500], secundario[400]),
          color: segunModo(secundario[500], COLORES_OSCURO.violetaClaro),
        },
      },
      text: {
        secondary: {
          hoverBackground: segunModo(
            secundario[50],
            `color-mix(in srgb, ${secundario[400]}, transparent 88%)`,
          ),
          activeBackground: segunModo(
            secundario[100],
            `color-mix(in srgb, ${secundario[400]}, transparent 76%)`,
          ),
          color: segunModo(secundario[500], COLORES_OSCURO.violetaClaro),
        },
      },
    },
    // Botones segmentados (selector de tema): la opción activa es violeta en oscuro.
    togglebutton: {
      root: {
        background: segunModo('{surface.100}', COLORES_OSCURO.fondo),
        checkedBackground: segunModo('{surface.100}', COLORES_OSCURO.fondo),
        hoverBackground: segunModo('{surface.100}', COLORES_OSCURO.fondo),
        borderColor: segunModo('{surface.100}', COLORES_OSCURO.borde),
        checkedBorderColor: segunModo('{surface.100}', COLORES_OSCURO.borde),
        // Tono 600 (no el 500 de Aura): sobre surface.100 el 500 queda en 4.3:1 (RNF-11).
        color: segunModo('{surface.600}', COLORES_OSCURO.textoSecundario),
        hoverColor: segunModo('{surface.700}', COLORES_OSCURO.texto),
        checkedColor: segunModo('{surface.900}', sobreColor),
      },
      icon: {
        color: segunModo('{surface.600}', COLORES_OSCURO.textoSecundario),
        hoverColor: segunModo('{surface.700}', COLORES_OSCURO.texto),
        checkedColor: segunModo('{surface.900}', sobreColor),
      },
      content: {
        checkedBackground: segunModo('{surface.0}', secundario[500]),
      },
    },
    message: mensajesLegibles,
    toast: avisosLegibles,
    badge: {
      secondary: {
        background: secundario[500],
        color: sobreColor,
      },
      // Insignias destacadas (contador del carrito, ofertas): Acento con texto oscuro.
      warn: {
        background: acento[500],
        color: texto,
      },
    },
  },
});
