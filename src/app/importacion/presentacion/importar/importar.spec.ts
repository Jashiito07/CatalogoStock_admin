import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { ApiMarcas } from '../../../marcas/aplicacion/puertos';
import { marcaPrueba } from '../../../productos/pruebas/dobles-productos';
import { EstadoImportacion } from '../../aplicacion/estado-importacion';
import { AlmacenImportacionesRecientes, ApiImportaciones } from '../../aplicacion/puertos';
import { Importacion, MAX_BYTES_PDF } from '../../dominio/importacion';
import {
  AlmacenRecientesMemoria,
  ApiImportacionesFalsa,
  crearApiImportacionesFalsa,
  ID_IMPORTACION,
  ID_MARCA,
  importacionPrueba,
} from '../../pruebas/dobles-importacion';
import { Importar } from './importar';

interface Interno {
  alElegirMarca(id: string | null): void;
  alSeleccionar(evento: { currentFiles: File[]; files: File[] }): void;
  opcionesMarca(): { id: string; nombre: string }[];
}

function pdf(nombre = 'catalogo.pdf', tamano = 1000, tipo = 'application/pdf'): File {
  const archivo = new File(['%PDF-1.4'], nombre, { type: tipo });
  Object.defineProperty(archivo, 'size', { value: tamano });
  return archivo;
}

describe('Importar: pantalla «Importar catálogo (PDF)» (RF-PRO-01, D-49, D-55)', () => {
  let api: ApiImportacionesFalsa;
  let almacen: AlmacenRecientesMemoria;
  let harness: RouterTestingHarness;
  let componente: Importar;
  let elemento: HTMLElement;

  const inactiva = marcaPrueba('33333333-3333-4333-8333-333333333333', 'Esika', { activa: false });

  async function estable(): Promise<void> {
    await harness.fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver, 0));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const interno = () => componente as unknown as Interno;
  const q = (selector: string) => elemento.querySelector<HTMLElement>(selector);
  const botonAnalizar = () => q('[data-prueba="analizar"] button') as HTMLButtonElement;

  async function elegir(archivo: File, marca: string | null = ID_MARCA): Promise<void> {
    interno().alElegirMarca(marca);
    interno().alSeleccionar({ currentFiles: [archivo], files: [archivo] });
    await estable();
  }

  async function abrir(): Promise<void> {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'productos/importar', component: Importar }]),
        EstadoMarcas,
        EstadoImportacion,
        {
          provide: ApiMarcas,
          useValue: { listar: vi.fn().mockResolvedValue([marcaPrueba(ID_MARCA, 'Yanbal'), inactiva]) },
        },
        { provide: ApiImportaciones, useValue: api },
        { provide: AlmacenImportacionesRecientes, useValue: almacen },
      ],
    }).compileComponents();
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/productos/importar', Importar);
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
    almacen = new AlmacenRecientesMemoria();
    await abrir();
  });

  afterEach(() => harness.fixture.destroy());

  it('D-48: solo ofrece marcas activas', () => {
    expect(interno().opcionesMarca().map((m) => m.nombre)).toEqual(['Yanbal']);
  });

  it('«Analizar» está deshabilitado hasta elegir marca y PDF', async () => {
    expect(botonAnalizar().disabled).toBe(true);
    interno().alElegirMarca(ID_MARCA);
    await estable();
    expect(botonAnalizar().disabled).toBe(true);
    await elegir(pdf());
    expect(botonAnalizar().disabled).toBe(false);
  });

  it('D-55: valida en el cliente que sea un PDF y que pese hasta 60 MB', async () => {
    await elegir(pdf('foto.png', 1000, 'image/png'));
    expect(q('[data-prueba="error-archivo"]')?.textContent).toContain('no es un PDF');
    expect(botonAnalizar().disabled).toBe(true);

    await elegir(pdf('grande.pdf', MAX_BYTES_PDF + 1));
    expect(q('[data-prueba="error-archivo"]')?.textContent).toContain('60 MB');
    expect(botonAnalizar().disabled).toBe(true);

    await elegir(pdf());
    expect(q('[data-prueba="error-archivo"]')).toBeNull();
    expect(api.analizar).not.toHaveBeenCalled();
  });

  it('muestra el archivo elegido con su peso y permite quitarlo (Analizar vuelve a deshabilitarse)', async () => {
    const entrada = q('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(entrada, 'files', { value: [pdf('catalogo.pdf', 2048)], configurable: true });
    entrada.dispatchEvent(new Event('change'));
    await estable();
    expect(q('[data-prueba="archivo-elegido"]')?.textContent).toContain('catalogo.pdf');
    expect(q('[data-prueba="archivo-elegido"]')?.textContent).toContain('2 KB');
    (q('[data-prueba="quitar-archivo"] button') as HTMLButtonElement).click();
    await estable();
    expect(q('[data-prueba="archivo-elegido"]')).toBeNull();
    expect(botonAnalizar().disabled).toBe(true);
  });

  it('RF-PRO-01: muestra el progreso mientras analiza y luego el resultado con enlace a la revisión', async () => {
    let terminar: (i: Importacion) => void = () => undefined;
    api.analizar.mockReturnValue(new Promise<Importacion>((resolver) => (terminar = resolver)));
    const archivo = pdf();
    await elegir(archivo);
    botonAnalizar().click();
    await estable();
    expect(api.analizar).toHaveBeenCalledWith(archivo, ID_MARCA, expect.any(Function));
    expect(q('[data-prueba="progreso"]')).not.toBeNull();
    expect(q('[data-prueba="resultado"]')).toBeNull();

    terminar(importacionPrueba({ totales: { pendientes: 131, aprobados: 0, descartados: 0, conAdvertencias: 12 } }));
    await estable();
    expect(q('[data-prueba="progreso"]')).toBeNull();
    expect(q('[data-prueba="resumen"]')?.textContent).toContain('Se encontraron 131 productos; 12 con advertencias.');
    expect(q('[data-prueba="revisar"]')).not.toBeNull();
    expect(almacen.ids).toContain(ID_IMPORTACION);
  });

  describe('importar desde el celular (D-61)', () => {
    it('preselecciona la marca por el nombre del archivo y lo avisa', async () => {
      interno().alSeleccionar({
        currentFiles: [pdf('Catalogo Yanbal C15 WhatsApp.pdf')],
        files: [pdf('Catalogo Yanbal C15 WhatsApp.pdf')],
      });
      await estable();
      expect(q('[data-prueba="marca-sugerida"]')?.textContent).toContain('Yanbal');
      expect(botonAnalizar().disabled).toBe(false);
    });

    it('no pisa una marca elegida a mano ni sugiere si el nombre no la reconoce', async () => {
      await elegir(pdf('avon-catalogo.pdf'));
      expect(q('[data-prueba="marca-sugerida"]')).toBeNull();
      interno().alElegirMarca(null);
      interno().alSeleccionar({ currentFiles: [pdf('catalogo.pdf')], files: [pdf('catalogo.pdf')] });
      await estable();
      expect(q('[data-prueba="marca-sugerida"]')).toBeNull();
      expect(botonAnalizar().disabled).toBe(true);
    });

    it('muestra los pasos 1-2-3 en orden', () => {
      const pasos = ['paso-1', 'paso-2', 'paso-3'].map((p) => q(`[data-prueba="${p}"]`)?.textContent ?? '');
      expect(pasos[0]).toContain('Elige la marca');
      expect(pasos[1]).toContain('Elige el PDF');
      expect(pasos[2]).toContain('Analizar');
    });

    it('el selector de archivos solo ofrece PDF y el botón principal es «Elegir PDF del catálogo»', () => {
      expect((q('input[type="file"]') as HTMLInputElement).accept).toBe('application/pdf');
      expect(q('.cs-importar__elegir')?.textContent).toContain('Elegir PDF del catálogo');
    });

    it('muestra el porcentaje real de subida y luego «Analizando…»', async () => {
      let avanzar: (porcentaje: number) => void = () => undefined;
      let terminar: (i: Importacion) => void = () => undefined;
      api.analizar.mockImplementation((_a, _m, alProgreso) => {
        avanzar = alProgreso ?? avanzar;
        return new Promise<Importacion>((resolver) => (terminar = resolver));
      });
      await elegir(pdf());
      botonAnalizar().click();
      await estable();
      avanzar(42);
      await estable();
      expect(q('[data-prueba="texto-subida"]')?.textContent).toContain('42 %');
      avanzar(100);
      await estable();
      expect(q('[data-prueba="texto-subida"]')).toBeNull();
      expect(q('[data-prueba="texto-analisis"]')?.textContent).toContain('Analizando…');
      terminar(importacionPrueba());
      await estable();
      expect(q('[data-prueba="progreso"]')).toBeNull();
    });

    it('no permite analizar dos veces: el botón se deshabilita y un segundo toque no envía otra subida', async () => {
      api.analizar.mockReturnValue(new Promise<Importacion>(() => undefined));
      await elegir(pdf());
      botonAnalizar().click();
      await estable();
      expect(botonAnalizar().disabled).toBe(true);
      botonAnalizar().click();
      await estable();
      expect(api.analizar).toHaveBeenCalledTimes(1);
    });

    it('sin conexión explica que el archivo sigue elegido y deja volver a intentar', async () => {
      api.analizar.mockRejectedValue(new ErrorApi('SIN_CONEXION', 'x', 0));
      await elegir(pdf());
      botonAnalizar().click();
      await estable();
      expect(q('[data-prueba="error-analisis"]')?.textContent).toContain('Se perdió la conexión');
      expect(botonAnalizar().disabled).toBe(false);
    });
  });

  describe('errores del servidor (contrato, «POST /productos/importaciones»)', () => {
    const casos: [string, ErrorApi, string][] = [
      ['400', new ErrorApi('DATOS_INVALIDOS', 'x', 400), 'Revisa los datos'],
      ['404 MARCA_NO_ENCONTRADA', new ErrorApi('MARCA_NO_ENCONTRADA', 'x', 404), 'ya no existe'],
      ['413', new ErrorApi('ARCHIVO_DEMASIADO_GRANDE', 'x', 413), 'más de 60 MB'],
      ['415', new ErrorApi('FORMATO_NO_PERMITIDO', 'x', 415), 'no es un PDF válido'],
      ['422 PDF_ILEGIBLE', new ErrorApi('PDF_ILEGIBLE', 'x', 422), 'No pudimos leer el PDF'],
      ['422 MARCA_INACTIVA', new ErrorApi('MARCA_INACTIVA', 'x', 422), 'desactivada'],
      ['429', new ErrorApi('LIMITE_EXCEDIDO', 'x', 429), '5 por hora'],
    ];

    it.each(casos)('%s se explica con un mensaje claro y deja volver a intentar', async (_n, error, texto) => {
      api.analizar.mockRejectedValue(error);
      await elegir(pdf());
      botonAnalizar().click();
      await estable();
      expect(q('[data-prueba="error-analisis"]')?.textContent).toContain(texto);
      expect(q('[data-prueba="abrir-existente"]')).toBeNull();
      expect(botonAnalizar().disabled).toBe(false);
    });

    it('409 IMPORTACION_DUPLICADA ofrece abrir la importación existente', async () => {
      api.analizar.mockRejectedValue(
        new ErrorApi('IMPORTACION_DUPLICADA', 'x', 409, { idImportacion: ID_IMPORTACION }),
      );
      await elegir(pdf());
      botonAnalizar().click();
      await estable();
      expect(q('[data-prueba="error-analisis"]')?.textContent).toContain('ya fue importado');
      expect(q('[data-prueba="abrir-existente"]')).not.toBeNull();
    });
  });

  describe('importaciones recientes (el contrato no tiene endpoint de lista)', () => {
    it('carga por id las recordadas en la sesión y olvida las que ya no existen', async () => {
      harness.fixture.destroy();
      TestBed.resetTestingModule();
      const otro = '44444444-4444-4444-8444-444444444444';
      almacen = new AlmacenRecientesMemoria();
      almacen.ids = [ID_IMPORTACION, otro];
      api = crearApiImportacionesFalsa();
      api.obtener.mockImplementation((id) =>
        id === otro ? Promise.reject(new ErrorApi('NO_ENCONTRADO', 'x', 404)) : Promise.resolve(importacionPrueba()),
      );
      await abrir();
      const filas = elemento.querySelectorAll('[data-prueba="fila-reciente"]');
      expect(filas).toHaveLength(1);
      expect(filas[0]?.textContent).toContain('catalogo-prueba.pdf');
      expect(filas[0]?.textContent).toContain('Yanbal');
      expect(almacen.ids).toEqual([ID_IMPORTACION]);
    });

    it('sin importaciones muestra un mensaje claro', () => {
      expect(q('[data-prueba="sin-recientes"]')?.textContent).toContain('Todavía no hay importaciones');
    });
  });
});
