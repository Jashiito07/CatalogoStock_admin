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
import { Borrador } from '../../dominio/importacion';
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

const ETIQUETA = 'Precio tomado de la ficha del catálogo. Confírmalo antes de aprobar';

/**
 * Advertencia `PRECIO_HEREDADO` del perfil Yanbal (contrato productos-importacion.md, «Precio heredado
 * de la ficha»): etiqueta, «Confirmar precio», aprobar con `PRECIO_NO_CONFIRMADO`, contador y filtro.
 * RN-11 (el servidor decide), RN-13 y RN-14 (no inventar datos), RNF-11 y RNF-12.
 */
function pruebasDeRevision(titulo: string, movil: boolean): void {
  describe(titulo, () => {
    let api: ApiImportacionesFalsa;
    let avisos: { add: ReturnType<typeof vi.fn> };
    let harness: RouterTestingHarness;
    let elemento: HTMLElement;
    let servidor: Borrador[];
    const matchMediaOriginal = window.matchMedia;

    const normal = () => borradorPrueba('b1', { nombre: 'Crema hidratante', codigo: '43873' });
    const heredado = (id: string, nombre: string, codigo: string) =>
      borradorPrueba(id, {
        nombre,
        codigo,
        precio: '19.50',
        precioNormal: '39.00',
        advertencias: ['PRECIO_HEREDADO', 'PRECIO_EN_OFERTA'],
      });

    async function estable(): Promise<void> {
      await harness.fixture.whenStable();
      await new Promise((resolver) => setTimeout(resolver, 0));
      await harness.fixture.whenStable();
      harness.detectChanges();
    }

    beforeEach(async () => {
      window.matchMedia = ((consulta: string) =>
        ({
          matches: movil,
          media: consulta,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;

      servidor = [
        normal(),
        heredado('h1', 'Base en Polvo – Tono 1', '6232'),
        heredado('h2', 'Base en Polvo – Tono 2', '6233'),
      ];
      avisos = { add: vi.fn() };
      api = crearApiImportacionesFalsa();
      api.obtener.mockImplementation(async () =>
        importacionPrueba({
          totales: {
            pendientes: servidor.filter((b) => b.estado === 'PENDIENTE').length,
            aprobados: 0,
            descartados: 0,
            conAdvertencias: servidor.filter((b) => b.advertencias.length > 0).length,
          },
        }),
      );
      // Servidor simulado: filtra por estado y por «con advertencias», como la API real.
      api.listarBorradores.mockImplementation(async (_id, consulta) => {
        const lista = servidor.filter(
          (b) =>
            b.estado === consulta.estado &&
            (consulta.conAdvertencias !== true || b.advertencias.length > 0),
        );
        return paginaBorradoresPrueba(lista, consulta, lista.length);
      });
      api.editarBorrador.mockImplementation(async (id, cambios) => {
        const actual = servidor.find((b) => b.id === id) as Borrador;
        const nuevo: Borrador = {
          ...actual,
          advertencias:
            cambios.precio === undefined
              ? actual.advertencias
              : actual.advertencias.filter((a) => a !== 'PRECIO_HEREDADO'),
        };
        servidor = servidor.map((b) => (b.id === id ? nuevo : b));
        return nuevo;
      });

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
    });

    afterEach(() => {
      harness.fixture.destroy();
      document.body.querySelectorAll('.p-dialog-mask, .p-confirmdialog').forEach((n) => n.remove());
      window.matchMedia = matchMediaOriginal;
    });

    const q = (selector: string) => elemento.querySelector<HTMLElement>(selector);
    const filas = () => Array.from(elemento.querySelectorAll<HTMLElement>('[data-prueba="fila-borrador"]'));
    const botonDe = (selector: string) => q(`${selector} button`) as HTMLButtonElement | null;
    const botonDeConfirmacion = (texto: string) =>
      Array.from(document.body.querySelectorAll<HTMLButtonElement>('.p-confirmdialog button')).find((b) =>
        b.textContent?.includes(texto),
      );
    const marcar = async (indice: number) => {
      const selector = movil
        ? '[data-prueba="seleccionar-borrador"] input'
        : 'p-tablecheckbox input';
      filas()[indice]?.querySelector<HTMLElement>(selector)?.click();
      await estable();
    };

    it('RN-13: el borrador heredado muestra la etiqueta de aviso con texto, ícono y severidad warn (no solo color)', () => {
      const etiqueta = filas()[1]?.querySelector('[data-prueba="advertencia-revision"]');
      expect(etiqueta?.textContent).toContain(ETIQUETA);
      expect(etiqueta?.querySelector('.pi-exclamation-triangle')).not.toBeNull();
      expect(etiqueta?.querySelector('.p-tag')?.className ?? etiqueta?.className).toContain('p-tag-warn');
      // El borrador normal no la lleva.
      expect(filas()[0]?.querySelector('[data-prueba="advertencia-revision"]')).toBeNull();
    });

    it('RNF-11: la ayuda explica de dónde salió el precio (visible en el celular, para lectores de pantalla en la tabla)', () => {
      const ayuda = filas()[1]?.querySelector('[data-prueba="ayuda-precio-heredado"]');
      expect(ayuda?.textContent).toContain('Este producto no traía su propio precio en el catálogo');
      expect(ayuda?.textContent).toContain('pulsa Confirmar precio o corrígelo');
      expect(filas()[0]?.querySelector('[data-prueba="ayuda-precio-heredado"]')).toBeNull();
    });

    it('el encabezado cuenta cuántos borradores esperan confirmación de precio y es un aviso accesible', () => {
      const contador = q('[data-prueba="contador-por-confirmar"]');
      expect(q('[data-prueba="cantidad-por-confirmar"]')?.textContent).toContain('2 borradores esperan confirmación de precio');
      expect(contador?.getAttribute('role')).toBe('status');
    });

    it('RN-11: «Confirmar precio» hace PATCH con el precio actual, quita la advertencia y baja el contador', async () => {
      botonDe('[data-prueba="confirmar-precio"]')?.click();
      await estable();
      expect(api.editarBorrador).toHaveBeenCalledWith('h1', { precio: '19.50' });
      expect(filas()[1]?.querySelector('[data-prueba="advertencia-revision"]')).toBeNull();
      expect(filas()[1]?.querySelector('[data-prueba="confirmar-precio"]')).toBeNull();
      expect(q('[data-prueba="cantidad-por-confirmar"]')?.textContent).toContain('1 borrador espera confirmación de precio');
      expect(avisos.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success', summary: 'Precio confirmado' }),
      );
    });

    it('RNF-11: el botón «Confirmar precio» indica a qué producto pertenece', () => {
      const boton = botonDe('[data-prueba="confirmar-precio"]');
      expect(boton?.getAttribute('aria-label')).toBe('Confirmar precio de Base en Polvo – Tono 1');
      expect(boton?.textContent).toContain('Confirmar precio');
    });

    it('si el PATCH falla avisa con un mensaje claro y la advertencia sigue', async () => {
      api.editarBorrador.mockRejectedValue(new ErrorApi('SIN_CONEXION', 'No se pudo conectar con el servidor.', 0));
      botonDe('[data-prueba="confirmar-precio"]')?.click();
      await estable();
      expect(avisos.add).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'error', detail: 'No se pudo conectar con el servidor.' }),
      );
      expect(filas()[1]?.querySelector('[data-prueba="advertencia-revision"]')).not.toBeNull();
    });

    it('RN-11: un heredado sin confirmar no se aprueba, ni seleccionando todos (solo se envían los aprobables)', async () => {
      await marcar(1);
      expect(botonDe('[data-prueba="aprobar"]')?.disabled).toBe(true);
      expect(q('[data-prueba="conteo-seleccion"]')?.textContent).toContain('1 por confirmar precio');

      await marcar(0);
      api.aprobar.mockResolvedValue([{ id: 'b1', estado: 'APROBADO', idProducto: 'p1' }]);
      botonDe('[data-prueba="aprobar"]')?.click();
      await estable();
      expect(document.body.querySelector('.p-confirmdialog')?.textContent).toContain(
        '1 borrador necesita confirmar el precio y no se aprobará hasta entonces',
      );
      botonDeConfirmacion('Aprobar')?.click();
      await estable();
      expect(api.aprobar).toHaveBeenCalledWith(['b1']);
    });

    it('RN-11: si el servidor responde PRECIO_NO_CONFIRMADO avisa con claridad, sin error genérico y conserva la selección', async () => {
      api.aprobar.mockResolvedValue([
        { id: 'b1', error: 'PRECIO_NO_CONFIRMADO' },
      ]);
      await marcar(0);
      botonDe('[data-prueba="aprobar"]')?.click();
      await estable();
      botonDeConfirmacion('Aprobar')?.click();
      await estable();

      expect(q('[data-prueba="aviso-por-confirmar"]')?.textContent).toContain('1 borrador necesita confirmar el precio');
      expect(q('[data-prueba="aviso-lote"]')?.textContent).not.toContain('No se procesaron');
      expect(avisos.add).not.toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
      expect(avisos.add).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'warn',
          detail: expect.stringContaining('1 borrador necesita confirmar el precio') as string,
        }),
      );
      expect(q('[data-prueba="conteo-seleccion"]')?.textContent).toContain('1 seleccionado');
    });

    it('con varios PRECIO_NO_CONFIRMADO el aviso dice «N borradores necesitan confirmar el precio»', async () => {
      api.aprobar.mockResolvedValue([
        { id: 'b1', error: 'PRECIO_NO_CONFIRMADO' },
        { id: 'h1', error: 'PRECIO_NO_CONFIRMADO' },
        { id: 'h2', error: 'SIN_PRECIO' },
      ]);
      await marcar(0);
      botonDe('[data-prueba="aprobar"]')?.click();
      await estable();
      botonDeConfirmacion('Aprobar')?.click();
      await estable();
      const aviso = q('[data-prueba="aviso-lote"]')?.textContent ?? '';
      expect(aviso).toContain('2 borradores necesitan confirmar el precio');
      expect(aviso).toContain('1 sin precio');
    });

    it('el filtro rápido muestra solo los que esperan confirmación y se puede quitar', async () => {
      botonDe('[data-prueba="filtro-por-confirmar"]')?.click();
      await estable();
      expect(filas()).toHaveLength(2);
      expect(filas().every((f) => f.textContent?.includes('Base en Polvo'))).toBe(true);
      expect(api.listarBorradores).toHaveBeenCalledWith(
        ID_IMPORTACION,
        expect.objectContaining({ estado: 'PENDIENTE', conAdvertencias: true }),
      );
      // El botón cambia de texto: el estado no depende solo del color ni del ícono.
      expect(botonDe('[data-prueba="filtro-por-confirmar"]')?.textContent).toContain('Ver todos los pendientes');

      botonDe('[data-prueba="filtro-por-confirmar"]')?.click();
      await estable();
      expect(filas()).toHaveLength(3);
    });

    it('en el modo filtrado, confirmar un precio saca el borrador de la lista', async () => {
      botonDe('[data-prueba="filtro-por-confirmar"]')?.click();
      await estable();
      botonDe('[data-prueba="confirmar-precio"]')?.click();
      await estable();
      expect(filas()).toHaveLength(1);
      expect(filas()[0]?.textContent).toContain('Tono 2');
    });

    it('CA-11: si ninguno espera confirmación, el filtro muestra el vacío y permite limpiarlo', async () => {
      servidor = servidor.map((b) => ({ ...b, advertencias: [] }));
      botonDe('[data-prueba="filtro-por-confirmar"]')?.click();
      await estable();
      expect(q('[data-prueba="borradores-vacio"]')?.textContent).toContain('No encontramos borradores con esos filtros');
      (q('[data-prueba="limpiar-vacio"] button') ?? q('[data-prueba="limpiar-vacio"]'))?.click();
      await estable();
      expect(filas()).toHaveLength(3);
    });
  });
}

pruebasDeRevision('Revision (PC): precio heredado de la ficha, perfil Yanbal', false);
pruebasDeRevision('Revision (celular): precio heredado de la ficha, perfil Yanbal', true);
