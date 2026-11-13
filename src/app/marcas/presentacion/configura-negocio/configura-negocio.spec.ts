import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Mock } from 'vitest';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { EstadoMarcas } from '../../aplicacion/estado-marcas';
import { ApiMarcas } from '../../aplicacion/puertos';
import { Marca, MarcaSugerida, NuevaMarca } from '../../dominio/marca';
import { ConfiguraNegocio } from './configura-negocio';

const SUGERIDAS: MarcaSugerida[] = [
  { nombre: 'Yanbal', color: '#FC5823', colorAcento: null, yaCreada: false },
  { nombre: 'Avon', color: '#FF2469', colorAcento: null, yaCreada: false },
  { nombre: 'Leonisa', color: '#222221', colorAcento: '#F36E21', yaCreada: false },
];

function creada(n: NuevaMarca, orden: number): Marca {
  return {
    id: `id-${n.nombre}`,
    ...n,
    textoSobreColor: '#FFFFFF',
    textoSobreAcento: null,
    activa: true,
    orden,
    creadaEn: '2026-11-11T10:00:00Z',
  };
}

describe('ConfiguraNegocio (D-48, RF-PRO-06)', () => {
  let crear: Mock<(m: NuevaMarca) => Promise<Marca>>;
  let fixture: ComponentFixture<ConfiguraNegocio>;
  let elemento: HTMLElement;
  let avisos: MessageService;
  let navegar: ReturnType<typeof vi.fn>;

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    let n = 0;
    crear = vi.fn((m: NuevaMarca) => Promise.resolve(creada(m, n++)));
    await TestBed.configureTestingModule({
      imports: [ConfiguraNegocio],
      providers: [
        provideRouter([]),
        MessageService,
        EstadoMarcas,
        {
          provide: ApiMarcas,
          useValue: { sugeridas: () => Promise.resolve(SUGERIDAS), crear, listar: vi.fn() },
        },
      ],
    }).compileComponents();
    avisos = TestBed.inject(MessageService);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(ConfiguraNegocio);
    elemento = fixture.nativeElement as HTMLElement;
    await estable();
  });

  afterEach(() => fixture.destroy());

  const tarjetas = () =>
    Array.from(elemento.querySelectorAll<HTMLElement>('[data-prueba="tarjeta-marca"]'));
  const casilla = (i: number) =>
    tarjetas()[i]?.querySelector<HTMLInputElement>('[data-prueba="casilla"] input');
  const continuar = () =>
    elemento.querySelector<HTMLButtonElement>('[data-prueba="continuar"] button');

  async function elegir(i: number): Promise<void> {
    casilla(i)?.click();
    await estable();
  }

  it('muestra las sugeridas con casilla, vista previa y contraste calculado', () => {
    expect(tarjetas()).toHaveLength(3);
    expect(tarjetas()[1]?.textContent).toContain('Avon');
    expect(tarjetas()[1]?.textContent).toContain('Contraste 4.9:1 ✔');
    expect(casilla(0)?.checked).toBe(false);
  });

  it('«Continuar» está deshabilitado hasta elegir al menos una marca', async () => {
    expect(continuar()?.disabled).toBe(true);
    expect(elemento.querySelector('[data-prueba="resumen"]')?.textContent).toContain(
      'Elige al menos una marca',
    );
    await elegir(0);
    expect(continuar()?.disabled).toBe(false);
  });

  it('cambiar el color por el campo hexadecimal actualiza el contraste', async () => {
    const hex = tarjetas()[0]?.querySelector<HTMLInputElement>('[data-prueba="selector-hex"]');
    hex!.value = 'ffffff';
    hex!.dispatchEvent(new Event('input'));
    await estable();
    expect(tarjetas()[0]?.querySelector('[data-prueba="contraste-principal"]')?.textContent).toContain(
      '#1E293B',
    );
    expect(hex?.value).toBe('#FFFFFF');
  });

  it('un color inválido deshabilita «Continuar» y muestra el error', async () => {
    await elegir(0);
    const hex = tarjetas()[0]?.querySelector<HTMLInputElement>('[data-prueba="selector-hex"]');
    hex!.value = '#12';
    hex!.dispatchEvent(new Event('input'));
    await estable();
    expect(tarjetas()[0]?.querySelector('[data-prueba="error-color"]')).not.toBeNull();
    expect(continuar()?.disabled).toBe(true);
  });

  it('crea con POST solo las elegidas (con su acento) y lleva a /marcas con un aviso', async () => {
    const agregar = vi.spyOn(avisos, 'add');
    await elegir(0);
    await elegir(2);
    continuar()?.click();
    await estable();

    expect(crear).toHaveBeenCalledTimes(2);
    expect(crear).toHaveBeenNthCalledWith(1, { nombre: 'Yanbal', color: '#FC5823', colorAcento: null });
    expect(crear).toHaveBeenNthCalledWith(2, {
      nombre: 'Leonisa',
      color: '#222221',
      colorAcento: '#F36E21',
    });
    expect(agregar).toHaveBeenCalledWith(expect.objectContaining({ severity: 'success' }));
    expect(navegar).toHaveBeenCalledWith('/marcas');
  });

  it('agrega una marca propia (nombre y color) y la crea', async () => {
    const nombre = elemento.querySelector<HTMLInputElement>('[data-prueba="nombre-propia"]');
    nombre!.value = 'Natura';
    nombre!.dispatchEvent(new Event('input'));
    await estable();
    elemento.querySelector<HTMLButtonElement>('[data-prueba="agregar-propia"] button')?.click();
    await estable();

    expect(tarjetas()).toHaveLength(4);
    expect(tarjetas()[3]?.textContent).toContain('Natura');
    continuar()?.click();
    await estable();
    expect(crear).toHaveBeenCalledWith({ nombre: 'Natura', color: '#2563EB', colorAcento: null });
  });

  it('no permite una marca propia repetida (sin distinguir tildes ni mayúsculas)', async () => {
    const nombre = elemento.querySelector<HTMLInputElement>('[data-prueba="nombre-propia"]');
    nombre!.value = 'AVÓN';
    nombre!.dispatchEvent(new Event('input'));
    await estable();
    expect(elemento.querySelector('[data-prueba="error-propia"]')?.textContent).toContain(
      'ya está en la lista',
    );
    expect(
      elemento.querySelector<HTMLButtonElement>('[data-prueba="agregar-propia"] button')?.disabled,
    ).toBe(true);
  });

  it('409 MARCA_DUPLICADA se señala en la tarjeta, se crean las demás y no navega', async () => {
    crear.mockImplementation((m) =>
      m.nombre === 'Avon'
        ? Promise.reject(new ErrorApi('MARCA_DUPLICADA', 'Ya existe.', 409))
        : Promise.resolve(creada(m, 0)),
    );
    await elegir(0);
    await elegir(1);
    continuar()?.click();
    await estable();

    expect(tarjetas()[1]?.querySelector('[data-prueba="error-marca"]')?.textContent).toContain(
      'Ya existe una marca con ese nombre.',
    );
    expect(tarjetas()[0]?.textContent).toContain('Ya creada');
    expect(navegar).not.toHaveBeenCalled();
  });

  it('400 por campo muestra el mensaje del servidor en la tarjeta', async () => {
    crear.mockRejectedValue(
      new ErrorApi('DATOS_INVALIDOS', 'x', 400, {
        errores: [{ campo: 'nombre', errores: ['El nombre no es válido.'] }],
      }),
    );
    await elegir(0);
    continuar()?.click();
    await estable();
    expect(tarjetas()[0]?.querySelector('[data-prueba="error-marca"]')?.textContent).toContain(
      'El nombre no es válido.',
    );
  });
});
