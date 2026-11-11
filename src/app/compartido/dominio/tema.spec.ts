import {
  esPreferenciaTema,
  minutosDelDia,
  resolverTema,
  temaPorHora,
} from './tema';

const hm = (horas: number, minutos: number) => horas * 60 + minutos;

describe('Tema por horario (N2)', () => {
  it('límites del intervalo [18:40, 06:45): 18:39 claro, 18:40 oscuro, 06:44 oscuro, 06:45 claro', () => {
    expect(temaPorHora(hm(18, 39))).toBe('claro');
    expect(temaPorHora(hm(18, 40))).toBe('oscuro');
    expect(temaPorHora(hm(6, 44))).toBe('oscuro');
    expect(temaPorHora(hm(6, 45))).toBe('claro');
  });

  it('cruza la medianoche: 23:59, 00:00 y 03:00 son oscuros; 12:00 es claro', () => {
    expect(temaPorHora(hm(23, 59))).toBe('oscuro');
    expect(temaPorHora(0)).toBe('oscuro');
    expect(temaPorHora(hm(3, 0))).toBe('oscuro');
    expect(temaPorHora(hm(12, 0))).toBe('claro');
  });

  it('normaliza minutos fuera del día', () => {
    expect(temaPorHora(1440 + hm(12, 0))).toBe('claro');
    expect(temaPorHora(-1)).toBe('oscuro');
  });

  it('la preferencia fija gana sobre el horario; automático sigue el horario', () => {
    expect(resolverTema('claro', hm(23, 0))).toBe('claro');
    expect(resolverTema('oscuro', hm(12, 0))).toBe('oscuro');
    expect(resolverTema('automatico', hm(23, 0))).toBe('oscuro');
    expect(resolverTema('automatico', hm(12, 0))).toBe('claro');
  });

  it('no depende de la zona horaria: usa la hora local de la fecha recibida', () => {
    // El constructor con componentes crea la fecha en la hora local del equipo,
    // así que el resultado es el mismo en cualquier zona horaria.
    expect(temaPorHora(minutosDelDia(new Date(2026, 10, 10, 18, 39)))).toBe('claro');
    expect(temaPorHora(minutosDelDia(new Date(2026, 10, 10, 18, 40)))).toBe('oscuro');
    expect(temaPorHora(minutosDelDia(new Date(2026, 10, 11, 6, 44)))).toBe('oscuro');
    expect(temaPorHora(minutosDelDia(new Date(2026, 10, 11, 6, 45)))).toBe('claro');
  });

  it('valida preferencias guardadas', () => {
    expect(esPreferenciaTema('automatico')).toBe(true);
    expect(esPreferenciaTema('oscuro')).toBe(true);
    expect(esPreferenciaTema('morado')).toBe(false);
    expect(esPreferenciaTema(null)).toBe(false);
  });
});
