import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { ApiMarcas } from '../../../marcas/aplicacion/puertos';
import { EstadoProductos } from '../../aplicacion/estado-productos';
import { ApiProductos } from '../../aplicacion/puertos';
import {
  API_PRUEBA,
  ApiProductosFalsa,
  crearApiProductosFalsa,
  imagenPrueba,
  marcaPrueba,
  paginaPrueba,
  productoPrueba,
} from '../../pruebas/dobles-productos';
import { MENSAJE_ELIMINAR, Productos, RETARDO_BUSQUEDA_MS } from './productos';

describe('Productos (RF-PRO-01 a RF-PRO-05, RF-INV-03)', () => {
  let api: ApiProductosFalsa;
  let avisos: { add: ReturnType<typeof vi.fn> };
  let fixture: ComponentFixture<Productos>;
  let elemento: HTMLElement;

  const crema = productoPrueba('p1', 'Crema hidratante', {
    precio: '12.5',
    imagenes: [imagenPrueba('i1', 0)],
  });
  const labial = productoPrueba('p2', 'Labial rojo', {
    precio: '8.90',
    disponibilidad: 'AGOTADO',
    marca: {
      id: 'm2',
      nombre: 'Avon',
      color: '#FF2469',
      colorAcento: null,
      textoSobreColor: '#0F172A',
      textoSobreAcento: null,
    },
  });
  const perfume = productoPrueba('p3', 'Perfume', { disponibilidad: 'PENDIENTE_REPOSICION' });

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  async function crear(): Promise<void> {
    avisos = { add: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [Productos],
      providers: [
        { provide: MessageService, useValue: avisos },
        EstadoMarcas,
        EstadoProductos,
        {
          provide: ApiMarcas,
          useValue: {
            listar: vi
              .fn()
              .mockResolvedValue([
                marcaPrueba('m1', 'Yanbal'),
                marcaPrueba('m2', 'Avon', { orden: 1 }),
                marcaPrueba('m3', 'Esika', { orden: 2, activa: false }),
              ]),
          },
        },
        { provide: ApiProductos, useValue: api },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Productos);
    elemento = fixture.nativeElement as HTMLElement;
    await estable();
  }

  beforeEach(async () => {
    // jsdom no trae matchMedia y el panel de `p-select` lo consulta al abrirse.
    window.matchMedia ??= ((consulta: string) =>
      ({
        matches: false,
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    api = crearApiProductosFalsa();
    api.listar.mockResolvedValue(paginaPrueba([crema, labial, perfume]));
    await crear();
  });

  afterEach(() => fixture.destroy());

  const filas = () =>
    Array.from(elemento.querySelectorAll<HTMLElement>('[data-prueba="fila-producto"]'));
  const boton = (fila: number, id: string) =>
    filas()[fila]?.querySelector<HTMLButtonElement>(`[data-prueba="${id}"] button`);
  const botonDeConfirmacion = (texto: string) =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('.p-confirmdialog button')).find((b) =>
      b.textContent?.includes(texto),
    );

  /** Abre un `p-select` y elige una opción por su texto (el panel se agrega al <body>). */
  async function elegir(idPrueba: string, texto: string): Promise<void> {
    elemento.querySelector<HTMLElement>(`[data-prueba="${idPrueba}"]`)?.click();
    await estable();
    const opcion = Array.from(document.body.querySelectorAll<HTMLElement>('.p-select-option')).find(
      (o) => o.textContent?.trim() === texto,
    );
    expect(opcion, `opción «${texto}»`).toBeDefined();
    opcion?.click();
    await estable();
  }

  it('RF-PRO-01: pide la primera página al servidor y muestra miniatura, nombre, marca, precio y disponibilidad', () => {
    expect(api.listar).toHaveBeenCalledTimes(1);
    expect(api.listar).toHaveBeenCalledWith({ pagina: 1, tamanio: 20 });
    expect(filas()).toHaveLength(3);

    const miniatura = filas()[0]?.querySelector<HTMLImageElement>('[data-prueba="miniatura"]');
    expect(miniatura?.getAttribute('src')).toBe(`${API_PRUEBA}/api/v1/imagenes/i1.png`);
    expect(miniatura?.alt).toContain('Crema hidratante');
    expect(filas()[1]?.querySelector('[data-prueba="sin-imagen"]')).not.toBeNull();

    expect(filas()[0]?.querySelector('[data-prueba="nombre-producto"]')?.textContent).toContain(
      'Crema hidratante',
    );
    const marca = filas()[1]?.querySelector<HTMLElement>('[data-prueba="marca-producto"]');
    expect(marca?.textContent).toContain('Avon');
    expect(marca?.style.backgroundColor).toBe('rgb(255, 36, 105)');
    expect(marca?.style.color).toBe('rgb(15, 23, 42)');
  });

  it('muestra el precio como texto exacto «$12.50», sin números de punto flotante', () => {
    expect(filas()[0]?.querySelector('[data-prueba="precio-producto"]')?.textContent?.trim()).toBe(
      '$12.50',
    );
    expect(filas()[1]?.querySelector('[data-prueba="precio-producto"]')?.textContent?.trim()).toBe(
      '$8.90',
    );
  });

  it('RF-PRO-05, RN-09: la disponibilidad se ve con p-tag en sus 3 estados', () => {
    const textos = filas().map((f) =>
      f.querySelector('[data-prueba="etiqueta-disponibilidad"]')?.textContent?.trim(),
    );
    expect(textos).toEqual(['Disponible', 'Agotado', 'Pendiente de reposición']);
  });

  describe('filtros y búsqueda (RF-CAT-03)', () => {
    it('filtra por marca y vuelve a la primera página', async () => {
      await elegir('filtro-marca', 'Avon');
      expect(api.listar).toHaveBeenLastCalledWith({ pagina: 1, tamanio: 20, marcaId: 'm2' });
    });

    it('el filtro de marca incluye las marcas inactivas, señaladas', async () => {
      elemento.querySelector<HTMLElement>('[data-prueba="filtro-marca"]')?.click();
      await estable();
      const textos = Array.from(document.body.querySelectorAll('.p-select-option')).map((o) =>
        o.textContent?.trim(),
      );
      expect(textos).toEqual(['Yanbal', 'Avon', 'Esika (inactiva)']);
    });

    it('filtra por disponibilidad', async () => {
      await elegir('filtro-disponibilidad', 'Agotado');
      expect(api.listar).toHaveBeenLastCalledWith({
        pagina: 1,
        tamanio: 20,
        disponibilidad: 'AGOTADO',
      });
    });

    it('busca con retardo: una sola consulta tras la última tecla', async () => {
      const campo = elemento.querySelector<HTMLInputElement>('[data-prueba="busqueda"]');
      for (const texto of ['c', 'cr', 'crema']) {
        campo!.value = texto;
        campo!.dispatchEvent(new Event('input'));
      }
      await estable();
      expect(api.listar).toHaveBeenCalledTimes(1);

      await new Promise((resolver) => setTimeout(resolver, RETARDO_BUSQUEDA_MS + 100));
      await estable();
      expect(api.listar).toHaveBeenCalledTimes(2);
      expect(api.listar).toHaveBeenLastCalledWith({ pagina: 1, tamanio: 20, busqueda: 'crema' });
    });

    it('CA-11: sin resultados ofrece limpiar los filtros y vuelve a consultar sin ellos', async () => {
      api.listar.mockResolvedValue(paginaPrueba([]));
      await elegir('filtro-disponibilidad', 'Agotado');

      const vacio = elemento.querySelector('[data-prueba="productos-vacio"]');
      expect(vacio?.textContent).toContain('No encontramos productos con esos filtros');

      elemento.querySelector<HTMLButtonElement>('[data-prueba="limpiar-vacio"] button')?.click();
      await estable();
      expect(api.listar).toHaveBeenLastCalledWith({ pagina: 1, tamanio: 20 });
    });

    it('sin productos ni filtros invita a crear el primero', async () => {
      api.listar.mockResolvedValue(paginaPrueba([]));
      await fixture.componentInstance['estado'].cargar();
      await estable();
      const vacio = elemento.querySelector('[data-prueba="productos-vacio"]');
      expect(vacio?.textContent).toContain('Todavía no hay productos');
      expect(vacio?.querySelector('[data-prueba="nuevo-vacio"]')).not.toBeNull();
    });
  });

  describe('paginación del servidor', () => {
    it('pide la página 2 con el siguiente del paginador', async () => {
      api.listar.mockResolvedValue(paginaPrueba([crema, labial, perfume], {}, 45));
      await fixture.componentInstance['estado'].cargar();
      await estable();
      expect(elemento.textContent).toContain('de 45 productos');

      elemento.querySelector<HTMLButtonElement>('.p-paginator-next')?.click();
      await estable();
      expect(api.listar).toHaveBeenLastCalledWith({ pagina: 2, tamanio: 20 });
    });
  });

  describe('error al cargar', () => {
    it('muestra un mensaje claro con «Reintentar»', async () => {
      api.listar.mockRejectedValueOnce(
        new ErrorApi('SIN_CONEXION', 'No se pudo conectar con el servidor.', 0),
      );
      await fixture.componentInstance['estado'].cargar();
      await estable();
      const error = elemento.querySelector('[data-prueba="error-lista"]');
      expect(error?.textContent).toContain('No se pudo conectar');

      error?.querySelector<HTMLButtonElement>('button')?.click();
      await estable();
      expect(elemento.querySelector('[data-prueba="error-lista"]')).toBeNull();
      expect(filas()).toHaveLength(3);
    });
  });

  describe('disponibilidad rápida (RF-PRO-05, CA-07)', () => {
    it('CA-07: cambia con PATCH y la fila refleja la respuesta del servidor', async () => {
      api.actualizar.mockResolvedValue({ ...crema, disponibilidad: 'AGOTADO' });
      await fixture.componentInstance.cambiarDisponibilidad(crema, 'AGOTADO');
      await estable();

      expect(api.actualizar).toHaveBeenCalledWith('p1', { disponibilidad: 'AGOTADO' });
      expect(
        filas()[0]?.querySelector('[data-prueba="etiqueta-disponibilidad"]')?.textContent?.trim(),
      ).toBe('Agotado');
      expect(avisos.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Disponibilidad actualizada' }),
      );
    });

    it('se puede elegir desde el selector de la fila', async () => {
      api.actualizar.mockResolvedValue({ ...crema, disponibilidad: 'PENDIENTE_REPOSICION' });
      filas()[0]?.querySelector<HTMLElement>('.p-select')?.click();
      await estable();
      const opcion = Array.from(document.body.querySelectorAll<HTMLElement>('.p-select-option')).find(
        (o) => o.textContent?.includes('Pendiente de reposición'),
      );
      opcion?.click();
      await estable();
      expect(api.actualizar).toHaveBeenCalledWith('p1', { disponibilidad: 'PENDIENTE_REPOSICION' });
    });

    it('si el servidor rechaza el cambio, avisa y vuelve a consultar', async () => {
      api.actualizar.mockRejectedValue(
        new ErrorApi('ACCESO_DENEGADO', 'Sin permiso.', 403),
      );
      await fixture.componentInstance.cambiarDisponibilidad(crema, 'AGOTADO');
      await estable();
      expect(avisos.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'No tienes permiso para esta acción.' }),
      );
      expect(api.listar).toHaveBeenCalledTimes(2);
    });

    it('no llama a la API si la disponibilidad no cambia', async () => {
      await fixture.componentInstance.cambiarDisponibilidad(crema, 'DISPONIBLE');
      expect(api.actualizar).not.toHaveBeenCalled();
    });
  });

  describe('eliminar (RF-PRO-03, CA-06, RNF-12)', () => {
    it('RNF-12: pide confirmación y no elimina si se cancela', async () => {
      boton(0, 'eliminar')?.click();
      await estable();
      expect(document.body.textContent).toContain(MENSAJE_ELIMINAR);
      expect(document.body.textContent).toContain('Eliminar Crema hidratante');
      botonDeConfirmacion('Cancelar')?.click();
      await estable();
      expect(api.eliminar).not.toHaveBeenCalled();
      expect(filas()).toHaveLength(3);
    });

    it('CA-06: al confirmar llama a DELETE y recarga el listado', async () => {
      api.listar.mockResolvedValue(paginaPrueba([labial, perfume]));
      boton(0, 'eliminar')?.click();
      await estable();
      botonDeConfirmacion('Eliminar')?.click();
      await estable();

      expect(api.eliminar).toHaveBeenCalledWith('p1');
      expect(api.listar).toHaveBeenCalledTimes(2);
      expect(filas()).toHaveLength(2);
      expect(avisos.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Producto eliminado' }),
      );
    });

    it('404 al eliminar: explica que ya no existe y actualiza la lista', async () => {
      api.eliminar.mockRejectedValue(new ErrorApi('NO_ENCONTRADO', 'No existe.', 404));
      await fixture.componentInstance.eliminar(crema);
      await estable();
      expect(avisos.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: expect.stringContaining('No encontramos este producto'),
        }),
      );
      expect(api.listar).toHaveBeenCalledTimes(2);
    });
  });

  describe('crear y editar', () => {
    it('«Nuevo producto» abre el diálogo vacío', async () => {
      elemento.querySelector<HTMLButtonElement>('[data-prueba="nuevo-producto"] button')?.click();
      await estable();
      const dialogo = document.body.querySelector('.p-dialog');
      expect(dialogo?.textContent).toContain('Nuevo producto');
      expect(document.body.querySelector<HTMLInputElement>('#nombre-producto')?.value).toBe('');
    });

    it('«Editar» abre el diálogo con los datos del producto', async () => {
      boton(0, 'editar')?.click();
      await estable();
      expect(document.body.querySelector('.p-dialog')?.textContent).toContain('Editar producto');
      expect(document.body.querySelector<HTMLInputElement>('#nombre-producto')?.value).toBe(
        'Crema hidratante',
      );
      expect(document.body.querySelector<HTMLInputElement>('#precio-producto')?.value).toBe('12.5');
    });
  });
});

