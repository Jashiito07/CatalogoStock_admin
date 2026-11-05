import { Dinero, ErrorDinero } from './dinero';

describe('Dinero (representación exacta en centavos)', () => {
  describe('desdeTexto', () => {
    it.each([
      ['12.50', 1250],
      ['12.5', 1250],
      ['12', 1200],
      ['0.01', 1],
      ['0', 0],
      [' 7.05 ', 705],
    ])('convierte «%s» en %i centavos', (texto, centavos) => {
      expect(Dinero.desdeTexto(texto).centavos).toBe(centavos);
    });

    it.each(['', 'abc', '12.505', '-1.00', '1,50', '1e3', '.50'])(
      'rechaza el texto inválido «%s»',
      (texto) => {
        expect(() => Dinero.desdeTexto(texto)).toThrow(ErrorDinero);
        expect(Dinero.esTextoValido(texto)).toBe(false);
      },
    );
  });

  it('suma sin errores de punto flotante (0.10 + 0.20 = 0.30)', () => {
    const resultado = Dinero.desdeTexto('0.10').sumar(Dinero.desdeTexto('0.20'));
    expect(resultado.aTexto()).toBe('0.30');
    expect(resultado.igualA(Dinero.desdeCentavos(30))).toBe(true);
  });

  it('multiplica por una cantidad entera', () => {
    expect(Dinero.desdeTexto('19.99').multiplicar(3).aTexto()).toBe('59.97');
    expect(Dinero.desdeTexto('19.99').multiplicar(0).esCero()).toBe(true);
  });

  it('rechaza multiplicar por cantidades negativas o decimales', () => {
    const precio = Dinero.desdeTexto('5.00');
    expect(() => precio.multiplicar(-1)).toThrow(ErrorDinero);
    expect(() => precio.multiplicar(1.5)).toThrow(ErrorDinero);
  });

  it('rechaza centavos negativos o no enteros', () => {
    expect(() => Dinero.desdeCentavos(-1)).toThrow(ErrorDinero);
    expect(() => Dinero.desdeCentavos(10.5)).toThrow(ErrorDinero);
  });

  it('calcula el total exacto de una lista de montos', () => {
    const montos = ['0.10', '0.20', '0.30', '12.45'].map((m) => Dinero.desdeTexto(m));
    expect(Dinero.total(montos).aTexto()).toBe('13.05');
    expect(Dinero.total([]).esCero()).toBe(true);
  });

  it('devuelve texto decimal con dos decimales para la API', () => {
    expect(Dinero.desdeCentavos(5).aTexto()).toBe('0.05');
    expect(Dinero.desdeCentavos(123456).aTexto()).toBe('1234.56');
  });

  it('formatea en dólares con el formato de Ecuador (es-EC)', () => {
    expect(Dinero.desdeTexto('1234.56').formatear()).toBe('$1.234,56');
    expect(Dinero.desdeTexto('12.5').formatear()).toBe('$12,50');
    expect(Dinero.cero().formatear()).toBe('$0,00');
  });
});
