import { borradorPrueba } from '../pruebas/dobles-importacion';
import {
  marcaSugeridaPorArchivo,
  MAX_BYTES_PDF,
  PASOS_IMPORTACION,
  porcentajeDeSubida,
  precioActualDistinto,
  validarArchivoPdf,
} from './importacion';

const MARCAS = [
  { id: 'y', nombre: 'Yanbal' },
  { id: 'le', nombre: 'Leonisa' },
  { id: 'a', nombre: 'Avon' },
  { id: 'c', nombre: 'Cyzone' },
  { id: 'e', nombre: 'Ésika' },
  { id: 'lb', nombre: "L'Bel" },
];

describe('Importar desde el celular: dominio (RF-PRO-01, D-55, D-61)', () => {
  describe('marcaSugeridaPorArchivo', () => {
    it.each([
      ['Catalogo Yanbal C15 WhatsApp.pdf', 'y'],
      ['LEONISA_catalogo_2026-10.pdf', 'le'],
      ['avon-c14.PDF', 'a'],
      ['Cyzone Campaña 15.pdf', 'c'],
      ['catalogo-esika-15.pdf', 'e'],
      ['Catálogo L-Bel C15.pdf', 'lb'],
      ['lbel.pdf', 'lb'],
    ])('«%s» sugiere la marca %s (sin mayúsculas, tildes ni signos)', (archivo, esperada) => {
      expect(marcaSugeridaPorArchivo(archivo, MARCAS)).toBe(esperada);
    });

    it('sin coincidencia, o con dos marcas en el nombre, no sugiere nada', () => {
      expect(marcaSugeridaPorArchivo('catalogo-diciembre.pdf', MARCAS)).toBeNull();
      expect(marcaSugeridaPorArchivo('yanbal-avon.pdf', MARCAS)).toBeNull();
      expect(marcaSugeridaPorArchivo('yanbal.pdf', [])).toBeNull();
    });

    it('solo considera las marcas que se le dan (las activas)', () => {
      expect(marcaSugeridaPorArchivo('esika.pdf', MARCAS.filter((m) => m.id !== 'e'))).toBeNull();
    });
  });

  describe('validarArchivoPdf: mensajes claros', () => {
    it('rechaza lo que no es PDF, lo vacío y lo mayor de 60 MB, citando el archivo', () => {
      expect(validarArchivoPdf({ name: 'foto.jpg', size: 10, type: 'image/jpeg' })).toContain('no es un PDF');
      expect(validarArchivoPdf({ name: 'a.pdf', size: 0, type: 'application/pdf' })).toContain('vacío');
      expect(validarArchivoPdf({ name: 'a.pdf', size: MAX_BYTES_PDF + 1, type: 'application/pdf' })).toContain('60 MB');
      expect(validarArchivoPdf({ name: 'a.pdf', size: MAX_BYTES_PDF, type: 'application/pdf' })).toBeNull();
    });
  });

  describe('porcentajeDeSubida', () => {
    it('calcula un porcentaje entero entre 0 y 100', () => {
      expect(porcentajeDeSubida(0, 200)).toBe(0);
      expect(porcentajeDeSubida(50, 200)).toBe(25);
      expect(porcentajeDeSubida(199, 200)).toBe(99);
      expect(porcentajeDeSubida(200, 200)).toBe(100);
      expect(porcentajeDeSubida(300, 200)).toBe(100);
    });

    it('sin total conocido vale 0', () => {
      expect(porcentajeDeSubida(10, undefined)).toBe(0);
      expect(porcentajeDeSubida(10, 0)).toBe(0);
    });
  });

  it('los pasos de la pantalla van en orden: marca, PDF, analizar', () => {
    expect(PASOS_IMPORTACION).toEqual(['Elige la marca', 'Elige el PDF', 'Analizar']);
  });

  describe('precioActualDistinto (precio actual → nuevo, D-57)', () => {
    it('devuelve el precio actual solo si cambia, comparando como texto exacto', () => {
      const base = borradorPrueba('b', { precio: '37.00' });
      expect(precioActualDistinto({ ...base, productoExistente: { id: 'p', nombre: 'x', precio: '30.00' } })).toBe('30.00');
      expect(precioActualDistinto({ ...base, productoExistente: { id: 'p', nombre: 'x', precio: '37' } })).toBeNull();
      expect(precioActualDistinto(base)).toBeNull();
      expect(precioActualDistinto({ ...base, precio: null, productoExistente: { id: 'p', nombre: 'x', precio: '30.00' } })).toBeNull();
    });
  });
});
