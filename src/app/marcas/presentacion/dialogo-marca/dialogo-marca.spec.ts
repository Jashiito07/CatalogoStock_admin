import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Mock } from 'vitest';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { EstadoMarcas } from '../../aplicacion/estado-marcas';
import { ApiMarcas } from '../../aplicacion/puertos';
import { CambiosMarca, Marca, MarcaSugerida, NuevaMarca } from '../../dominio/marca';
import { DialogoMarca } from './dialogo-marca';

/** Forma de `GET /marcas/sugeridas` (D-56): los colores oficiales vienen del servidor. */
const SUGERIDAS: MarcaSugerida[] = [
  { nombre: 'Yanbal', color: '#6B2C91', colorAcento: null, yaCreada: true },
  { nombre: 'Avon', color: '#FF2469', colorAcento: null, yaCreada: false },
  { nombre: "L'Bel", color: '#2E1A47', colorAcento: null, yaCreada: false },
  { nombre: 'Leonisa', color: '#222221', colorAcento: '#F36E21', yaCreada: true },
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

describe('DialogoMarca · combobox de marcas y colores fijos (D-43, D-56, RF-PRO-04, RF-PRO-06)', () => {
  let crear: Mock<(m: NuevaMarca) => Promise<Marca>>;
  let actualizar: Mock<(id: string, c: CambiosMarca) => Promise<Marca>>;
  let sugeridas: () => Promise<MarcaSugerida[]>;
  let fixture: ComponentFixture<DialogoMarca>;

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  async function configurar(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [DialogoMarca],
      providers: [
        EstadoMarcas,
        { provide: ApiMarcas, useValue: { crear, actualizar, listar: vi.fn(), sugeridas } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DialogoMarca);
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

  const combo = () => document.body.querySelector<HTMLElement>('[data-prueba="combo-marca"]');
  const opciones = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.p-select-option'));
  const opcion = (texto: string) => opciones().find((o) => o.textContent?.includes(texto));
  const esDeshabilitada = (o: HTMLElement | undefined) =>
    o?.getAttribute('aria-disabled') === 'true' || o?.classList.contains('p-disabled') === true;

  async function abrirLista(): Promise<void> {
    // Si la lista anterior aún se está cerrando, dale tiempo antes de volver a abrirla.
    for (let intento = 0; intento < 20 && opciones().length > 0; intento++) {
      await new Promise((resolver) => setTimeout(resolver, 25));
    }
    combo()?.click();
    await estable();
  }

  /** Abre la lista y elige una opción por su texto. */
  async function elegir(texto: string): Promise<void> {
    await abrirLista();
    const elegida = opcion(texto);
    expect(elegida, `opción «${texto}»`).toBeDefined();
    elegida?.click();
    await estable();
  }

  const hexs = () =>
    Array.from(document.body.querySelectorAll<HTMLInputElement>('[data-prueba="selector-hex"]'));
  const nota = () => document.body.querySelector<HTMLElement>('[data-prueba="nota-color-fijo"]');
  const campoNombre = () => document.body.querySelector<HTMLInputElement>('#nombre-marca');
  const errorNombre = () => document.body.querySelector('[data-prueba="error-nombre"]');
  const botonGuardar = () =>
    document.body.querySelector<HTMLButtonElement>('[data-prueba="guardar"] button');
  const agregarAcento = () =>
    document.body.querySelector<HTMLButtonElement>('[data-prueba="agregar-acento"] button');
  const guardar = async () => {
    botonGuardar()?.click();
    await estable();
  };

  beforeEach(async () => {
    // jsdom no trae matchMedia y el panel de `p-select` lo consulta al abrirse.
    window.matchMedia ??= ((consulta: string) =>
      ({
        matches: false,
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    // jsdom tampoco trae scrollIntoView, que `p-select` usa al reabrir con una opción elegida.
    Element.prototype.scrollIntoView ??= () => undefined;
    crear = vi.fn((m: NuevaMarca) => Promise.resolve(marca('n', m.nombre, { ...m })));
    actualizar = vi.fn((id: string, c: CambiosMarca) => Promise.resolve(marca(id, 'X', { ...c })));
    sugeridas = () => Promise.resolve(SUGERIDAS);
    await configurar();
  });

  afterEach(() => fixture.destroy());

  describe('crear · lista del combobox', () => {
    it('RF-PRO-04: ofrece las conocidas y, al final, «Agregar nueva marca…»; sin elegir no muestra el formulario', async () => {
      await abrir();
      expect(
        combo()?.getAttribute('aria-label') ?? combo()?.querySelector('[aria-label]'),
      ).not.toBeNull();
      expect(campoNombre()).toBeNull();
      expect(botonGuardar()?.disabled).toBe(true);

      await abrirLista();
      const nombres = opciones().map((o) => o.textContent?.trim() ?? '');
      expect(nombres).toHaveLength(5);
      expect(nombres[0]).toContain('Yanbal');
      expect(nombres[1]).toContain('Avon');
      expect(nombres[2]).toContain("L'Bel");
      expect(nombres[3]).toContain('Leonisa');
      expect(nombres[4]).toContain('Agregar nueva marca…');
      expect(opciones()[4]?.querySelector('.pi-plus')).not.toBeNull();
    });

    it('D-56: las ya agregadas (Yanbal, Leonisa) aparecen deshabilitadas con «Ya agregada»', async () => {
      await abrir();
      await abrirLista();

      expect(esDeshabilitada(opcion('Yanbal'))).toBe(true);
      expect(opcion('Yanbal')?.textContent).toContain('Ya agregada');
      expect(esDeshabilitada(opcion('Leonisa'))).toBe(true);
      expect(opcion('Leonisa')?.textContent).toContain('Ya agregada');
      expect(esDeshabilitada(opcion('Avon'))).toBe(false);
      expect(opcion('Avon')?.textContent).not.toContain('Ya agregada');
      expect(esDeshabilitada(opcion('Agregar nueva marca…'))).toBe(false);
    });

    it('una marca que el panel ya tiene también se deshabilita aunque la lista del servidor esté vieja', async () => {
      await abrir();
      await TestBed.inject(EstadoMarcas).crear({
        nombre: 'Avon',
        color: '#FF2469',
        colorAcento: null,
      });
      await estable();
      await abrirLista();
      expect(esDeshabilitada(opcion('Avon'))).toBe(true);
    });

    it('al elegir una deshabilitada no pasa nada: el formulario sigue oculto', async () => {
      await abrir();
      await abrirLista();
      opcion('Yanbal')?.click();
      await estable();
      expect(campoNombre()).toBeNull();
      expect(botonGuardar()?.disabled).toBe(true);
    });

    it('el filtro encuentra una conocida por su nombre', async () => {
      await abrir();
      await abrirLista();
      const filtro = document.body.querySelector<HTMLInputElement>('.p-select-filter');
      expect(filtro).not.toBeNull();
      filtro!.value = 'leo';
      filtro!.dispatchEvent(new Event('input'));
      await estable();
      expect(opciones().map((o) => o.textContent?.trim())).toEqual([
        expect.stringContaining('Leonisa'),
      ]);
    });
  });

  describe('crear · elegir una conocida (colores oficiales fijos)', () => {
    it.each([
      ['Avon', 'Avon', '#FF2469', null],
      ["L'Bel", "L'Bel", '#2E1A47', null],
    ])(
      'RF-PRO-06: elegir «%s» fija el nombre y el color oficial, los bloquea y los envía',
      async (texto, nombre, color, acento) => {
        await abrir();
        await elegir(texto);

        expect(campoNombre()?.value).toBe(nombre);
        expect(campoNombre()?.disabled).toBe(true);
        expect(hexs()[0]?.value).toBe(color);
        expect(hexs()[0]?.disabled).toBe(true);
        expect(nota()?.textContent).toContain(`Los colores de ${nombre} son fijos.`);
        expect(hexs()[0]?.getAttribute('aria-describedby')).toBe(nota()?.id);
        expect(agregarAcento()?.disabled).toBe(true);
        expect(document.body.querySelector('[data-prueba="vista-previa"]')?.textContent).toContain(
          'Contraste',
        );

        await guardar();
        expect(crear).toHaveBeenCalledWith({ nombre, color, colorAcento: acento });
      },
    );

    it('RF-PRO-06: una conocida con acento muestra y bloquea ambos colores', async () => {
      sugeridas = () => Promise.resolve(SUGERIDAS.map((s) => ({ ...s, yaCreada: false })));
      TestBed.resetTestingModule();
      await configurar();
      await abrir();
      await elegir('Leonisa');

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
  });

  describe('crear · agregar nueva marca', () => {
    it('RF-PRO-04: «Agregar nueva marca…» muestra el nombre libre y los colores libres', async () => {
      await abrir();
      await elegir('Agregar nueva marca…');

      expect(campoNombre()?.disabled).toBe(false);
      expect(campoNombre()?.value).toBe('');
      expect(hexs()[0]?.disabled).toBe(false);
      expect(nota()).toBeNull();
      expect(agregarAcento()?.disabled).toBe(false);

      await escribirNombre('Natura');
      await escribirHex('#112233');
      await guardar();
      expect(crear).toHaveBeenCalledWith({ nombre: 'Natura', color: '#112233', colorAcento: null });
    });

    it('valida de 2 a 40 caracteres con los mensajes de siempre', async () => {
      await abrir();
      await elegir('Agregar nueva marca…');
      await escribirNombre('N');
      campoNombre()?.dispatchEvent(new Event('blur'));
      await estable();
      expect(errorNombre()?.textContent).toContain('al menos 2 caracteres');
      expect(botonGuardar()?.disabled).toBe(true);

      await escribirNombre('Natura');
      expect(errorNombre()).toBeNull();
      expect(botonGuardar()?.disabled).toBe(false);
      expect(campoNombre()?.maxLength).toBe(40);
    });

    it('cambiar de conocida a nueva y viceversa: no arrastra el nombre ni pisa el color elegido', async () => {
      await abrir();
      await elegir('Agregar nueva marca…');
      await escribirNombre('Natura');
      await escribirHex('#112233');

      await elegir('Avon');
      expect(campoNombre()?.value).toBe('Avon');
      expect(hexs()[0]?.value).toBe('#FF2469');
      expect(hexs()[0]?.disabled).toBe(true);

      await elegir('Agregar nueva marca…');
      expect(campoNombre()?.disabled).toBe(false);
      expect(campoNombre()?.value).toBe('Natura');
      expect(hexs()[0]?.value).toBe('#112233');
      expect(hexs()[0]?.disabled).toBe(false);
      expect(nota()).toBeNull();
      await guardar();
      expect(crear).toHaveBeenCalledWith({ nombre: 'Natura', color: '#112233', colorAcento: null });
    });

    it('D-56: un nombre libre que coincide con una conocida avisa y no deja guardar', async () => {
      await abrir();
      await elegir('Agregar nueva marca…');
      await escribirNombre('l´bel');

      expect(errorNombre()?.textContent).toContain(
        'Esa marca ya está en la lista: elígela arriba.',
      );
      expect(botonGuardar()?.disabled).toBe(true);
      await guardar();
      expect(crear).not.toHaveBeenCalled();

      await escribirNombre('Avonia');
      expect(errorNombre()).toBeNull();
      expect(botonGuardar()?.disabled).toBe(false);
    });

    it('un nombre libre igual a una marca ya agregada dice que ya existe', async () => {
      await abrir();
      await TestBed.inject(EstadoMarcas).crear({
        nombre: 'Natura',
        color: '#112233',
        colorAcento: null,
      });
      await elegir('Agregar nueva marca…');
      await escribirNombre('natura');
      expect(errorNombre()?.textContent).toContain('Ya existe una marca con ese nombre.');
      expect(botonGuardar()?.disabled).toBe(true);
    });

    it('409 MARCA_DUPLICADA muestra el mensaje y deja el diálogo abierto', async () => {
      crear.mockRejectedValue(new ErrorApi('MARCA_DUPLICADA', 'x', 409));
      await abrir();
      await elegir('Agregar nueva marca…');
      await escribirNombre('Natura');
      await guardar();
      expect(document.body.querySelector('[data-prueba="error-general"]')?.textContent).toContain(
        'Ya existe una marca con ese nombre.',
      );
      expect(document.body.querySelector('[data-prueba="dialogo-marca"]')).not.toBeNull();
    });

    it('422 NOMBRE_MARCA_FIJO muestra un mensaje claro', async () => {
      crear.mockRejectedValue(new ErrorApi('NOMBRE_MARCA_FIJO', 'x', 422));
      await abrir();
      await elegir('Agregar nueva marca…');
      await escribirNombre('Natura');
      await guardar();
      expect(document.body.querySelector('[data-prueba="error-general"]')?.textContent).toContain(
        'nombre de una marca conocida no se puede cambiar',
      );
    });

    it('422 COLOR_MARCA_FIJO al crear una conocida muestra un mensaje claro', async () => {
      crear.mockRejectedValue(new ErrorApi('COLOR_MARCA_FIJO', 'x', 422));
      await abrir();
      await elegir('Avon');
      await guardar();
      expect(document.body.querySelector('[data-prueba="error-general"]')?.textContent).toContain(
        'colores de una marca conocida no se pueden cambiar',
      );
    });

    it('tras crear una conocida, vuelve a abrirse con esa marca deshabilitada', async () => {
      await abrir();
      await elegir('Avon');
      await guardar();
      expect(crear).toHaveBeenCalledTimes(1);

      fixture.componentRef.setInput('visible', false);
      await estable();
      await abrir();
      await abrirLista();
      expect(esDeshabilitada(opcion('Avon'))).toBe(true);
    });
  });

  describe('crear · casos límite de la lista', () => {
    it('si ya están todas agregadas, solo ofrece «Agregar nueva marca…» con un texto de ayuda', async () => {
      sugeridas = () => Promise.resolve(SUGERIDAS.map((s) => ({ ...s, yaCreada: true })));
      TestBed.resetTestingModule();
      await configurar();
      await abrir();

      expect(
        document.body.querySelector('[data-prueba="aviso-todas-agregadas"]')?.textContent,
      ).toContain('Ya agregaste todas las marcas conocidas');
      await abrirLista();
      expect(opciones().filter((o) => !esDeshabilitada(o))).toHaveLength(1);
      expect(opcion('Agregar nueva marca…')).toBeDefined();
    });

    it('si falla GET /marcas/sugeridas, avisa y ofrece solo «Agregar nueva marca…» (el servidor decide)', async () => {
      sugeridas = () => Promise.reject(new Error('sin red'));
      TestBed.resetTestingModule();
      await configurar();
      await abrir();

      expect(document.body.querySelector('[data-prueba="aviso-sugeridas"]')?.textContent).toContain(
        'No pudimos cargar las marcas conocidas',
      );
      await abrirLista();
      expect(opciones()).toHaveLength(1);
      expect(opciones()[0]?.textContent).toContain('Agregar nueva marca…');
      opciones()[0]?.click();
      await estable();

      await escribirNombre('Avon');
      expect(hexs()[0]?.disabled).toBe(false);
      await guardar();
      expect(crear).toHaveBeenCalledWith({ nombre: 'Avon', color: '#2563EB', colorAcento: null });
    });
  });

  describe('editar · sin combobox', () => {
    it('editar una conocida: sin combobox, colores bloqueados y activar/orden siguen funcionando', async () => {
      await abrir(marca('a', 'Avon', { color: '#FF2469', orden: 1 }));

      expect(combo()).toBeNull();
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
      expect(errorNombre()).toBeNull();

      await escribirNombre('Natura');
      expect(errorNombre()?.textContent).toContain(
        'El nombre de Avon no se puede cambiar por otro',
      );
      expect(hexs()[0]?.disabled).toBe(true);
      expect(hexs()[0]?.value).toBe('#FF2469');
      expect(botonGuardar()?.disabled).toBe(true);

      await escribirNombre('Avón');
      await guardar();
      expect(actualizar).toHaveBeenCalledWith('a', { nombre: 'Avón' });
    });

    it('editar una marca propia: colores libres', async () => {
      await abrir(marca('p', 'Natura'));
      expect(combo()).toBeNull();
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

    it('422 COLOR_MARCA_FIJO al editar muestra un mensaje claro y deja el diálogo abierto', async () => {
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
  });
});
