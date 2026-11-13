import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { Mock } from 'vitest';

import { EstadoMarcas } from '../../aplicacion/estado-marcas';
import { ApiMarcas } from '../../aplicacion/puertos';
import { CambiosMarca, Marca, NuevaMarca } from '../../dominio/marca';
import { Marcas, MENSAJE_DESACTIVAR } from './marcas';

function marca(id: string, nombre: string, orden: number, parcial: Partial<Marca> = {}): Marca {
  return {
    id,
    nombre,
    color: '#FC5823',
    colorAcento: null,
    textoSobreColor: '#1E293B',
    textoSobreAcento: null,
    activa: true,
    orden,
    creadaEn: '2026-11-11T10:00:00Z',
    ...parcial,
  };
}

describe('Marcas (RF-PRO-04, D-43)', () => {
  let listar: Mock<(i: boolean) => Promise<readonly Marca[]>>;
  let actualizar: Mock<(id: string, c: CambiosMarca) => Promise<Marca>>;
  let crear: Mock<(m: NuevaMarca) => Promise<Marca>>;
  let fixture: ComponentFixture<Marcas>;
  let elemento: HTMLElement;

  async function estable(): Promise<void> {
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    listar = vi.fn().mockResolvedValue([
      marca('a', 'Yanbal', 0),
      marca('b', 'Leonisa', 1, { color: '#222221', colorAcento: '#F36E21' }),
      marca('c', 'Esika', 2, { activa: false }),
    ]);
    actualizar = vi.fn((id: string, c: CambiosMarca) =>
      Promise.resolve(marca(id, 'X', 0, { ...c })),
    );
    crear = vi.fn((m: NuevaMarca) => Promise.resolve(marca('n', m.nombre, 3, { ...m })));
    await TestBed.configureTestingModule({
      imports: [Marcas],
      providers: [
        provideRouter([]),
        MessageService,
        EstadoMarcas,
        { provide: ApiMarcas, useValue: { listar, actualizar, crear } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Marcas);
    elemento = fixture.nativeElement as HTMLElement;
    await estable();
  });

  afterEach(() => fixture.destroy());

  const filas = () => Array.from(elemento.querySelectorAll<HTMLElement>('[data-prueba="fila-marca"]'));
  const boton = (fila: number, id: string) =>
    filas()[fila]?.querySelector<HTMLButtonElement>(`[data-prueba="${id}"] button`);
  const botonDeConfirmacion = (texto: string) =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('.p-confirmdialog button')).find((b) =>
      b.textContent?.includes(texto),
    );

  it('muestra color, nombre, acento, estado y orden de cada marca', () => {
    expect(listar).toHaveBeenCalledWith(true);
    expect(filas()).toHaveLength(3);
    const muestra = filas()[0]?.querySelector<HTMLElement>('[data-prueba="muestra-color"]');
    expect(muestra?.style.backgroundColor).toBe('rgb(252, 88, 35)');
    expect(filas()[0]?.textContent).toContain('Yanbal');
    expect(filas()[0]?.textContent).toContain('Sin acento');
    expect(filas()[1]?.textContent).toContain('#F36E21');
    expect(filas()[0]?.textContent).toContain('Activa');
    expect(filas()[2]?.textContent).toContain('Inactiva');
  });

  it('RNF-12: desactivar pide confirmación y no cambia nada si se cancela', async () => {
    boton(0, 'alternar-activa')?.click();
    await estable();
    expect(document.body.textContent).toContain(MENSAJE_DESACTIVAR);
    botonDeConfirmacion('Cancelar')?.click();
    await estable();
    expect(actualizar).not.toHaveBeenCalled();
  });

  it('al confirmar, desactiva con PATCH activa:false', async () => {
    boton(0, 'alternar-activa')?.click();
    await estable();
    botonDeConfirmacion('Desactivar')?.click();
    await estable();
    expect(actualizar).toHaveBeenCalledWith('a', { activa: false });
  });

  it('activar una marca inactiva es directo (sin confirmación)', async () => {
    boton(2, 'alternar-activa')?.click();
    await estable();
    expect(actualizar).toHaveBeenCalledWith('c', { activa: true });
  });

  it('subir una marca reordena con PATCH de orden', async () => {
    boton(1, 'subir')?.click();
    await estable();
    expect(actualizar).toHaveBeenCalledWith('b', { orden: 0 });
    expect(actualizar).toHaveBeenCalledWith('a', { orden: 1 });
    expect(boton(0, 'subir')?.disabled).toBe(true);
  });

  it('«Nueva marca» abre el diálogo con vista previa y crea con POST', async () => {
    elemento.querySelector<HTMLButtonElement>('[data-prueba="nueva-marca"] button')?.click();
    await estable();

    const dialogo = document.body.querySelector('[data-prueba="dialogo-marca"], .p-dialog');
    expect(dialogo?.textContent).toContain('Nueva marca');
    expect(dialogo?.querySelector('[data-prueba="vista-previa"]')).not.toBeNull();
    expect(dialogo?.textContent).toContain('Contraste');

    const nombre = document.body.querySelector<HTMLInputElement>('#nombre-marca');
    nombre!.value = 'Natura';
    nombre!.dispatchEvent(new Event('input'));
    await estable();
    document.body
      .querySelector<HTMLButtonElement>('[data-prueba="guardar"] button')
      ?.click();
    await estable();

    expect(crear).toHaveBeenCalledWith({ nombre: 'Natura', color: '#2563EB', colorAcento: null });
  });

  it('editar envía solo los campos que cambiaron', async () => {
    boton(0, 'editar')?.click();
    await estable();
    const hex = document.body.querySelector<HTMLInputElement>('[data-prueba="selector-hex"]');
    hex!.value = '#FF2469';
    hex!.dispatchEvent(new Event('input'));
    await estable();
    document.body.querySelector<HTMLButtonElement>('[data-prueba="guardar"] button')?.click();
    await estable();
    expect(actualizar).toHaveBeenCalledWith('a', { color: '#FF2469' });
  });

  it('sin marcas ofrece el enlace a «Configura tu negocio»', async () => {
    listar.mockResolvedValue([]);
    await fixture.componentInstance.cargar();
    await estable();
    expect(elemento.querySelector('[data-prueba="marcas-vacio"]')?.textContent).toContain(
      'Configura tu negocio',
    );
  });
});
