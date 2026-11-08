import { TestBed } from '@angular/core/testing';

import {
  AlmacenTokenRenovacionSessionStorage,
  CLAVE_TOKEN_RENOVACION,
} from './almacen-token-renovacion.session-storage';

describe('AlmacenTokenRenovacionSessionStorage', () => {
  let almacen: AlmacenTokenRenovacionSessionStorage;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [AlmacenTokenRenovacionSessionStorage] });
    almacen = TestBed.inject(AlmacenTokenRenovacionSessionStorage);
  });

  afterEach(() => sessionStorage.clear());

  it('guarda el token de renovación en sessionStorage y nunca en localStorage', () => {
    almacen.guardar('renovacion-1');

    expect(sessionStorage.getItem(CLAVE_TOKEN_RENOVACION)).toBe('renovacion-1');
    expect(localStorage.length).toBe(0);
    expect(almacen.leer()).toBe('renovacion-1');
  });

  it('lee el token que dejó una recarga anterior de la pestaña', () => {
    sessionStorage.setItem(CLAVE_TOKEN_RENOVACION, 'renovacion-previa');
    expect(almacen.leer()).toBe('renovacion-previa');
  });

  it('borra el token', () => {
    almacen.guardar('renovacion-1');
    almacen.borrar();

    expect(almacen.leer()).toBeNull();
    expect(sessionStorage.getItem(CLAVE_TOKEN_RENOVACION)).toBeNull();
  });

  it('si el navegador bloquea sessionStorage, lo conserva solo en memoria', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    almacen.guardar('renovacion-1');

    expect(almacen.leer()).toBe('renovacion-1');
    vi.restoreAllMocks();
  });
});
