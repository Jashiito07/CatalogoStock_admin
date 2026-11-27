import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';

import { AlmacenTokenRenovacion, ApiAutenticacion } from '../../../usuarios/aplicacion/puertos';
import { SesionVendedor } from '../../../usuarios/aplicacion/sesion-vendedor';
import {
  AlmacenEnMemoria,
  ApiAutenticacionFalsa,
  crearApiFalsa,
  crearSesion,
} from '../../../usuarios/pruebas/dobles-sesion';
import { importacionPrueba } from '../../../importacion/pruebas/dobles-importacion';
import { ResumenClientes, ResumenPanel, ResumenProductos, Seccion } from '../../aplicacion/resumen-panel';
import { Inicio } from './inicio';

function listo<T>(datos: T): Seccion<T> {
  return { estado: 'listo', datos };
}

/** Doble de ResumenPanel: las secciones son señales que cada prueba puede cambiar. */
function crearResumenFalso() {
  return {
    cargar: vi.fn().mockResolvedValue(undefined),
    productos: signal<Seccion<ResumenProductos>>(
      listo({
        total: 10,
        porDisponibilidad: { DISPONIBLE: 7, AGOTADO: 2, PENDIENTE_REPOSICION: 1 },
        porMarca: [
          { id: 'm1', nombre: 'Yanbal', color: '#FC5823', total: 6 },
          { id: 'm2', nombre: "L'Bel", color: '#2E1A47', total: 4 },
        ],
      }),
    ),
    marcas: signal(listo({ activas: 2, total: 3 })),
    clientes: signal<Seccion<ResumenClientes>>(
      listo({ activos: 9, desactivados: 3, sinVerificar: 5, verificados: 7 }),
    ),
    importaciones: signal(
      listo({ recientes: [importacionPrueba()], borradoresPendientes: 4 }),
    ),
    actividad: signal(
      listo([
        {
          id: 'a1',
          fecha: '2026-11-05T15:16:02Z',
          accion: 'SESION_INICIADA',
          usuario: { id: 'u1', nombre: 'Vendedora', rol: 'VENDEDOR' },
          entidad: 'SESION',
          idEntidad: null,
          detalle: {},
        },
      ]),
    ),
  };
}
type ResumenFalso = ReturnType<typeof crearResumenFalso>;

describe('Inicio', () => {
  let api: ApiAutenticacionFalsa;
  let resumen: ResumenFalso;

  beforeEach(async () => {
    resumen = crearResumenFalso();
    api = crearApiFalsa();
    await TestBed.configureTestingModule({
      imports: [Inicio],
      providers: [
        MessageService,
        provideRouter([]),
        { provide: ResumenPanel, useValue: resumen },
        { provide: ApiAutenticacion, useValue: api },
        { provide: AlmacenTokenRenovacion, useValue: new AlmacenEnMemoria() },
      ],
    }).compileComponents();
  });

  it('D-50: sin sesión no muestra el aviso «Verifica tu correo»', async () => {
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-verificar-correo')).toBeNull();
  });

  it('D-50: con el correo sin verificar muestra «Verifica tu correo» y lo oculta al verificarlo', async () => {
    const sesion = crearSesion();
    api.ingresarVendedor.mockResolvedValue(sesion);
    const servicio = TestBed.inject(SesionVendedor);
    await servicio.ingresar(sesion.usuario.correo, 'Clave2026');

    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;
    expect(elemento.querySelector('app-verificar-correo')?.textContent).toContain('Verifica tu correo');
    expect(elemento.textContent).toContain(sesion.usuario.correo);

    servicio.actualizarUsuario({ ...sesion.usuario, correoVerificadoEn: '2026-11-15T10:00:00.000Z' });
    await fixture.whenStable();
    expect(elemento.querySelector('app-verificar-correo')).toBeNull();
  });

  it('muestra los datos reales en las tarjetas de resumen', async () => {
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;
    const valor = (prueba: string): string | undefined =>
      elemento.querySelector(`[data-prueba="${prueba}"]`)?.textContent?.trim();

    expect(resumen.cargar).toHaveBeenCalledTimes(1);
    expect(valor('valor-productos')).toBe('10');
    expect(valor('valor-marcas')).toBe('2');
    expect(valor('valor-clientes')).toBe('9');
    expect(valor('valor-borradores')).toBe('4');
    expect(elemento.textContent).toContain('3 desactivados · 7 con correo verificado');
  });

  it('dibuja los gráficos con texto e ícono (no solo color) y las barras por marca', async () => {
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    const leyenda = elemento.querySelectorAll('[data-prueba="leyenda-disponibilidad"]');
    expect(leyenda).toHaveLength(3);
    expect(leyenda[0].textContent).toContain('Disponible');
    expect(leyenda[0].querySelector('i.pi-check-circle')).not.toBeNull();
    expect(leyenda[1].querySelector('i.pi-times-circle')).not.toBeNull();
    expect(leyenda[2].querySelector('i.pi-clock')).not.toBeNull();
    expect(elemento.querySelectorAll('[data-prueba="barra-marca"]')).toHaveLength(2);
    expect(elemento.querySelectorAll('.cs-dona__svg circle')).toHaveLength(3);
    expect(elemento.querySelector('[data-prueba="correos-sin-verificar"]')?.textContent).toContain('5');
  });

  it('muestra la actividad reciente de la bitácora y las importaciones recientes', async () => {
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('[data-prueba="actividad"]')?.textContent).toContain('Sesión iniciada');
    expect(elemento.querySelector('[data-prueba="importacion-reciente"]')?.textContent).toContain(
      'catalogo-prueba.pdf',
    );
  });

  it('no muestra ventas ni pedidos por estado (llegan en la Fase 6)', async () => {
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    const texto = ((fixture.nativeElement as HTMLElement).textContent ?? '').toLowerCase();
    expect(texto).not.toContain('ventas del');
    expect(texto).not.toContain('pendiente de pago');
  });

  it('una sección con error lo dice sin tumbar las demás', async () => {
    resumen.clientes.set({ estado: 'error' });
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(elemento.querySelector('[data-prueba="tarjeta-clientes"]')?.textContent).toContain(
      'No pudimos cargar los clientes.',
    );
    expect(elemento.querySelector('[data-prueba="valor-productos"]')?.textContent?.trim()).toBe('10');
  });

  it('«Actualizar» vuelve a consultar los datos', async () => {
    const fixture = TestBed.createComponent(Inicio);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-prueba="actualizar-resumen"] button, button[data-prueba="actualizar-resumen"]')
      ?.click();
    expect(resumen.cargar).toHaveBeenCalledTimes(2);
  });
});