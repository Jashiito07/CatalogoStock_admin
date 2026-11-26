import { licenciaPrimeng } from './licencia-primeng';

describe('licenciaPrimeng (D-59)', () => {
  it('devuelve la clave cuando no está vacía', () => {
    expect(licenciaPrimeng('CLAVE-FALSA')).toBe('CLAVE-FALSA');
  });

  it('devuelve undefined cuando está vacía', () => {
    expect(licenciaPrimeng('')).toBeUndefined();
    expect(licenciaPrimeng('   ')).toBeUndefined();
  });
});
