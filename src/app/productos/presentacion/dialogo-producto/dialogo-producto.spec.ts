import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { ApiMarcas } from '../../../marcas/aplicacion/puertos';
import { EstadoProductos } from '../../aplicacion/estado-productos';
import { ApiProductos } from '../../aplicacion/puertos';
import { Producto } from '../../dominio/producto';
import {
  ApiProductosFalsa,
  archivoPrueba,
  crearApiProductosFalsa,
  imagenPrueba,
  marcaPrueba,
  productoPrueba,
} from '../../pruebas/dobles-productos';
import { DialogoProducto } from './dialogo-producto';

@Component({
  selector: 'app-anfitrion',
  imports: [DialogoProducto, ConfirmDialogModule],
  providers: [ConfirmationService],
  template: `
    <p-confirmdialog />
    <app-dialogo-producto
      [(visible)]="visible"
      [producto]="producto()"
      (cambios)="cambios.set(cambios() + 1)"
      (guardado)="guardados.set([...guardados(), $event])"
    />
  `,
})
class Anfitrion {
  readonly visible = signal(false);
  readonly producto = signal<Producto | null>(null);
  readonly cambios = signal(0);
  readonly guardados = signal<readonly Producto[]>([]);
}

describe('DialogoProducto (RF-PRO-01, RF-PRO-02, RF-PRO-05, D-46)', () => {
  let api: ApiProductosFalsa;
  let fixture: ComponentFixture<Anfitrion>;

  const yanbal = marcaPrueba('m1', 'Yanbal');
  const avon = marcaPrueba('m2', 'Avon', { orden: 1 });
  const esika = marcaPrueba('m3', 'Esika', { orden: 2, activa: false });

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  const dialogo = () =>
    fixture.debugElement.query(By.directive(DialogoProducto)).componentInstance as DialogoProducto;
  const interno = () => dialogo() as unknown as Record<string, { (): unknown; set(v: unknown): void }>;
  const campo = <T extends HTMLElement>(selector: string) =>
    document.body.querySelector<T>(selector) as T;
  const boton = (id: string) =>
    document.body.querySelector<HTMLButtonElement>(`[data-prueba="${id}"] button`);
  const botonDeConfirmacion = (texto: string) =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('.p-confirmdialog button')).find((b) =>
      b.textContent?.includes(texto),
    );

  async function escribir(selector: string, texto: string): Promise<void> {
    const entrada = campo<HTMLInputElement>(selector);
    entrada.value = texto;
    entrada.dispatchEvent(new Event('input'));
    entrada.dispatchEvent(new Event('blur'));
    await estable();
  }

  async function abrir(producto: Producto | null = null): Promise<void> {
    fixture.componentInstance.producto.set(producto);
    fixture.componentInstance.visible.set(true);
    await estable();
  }

  async function rellenarValido(): Promise<void> {
    await escribir('#nombre-producto', 'Crema hidratante');
    interno()['marcaId']?.set('m1');
    await escribir('#precio-producto', '12,5');
  }

  beforeEach(async () => {
    api = crearApiProductosFalsa();
    let siguiente = 0;
    api.crear.mockImplementation((p) =>
      Promise.resolve(
        productoPrueba('nuevo', p.nombre, { precio: p.precio, descripcion: p.descripcion ?? '' }),
      ),
    );
    api.actualizar.mockImplementation((id, c) =>
      Promise.resolve(productoPrueba(id, c.nombre ?? 'Crema hidratante', { ...c })),
    );
    api.subirImagen.mockImplementation(() => Promise.resolve(imagenPrueba(`img${++siguiente}`, 0)));
    await TestBed.configureTestingModule({
      imports: [Anfitrion],
      providers: [
        EstadoMarcas,
        EstadoProductos,
        { provide: ApiMarcas, useValue: { listar: vi.fn().mockResolvedValue([yanbal, avon, esika]) } },
        { provide: ApiProductos, useValue: api },
      ],
    }).compileComponents();
    await TestBed.inject(EstadoMarcas).cargar();
    fixture = TestBed.createComponent(Anfitrion);
    await estable();
  });

  afterEach(() => fixture.destroy());

  describe('validación', () => {
    it('RNF-03: el precio con más de 2 decimales, cero o texto se rechaza y bloquea «Guardar»', async () => {
      await abrir();
      await rellenarValido();
      expect(boton('guardar')?.disabled).toBe(false);

      for (const invalido of ['12.505', '0', '0.00', 'abc', '-3', '100000']) {
        await escribir('#precio-producto', invalido);
        expect(campo('[data-prueba="error-precio"]'), invalido).not.toBeNull();
        expect(boton('guardar')?.disabled, invalido).toBe(true);
      }

      await escribir('#precio-producto', '99999.99');
      expect(document.body.querySelector('[data-prueba="error-precio"]')).toBeNull();
      expect(boton('guardar')?.disabled).toBe(false);
    });

    it('el nombre es obligatorio (mínimo 2 caracteres)', async () => {
      await abrir();
      await escribir('#nombre-producto', 'A');
      expect(campo('[data-prueba="error-nombre"]').textContent).toContain('al menos 2');
      expect(boton('guardar')?.disabled).toBe(true);
    });

    it('«Guardar» sigue deshabilitado sin marca elegida', async () => {
      await abrir();
      await escribir('#nombre-producto', 'Crema');
      await escribir('#precio-producto', '5');
      expect(boton('guardar')?.disabled).toBe(true);
    });

    it('RF-PRO-04: solo ofrece marcas activas', async () => {
      await abrir();
      const opciones = (interno()['opcionesMarca'] as unknown as () => { nombre: string }[])();
      expect(opciones.map((o) => o.nombre)).toEqual(['Yanbal', 'Avon']);
    });

    it('al editar un producto de una marca inactiva, esa marca aparece deshabilitada', async () => {
      const producto = productoPrueba('p1', 'Crema', {
        marca: { ...productoPrueba('x', 'x').marca, id: 'm3', nombre: 'Esika' },
      });
      await abrir(producto);
      const opciones = (
        interno()['opcionesMarca'] as unknown as () => { nombre: string; inactiva: boolean }[]
      )();
      expect(opciones.at(-1)).toMatchObject({ nombre: 'Esika', inactiva: true });
    });
  });

  describe('crear (CA-04)', () => {
    it('CA-04: crea con precio como texto de 2 decimales y sube las imágenes en el orden mostrado', async () => {
      await abrir();
      await rellenarValido();
      dialogo().agregarArchivos([archivoPrueba('a.png'), archivoPrueba('b.jpg', 500, 'image/jpeg')]);
      await estable();
      boton('guardar')?.click();
      await estable();

      expect(api.crear).toHaveBeenCalledWith({
        nombre: 'Crema hidratante',
        marcaId: 'm1',
        precio: '12.50',
        descripcion: '',
        disponibilidad: 'DISPONIBLE',
      });
      expect(api.crear).toHaveBeenCalledTimes(1);
      expect(api.subirImagen.mock.calls.map(([id, f]) => [id, f.name])).toEqual([
        ['nuevo', 'a.png'],
        ['nuevo', 'b.jpg'],
      ]);
      // El orden subido ya es el deseado: no hace falta PUT /orden.
      expect(api.ordenarImagenes).not.toHaveBeenCalled();
      expect(fixture.componentInstance.visible()).toBe(false);
      expect(fixture.componentInstance.guardados()).toHaveLength(1);
      expect(fixture.componentInstance.cambios()).toBeGreaterThan(0);
    });

    it('elegir otra imagen como principal sube todo y luego envía el orden con PUT', async () => {
      await abrir();
      await rellenarValido();
      dialogo().agregarArchivos([archivoPrueba('a.png'), archivoPrueba('b.png')]);
      await estable();
      boton('hacer-principal')?.click();
      await estable();
      boton('guardar')?.click();
      await estable();

      expect(api.subirImagen.mock.calls.map(([, f]) => f.name)).toEqual(['b.png', 'a.png']);
      expect(api.ordenarImagenes).not.toHaveBeenCalled();
    });

    it('422 MARCA_INACTIVA: avisa junto a la marca y el diálogo sigue abierto', async () => {
      api.crear.mockRejectedValue(
        new ErrorApi('MARCA_INACTIVA', 'La marca está desactivada.', 422),
      );
      await abrir();
      await rellenarValido();
      boton('guardar')?.click();
      await estable();

      expect(campo('[data-prueba="error-marca"]').textContent).toContain('desactivada');
      expect(campo('[data-prueba="error-general"]').textContent).toContain('desactivada');
      expect(fixture.componentInstance.visible()).toBe(true);
    });

    it('400 DATOS_INVALIDOS: muestra el error junto al campo', async () => {
      api.crear.mockRejectedValue(
        new ErrorApi('DATOS_INVALIDOS', 'Datos inválidos.', 400, {
          errores: [{ campo: 'precio', errores: ['El precio no es válido.'] }],
        }),
      );
      await abrir();
      await rellenarValido();
      boton('guardar')?.click();
      await estable();
      expect(campo('[data-prueba="error-precio"]').textContent).toContain('El precio no es válido.');
    });

    it('404 NO_ENCONTRADO al crear: la marca ya no existe', async () => {
      api.crear.mockRejectedValue(new ErrorApi('NO_ENCONTRADO', 'No existe.', 404));
      await abrir();
      await rellenarValido();
      boton('guardar')?.click();
      await estable();
      expect(campo('[data-prueba="error-general"]').textContent).toContain('La marca elegida ya no existe');
    });

    it('si falla una subida, el producto ya existe: reintentar no lo crea otra vez', async () => {
      api.subirImagen
        .mockRejectedValueOnce(
          new ErrorApi('TIPO_NO_ADMITIDO', 'No es una imagen.', 415),
        )
        .mockResolvedValueOnce(imagenPrueba('imgBuena', 1))
        .mockResolvedValueOnce(imagenPrueba('imgMala', 2));
      await abrir();
      await rellenarValido();
      dialogo().agregarArchivos([archivoPrueba('mala.png'), archivoPrueba('buena.png')]);
      await estable();
      boton('guardar')?.click();
      await estable();

      expect(fixture.componentInstance.visible()).toBe(true);
      expect(campo('[data-prueba="error-general"]').textContent).toContain('una imagen no se subió');
      expect(campo('[data-prueba="error-item"]').textContent).toContain('no es una imagen válida');
      expect(document.body.querySelector('.p-dialog')?.textContent).toContain('Editar producto');

      boton('guardar')?.click();
      await estable();
      expect(api.crear).toHaveBeenCalledTimes(1);
      expect(api.subirImagen).toHaveBeenCalledTimes(3); // mala, buena y reintento de la mala
      // El orden mostrado era [mala, buena] y el servidor tiene [buena, mala]: se corrige con PUT.
      expect(api.ordenarImagenes).toHaveBeenCalledWith('nuevo', ['imgMala', 'imgBuena']);
      expect(fixture.componentInstance.visible()).toBe(false);
    });
  });

  describe('imágenes (D-46)', () => {
    it('rechaza en el cliente los tipos no admitidos y los archivos de más de 2 MB', async () => {
      await abrir();
      dialogo().agregarArchivos([
        archivoPrueba('animada.gif', 1000, 'image/gif'),
        archivoPrueba('enorme.png', 3 * 1024 * 1024),
        archivoPrueba('buena.webp', 1000, 'image/webp'),
      ]);
      await estable();

      const avisos = Array.from(
        document.body.querySelectorAll('[data-prueba="error-imagen"]'),
      ).map((a) => a.textContent);
      expect(avisos).toHaveLength(2);
      expect(avisos[0]).toContain('animada.gif');
      expect(avisos[1]).toContain('2 MB');
      expect(document.body.querySelectorAll('[data-prueba="imagen"]')).toHaveLength(1);
    });

    it('admite como máximo 5 imágenes', async () => {
      await abrir();
      dialogo().agregarArchivos(['1', '2', '3', '4', '5', '6'].map((n) => archivoPrueba(`${n}.png`)));
      await estable();
      expect(document.body.querySelectorAll('[data-prueba="imagen"]')).toHaveLength(5);
      expect(campo('[data-prueba="error-imagen"]').textContent).toContain('hasta 5 imágenes');
      expect(document.body.querySelector('[data-prueba="imagenes"]')?.textContent).toContain('5 de 5');
    });

    it('la primera es la principal; se puede elegir otra y reordenar', async () => {
      await abrir();
      dialogo().agregarArchivos([archivoPrueba('a.png'), archivoPrueba('b.png'), archivoPrueba('c.png')]);
      await estable();
      const nombres = () =>
        Array.from(document.body.querySelectorAll('.p-dialog [data-prueba="imagen"] strong, .p-dialog [data-prueba="imagen"] .cs-dialogo-producto__nombre-imagen')).map(
          (n) => n.textContent?.trim(),
        );
      expect(nombres()).toEqual(['a.png', 'b.png', 'c.png']);
      expect(document.body.querySelectorAll('[data-prueba="etiqueta-principal"]')).toHaveLength(1);

      document.body.querySelectorAll<HTMLButtonElement>('[data-prueba="hacer-principal"] button')[1]?.click();
      await estable();
      expect(nombres()).toEqual(['c.png', 'a.png', 'b.png']);

      document.body.querySelectorAll<HTMLButtonElement>('[data-prueba="bajar-imagen"] button')[0]?.click();
      await estable();
      expect(nombres()).toEqual(['a.png', 'c.png', 'b.png']);
    });

    it('al editar, un cambio de orden se envía con PUT con todos los ids', async () => {
      const producto = productoPrueba('p1', 'Crema hidratante', {
        imagenes: [imagenPrueba('i1', 0), imagenPrueba('i2', 1), imagenPrueba('i3', 2)],
      });
      await abrir(producto);
      document.body.querySelectorAll<HTMLButtonElement>('[data-prueba="hacer-principal"] button')[1]?.click();
      await estable();
      boton('guardar')?.click();
      await estable();

      expect(api.ordenarImagenes).toHaveBeenCalledWith('p1', ['i3', 'i1', 'i2']);
      expect(api.actualizar).not.toHaveBeenCalled();
      expect(fixture.componentInstance.visible()).toBe(false);
    });

    it('RNF-12: quitar una imagen guardada pide confirmación; al cancelar no se borra', async () => {
      await abrir(productoPrueba('p1', 'Crema', { imagenes: [imagenPrueba('i1', 0), imagenPrueba('i2', 1)] }));
      document.body.querySelectorAll<HTMLButtonElement>('[data-prueba="quitar-imagen"] button')[1]?.click();
      await estable();
      expect(document.body.textContent).toContain('Quitar imagen');
      botonDeConfirmacion('Cancelar')?.click();
      await estable();
      expect(api.eliminarImagen).not.toHaveBeenCalled();
      expect(document.body.querySelectorAll('[data-prueba="imagen"]')).toHaveLength(2);
    });

    it('al confirmar, borra la imagen con DELETE y la saca de la lista', async () => {
      await abrir(productoPrueba('p1', 'Crema', { imagenes: [imagenPrueba('i1', 0), imagenPrueba('i2', 1)] }));
      document.body.querySelectorAll<HTMLButtonElement>('[data-prueba="quitar-imagen"] button')[1]?.click();
      await estable();
      botonDeConfirmacion('Quitar')?.click();
      await estable();
      expect(api.eliminarImagen).toHaveBeenCalledWith('p1', 'i2');
      expect(document.body.querySelectorAll('[data-prueba="imagen"]')).toHaveLength(1);
      expect(fixture.componentInstance.cambios()).toBe(1);
    });

    it('si el servidor no puede borrar la imagen, la deja y explica por qué', async () => {
      api.eliminarImagen.mockRejectedValue(new ErrorApi('NO_ENCONTRADO', 'No existe.', 404));
      await abrir(productoPrueba('p1', 'Crema', { imagenes: [imagenPrueba('i1', 0)] }));
      document.body.querySelector<HTMLButtonElement>('[data-prueba="quitar-imagen"] button')?.click();
      await estable();
      botonDeConfirmacion('Quitar')?.click();
      await estable();
      expect(campo('[data-prueba="error-imagen"]').textContent).toContain('No se pudo quitar la imagen');
      expect(document.body.querySelectorAll('[data-prueba="imagen"]')).toHaveLength(1);
    });
  });

  describe('editar (CA-05, CA-07)', () => {
    const existente = productoPrueba('p1', 'Crema hidratante', { precio: '12.50' });

    it('CA-05: cambiar solo el precio envía únicamente el precio', async () => {
      await abrir(existente);
      await escribir('#precio-producto', '15');
      boton('guardar')?.click();
      await estable();
      expect(api.actualizar).toHaveBeenCalledWith('p1', { precio: '15.00' });
      expect(api.crear).not.toHaveBeenCalled();
      expect(fixture.componentInstance.visible()).toBe(false);
    });

    it('CA-07: cambiar la disponibilidad se envía como PATCH', async () => {
      await abrir(existente);
      interno()['disponibilidad']?.set('AGOTADO');
      await estable();
      boton('guardar')?.click();
      await estable();
      expect(api.actualizar).toHaveBeenCalledWith('p1', { disponibilidad: 'AGOTADO' });
    });

    it('sin cambios no llama a la API y cierra', async () => {
      await abrir(existente);
      boton('guardar')?.click();
      await estable();
      expect(api.actualizar).not.toHaveBeenCalled();
      expect(fixture.componentInstance.visible()).toBe(false);
    });

    it('404 al editar: el producto ya no existe', async () => {
      api.actualizar.mockRejectedValue(new ErrorApi('NO_ENCONTRADO', 'No existe.', 404));
      await abrir(existente);
      await escribir('#nombre-producto', 'Otro nombre');
      boton('guardar')?.click();
      await estable();
      expect(campo('[data-prueba="error-general"]').textContent).toContain('No encontramos este producto');
      expect(fixture.componentInstance.visible()).toBe(true);
    });
  });
});
