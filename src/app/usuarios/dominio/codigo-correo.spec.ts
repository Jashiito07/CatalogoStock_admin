import {
  correoVerificado,
  esCodigoCorreoValido,
  formatearEspera,
  normalizarCodigo,
} from './codigo-correo';

describe('Código del correo (RF-USU-05, D-50)', () => {
  it.each([
    ['482913', true],
    ['000000', true],
    ['48291', false],
    ['4829135', false],
    ['48291a', false],
    ['', false],
  ])('esCodigoCorreoValido(%j) → %s', (codigo, esperado) => {
    expect(esCodigoCorreoValido(codigo)).toBe(esperado);
  });

  it('normalizarCodigo deja solo dígitos y corta a 6', () => {
    expect(normalizarCodigo('48a2 91-3999')).toBe('482913');
    expect(normalizarCodigo('abc')).toBe('');
  });

  it('formatearEspera: segundos → m:ss', () => {
    expect(formatearEspera(75)).toBe('1:15');
    expect(formatearEspera(9)).toBe('0:09');
  });

  it('correoVerificado: solo con fecha; sin dato o null cuenta como no verificado', () => {
    expect(correoVerificado({ correoVerificadoEn: '2026-11-15T10:00:00.000Z' })).toBe(true);
    expect(correoVerificado({ correoVerificadoEn: null })).toBe(false);
    expect(correoVerificado({})).toBe(false);
    expect(correoVerificado(null)).toBe(false);
  });
});
