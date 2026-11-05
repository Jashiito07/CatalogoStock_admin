import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MenuItem, MessageService } from 'primeng/api';

import { DisenoPanel } from './diseno-panel';
import { AVISO_PROXIMA_FASE, crearSeccionesPanel } from './secciones-panel';

const SECCIONES_FUTURAS = ['Productos', 'Inventario', 'Pedidos', 'Pagos', 'Conflictos', 'Bitácora'];

function itemsDe(secciones: MenuItem[]): MenuItem[] {
  return secciones.flatMap((grupo) => grupo.items ?? []);
}

describe('DisenoPanel', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisenoPanel],
      providers: [provideRouter([]), MessageService],
    }).compileComponents();
  });

  it('se crea con la barra superior del panel del vendedor', async () => {
    const fixture = TestBed.createComponent(DisenoPanel);
    await fixture.whenStable();
    const elemento = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance).toBeTruthy();
    expect(elemento.querySelector('h1')?.textContent?.trim()).toBe(
      'CatálogoStock · Panel del vendedor',
    );
    expect(elemento.querySelector('nav[aria-label="Secciones del panel"]')).not.toBeNull();
    expect(elemento.querySelector('main#contenido-principal')).not.toBeNull();
  });

  it('muestra todas las secciones en el menú lateral', async () => {
    const fixture = TestBed.createComponent(DisenoPanel);
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    for (const seccion of ['Inicio', ...SECCIONES_FUTURAS]) {
      expect(texto).toContain(seccion);
    }
  });
});

describe('crearSeccionesPanel', () => {
  it('deja habilitada solo la sección Inicio', () => {
    const items = itemsDe(crearSeccionesPanel());
    const inicio = items.find((item) => item.label === 'Inicio');

    expect(inicio?.disabled).toBeFalsy();
    expect(inicio?.routerLink).toBe('/inicio');
  });

  it('deshabilita las secciones de las próximas fases con un aviso', () => {
    const items = itemsDe(crearSeccionesPanel());

    for (const seccion of SECCIONES_FUTURAS) {
      const item = items.find((i) => i.label === seccion);
      expect(item, seccion).toBeDefined();
      expect(item?.disabled).toBe(true);
      expect(item?.title).toBe(AVISO_PROXIMA_FASE);
      expect(item?.routerLink).toBeUndefined();
    }
  });
});
