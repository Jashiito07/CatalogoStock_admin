import {
  buscarMarcaConocida,
  claveDeMarcaConocida,
  MarcaSugerida,
  mismaMarcaConocida,
} from './marca';

/** Datos de ejemplo con la forma de `GET /marcas/sugeridas` (la fuente real es el servidor). */
const SUGERIDAS: readonly MarcaSugerida[] = [
  { nombre: 'Avon', color: '#FF2469', colorAcento: null, yaCreada: false },
  { nombre: "L'Bel", color: '#2E1A47', colorAcento: null, yaCreada: false },
  { nombre: 'Esika', color: '#E1251B', colorAcento: null, yaCreada: false },
  { nombre: 'Leonisa', color: '#222221', colorAcento: '#F36E21', yaCreada: false },
];

describe('marcas · reconocimiento de marcas conocidas (D-56)', () => {
  it('la clave ignora mayúsculas, tildes, espacios y signos', () => {
    expect(claveDeMarcaConocida("L'Bel")).toBe('lbel');
    expect(claveDeMarcaConocida('L´Bel')).toBe('lbel');
    expect(claveDeMarcaConocida('L’Bel')).toBe('lbel');
    expect(claveDeMarcaConocida(' lbel ')).toBe('lbel');
    expect(claveDeMarcaConocida('Ésika')).toBe('esika');
    expect(claveDeMarcaConocida('L BEL')).toBe('lbel');
  });

  it('dos nombres son la misma marca si sus claves coinciden', () => {
    expect(mismaMarcaConocida('Avon', 'AVON')).toBe(true);
    expect(mismaMarcaConocida("L'Bel", 'lbel')).toBe(true);
    expect(mismaMarcaConocida('Esika', 'Ésika')).toBe(true);
    expect(mismaMarcaConocida('Avon', 'Avon Pro')).toBe(false);
  });

  it('un nombre sin letras ni números nunca coincide', () => {
    expect(mismaMarcaConocida("'", '´')).toBe(false);
  });

  it('encuentra la marca conocida con sus colores oficiales de la lista', () => {
    expect(buscarMarcaConocida('avon', SUGERIDAS)?.color).toBe('#FF2469');
    expect(buscarMarcaConocida(' ÉSIKA ', SUGERIDAS)?.nombre).toBe('Esika');
    expect(buscarMarcaConocida('L´Bel', SUGERIDAS)?.nombre).toBe("L'Bel");
    expect(buscarMarcaConocida('leonisa', SUGERIDAS)?.colorAcento).toBe('#F36E21');
  });

  it('una marca propia o una lista vacía no es conocida', () => {
    expect(buscarMarcaConocida('Natura', SUGERIDAS)).toBeNull();
    expect(buscarMarcaConocida('Avo', SUGERIDAS)).toBeNull();
    expect(buscarMarcaConocida('Avon', [])).toBeNull();
  });
});
