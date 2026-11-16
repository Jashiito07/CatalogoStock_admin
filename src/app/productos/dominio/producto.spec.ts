import {
  esDisponibilidad,
  etiquetaDisponibilidad,
  formatearPrecio,
  hacerPrimero,
  imagenPrincipal,
  MAX_BYTES_IMAGEN,
  mismoOrden,
  moverElemento,
  normalizarPrecio,
  precioParaApi,
  validarArchivoImagen,
  validarDescripcion,
  validarNombre,
  validarPrecio,
} from './producto';

describe('Producto (dominio, RF-PRO-01 a RF-PRO-05)', () => {
  describe('precio (RNF-03, RN-11)', () => {
    it.each(['0.01', '12', '12.5', '12.50', '99999.99', '1'])('acepta «%s»', (texto) => {
      expect(validarPrecio(texto)).toBeNull();
    });

    it.each(['', '  ', 'abc', '0', '0.00', '12.505', '-1', '100000', '1e3', '12.', '.5', '1 2'])(
      'rechaza «%s»',
      (texto) => {
        expect(validarPrecio(texto)).not.toBeNull();
      },
    );

    it('acepta la coma decimal y la convierte a punto', () => {
      expect(normalizarPrecio(' 12,5 ')).toBe('12.5');
      expect(validarPrecio('12,50')).toBeNull();
      expect(precioParaApi('12,5')).toBe('12.50');
    });

    it('envía siempre texto con 2 decimales, sin números de punto flotante', () => {
      expect(precioParaApi('12')).toBe('12.00');
      expect(precioParaApi('0.1')).toBe('0.10');
      expect(precioParaApi('99999.99')).toBe('99999.99');
    });

    it('muestra «$12.50» a partir del texto exacto', () => {
      expect(formatearPrecio('12.5')).toBe('$12.50');
      expect(formatearPrecio('0.10')).toBe('$0.10');
      expect(formatearPrecio('99999.99')).toBe('$99999.99');
    });
  });

  describe('nombre y descripción', () => {
    it('el nombre admite de 2 a 120 caracteres', () => {
      expect(validarNombre('A')).not.toBeNull();
      expect(validarNombre(' A ')).not.toBeNull();
      expect(validarNombre('Crema')).toBeNull();
      expect(validarNombre('x'.repeat(120))).toBeNull();
      expect(validarNombre('x'.repeat(121))).not.toBeNull();
    });

    it('la descripción admite hasta 2000 caracteres', () => {
      expect(validarDescripcion('')).toBeNull();
      expect(validarDescripcion('x'.repeat(2000))).toBeNull();
      expect(validarDescripcion('x'.repeat(2001))).not.toBeNull();
    });
  });

  describe('disponibilidad (RN-09, D-47)', () => {
    it('solo existen los 3 valores del contrato, con su etiqueta', () => {
      expect(esDisponibilidad('DISPONIBLE')).toBe(true);
      expect(esDisponibilidad('AGOTADO')).toBe(true);
      expect(esDisponibilidad('PENDIENTE_REPOSICION')).toBe(true);
      expect(esDisponibilidad('OTRO')).toBe(false);
      expect(etiquetaDisponibilidad('PENDIENTE_REPOSICION')).toBe('Pendiente de reposición');
    });
  });

  describe('imágenes (D-46)', () => {
    const archivo = (name: string, size: number, type: string) => ({ name, size, type });

    it('acepta JPG, PNG y WebP de hasta 2 MB', () => {
      expect(validarArchivoImagen(archivo('a.jpg', 1000, 'image/jpeg'))).toBeNull();
      expect(validarArchivoImagen(archivo('a.png', 1000, 'image/png'))).toBeNull();
      expect(validarArchivoImagen(archivo('a.webp', MAX_BYTES_IMAGEN, 'image/webp'))).toBeNull();
    });

    it('rechaza tipos no admitidos y archivos de más de 2 MB o vacíos', () => {
      expect(validarArchivoImagen(archivo('a.gif', 1000, 'image/gif'))).toContain('no es una imagen');
      expect(validarArchivoImagen(archivo('a.pdf', 1000, 'application/pdf'))).not.toBeNull();
      expect(validarArchivoImagen(archivo('a.jpg', MAX_BYTES_IMAGEN + 1, 'image/jpeg'))).toContain(
        '2 MB',
      );
      expect(validarArchivoImagen(archivo('a.jpg', 0, 'image/jpeg'))).not.toBeNull();
    });

    it('sin tipo MIME usa la extensión', () => {
      expect(validarArchivoImagen(archivo('foto.PNG', 10, ''))).toBeNull();
      expect(validarArchivoImagen(archivo('foto.txt', 10, ''))).not.toBeNull();
    });

    it('reordena: mover, hacer principal y comparar órdenes', () => {
      const lista = ['a', 'b', 'c'];
      expect(moverElemento(lista, 1, -1)).toEqual(['b', 'a', 'c']);
      expect(moverElemento(lista, 2, 1)).toBe(lista);
      expect(moverElemento(lista, 0, -1)).toBe(lista);
      expect(hacerPrimero(lista, 2)).toEqual(['c', 'a', 'b']);
      expect(hacerPrimero(lista, 0)).toBe(lista);
      expect(mismoOrden(['a', 'b'], ['a', 'b'])).toBe(true);
      expect(mismoOrden(['a', 'b'], ['b', 'a'])).toBe(false);
      expect(mismoOrden(['a'], ['a', 'b'])).toBe(false);
    });

    it('la imagen principal es la marcada o, si falta, la primera', () => {
      const imagenes = [
        { id: 'b', url: '/b.jpg', orden: 1, principal: false },
        { id: 'a', url: '/a.jpg', orden: 0, principal: true },
      ];
      expect(imagenPrincipal({ imagenes })?.id).toBe('a');
      expect(imagenPrincipal({ imagenes: [] })).toBeNull();
      expect(
        imagenPrincipal({ imagenes: imagenes.map((i) => ({ ...i, principal: false })) })?.id,
      ).toBe('a');
    });
  });
});
