import { TestBed } from '@angular/core/testing';

import { AlmacenPreferenciaTema } from '../../aplicacion/preferencia-tema.puerto';
import { PreferenciaTema } from '../../dominio/tema';
import {
  AHORA,
  ALMACEN_PREFERENCIA_TEMA,
  CLASE_TEMA_OSCURO,
  INTERVALO_REVISION_TEMA_MS,
  ServicioTema,
} from './servicio-tema';

class AlmacenEnMemoria implements AlmacenPreferenciaTema {
  guardada: PreferenciaTema | null;
  constructor(inicial: PreferenciaTema | null = null) {
    this.guardada = inicial;
  }
  leer(): PreferenciaTema | null {
    return this.guardada;
  }
  guardar(preferencia: PreferenciaTema): void {
    this.guardada = preferencia;
  }
}

describe('ServicioTema (D-41)', () => {
  let hora: Date;
  let almacen: AlmacenEnMemoria;

  const hoyA = (h: number, m: number) => new Date(2026, 10, 10, h, m);
  const esOscuro = () => document.documentElement.classList.contains(CLASE_TEMA_OSCURO);

  function crear(inicial: PreferenciaTema | null = null): ServicioTema {
    almacen = new AlmacenEnMemoria(inicial);
    TestBed.configureTestingModule({
      providers: [
        { provide: AHORA, useValue: () => hora },
        { provide: ALMACEN_PREFERENCIA_TEMA, useValue: almacen },
      ],
    });
    return TestBed.inject(ServicioTema);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    hora = hoyA(12, 0);
    document.documentElement.classList.remove(CLASE_TEMA_OSCURO);
  });

  afterEach(() => {
    TestBed.inject(ServicioTema).ngOnDestroy();
    vi.useRealTimers();
    document.documentElement.classList.remove(CLASE_TEMA_OSCURO);
  });

  it('aplica el tema automático al iniciar: claro a las 12:00', () => {
    const servicio = crear();
    servicio.iniciar();
    expect(servicio.preferencia()).toBe('automatico');
    expect(servicio.temaAplicado()).toBe('claro');
    expect(esOscuro()).toBe(false);
  });

  it('arranca oscuro de noche (19:00)', () => {
    hora = hoyA(19, 0);
    const servicio = crear();
    servicio.iniciar();
    expect(servicio.temaAplicado()).toBe('oscuro');
    expect(esOscuro()).toBe(true);
  });

  it('con el panel abierto cambia solo cuando llega 18:40 y vuelve a claro a las 06:45', () => {
    hora = hoyA(18, 39);
    const servicio = crear();
    servicio.iniciar();
    expect(esOscuro()).toBe(false);

    hora = hoyA(18, 40);
    vi.advanceTimersByTime(INTERVALO_REVISION_TEMA_MS);
    expect(servicio.temaAplicado()).toBe('oscuro');
    expect(esOscuro()).toBe(true);

    hora = hoyA(6, 45);
    vi.advanceTimersByTime(INTERVALO_REVISION_TEMA_MS);
    expect(servicio.temaAplicado()).toBe('claro');
    expect(esOscuro()).toBe(false);
  });

  it('al volver a la pestaña (visibilitychange) revisa la hora de inmediato', () => {
    hora = hoyA(18, 0);
    const servicio = crear();
    servicio.iniciar();
    expect(esOscuro()).toBe(false);

    hora = hoyA(20, 0);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(servicio.temaAplicado()).toBe('oscuro');
  });

  it('la preferencia guardada gana sobre el horario', () => {
    hora = hoyA(23, 0);
    const servicio = crear('claro');
    servicio.iniciar();
    expect(servicio.preferencia()).toBe('claro');
    expect(esOscuro()).toBe(false);
  });

  it('seleccionar guarda la preferencia y aplica el tema', () => {
    const servicio = crear();
    servicio.iniciar();
    servicio.seleccionar('oscuro');
    expect(esOscuro()).toBe(true);
    expect(almacen.guardada).toBe('oscuro');

    servicio.seleccionar('automatico');
    expect(esOscuro()).toBe(false); // 12:00
    expect(almacen.guardada).toBe('automatico');
  });

  it('al destruirse limpia el temporizador y deja de oír visibilitychange', () => {
    const servicio = crear();
    servicio.iniciar();
    expect(vi.getTimerCount()).toBe(1);

    servicio.ngOnDestroy();
    expect(vi.getTimerCount()).toBe(0);

    hora = hoyA(23, 0);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(esOscuro()).toBe(false);
  });
});
