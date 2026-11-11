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

describe('TemaCatalogoStock (D-06, D-41)', () => {
  it('genera la escala primaria desde el Primario en claro y desde el Secundario en oscuro', () => {
    const valor = String(token('semantic.primary.500')).toLowerCase();
    expect(valor).toBe(
      `light-dark(${COLORES_CORPORATIVOS.primario.toLowerCase()}, ${COLORES_CORPORATIVOS.secundario.toLowerCase()})`,
    );
  });

  it('el botón principal usa texto blanco sobre el tono 500 de la escala primaria', () => {
    const principal = token('components.button.root.primary') as TokensColor;
    expect(principal.background).toBe('{primary.500}');
    expect(principal.color).toBe(COLORES_CORPORATIVOS.sobreColor);
  });

  it('usa el Secundario corporativo en los botones secundarios (claro), con texto blanco', () => {
    const secundario = token('components.button.root.secondary') as TokensColor;
    expect(secundario.background?.toLowerCase()).toContain(
      `light-dark(${COLORES_CORPORATIVOS.secundario.toLowerCase()},`,
    );
    expect(secundario.color).toContain(`light-dark(${COLORES_CORPORATIVOS.sobreColor},`);
  });

  it('RNF-11: los mensajes usan el tono 700 en claro (800 en advertencia) y el 300 en oscuro', () => {
    expect((token('components.message.error') as TokensColor).color).toBe(
      'light-dark({red.700}, {red.300})',
    );
    expect((token('components.message.error.simple') as TokensColor).color).toBe(
      'light-dark({red.700}, {red.300})',
    );
    expect((token('components.message.success') as TokensColor).color).toBe(
      'light-dark({green.700}, {green.300})',
    );
    expect((token('components.toast.warn') as TokensColor).color).toBe(
      'light-dark({yellow.800}, {yellow.300})',
    );
  });

  it('RNF-11: sobre el Acento el texto va en el color Texto, nunca en blanco (claro y oscuro)', () => {
    for (const ruta of ['components.badge.warn', 'components.button.root.warn']) {
      const tokens = token(ruta) as TokensColor;
      expect(tokens.background?.toLowerCase()).toBe(COLORES_CORPORATIVOS.acento.toLowerCase());
      expect(tokens.color).toBe(COLORES_CORPORATIVOS.texto);
    }
  });
});
