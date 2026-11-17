import {
  AYUDA_CORREO_SIN_VERIFICAR,
  construirConsultaClientes,
  correoVerificadoDeFiltro,
  estadoCorreoDe,
  OPCIONES_FILTRO_CORREO,
  textoAvisoSinVerificar,
} from './cliente';

describe('Correo verificado de los clientes (contrato usuarios-gestion, RF-USU-05)', () => {
  it('estadoCorreoDe: fecha = verificado, null = sin verificar, ausente = desconocido', () => {
    expect(estadoCorreoDe({ correoVerificadoEn: '2026-11-10T12:00:00Z' })).toBe('verificado');
    expect(estadoCorreoDe({ correoVerificadoEn: null })).toBe('sin-verificar');
    expect(estadoCorreoDe({})).toBe('desconocido');
  });

  it('correoVerificadoDeFiltro: todos no filtra; verificados y sin verificar son true y false', () => {
    expect(correoVerificadoDeFiltro('todos')).toBeUndefined();
    expect(correoVerificadoDeFiltro('verificados')).toBe(true);
    expect(correoVerificadoDeFiltro('sin-verificar')).toBe(false);
  });

  it('el filtro ofrece Todos, Verificados y Sin verificar', () => {
    expect(OPCIONES_FILTRO_CORREO.map((o) => o.etiqueta)).toEqual([
      'Todos',
      'Verificados',
      'Sin verificar',
    ]);
  });

  it('construirConsultaClientes añade correoVerificado solo cuando se filtra (también false)', () => {
    expect(construirConsultaClientes('', 1, 20, undefined, true)).toEqual({
      pagina: 1,
      tamanio: 20,
      correoVerificado: true,
    });
    expect(construirConsultaClientes(' ana ', 1, 20, true, false)).toEqual({
      pagina: 1,
      tamanio: 20,
      busqueda: 'ana',
      activo: true,
      correoVerificado: false,
    });
    expect(construirConsultaClientes('', 1, 20)).toEqual({ pagina: 1, tamanio: 20 });
  });

  it('textoAvisoSinVerificar concuerda en singular y plural', () => {
    expect(textoAvisoSinVerificar(1)).toBe('1 cliente tiene el correo sin verificar');
    expect(textoAvisoSinVerificar(4)).toBe('4 clientes tienen el correo sin verificar');
  });

  it('la ayuda explica la consecuencia con el texto del contrato', () => {
    expect(AYUDA_CORREO_SIN_VERIFICAR).toBe(
      'Aún no confirmó su correo. No podrá recuperar su clave por correo; solo con tu ayuda.',
    );
  });
});
