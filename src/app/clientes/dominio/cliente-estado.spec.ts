import { ErrorApi } from '../../compartido/aplicacion/error-api';
import {
  MENSAJE_CLIENTE_NO_ENCONTRADO,
  MENSAJE_NO_SE_PUEDE_DESACTIVAR_VENDEDOR,
  MENSAJE_SIN_PERMISO,
  mensajeDeErrorAlCambiarEstado,
} from '../aplicacion/mensajes-clientes';
import {
  activoDeFiltro,
  construirConsultaClientes,
  etiquetaEstado,
  OPCIONES_FILTRO_ESTADO,
} from './cliente';

describe('Estado de los clientes (D-53)', () => {
  it('etiquetaEstado: Activo o Desactivado', () => {
    expect(etiquetaEstado(true)).toBe('Activo');
    expect(etiquetaEstado(false)).toBe('Desactivado');
  });

  it('activoDeFiltro: todos no filtra; activos y desactivados son true y false', () => {
    expect(activoDeFiltro('todos')).toBeUndefined();
    expect(activoDeFiltro('activos')).toBe(true);
    expect(activoDeFiltro('desactivados')).toBe(false);
  });

  it('el filtro ofrece tres opciones en español', () => {
    expect(OPCIONES_FILTRO_ESTADO.map((o) => o.etiqueta)).toEqual(['Todos', 'Activos', 'Desactivados']);
  });

  it('construirConsultaClientes añade activo solo cuando se filtra (también false)', () => {
    expect(construirConsultaClientes('', 1, 20)).toEqual({ pagina: 1, tamanio: 20 });
    expect(construirConsultaClientes('', 1, 20, true)).toEqual({ pagina: 1, tamanio: 20, activo: true });
    expect(construirConsultaClientes(' ana ', 2, 20, false)).toEqual({
      pagina: 2,
      tamanio: 20,
      busqueda: 'ana',
      activo: false,
    });
  });
});

describe('mensajeDeErrorAlCambiarEstado (D-53)', () => {
  it('403, 404 y 422 OPERACION_NO_PERMITIDA tienen un mensaje claro', () => {
    expect(mensajeDeErrorAlCambiarEstado(new ErrorApi('NO_AUTORIZADO', 'x', 403))).toBe(MENSAJE_SIN_PERMISO);
    expect(mensajeDeErrorAlCambiarEstado(new ErrorApi('USUARIO_NO_ENCONTRADO', 'x', 404))).toBe(
      MENSAJE_CLIENTE_NO_ENCONTRADO,
    );
    expect(mensajeDeErrorAlCambiarEstado(new ErrorApi('OPERACION_NO_PERMITIDA', 'x', 422))).toBe(
      MENSAJE_NO_SE_PUEDE_DESACTIVAR_VENDEDOR,
    );
  });

  it('otros errores de la API muestran su mensaje; un error desconocido, uno genérico', () => {
    expect(mensajeDeErrorAlCambiarEstado(new ErrorApi('X', 'Falló el servidor.', 500))).toBe('Falló el servidor.');
    expect(mensajeDeErrorAlCambiarEstado(new Error('interno'))).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
  });
});
