import { TestBed } from '@angular/core/testing';

import { rutaLogoHorizontal } from '../marca';
import { OPCIONES_TEMA, SelectorTema } from './selector-tema';
import { ALMACEN_PREFERENCIA_TEMA, ServicioTema } from './servicio-tema';

describe('SelectorTema (D-41)', () => {
  const guardar = vi.fn();

  beforeEach(() => {
    guardar.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: ALMACEN_PREFERENCIA_TEMA, useValue: { leer: () => null, guardar } },
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(ServicioTema).ngOnDestroy();
    document.documentElement.classList.remove('app-oscuro');
  });

  it('ofrece Automático, Claro y Oscuro con nombre accesible', async () => {
    const fixture = TestBed.createComponent(SelectorTema);
    await fixture.whenStable();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(OPCIONES_TEMA.map((o) => o.valor)).toEqual(['automatico', 'claro', 'oscuro']);
    for (const etiqueta of ['Automático', 'Claro', 'Oscuro']) {
      expect(texto).toContain(etiqueta);
    }
  });

  it('al elegir «Oscuro» aplica el tema y guarda la preferencia', async () => {
    const fixture = TestBed.createComponent(SelectorTema);
    await fixture.whenStable();
    const botones = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.p-togglebutton'),
    );
    botones.find((b) => b.textContent?.includes('Oscuro'))?.click();
    await fixture.whenStable();

    const servicio = TestBed.inject(ServicioTema);
    expect(servicio.preferencia()).toBe('oscuro');
    expect(document.documentElement.classList.contains('app-oscuro')).toBe(true);
    expect(guardar).toHaveBeenCalledWith('oscuro');
  });

  it('el logo cambia según el tema', () => {
    expect(rutaLogoHorizontal('claro')).toBe('marca/catalogostock-logo-horizontal.svg');
    expect(rutaLogoHorizontal('oscuro')).toBe(
      'marca/catalogostock-logo-horizontal-fondo-oscuro.svg',
    );
  });
});
