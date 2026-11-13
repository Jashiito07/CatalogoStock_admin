import {
  calcularContraste,
  cambiosAlMover,
  esColorValido,
  formatearRazon,
  Marca,
  nombreRepetido,
  normalizarColor,
  ordenarMarcas,
  textoContraste,
  validarNombre,
} from './marca';

function marca(id: string, orden: number, nombre = id): Marca {
  return {
    id,
    nombre,
    color: '#2563EB',
    colorAcento: null,
    textoSobreColor: '#FFFFFF',
    textoSobreAcento: null,
    activa: true,
    orden,
    creadaEn: '2026-11-11T10:00:00Z',
  };
}

describe('marcas · dominio (RF-PRO-04, D-43)', () => {
  it('valida el color #RRGGBB', () => {
    expect(esColorValido('#FC5823')).toBe(true);
    expect(esColorValido('#fc5823')).toBe(true);
    expect(esColorValido('FC5823')).toBe(false);
    expect(esColorValido('#FC582')).toBe(false);
    expect(esColorValido('#GG5823')).toBe(false);
  });

  it('normaliza a mayúsculas y completa el «#»; deja intacto lo incompleto', () => {
    expect(normalizarColor('fc5823')).toBe('#FC5823');
    expect(normalizarColor(' #fc5823 ')).toBe('#FC5823');
    expect(normalizarColor('#fc58')).toBe('#fc58');
  });

  it.each([
    ['#FC5823', '#1E293B'], // Yanbal 4.57:1
    ['#FF2469', '#0F172A'], // Avon: ni blanco ni #1E293B llegan a 4.5
    ['#2E1A47', '#FFFFFF'], // L'Bel
    ['#A90061', '#FFFFFF'], // Cyzone
    ['#E1251B', '#FFFFFF'], // Esika
    ['#222221', '#FFFFFF'], // Leonisa principal
    ['#F36E21', '#1E293B'], // Leonisa acento
  ])('RNF-11: el texto sobre %s es %s con contraste ≥ 4.5:1', (color, texto) => {
    const c = calcularContraste(color);
    expect(c.texto).toBe(texto);
    expect(c.cumple).toBe(true);
    expect(c.razon).toBeGreaterThanOrEqual(4.5);
  });

  it('muestra la razón con un decimal', () => {
    expect(formatearRazon(4.57)).toBe('4.6:1');
    expect(formatearRazon(4.94)).toBe('4.9:1');
    expect(formatearRazon(15.5)).toBe('15.5:1');
    expect(textoContraste({ texto: '#0F172A', razon: 4.94, cumple: true })).toBe('Contraste 4.9:1 ✔');
  });

  it('valida el nombre (2 a 40 caracteres)', () => {
    expect(validarNombre('A')).not.toBeNull();
    expect(validarNombre(' A ')).not.toBeNull();
    expect(validarNombre('Yanbal')).toBeNull();
    expect(validarNombre('x'.repeat(41))).not.toBeNull();
  });

  it('detecta nombres repetidos sin distinguir mayúsculas ni tildes', () => {
    expect(nombreRepetido(' ÉSIKA ', ['Esika'])).toBe(true);
    expect(nombreRepetido('Avon', ['Esika'])).toBe(false);
  });

  it('ordena por orden y luego por nombre', () => {
    const lista = ordenarMarcas([marca('b', 1, 'B'), marca('c', 0, 'Zeta'), marca('a', 0, 'Alfa')]);
    expect(lista.map((m) => m.id)).toEqual(['a', 'c', 'b']);
  });

  it('mover: numera 0..n y solo cambia lo necesario', () => {
    const lista = [marca('a', 0), marca('b', 1), marca('c', 2)];
    expect(cambiosAlMover(lista, 'b', -1)).toEqual([
      { id: 'b', orden: 0 },
      { id: 'a', orden: 1 },
    ]);
    expect(cambiosAlMover(lista, 'a', -1)).toEqual([]);
    expect(cambiosAlMover(lista, 'c', 1)).toEqual([]);
  });

  it('mover: con órdenes repetidos los renumera', () => {
    const lista = [marca('a', 0), marca('b', 0), marca('c', 0)];
    expect(cambiosAlMover(lista, 'c', -1)).toEqual([
      { id: 'c', orden: 1 },
      { id: 'b', orden: 2 },
    ]);
  });
});
