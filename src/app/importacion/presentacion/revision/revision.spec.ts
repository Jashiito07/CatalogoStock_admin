import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MessageService } from 'primeng/api';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
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
import { RETARDO_BUSQUEDA_MS, Revision } from './revision';

describe('Revision: lista de revisión de borradores (RF-PRO-01, RF-PRO-02, D-55)', () => {
  let api: ApiImportacionesFalsa;
  let avisos: { add: ReturnType<typeof vi.fn> };
  let harness: RouterTestingHarness;
  let elemento: HTMLElement;

  const completo = borradorPrueba('b1', { nombre: 'Crema hidratante', pagina: 12, codigo: '43873' });
  const oferta = borradorPrueba('b2', {
    nombre: 'Labial rojo',
    precio: '37.00',
    precioNormal: '44.00',
    codigo: '011715C',
    advertencias: ['PRECIO_EN_OFERTA', 'VARIAS_REFERENCIAS'],
  });
  const sinPrecio = borradorPrueba('b3', {
    nombre: 'Perfume',
    precio: null,
    codigo: null,
    advertencias: ['SIN_PRECIO', 'SIN_CODIGO'],
  });

  async function estable(): Promise<void> {
    await harness.fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function abrir(): Promise<void> {
    avisos = { add: vi.fn() };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'productos/importar/:id', component: Revision }]),
        { provide: MessageService, useValue: avisos },
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

  beforeEach(async () => {
    window.matchMedia ??= ((consulta: string) =>
      ({
        matches: false,
        media: consulta,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList) as typeof window.matchMedia;
    api = crearApiImportacionesFalsa();
    api.obtener.mockResolvedValue(importacionPrueba());
    api.listarBorradores.mockResolvedValue(paginaBorradoresPrueba([completo, oferta, sinPrecio]));
    await abrir();
  });

  afterEach(() => {
    harness.fixture.destroy();
    document.body.querySelectorAll('.p-dialog-mask, .p-confirmdialog').forEach((n) => n.remove());
  });

  const q = (selector: string) => elemento.querySelector<HTMLElement>(selector);
  const filas = () => Array.from(elemento.querySelectorAll<HTMLElement>('[data-prueba="fila-borrador"]'));
  const botonDe = (id: string) => q(`[data-prueba="${id}"] button`) as HTMLButtonElement | null;
  const casilla = (fila: number) =>
    filas()[fila]?.querySelector<HTMLElement>('p-tablecheckbox input');
  const botonDeConfirmacion = (texto: string) =>
    Array.from(document.body.querySelectorAll<HTMLButtonElement>('.p-confirmdialog button')).find((b) =>
      b.textContent?.includes(texto),
    );

  async function seleccionar(...indices: number[]): Promise<void> {
    for (const indice of indices) {
      casilla(indice)?.click();
      await estable();
    }
  }

  it('RF-PRO-01: abre la importación, pide los pendientes y muestra el resumen', () => {
    expect(api.obtener).toHaveBeenCalledWith(ID_IMPORTACION);
    expect(api.listarBorradores).toHaveBeenCalledWith(ID_IMPORTACION, {
      pagina: 1,
      tamanio: 50,
      estado: 'PENDIENTE',
    });
    expect(q('[data-prueba="resumen-importacion"]')?.textContent).toContain('Se encontraron 3 productos; 2 con advertencias.');
    expect(filas()).toHaveLength(3);
  });

  it('RF-PRO-01: cada fila muestra página, código, nombre, precio exacto, precio normal y marca', () => {
    const texto = filas()[1]?.textContent ?? '';
    expect(texto).toContain('011715C');
    expect(texto).toContain('Labial rojo');
    expect(texto).toContain('$37.00');
    expect(texto).toContain('Normal $44.00');
    expect(texto).toContain('Yanbal');
    expect(filas()[0]?.querySelector('[data-prueba="pagina-borrador"]')?.textContent?.trim()).toBe('12');
  });

  it('D-55: las advertencias informativas se muestran distintas de las que piden revisión', () => {
    expect(filas()[1]?.querySelectorAll('[data-prueba="advertencia-informativa"]')).toHaveLength(2);
    expect(filas()[1]?.querySelectorAll('[data-prueba="advertencia-revision"]')).toHaveLength(0);
    expect(filas()[2]?.querySelectorAll('[data-prueba="advertencia-revision"]')).toHaveLength(2);
    expect(filas()[2]?.textContent).toContain('Sin precio');
    expect(filas()[0]?.querySelectorAll('[data-prueba="advertencia-revision"], [data-prueba="advertencia-informativa"]')).toHaveLength(0);
  });

  it('RF-PRO-01: los contadores de pendientes, aprobados y descartados están en el selector de estado', () => {
    const texto = q('[data-prueba="filtro-estado"]')?.textContent ?? '';
    expect(texto).toContain('Pendientes (3)');
    expect(texto).toContain('Aprobados (0)');
    expect(texto).toContain('Descartados (0)');
  });

  it('filtra por estado: pide los aprobados y ya no ofrece selección ni edición', async () => {
    api.listarBorradores.mockResolvedValue(
      paginaBorradoresPrueba([borradorPrueba('a1', { estado: 'APROBADO' })]),
    );
    const opciones = Array.from(elemento.querySelectorAll<HTMLElement>('[data-prueba="filtro-estado"] [role="radio"], [data-prueba="filtro-estado"] .p-togglebutton'));
    opciones.find((o) => o.textContent?.includes('Aprobados'))?.click();
    await estable();
    expect(api.listarBorradores).toHaveBeenLastCalledWith(ID_IMPORTACION, {
      pagina: 1,
      tamanio: 50,
      estado: 'APROBADO',
    });
    expect(q('[data-prueba="barra-acciones"]')).toBeNull();
    expect(q('[data-prueba="editar"]')).toBeNull();
  });

  it('«Solo con advertencias» pide conAdvertencias=true', async () => {
    (q('[data-prueba="solo-advertencias"] input') as HTMLElement).click();
    await estable();
    expect(api.listarBorradores).toHaveBeenLastCalledWith(ID_IMPORTACION, {
      pagina: 1,
      tamanio: 50,
      estado: 'PENDIENTE',
      conAdvertencias: true,
    });
  });

  it('la búsqueda espera a que termines de escribir y consulta una sola vez', async () => {
    const entrada = q('#busqueda-borradores') as HTMLInputElement;
    const llamadas = api.listarBorradores.mock.calls.length;
    for (const texto of ['c', 'cr', 'crema']) {
      entrada.value = texto;
      entrada.dispatchEvent(new Event('input'));
    }
    expect(api.listarBorradores).toHaveBeenCalledTimes(llamadas);
    await new Promise((resolver) => setTimeout(resolver, RETARDO_BUSQUEDA_MS + 50));
    await estable();
    expect(api.listarBorradores).toHaveBeenCalledTimes(llamadas + 1);
    expect(api.listarBorradores).toHaveBeenLastCalledWith(ID_IMPORTACION, {
      pagina: 1,
      tamanio: 50,
      estado: 'PENDIENTE',
      busqueda: 'crema',
    });
  });

  it('filtra por página del PDF y valida que sea un número', async () => {
    const entrada = q('#filtro-pagina-pdf') as HTMLInputElement;
    const llamadas = api.listarBorradores.mock.calls.length;
    entrada.value = 'abc';
    entrada.dispatchEvent(new Event('input'));
    await estable();
    expect(q('[data-prueba="error-pagina"]')?.textContent).toContain('número de página');
    await new Promise((resolver) => setTimeout(resolver, RETARDO_BUSQUEDA_MS + 50));
    expect(api.listarBorradores).toHaveBeenCalledTimes(llamadas);

    entrada.value = '12';
    entrada.dispatchEvent(new Event('input'));
    await new Promise((resolver) => setTimeout(resolver, RETARDO_BUSQUEDA_MS + 50));
    await estable();
    expect(api.listarBorradores).toHaveBeenLastCalledWith(ID_IMPORTACION, {
      pagina: 1,
      tamanio: 50,
      estado: 'PENDIENTE',
      paginaPdf: 12,
    });
  });

  it('sin selección, «Aprobar seleccionados» y «Descartar» están deshabilitados', () => {
    expect(botonDe('aprobar')?.disabled).toBe(true);
    expect(botonDe('descartar')?.disabled).toBe(true);
  });

  it('RNF-12: aprobar pide confirmación y no llama a la API si se cancela', async () => {
    await seleccionar(0);
    botonDe('aprobar')?.click();
    await estable();
    expect(document.body.querySelector('.p-confirmdialog')?.textContent).toContain('Se crearán 1 producto');
    botonDeConfirmacion('Cancelar')?.click();
    await estable();
    expect(api.aprobar).not.toHaveBeenCalled();
  });

  it('RF-PRO-01: al confirmar aprueba, muestra la cantidad y el enlace a Productos para subir imágenes', async () => {
    api.aprobar.mockResolvedValue([{ id: 'b1', estado: 'APROBADO', idProducto: 'p1' }]);
    api.obtener.mockResolvedValue(
      importacionPrueba({ totales: { pendientes: 2, aprobados: 1, descartados: 0, conAdvertencias: 2 } }),
    );
    api.listarBorradores.mockResolvedValue(paginaBorradoresPrueba([oferta, sinPrecio]));
    await seleccionar(0);
    botonDe('aprobar')?.click();
    await estable();
    botonDeConfirmacion('Aprobar')?.click();
    await estable();
    expect(api.aprobar).toHaveBeenCalledWith(['b1']);
    expect(q('[data-prueba="cantidad-aviso"]')?.textContent).toContain('Se aprobó 1 producto');
    expect(q('[data-prueba="aviso-productos"]')).not.toBeNull();
    expect(q('[data-prueba="filtro-estado"]')?.textContent).toContain('Aprobados (1)');
    expect(filas()).toHaveLength(2);
  });

  it('RN-11: un borrador sin precio no se envía a aprobar y se avisa', async () => {
    api.aprobar.mockResolvedValue([{ id: 'b1', estado: 'APROBADO', idProducto: 'p1' }]);
    await seleccionar(0, 2);
    expect(q('[data-prueba="conteo-seleccion"]')?.textContent).toContain('1 sin precio');
    botonDe('aprobar')?.click();
    await estable();
    expect(document.body.querySelector('.p-confirmdialog')?.textContent).toContain('1 borrador sin precio no se aprobará');
    botonDeConfirmacion('Aprobar')?.click();
    await estable();
    expect(api.aprobar).toHaveBeenCalledWith(['b1']);
  });

  it('solo borradores sin precio: «Aprobar seleccionados» queda deshabilitado', async () => {
    await seleccionar(2);
    expect(botonDe('aprobar')?.disabled).toBe(true);
    expect(botonDe('descartar')?.disabled).toBe(false);
  });

  it('muestra los errores por borrador del resultado (SIN_PRECIO, NO_PENDIENTE)', async () => {
    api.aprobar.mockResolvedValue([
      { id: 'b1', estado: 'APROBADO', idProducto: 'p1' },
      { id: 'b2', error: 'SIN_PRECIO' },
      { id: 'b3', error: 'NO_PENDIENTE' },
    ]);
    await seleccionar(0, 1);
    botonDe('aprobar')?.click();
    await estable();
    botonDeConfirmacion('Aprobar')?.click();
    await estable();
    const aviso = q('[data-prueba="aviso-lote"]')?.textContent ?? '';
    expect(aviso).toContain('Se aprobó 1 producto');
    expect(aviso).toContain('1 sin precio');
    expect(aviso).toContain('1 que ya no estaban pendientes');
  });

  it('RNF-12: descartar pide confirmación y, al aceptar, llama a la API', async () => {
    api.descartar.mockResolvedValue([
      { id: 'b2', estado: 'DESCARTADO' },
      { id: 'b3', estado: 'DESCARTADO' },
    ]);
    await seleccionar(1, 2);
    botonDe('descartar')?.click();
    await estable();
    expect(document.body.querySelector('.p-confirmdialog')?.textContent).toContain('Se descartarán 2 borradores');
    expect(api.descartar).not.toHaveBeenCalled();
    botonDeConfirmacion('Descartar')?.click();
    await estable();
    expect(api.descartar).toHaveBeenCalledWith(['b2', 'b3']);
    expect(q('[data-prueba="cantidad-aviso"]')?.textContent).toContain('Se descartaron 2 borradores');
  });

  it('si la API falla al aprobar, avisa con un mensaje claro y vuelve a consultar', async () => {
    api.aprobar.mockRejectedValue(new ErrorApi('SIN_CONEXION', 'No se pudo conectar con el servidor.', 0));
    await seleccionar(0);
    botonDe('aprobar')?.click();
    await estable();
    const llamadas = api.listarBorradores.mock.calls.length;
    botonDeConfirmacion('Aprobar')?.click();
    await estable();
    expect(avisos.add).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error', detail: 'No se pudo conectar con el servidor.' }),
    );
    expect(api.listarBorradores.mock.calls.length).toBeGreaterThan(llamadas);
  });

  it('«Editar» abre el diálogo del borrador', async () => {
    (q('[data-prueba="editar"] button') as HTMLButtonElement).click();
    await estable();
    expect(document.body.querySelector('[data-prueba="dialogo-borrador"]')).not.toBeNull();
    expect((document.body.querySelector('#nombre-borrador') as HTMLInputElement).value).toBe('Crema hidratante');
  });

  it('CA-11: sin resultados con filtros ofrece limpiarlos', async () => {
    api.listarBorradores.mockResolvedValue(paginaBorradoresPrueba([]));
    (q('[data-prueba="solo-advertencias"] input') as HTMLElement).click();
    await estable();
    expect(q('[data-prueba="borradores-vacio"]')?.textContent).toContain('No encontramos borradores con esos filtros');
    expect(q('[data-prueba="limpiar-vacio"]')).not.toBeNull();
  });
});

describe('Revision: importación inexistente', () => {
  it('404 muestra un mensaje claro con «Reintentar»', async () => {
    const api = crearApiImportacionesFalsa();
    api.obtener.mockRejectedValue(new ErrorApi('NO_ENCONTRADO', 'x', 404));
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'productos/importar/:id', component: Revision }]),
        { provide: MessageService, useValue: { add: vi.fn() } },
        EstadoMarcas,
        EstadoImportacion,
        { provide: ApiMarcas, useValue: { listar: vi.fn().mockResolvedValue([]) } },
        { provide: ApiImportaciones, useValue: api },
        { provide: AlmacenImportacionesRecientes, useClass: AlmacenRecientesMemoria },
      ],
    }).compileComponents();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/productos/importar/${ID_IMPORTACION}`, Revision);
    await harness.fixture.whenStable();
    harness.detectChanges();
    const texto = (harness.routeNativeElement as HTMLElement).querySelector('[data-prueba="error-lista"]')?.textContent;
    expect(texto).toContain('No encontramos lo que buscas');
    expect(texto).toContain('Reintentar');
    expect(api.listarBorradores).not.toHaveBeenCalled();
  });
});

