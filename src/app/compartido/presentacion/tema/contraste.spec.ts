import { CONTRASTE_MINIMO, razonDeContraste } from '../../dominio/contraste';
import { COLORES_CORPORATIVOS as C, COLORES_OSCURO as O } from './tema-catalogostock';

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

  describe('modo oscuro con violeta', () => {
    const pares: [string, string, string][] = [
      ['texto sobre fondo', O.texto, O.fondo],
      ['texto sobre superficie', O.texto, O.superficie],
      ['texto secundario sobre fondo', O.textoSecundario, O.fondo],
      ['texto secundario sobre superficie', O.textoSecundario, O.superficie],
      ['blanco sobre Secundario (botón principal)', C.sobreColor, C.secundario],
      ['violeta claro sobre superficie (precios y enlaces)', O.violetaClaro, O.superficie],
      ['violeta claro sobre fondo', O.violetaClaro, O.fondo],
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
