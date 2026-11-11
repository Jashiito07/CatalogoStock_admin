import { definePreset, palette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

/**
 * Tema corporativo de CatálogoStock para el panel del vendedor (D-06). Único lugar,
 * junto con `colores.css`, donde se escriben los colores en hexadecimal. Tiene la misma
 * forma que el tema de la app móvil (CatalogoStock_frontend) para mantener la coherencia.
 *
 * | Rol        | Color     |
 * |------------|-----------|
 * | Primario   | #2563EB   |
 * | Secundario | #7C3AED   |
 * | Acento     | #F97316   |
 * | Fondo      | #F8FAFC   |
 * | Texto      | #1E293B   |
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

type Tono = 50 | 100 | 300 | 400 | 500 | 600 | 700;
type Escala = Record<Tono, string>;

function escalaDe(color: string): Escala {
  const escala = palette(color);
  const tonos: Tono[] = [50, 100, 300, 400, 500, 600, 700];
  return Object.fromEntries(
    tonos.map((tono) => {
      const valor = escala[tono];
      if (!valor) {
        throw new Error(`No se generó el tono ${tono} de ${color}`);
      }
      return [tono, valor];
    }),
  ) as Escala;
}

const secundario = escalaDe(COLORES_CORPORATIVOS.secundario);
const acento = escalaDe(COLORES_CORPORATIVOS.acento);
const { texto, sobreColor } = COLORES_CORPORATIVOS;

export const TemaCatalogoStock = definePreset(Aura, {
  semantic: {
    primary: palette(COLORES_CORPORATIVOS.primario),
    text: {
      color: texto,
    },
  },
  components: {
    button: {
      root: {
        secondary: {
          background: secundario[500],
          hoverBackground: secundario[600],
          activeBackground: secundario[700],
          borderColor: secundario[500],
          hoverBorderColor: secundario[600],
          activeBorderColor: secundario[700],
          color: sobreColor,
          hoverColor: sobreColor,
          activeColor: sobreColor,
          focusRing: { color: secundario[500], shadow: 'none' },
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
          hoverBackground: secundario[50],
          activeBackground: secundario[100],
          borderColor: secundario[500],
          color: secundario[500],
        },
      },
      text: {
        secondary: {
          hoverBackground: secundario[50],
          activeBackground: secundario[100],
          color: secundario[500],
        },
      },
    },
    // RNF-11: el tono 600 de Aura sobre su fondo claro queda cerca o por debajo de 4.5:1
    // (rojo ≈ 4.4, verde ≈ 3.1). Los mensajes usan el tono 700 de la misma escala.
    message: {
      error: {
        color: '{red.700}',
        simple: { color: '{red.700}' },
        outlined: { color: '{red.700}', borderColor: '{red.700}' },
      },
      success: {
        color: '{green.700}',
        simple: { color: '{green.700}' },
        outlined: { color: '{green.700}', borderColor: '{green.700}' },
      },
    },
    // RNF-11: mismo criterio en los avisos (p-toast). El amarillo 600 sobre su fondo claro
    // queda muy por debajo de 4.5:1; se usa el 800.
    toast: {
      success: { color: '{green.700}' },
      error: { color: '{red.700}' },
      warn: { color: '{yellow.800}' },
    },
    badge: {
      secondary: {
        background: secundario[500],
        color: sobreColor,
      },
      // Insignias destacadas (avisos, pendientes de revisión): Acento con texto oscuro.
      warn: {
        background: acento[500],
        color: texto,
      },
    },
  },
});
