import {
  codigoDeNombre,
  emparejarFotos,
  minutosEstimados,
  PAUSA_ENTRE_SUBIDAS_MS,
  ProductoParaFotos,
  resumenLote,
  revisarLote,
  textoAviso,
} from './fotos-lote';
import { DatosArchivo } from './producto';

const foto = (name: string, size = 50_000, type = 'image/jpeg'): DatosArchivo => ({ name, size, type });

const producto = (id: string, codigo: string | null, fotosActuales = 0): ProductoParaFotos => ({
  id,
  nombre: `Producto ${id}`,
  codigo,
  fotosActuales,
});

describe('Fotos en lote: código en el nombre del archivo (DEC-07)', () => {
  it('lee el código antes de -, _, espacio o paréntesis, sin la extensión y en mayúsculas', () => {
    expect(codigoDeNombre('12345.jpg')).toBe('12345');
    expect(codigoDeNombre('12345-2.jpg')).toBe('12345');
    expect(codigoDeNombre('12345_b.PNG')).toBe('12345');
    expect(codigoDeNombre('12345 (2).webp')).toBe('12345');
    expect(codigoDeNombre('ab12-frente.jpg')).toBe('AB12');
    expect(codigoDeNombre('carpeta/sub/7788.jpg')).toBe('7788');
    expect(codigoDeNombre('  4455.jpeg')).toBe('4455');
  });

  it('sin letras ni números al inicio o con un código de más de 20 caracteres → null', () => {
    expect(codigoDeNombre('-12345.jpg')).toBeNull();
    expect(codigoDeNombre('(1).jpg')).toBeNull();
    expect(codigoDeNombre('.jpg')).toBeNull();
    expect(codigoDeNombre(`${'1'.repeat(21)}.jpg`)).toBeNull();
    expect(codigoDeNombre('ñandú.jpg')).toBeNull();
  });
});

describe('Fotos en lote: emparejar y revisar (RF-PRO-01, D-46)', () => {
  const productos = [producto('p1', '12345'), producto('p2', 'AB12', 4), producto('p3', null)];

  it('empareja por código sin distinguir mayúsculas y ordena de forma natural (la principal primero)', () => {
    const fotos = emparejarFotos(
      [foto('12345-10.jpg'), foto('ab12.jpg'), foto('12345.jpg'), foto('12345-2.jpg')],
      productos,
    );

    expect(fotos.map((f) => f.nombre)).toEqual(['12345.jpg', '12345-2.jpg', '12345-10.jpg', 'ab12.jpg']);
    expect(fotos.map((f) => f.productoId)).toEqual(['p1', 'p1', 'p1', 'p2']);
    expect(fotos.map((f) => f.clave)).toEqual([2, 3, 0, 1]);
    expect(revisarLote(fotos, productos).every((f) => f.lista)).toBe(true);
  });

  it('sin código, código desconocido o repetido en dos productos → hay que elegir el producto', () => {
    const conRepetido = [...productos, producto('p4', '12345')];
    const revisadas = revisarLote(
      emparejarFotos([foto('(1) foto.jpg'), foto('99999.jpg'), foto('12345.jpg')], conRepetido),
      conRepetido,
    );

    // Orden: sin código primero y luego por código (12345 antes que 99999).
    expect(revisadas.map((f) => [f.nombre, f.avisos])).toEqual([
      ['(1) foto.jpg', ['SIN_CODIGO']],
      ['12345.jpg', ['CODIGO_AMBIGUO']],
      ['99999.jpg', ['CODIGO_DESCONOCIDO']],
    ]);
    // Un nombre como «foto.jpg» se lee como el código FOTO, que no existe.
    expect(revisarLote(emparejarFotos([foto('foto.jpg')], productos), productos)[0].avisos).toEqual([
      'CODIGO_DESCONOCIDO',
    ]);
    expect(revisadas.some((f) => f.lista)).toBe(false);
    expect(textoAviso('CODIGO_AMBIGUO')).toContain('elige el producto');
  });

  it('al elegir el producto a mano, el aviso del código desaparece y la foto queda lista', () => {
    const [sinCodigo] = emparejarFotos([foto('IMG_0001.jpg')], productos);
    const [revisada] = revisarLote([{ ...sinCodigo, productoId: 'p3' }], productos);

    expect(revisada.avisos).toEqual([]);
    expect(revisada.lista).toBe(true);
  });

  it('respeta el cupo de 5: cuenta las que el producto ya tiene y las del lote, en orden', () => {
    // p2 ya tiene 4 fotos: solo entra una más.
    const revisadas = revisarLote(
      emparejarFotos([foto('ab12.jpg'), foto('ab12-2.jpg'), foto('ab12-3.jpg')], productos),
      productos,
    );

    expect(revisadas.map((f) => f.lista)).toEqual([true, false, false]);
    expect(revisadas[1].avisos).toEqual(['SIN_CUPO']);
  });

  it('una foto quitada libera su cupo para la siguiente', () => {
    const fotos = emparejarFotos([foto('ab12.jpg'), foto('ab12-2.jpg')], productos);
    const revisadas = revisarLote([{ ...fotos[0], excluida: true }, fotos[1]], productos);

    expect(revisadas.map((f) => f.lista)).toEqual([false, true]);
    expect(resumenLote(revisadas)).toEqual({ listas: 1, conAviso: 0, excluidas: 1, productos: 1 });
  });

  it('archivo no admitido o elegido dos veces → no se sube', () => {
    const revisadas = revisarLote(
      emparejarFotos(
        [foto('12345.gif', 10, 'image/gif'), foto('12345.jpg', 3 * 1024 * 1024), foto('12345-2.jpg'), foto('12345-2.jpg')],
        productos,
      ),
      productos,
    );
    const porNombre = new Map(revisadas.map((f) => [`${f.nombre}|${f.tamano}`, f]));

    expect(porNombre.get('12345.gif|10')?.avisos).toContain('ARCHIVO_NO_VALIDO');
    expect(porNombre.get(`12345.jpg|${3 * 1024 * 1024}`)?.errorArchivo).toContain('más de 2 MB');
    expect(revisadas.filter((f) => f.nombre === '12345-2.jpg').map((f) => f.avisos)).toEqual([[], ['DUPLICADA']]);
    expect(resumenLote(revisadas)).toMatchObject({ listas: 1, conAviso: 3 });
  });

  it('30 por minuto: 2 s entre subidas y minutos estimados', () => {
    expect(PAUSA_ENTRE_SUBIDAS_MS).toBe(2000);
    expect(minutosEstimados(1)).toBe(1);
    expect(minutosEstimados(78)).toBe(3);
  });
});
