import { anchoRelativo, arcosDona, porcentaje } from './graficos';

describe('graficos (Inicio del panel)', () => {
  it('anchoRelativo: el mayor ocupa 100 y los demás son proporcionales', () => {
    expect(anchoRelativo(40, 40)).toBe(100);
    expect(anchoRelativo(20, 40)).toBe(50);
  });

  it('anchoRelativo: un valor pequeño no desaparece y cero queda en 0', () => {
    expect(anchoRelativo(1, 1000)).toBe(2);
    expect(anchoRelativo(0, 10)).toBe(0);
    expect(anchoRelativo(5, 0)).toBe(0);
  });

  it('porcentaje: redondea y evita dividir entre cero', () => {
    expect(porcentaje(1, 3)).toBe(33);
    expect(porcentaje(0, 0)).toBe(0);
  });

  it('arcosDona: los arcos suman la circunferencia y se encadenan desde arriba', () => {
    const [a, b] = arcosDona([3, 1]);
    expect(a.trazo).toBe('75 25');
    expect(a.desfase).toBe(25);
    expect(b.trazo).toBe('25 75');
    expect(b.desfase).toBe(-50);
  });

  it('arcosDona: sin datos no dibuja arcos', () => {
    expect(arcosDona([0, 0])).toEqual([]);
  });
});
