import { borradorPrueba } from '../pruebas/dobles-importacion';
import {
  advertenciasDeRevision,
  advertenciasInformativas,
  cambiosDeBorrador,
  descripcionDeFallidos,
  infoAdvertencia,
  MAX_BYTES_PDF,
  precioDeBorrador,
  puedeAprobar,
  resumenDeAnalisis,
  resumirLote,
  tieneSinPrecio,
  validarArchivoPdf,
} from './importacion';

const formulario = (b = borradorPrueba('b1')) => ({
  nombre: b.nombre,
  descripcion: b.descripcion ?? '',
  precio: b.precio ?? '',
  marcaId: b.marcaId,
  disponibilidad: b.disponibilidad,
});

describe('Importación de catálogo en PDF: dominio (RF-PRO-01, RF-PRO-02, D-55)', () => {
  describe('validarArchivoPdf', () => {
    it('RF-PRO-01: acepta un PDF de hasta 60 MB', () => {
      expect(validarArchivoPdf({ name: 'a.PDF', size: MAX_BYTES_PDF, type: 'application/pdf' })).toBeNull();
      expect(validarArchivoPdf({ name: 'a.pdf', size: 10, type: '' })).toBeNull();
    });

    it('D-55: rechaza lo que no es PDF, lo vacío y lo mayor de 60 MB', () => {
      expect(validarArchivoPdf({ name: 'a.png', size: 10, type: 'image/png' })).toMatch(/no es un PDF/);
      expect(validarArchivoPdf({ name: 'a.pdf', size: 10, type: 'text/plain' })).toMatch(/no es un PDF/);
      expect(validarArchivoPdf({ name: 'a.pdf', size: 0, type: 'application/pdf' })).toMatch(/vacío/);
      expect(validarArchivoPdf({ name: 'a.pdf', size: MAX_BYTES_PDF + 1, type: 'application/pdf' })).toMatch(
        /60 MB/,
      );
    });
  });

  describe('advertencias', () => {
    it('distingue las informativas de las que piden revisión', () => {
      const b = borradorPrueba('b1', {
        advertencias: ['PRECIO_EN_OFERTA', 'SIN_CODIGO', 'VARIAS_REFERENCIAS', 'NOMBRE_DUDOSO'],
      });
      expect(advertenciasDeRevision(b)).toEqual(['SIN_CODIGO', 'NOMBRE_DUDOSO']);
      expect(advertenciasInformativas(b)).toEqual(['PRECIO_EN_OFERTA', 'VARIAS_REFERENCIAS']);
    });

    it('un código desconocido se trata como advertencia de revisión', () => {
      expect(infoAdvertencia('NUEVA').informativa).toBe(false);
      expect(infoAdvertencia('NUEVA').etiqueta).toBe('NUEVA');
    });
  });

  describe('aprobación', () => {
    it('RN-11: un borrador sin precio no se puede aprobar', () => {
      expect(tieneSinPrecio(borradorPrueba('b', { precio: null, advertencias: ['SIN_PRECIO'] }))).toBe(true);
      expect(puedeAprobar(borradorPrueba('b', { precio: null, advertencias: ['SIN_PRECIO'] }))).toBe(false);
      expect(puedeAprobar(borradorPrueba('b', { advertencias: ['SIN_PRECIO'] }))).toBe(false);
    });

    it('solo un borrador pendiente con precio se puede aprobar', () => {
      expect(puedeAprobar(borradorPrueba('b'))).toBe(true);
      expect(puedeAprobar(borradorPrueba('b', { estado: 'APROBADO' }))).toBe(false);
      expect(puedeAprobar(borradorPrueba('b', { estado: 'DESCARTADO' }))).toBe(false);
    });
  });

  describe('resumen', () => {
    it('«Se encontraron N productos; M con advertencias»', () => {
      const totales = { pendientes: 130, aprobados: 10, descartados: 3, conAdvertencias: 12 };
      expect(resumenDeAnalisis({ totales })).toBe('Se encontraron 143 productos; 12 con advertencias.');
    });

    it('usa el singular con un solo producto', () => {
      const totales = { pendientes: 1, aprobados: 0, descartados: 0, conAdvertencias: 1 };
      expect(resumenDeAnalisis({ totales })).toBe('Se encontró 1 producto; 1 con advertencias.');
    });

    it('precios como texto exacto, sin números de punto flotante', () => {
      expect(precioDeBorrador('37.00')).toBe('$37.00');
      expect(precioDeBorrador('0.10')).toBe('$0.10');
      expect(precioDeBorrador(null)).toBe('—');
    });
  });

  describe('lotes', () => {
    it('separa aprobados y errores por borrador', () => {
      const resumen = resumirLote([
        { id: 'a', estado: 'APROBADO', idProducto: 'p1' },
        { id: 'b', error: 'SIN_PRECIO' },
        { id: 'c', error: 'NO_PENDIENTE' },
        { id: 'd', error: 'SIN_PRECIO' },
      ]);
      expect(resumen.correctos).toEqual(['a']);
      expect(resumen.fallidos).toHaveLength(3);
      expect(descripcionDeFallidos(resumen.fallidos)).toBe('2 sin precio, 1 que ya no estaban pendientes');
    });

    it('un error desconocido se agrupa como otro motivo', () => {
      expect(descripcionDeFallidos([{ id: 'a', error: 'RARO' }])).toBe('1 por otro motivo');
    });
  });

  describe('cambiosDeBorrador (PATCH parcial)', () => {
    it('sin cambios no envía nada', () => {
      expect(cambiosDeBorrador(borradorPrueba('b1'), formulario())).toEqual({});
    });

    it('envía solo los campos cambiados y el precio con 2 decimales como texto', () => {
      const b = borradorPrueba('b1', { precio: '35.00' });
      const cambios = cambiosDeBorrador(b, {
        ...formulario(b),
        nombre: '  Crema nueva ',
        precio: '12,5',
        disponibilidad: 'AGOTADO',
      });
      expect(cambios).toEqual({ nombre: 'Crema nueva', precio: '12.50', disponibilidad: 'AGOTADO' });
    });

    it('"35" y "35.00" son el mismo precio: no se envía', () => {
      const b = borradorPrueba('b1', { precio: '35.00' });
      expect(cambiosDeBorrador(b, { ...formulario(b), precio: '35' })).toEqual({});
    });

    it('un precio escrito en un borrador sin precio sí se envía; vacío no (el servidor no admite null)', () => {
      const sin = borradorPrueba('b1', { precio: null, advertencias: ['SIN_PRECIO'] });
      expect(cambiosDeBorrador(sin, { ...formulario(sin), precio: '9.9' })).toEqual({ precio: '9.90' });
      expect(cambiosDeBorrador(sin, { ...formulario(sin), precio: '' })).toEqual({});
    });

    it('una descripción vacía sobre una que no existía no es un cambio', () => {
      const b = borradorPrueba('b1', { descripcion: null });
      expect(cambiosDeBorrador(b, formulario(b))).toEqual({});
      expect(cambiosDeBorrador(b, { ...formulario(b), descripcion: 'Texto' })).toEqual({ descripcion: 'Texto' });
    });
  });
});
