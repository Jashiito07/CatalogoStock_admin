import { COLORES_CORPORATIVOS, TemaCatalogoStock } from './tema-catalogostock';

interface TokensColor {
  background?: string;
  color?: string;
}

/** Acceso de solo lectura a los tokens del preset, sin depender de sus tipos internos. */
function token(ruta: string): unknown {
  return ruta
    .split('.')
    .reduce<unknown>(
      (nodo, clave) => (nodo as Record<string, unknown> | undefined)?.[clave],
      TemaCatalogoStock,
    );
}

describe('TemaCatalogoStock (D-06)', () => {
  it('genera la escala primaria desde el Primario corporativo', () => {
    expect(String(token('semantic.primary.500')).toLowerCase()).toBe(
      COLORES_CORPORATIVOS.primario.toLowerCase(),
    );
  });

  it('usa el Secundario corporativo en los botones secundarios, con texto blanco', () => {
    const secundario = token('components.button.root.secondary') as TokensColor;
    expect(secundario.background?.toLowerCase()).toBe(
      COLORES_CORPORATIVOS.secundario.toLowerCase(),
    );
    expect(secundario.color).toBe(COLORES_CORPORATIVOS.sobreColor);
  });

  it('RNF-11: los mensajes de error y de éxito usan el tono 700 para cumplir 4.5:1', () => {
    expect((token('components.message.error') as TokensColor).color).toBe('{red.700}');
    expect((token('components.message.error.simple') as TokensColor).color).toBe('{red.700}');
    expect((token('components.message.success') as TokensColor).color).toBe('{green.700}');
  });

  it('RNF-11: sobre el Acento el texto va en el color Texto, nunca en blanco', () => {
    for (const ruta of ['components.badge.warn', 'components.button.root.warn']) {
      const tokens = token(ruta) as TokensColor;
      expect(tokens.background?.toLowerCase()).toBe(COLORES_CORPORATIVOS.acento.toLowerCase());
      expect(tokens.color).toBe(COLORES_CORPORATIVOS.texto);
    }
  });
});
