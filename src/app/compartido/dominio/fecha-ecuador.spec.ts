import { fechaHoraEcuador, horaEcuador } from './fecha-ecuador';

describe('fechas en hora de Ecuador (D-31)', () => {
  it('convierte UTC a la hora de Ecuador (UTC-5)', () => {
    expect(horaEcuador('2026-11-09T15:30:00Z')).toBe('10:30');
    expect(horaEcuador('2026-11-09T15:30:00.000Z')).toBe('10:30');
  });

  it('cruza la medianoche hacia el día anterior', () => {
    expect(horaEcuador('2026-11-10T03:05:00Z')).toBe('22:05');
    expect(fechaHoraEcuador('2026-11-10T03:05:00Z')).toBe('09/11/2026 22:05');
  });

  it('respeta una fecha que ya trae la zona de Ecuador', () => {
    expect(fechaHoraEcuador('2026-11-05T10:16:02-05:00')).toBe('05/11/2026 10:16');
  });

  it('devuelve texto vacío si no es una fecha', () => {
    expect(horaEcuador('no-es-fecha')).toBe('');
    expect(fechaHoraEcuador('')).toBe('');
  });
});
