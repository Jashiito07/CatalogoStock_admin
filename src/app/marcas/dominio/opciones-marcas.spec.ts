import { estanTodasAgregadas, MarcaSugerida, opcionesDeMarcas } from './marca';

const SUGERIDAS: readonly MarcaSugerida[] = [
  { nombre: 'Yanbal', color: '#6B2C91', colorAcento: null, yaCreada: true },
  { nombre: 'Avon', color: '#FF2469', colorAcento: null, yaCreada: false },
  { nombre: 'Leonisa', color: '#222221', colorAcento: '#F36E21', yaCreada: true },
];

describe('marcas · opciones del combobox (D-43, D-56, RF-PRO-04)', () => {
  it('RF-PRO-04: conserva el orden y los colores oficiales de cada sugerida', () => {
    const opciones = opcionesDeMarcas(SUGERIDAS, []);
    expect(opciones.map((o) => o.nombre)).toEqual(['Yanbal', 'Avon', 'Leonisa']);
    expect(opciones[2]).toMatchObject({
      clave: 'Leonisa',
      color: '#222221',
      colorAcento: '#F36E21',
    });
  });

  it('marca como agregadas las que el servidor indica con yaCreada', () => {
    expect(opcionesDeMarcas(SUGERIDAS, []).map((o) => o.yaAgregada)).toEqual([true, false, true]);
  });

  it('también marca como agregada la que el panel ya tiene, con otra mayúscula o tilde', () => {
    const opciones = opcionesDeMarcas(SUGERIDAS, [{ nombre: 'AVÓN' }]);
    expect(opciones.find((o) => o.nombre === 'Avon')?.yaAgregada).toBe(true);
  });

  it('una marca propia del panel no deshabilita ninguna conocida', () => {
    expect(opcionesDeMarcas(SUGERIDAS, [{ nombre: 'Natura' }])[1]?.yaAgregada).toBe(false);
  });

  it('estanTodasAgregadas: solo si hay conocidas y todas están agregadas', () => {
    expect(estanTodasAgregadas(opcionesDeMarcas(SUGERIDAS, []))).toBe(false);
    expect(estanTodasAgregadas(opcionesDeMarcas(SUGERIDAS, [{ nombre: 'Avon' }]))).toBe(true);
    expect(estanTodasAgregadas([])).toBe(false);
  });
});
