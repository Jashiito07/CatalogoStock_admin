import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from 'primeng/api';

import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { ApiMarcas } from '../../../marcas/aplicacion/puertos';
import { marcaPrueba } from '../../../productos/pruebas/dobles-productos';
import { EstadoImportacion } from '../../aplicacion/estado-importacion';
import { AlmacenImportacionesRecientes, ApiImportaciones } from '../../aplicacion/puertos';
import {
  AlmacenRecientesMemoria,
  ApiImportacionesFalsa,
  borradorPrueba,
  crearApiImportacionesFalsa,
  ID_IMPORTACION,
  ID_MARCA,
  importacionPrueba,
  paginaBorradoresPrueba,
} from '../../pruebas/dobles-importacion';
import { Revision } from './revision';

/** D-61: en pantallas de menos de 768 px la revisión pasa a tarjetas, filtros colapsables y barra fija. */
describe('Revision en el celular (D-61, RF-PRO-01)', () => {
  let api: ApiImportacionesFalsa;
  let harness: RouterTestingHarness;
  let elemento: HTMLElement;
  const matchMediaOriginal = window.matchMedia;

  const completo = borradorPrueba('b1', { nombre: 'Crema hidratante', codigo: '43873' });
  const cambioPrecio = borradorPrueba('b2', {
    nombre: 'Labial rojo',
    precio: '37.00',
    codigo: '011715C',
    productoExistente: { id: 'p1', nombre: 'Labial rojo', precio: '30.00' },
    advertencias: ['YA_IMPORTADO'],
  });
  const sinPrecio = borradorPrueba('b3', {
    nombre: 'Perfume',
    precio: null,
    advertencias: ['SIN_PRECIO'],
  });

  async function estable(): Promise<void> {
    await harness.fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function abrir(total = 3): Promise<void> {
    api = crearApiImportacionesFalsa();
    api.obtener.mockResolvedValue(importacionPrueba());
    api.listarBorradores.mockResolvedValue(
      paginaBorradoresPrueba([completo, cambioPrecio, sinPrecio], {}, total),
    );
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'productos/importar/:id', component: Revision }]),
        { provide: MessageService, useValue: { add: vi.fn() } },
        EstadoMarcas,
        EstadoImportacion,
        {
          provide: ApiMarcas,
          useValue: { listar: vi.fn().mockResolvedValue([marcaPrueba(ID_MARCA, 'Yanbal')]) },
        },
        { provide: ApiImportaciones, useValue: api },
        { provide: AlmacenImportacionesRecientes, useClass: AlmacenRecientesMemoria },
      ],
    }).compileComponents();
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/productos/importar/${ID_IMPORTACION}`, Revision);
    elemento = harness.routeNativeElement as HTMLElement;
    await estable();
  }

  beforeEach(() => {
    window.matchMedia = ((consulta: string) =>
      ({
        matches: true,
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
  });

  afterEach(() => {
    harness.fixture.destroy();
    document.body.querySelectorAll('.p-dialog-mask, .p-confirmdialog').forEach((n) => n.remove());
    window.matchMedia = matchMediaOriginal;
  });

  const q = (selector: string) => elemento.querySelector<HTMLElement>(selector);
  const tarjetas = () => Array.from(elemento.querySelectorAll<HTMLElement>('[data-prueba="fila-borrador"]'));
  const boton = (id: string) => q(`[data-prueba="${id}"] button`) as HTMLButtonElement;
  const marcar = async (indice: number) => {
    tarjetas()[indice]?.querySelector<HTMLElement>('[data-prueba="seleccionar-borrador"] input')?.click();
    await estable();
  };

  it('muestra una lista de tarjetas y no la tabla', async () => {
    await abrir();
    expect(q('p-table')).toBeNull();
    expect(tarjetas()).toHaveLength(3);
    expect(tarjetas()[0]?.textContent).toContain('43873');
    expect(tarjetas()[0]?.textContent).toContain('Crema hidratante');
    expect(tarjetas()[0]?.querySelector('[data-prueba="editar"]')).not.toBeNull();
  });

  it('muestra «precio actual → nuevo» solo si el borrador actualiza un producto', async () => {
    await abrir();
    expect(tarjetas()[1]?.querySelector('[data-prueba="precio-actual"]')?.textContent).toContain('$30.00');
    expect(tarjetas()[1]?.querySelector('[data-prueba="precio-borrador"]')?.textContent).toContain('$37.00');
    expect(tarjetas()[0]?.querySelector('[data-prueba="precio-actual"]')).toBeNull();
    expect(tarjetas()[2]?.textContent).toContain('Sin precio');
  });

  it('selección múltiple: la barra fija cuenta lo seleccionado y aprueba con confirmación (RNF-12)', async () => {
    await abrir();
    expect(boton('aprobar').disabled).toBe(true);
    await marcar(0);
    await marcar(1);
    expect(q('[data-prueba="conteo-seleccion"]')?.textContent).toContain('2 seleccionados');
    expect(boton('aprobar').textContent).toContain('Aprobar seleccionados (2)');
    api.aprobar.mockResolvedValue([
      { id: 'b1', estado: 'APROBADO' },
      { id: 'b2', estado: 'APROBADO' },
    ]);
    boton('aprobar').click();
    await estable();
    expect(api.aprobar).not.toHaveBeenCalled();
    const aceptar = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.p-confirmdialog button')).find(
      (b) => b.textContent?.includes('Aprobar'),
    );
    aceptar?.click();
    await estable();
    expect(api.aprobar).toHaveBeenCalledWith(['b1', 'b2']);
  });

  it('RN-11: un borrador sin precio seleccionado no cuenta para aprobar', async () => {
    await abrir();
    await marcar(2);
    expect(q('[data-prueba="conteo-seleccion"]')?.textContent).toContain('1 sin precio');
    expect(boton('aprobar').textContent).toContain('(0)');
    expect(boton('aprobar').disabled).toBe(true);
    expect(boton('descartar').disabled).toBe(false);
  });

  it('«Seleccionar los N de esta página» marca todas las tarjetas', async () => {
    await abrir();
    q('[data-prueba="seleccionar-todos"] input')?.click();
    await estable();
    expect(q('[data-prueba="conteo-seleccion"]')?.textContent).toContain('3 seleccionados');
  });

  it('los filtros están colapsados y se abren con «Filtros»', async () => {
    await abrir();
    expect(q('[data-prueba="panel-filtros"]')).toBeNull();
    expect(q('[data-prueba="busqueda"]')).toBeNull();
    boton('alternar-filtros').click();
    await estable();
    expect(q('[data-prueba="panel-filtros"]')).not.toBeNull();
    expect(q('[data-prueba="busqueda"]')).not.toBeNull();
    expect(boton('alternar-filtros').textContent).toContain('Ocultar filtros');
  });

  it('paginación numerada con botones «Anterior» y «Siguiente»', async () => {
    await abrir(120);
    expect(q('[data-prueba="pagina-actual"]')?.textContent).toContain('Página 1 de 3');
    expect(boton('pagina-anterior').disabled).toBe(true);
    boton('pagina-siguiente').click();
    await estable();
    expect(api.listarBorradores).toHaveBeenLastCalledWith(
      ID_IMPORTACION,
      expect.objectContaining({ pagina: 2, tamanio: 50 }),
    );
  });
});
