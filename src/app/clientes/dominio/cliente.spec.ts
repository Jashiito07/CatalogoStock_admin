import {
  construirConsultaClientes,
  esCodigoValido,
  formatearTelefono,
  paginaDesdeIndice,
  tieneCodigoVigente,
} from './cliente';

describe('clientes: dominio (RF-USU-05)', () => {
  describe('construirConsultaClientes', () => {
    it('sin búsqueda envía solo la paginación', () => {
      expect(construirConsultaClientes('', 1, 20)).toEqual({ pagina: 1, tamanio: 20 });
      expect(construirConsultaClientes('   ', 2, 50)).toEqual({ pagina: 2, tamanio: 50 });
      expect(construirConsultaClientes(null, 1, 20)).toEqual({ pagina: 1, tamanio: 20 });
    });

    it('recorta la búsqueda y la limita a 100 caracteres', () => {
      expect(construirConsultaClientes('  maría ', 1, 20)).toEqual({
        pagina: 1,
        tamanio: 20,
        busqueda: 'maría',
      });
      expect(construirConsultaClientes('a'.repeat(150), 1, 20).busqueda).toHaveLength(100);
    });

    it('corrige página y tamaño fuera del rango del contrato', () => {
      expect(construirConsultaClientes('', 0, 500)).toEqual({ pagina: 1, tamanio: 20 });
    });
  });

  it('paginaDesdeIndice', () => {
    expect(paginaDesdeIndice(0, 20)).toBe(1);
    expect(paginaDesdeIndice(40, 20)).toBe(3);
  });

  it('formatea el celular de Ecuador de forma legible', () => {
    expect(formatearTelefono('+593991234567')).toBe('099 123 4567');
    expect(formatearTelefono('otro')).toBe('otro');
  });

  it('el código está vigente solo si vence después de ahora', () => {
    const ahora = new Date('2026-11-09T15:00:00Z');
    expect(tieneCodigoVigente({ codigoRecuperacionVigenteHasta: null }, ahora)).toBe(false);
    expect(
      tieneCodigoVigente({ codigoRecuperacionVigenteHasta: '2026-11-09T15:10:00Z' }, ahora),
    ).toBe(true);
    expect(
      tieneCodigoVigente({ codigoRecuperacionVigenteHasta: '2026-11-09T14:59:00Z' }, ahora),
    ).toBe(false);
  });

  it('el código tiene exactamente 6 dígitos', () => {
    expect(esCodigoValido('482913')).toBe(true);
    expect(esCodigoValido('000000')).toBe(true);
    expect(esCodigoValido('48291')).toBe(false);
    expect(esCodigoValido('48291a')).toBe(false);
  });
});
