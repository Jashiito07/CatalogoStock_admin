import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Mock } from 'vitest';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { EstadoMarcas } from '../../aplicacion/estado-marcas';
import { ApiMarcas } from '../../aplicacion/puertos';
import { CambiosMarca, Marca, MarcaSugerida, NuevaMarca } from '../../dominio/marca';
import { DialogoMarca } from './dialogo-marca';

/** Forma de `GET /marcas/sugeridas` (D-56): los colores oficiales vienen del servidor. */
const SUGERIDAS: MarcaSugerida[] = [
  { nombre: 'Avon', color: '#FF2469', colorAcento: null, yaCreada: false },
  { nombre: "L'Bel", color: '#2E1A47', colorAcento: null, yaCreada: false },
  { nombre: 'Leonisa', color: '#222221', colorAcento: '#F36E21', yaCreada: false },
];

function marca(id: string, nombre: string, parcial: Partial<Marca> = {}): Marca {
  return {
    id,
    nombre,
    color: '#2563EB',
    colorAcento: null,
    textoSobreColor: '#FFFFFF',
    textoSobreAcento: null,
    activa: true,
    orden: 0,
    creadaEn: '2026-11-11T10:00:00Z',
    ...parcial,
  };
}

describe('DialogoMarca · colores fijos de marcas conocidas (D-56, RF-PRO-06)', () => {
  let crear: Mock<(m: NuevaMarca) => Promise<Marca>>;
  let actualizar: Mock<(id: string, c: CambiosMarca) => Promise<Marca>>;
  let fixture: ComponentFixture<DialogoMarca>;

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  async function abrir(existente: Marca | null = null): Promise<void> {
    fixture.componentRef.setInput('marca', existente);
    fixture.componentRef.setInput('visible', true);
    await estable();
  }

  async function escribirNombre(texto: string): Promise<void> {
    const entrada = document.body.querySelector<HTMLInputElement>('#nombre-marca');
    entrada!.value = texto;
    entrada!.dispatchEvent(new Event('input'));
    await estable();
  }

  async function escribirHex(texto: string): Promise<void> {
    const hex = document.body.querySelector<HTMLInputElement>('[data-prueba="selector-hex"]');
    hex!.value = texto;
    hex!.dispatchEvent(new Event('input'));
    await estable();
  }

  const hexs = () =>
    Array.from(document.body.querySelectorAll<HTMLInputElement>('[data-prueba="selector-hex"]'));
  const nota = () => document.body.querySelector<HTMLElement>('[data-prueba="nota-color-fijo"]');
  const agregarAcento = () =>
    document.body.querySelector<HTMLButtonElement>('[data-prueba="agregar-acento"] button');
  const guardar = async () => {
    document.body.querySelector<HTMLButtonElement>('[data-prueba="guardar"] button')?.click();
    await estable();
  };

  beforeEach(async () => {
    crear = vi.fn((m: NuevaMarca) => Promise.resolve(marca('n', m.nombre, { ...m })));
    actualizar = vi.fn((id: string, c: CambiosMarca) => Promise.resolve(marca(id, 'X', { ...c })));
    await TestBed.configureTestingModule({
      imports: [DialogoMarca],
      providers: [
        EstadoMarcas,
        {
          provide: ApiMarcas,
          useValue: {
            crear,
            actualizar,
            listar: vi.fn(),
            sugeridas: () => Promise.resolve(SUGERIDAS),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DialogoMarca);
  });

  afterEach(() => fixture.destroy());

  it('crear: escribir «Avon» pone su color oficial y bloquea los campos con la nota', async () => {
    await abrir();
    expect(nota()).toBeNull();
    expect(hexs()[0]?.disabled).toBe(false);

    await escribirNombre('Avon');

    expect(hexs()[0]?.value).toBe('#FF2469');
    expect(hexs()[0]?.disabled).toBe(true);
    expect(nota()?.textContent).toContain('Los colores de Avon son fijos.');
    expect(hexs()[0]?.getAttribute('aria-describedby')).toBe(nota()?.id);
    expect(agregarAcento()?.disabled).toBe(true);
    expect(
      document.body.querySelector(
        '[data-prueba="selector-visual"] input, [data-prueba="selector-visual"]',
      ),
    ).not.toBeNull();
    expect(document.body.querySelector('[data-prueba="vista-previa"]')?.textContent).toContain(
      'Contraste',
    );
  });

  it('crear: reconoce variantes (L´Bel, lbel, mayúsculas) y envía el nombre y colores oficiales', async () => {
    await abrir();
    await escribirNombre('l´bel');
    expect(nota()?.textContent).toContain("Los colores de L'Bel son fijos.");

    await guardar();
    expect(crear).toHaveBeenCalledWith({ nombre: "L'Bel", color: '#2E1A47', colorAcento: null });
  });

  it('crear: una conocida con acento (Leonisa) muestra y bloquea ambos colores', async () => {
    await abrir();
    await escribirNombre('LEONISA');
    expect(hexs().map((h) => h.value)).toEqual(['#222221', '#F36E21']);
    expect(hexs().every((h) => h.disabled)).toBe(true);
    expect(document.body.querySelector('[data-prueba="quitar-acento"]')).toBeNull();

    await guardar();
    expect(crear).toHaveBeenCalledWith({
      nombre: 'Leonisa',
      color: '#222221',
      colorAcento: '#F36E21',
    });
  });

  it('de conocida a propia: se habilitan los campos y se conserva el color que eligió', async () => {
    await abrir();
    await escribirHex('#112233');
    await escribirNombre('Avon');
    expect(hexs()[0]?.value).toBe('#FF2469');

    await escribirNombre('Avonia');

    expect(nota()).toBeNull();
    expect(hexs()[0]?.disabled).toBe(false);
    expect(hexs()[0]?.value).toBe('#112233');
    await guardar();
    expect(crear).toHaveBeenCalledWith({ nombre: 'Avonia', color: '#112233', colorAcento: null });
  });

  it('de conocida a propia sin haber elegido color: vuelve al predeterminado', async () => {
    await abrir();
    await escribirNombre('Avon');
    await escribirNombre('Natura');
    expect(hexs()[0]?.value).toBe('#2563EB');
    expect(hexs()[0]?.disabled).toBe(false);
  });

  it('de propia a conocida: toma los colores oficiales aunque haya elegido otros', async () => {
    await abrir();
    await escribirNombre('Natura');
    await escribirHex('#112233');
    await escribirNombre('Avon');
    expect(hexs()[0]?.value).toBe('#FF2469');
    expect(hexs()[0]?.disabled).toBe(true);
    await guardar();
    expect(crear).toHaveBeenCalledWith({ nombre: 'Avon', color: '#FF2469', colorAcento: null });
  });

  it('editar una conocida: colores bloqueados siempre y activar/orden siguen funcionando', async () => {
    await abrir(marca('a', 'Avon', { color: '#FF2469', orden: 1 }));

    expect(hexs()[0]?.disabled).toBe(true);
    expect(nota()?.textContent).toContain('Los colores de Avon son fijos.');
    const orden = document.body.querySelector<HTMLInputElement>('#orden-marca');
    orden!.value = '3';
    orden!.dispatchEvent(new Event('input'));
    orden!.dispatchEvent(new Event('blur'));
    await estable();
    await guardar();

    expect(actualizar).toHaveBeenCalledWith('a', { orden: 3 });
  });

  it('editar una conocida: se pueden corregir mayúsculas o tildes, pero no cambiar a otro nombre', async () => {
    await abrir(marca('a', 'Avon', { color: '#FF2469' }));

    await escribirNombre('Avón');
    expect(document.body.querySelector('[data-prueba="error-nombre"]')).toBeNull();

    await escribirNombre('Natura');
    expect(document.body.querySelector('[data-prueba="error-nombre"]')?.textContent).toContain(
      'El nombre de Avon no se puede cambiar por otro',
    );
    expect(hexs()[0]?.disabled).toBe(true);
    expect(hexs()[0]?.value).toBe('#FF2469');
    expect(
      document.body.querySelector<HTMLButtonElement>('[data-prueba="guardar"] button')?.disabled,
    ).toBe(true);

    await escribirNombre('Avón');
    await guardar();
    expect(actualizar).toHaveBeenCalledWith('a', { nombre: 'Avón' });
  });

  it('editar una marca propia: colores libres', async () => {
    await abrir(marca('p', 'Natura'));
    expect(nota()).toBeNull();
    expect(hexs()[0]?.disabled).toBe(false);
    await escribirHex('#FF0000');
    await guardar();
    expect(actualizar).toHaveBeenCalledWith('p', { color: '#FF0000' });
  });

  it('editar una propia que pasa a llamarse como una conocida: toma nombre y color oficiales', async () => {
    await abrir(marca('p', 'Natura'));
    await escribirNombre('avon');
    expect(hexs()[0]?.disabled).toBe(true);
    await guardar();
    expect(actualizar).toHaveBeenCalledWith('p', { nombre: 'Avon', color: '#FF2469' });
  });

  it('422 COLOR_MARCA_FIJO muestra un mensaje claro y deja el diálogo abierto', async () => {
    actualizar.mockRejectedValue(new ErrorApi('COLOR_MARCA_FIJO', 'x', 422));
    await abrir(marca('a', 'Avon', { color: '#FF2469' }));
    const orden = document.body.querySelector<HTMLInputElement>('#orden-marca');
    orden!.value = '5';
    orden!.dispatchEvent(new Event('input'));
    orden!.dispatchEvent(new Event('blur'));
    await estable();
    await guardar();
    expect(document.body.querySelector('[data-prueba="error-general"]')?.textContent).toContain(
      'colores de una marca conocida no se pueden cambiar',
    );
  });

  it('422 NOMBRE_MARCA_FIJO muestra un mensaje claro', async () => {
    crear.mockRejectedValue(new ErrorApi('NOMBRE_MARCA_FIJO', 'x', 422));
    await abrir();
    await escribirNombre('Natura');
    await guardar();
    expect(document.body.querySelector('[data-prueba="error-general"]')?.textContent).toContain(
      'nombre de una marca conocida no se puede cambiar',
    );
  });

  it('si no se pueden cargar las sugeridas, los campos quedan libres (el servidor impone la regla)', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DialogoMarca],
      providers: [
        EstadoMarcas,
        {
          provide: ApiMarcas,
          useValue: {
            crear,
            actualizar,
            listar: vi.fn(),
            sugeridas: () => Promise.reject(new Error('x')),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DialogoMarca);
    await abrir();
    await escribirNombre('Avon');
    expect(hexs()[0]?.disabled).toBe(false);
  });
});
