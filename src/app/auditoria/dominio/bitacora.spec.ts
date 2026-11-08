import {
  construirConsultaBitacora,
  describirDetalle,
  describirUsuario,
  diaCalendarioDe,
  ErrorFiltrosBitacora,
  etiquetaAccion,
  etiquetaEntidad,
  finDelDiaEcuador,
  gravedadAccion,
  inicioDelDiaEcuador,
  MENSAJE_RANGO_FECHAS_INVALIDO,
  paginaDesdeIndice,
} from './bitacora';

/** Mismo patrón con el que la API valida `desde` y `hasta` (D-31). */
const PATRON_FECHA_CON_ZONA =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

describe('Bitácora: filtros de fecha (RF-USU-04, D-31)', () => {
  const dia5 = { anio: 2026, mes: 11, dia: 5 };

  it('desde = inicio del día y hasta = fin del día, con hora y zona -05:00', () => {
    expect(inicioDelDiaEcuador(dia5)).toBe('2026-11-05T00:00:00.000-05:00');
    expect(finDelDiaEcuador(dia5)).toBe('2026-11-05T23:59:59.999-05:00');
    expect(inicioDelDiaEcuador(dia5)).toMatch(PATRON_FECHA_CON_ZONA);
    expect(finDelDiaEcuador(dia5)).toMatch(PATRON_FECHA_CON_ZONA);
  });

  it('el instante «desde» equivale a las 05:00 UTC del mismo día', () => {
    expect(new Date(inicioDelDiaEcuador(dia5)).toISOString()).toBe('2026-11-05T05:00:00.000Z');
    expect(new Date(finDelDiaEcuador(dia5)).toISOString()).toBe('2026-11-06T04:59:59.999Z');
  });

  it('toma el día que muestra el selector de fecha, sin importar la hora', () => {
    expect(diaCalendarioDe(new Date(2026, 0, 9, 23, 30))).toEqual({ anio: 2026, mes: 1, dia: 9 });
  });

  it('construye la consulta con paginación, acción, usuario y fechas', () => {
    expect(
      construirConsultaBitacora(
        {
          accion: 'SESION_FALLIDA',
          desde: { anio: 2026, mes: 11, dia: 1 },
          hasta: dia5,
          idUsuario: '6f1c0000-0000-4000-8000-000000000000',
        },
        2,
        50,
      ),
    ).toEqual({
      pagina: 2,
      tamanio: 50,
      accion: 'SESION_FALLIDA',
      idUsuario: '6f1c0000-0000-4000-8000-000000000000',
      desde: '2026-11-01T00:00:00.000-05:00',
      hasta: '2026-11-05T23:59:59.999-05:00',
    });
  });

  it('omite los filtros vacíos', () => {
    expect(
      construirConsultaBitacora({ accion: null, desde: null, hasta: null, idUsuario: null }, 1, 20),
    ).toEqual({ pagina: 1, tamanio: 20 });
  });

  it('acepta el mismo día como desde y hasta', () => {
    const consulta = construirConsultaBitacora({ desde: dia5, hasta: dia5 }, 1, 20);
    expect(consulta.desde).toBe('2026-11-05T00:00:00.000-05:00');
    expect(consulta.hasta).toBe('2026-11-05T23:59:59.999-05:00');
  });

  it('rechaza «hasta» anterior a «desde» sin llamar a la API', () => {
    expect(() =>
      construirConsultaBitacora({ desde: dia5, hasta: { anio: 2026, mes: 11, dia: 4 } }, 1, 20),
    ).toThrow(new ErrorFiltrosBitacora(MENSAJE_RANGO_FECHAS_INVALIDO));
  });

  it.each([
    [0, 20],
    [1, 0],
    [1, 101],
    [1.5, 20],
  ])('rechaza la paginación fuera del contrato (pagina %s, tamanio %s)', (pagina, tamanio) => {
    expect(() => construirConsultaBitacora({}, pagina, tamanio)).toThrow(ErrorFiltrosBitacora);
  });

  it('calcula la página desde el primer índice de la tabla', () => {
    expect(paginaDesdeIndice(0, 20)).toBe(1);
    expect(paginaDesdeIndice(40, 20)).toBe(3);
    expect(paginaDesdeIndice(50, 50)).toBe(2);
  });
});

describe('Bitácora: presentación de los registros', () => {
  it('traduce las acciones del catálogo y deja visibles las desconocidas', () => {
    expect(etiquetaAccion('SESION_INICIADA')).toBe('Sesión iniciada');
    expect(etiquetaAccion('ACCESO_DENEGADO')).toBe('Acceso denegado');
    expect(etiquetaAccion('ACCION_FUTURA')).toBe('ACCION_FUTURA');
    expect(gravedadAccion('SESION_FALLIDA')).toBe('alerta');
    expect(gravedadAccion('ACCION_FUTURA')).toBe('neutral');
  });

  it('traduce la entidad', () => {
    expect(etiquetaEntidad('SESION')).toBe('Sesión');
    expect(etiquetaEntidad(null)).toBe('—');
  });

  it('usuario null → «No identificado», sin filtro', () => {
    expect(describirUsuario(null)).toEqual({
      nombre: 'No identificado',
      rol: null,
      identificado: false,
      filtrable: false,
    });
  });

  it('D-30: usuario eliminado (rol null) → «Usuario eliminado», filtrable por su id', () => {
    expect(describirUsuario({ id: 'u-1', nombre: 'Usuario eliminado', rol: null })).toEqual({
      nombre: 'Usuario eliminado',
      rol: null,
      identificado: false,
      filtrable: true,
    });
  });

  it('usuario con rol → nombre y rol en español', () => {
    expect(describirUsuario({ id: 'u-2', nombre: 'María Zambrano', rol: 'CLIENTE' })).toEqual({
      nombre: 'María Zambrano',
      rol: 'Cliente',
      identificado: true,
      filtrable: true,
    });
  });

  it('describe el detalle de un ingreso fallido (D-20) y de un acceso denegado', () => {
    expect(
      describirDetalle({ correo: 'intento@correo.com', canal: 'PANEL', motivo: 'ROL_NO_PERMITIDO' }),
    ).toEqual([
      { etiqueta: 'Correo intentado', valor: 'intento@correo.com' },
      { etiqueta: 'Canal', valor: 'Panel web' },
      { etiqueta: 'Motivo', valor: 'Rol no permitido en ese canal' },
    ]);
    expect(describirDetalle({ familiaRevocada: true, otro: null })).toEqual([
      { etiqueta: 'Sesiones revocadas', valor: 'Sí' },
      { etiqueta: 'otro', valor: '—' },
    ]);
    expect(describirDetalle({})).toEqual([]);
  });
});
