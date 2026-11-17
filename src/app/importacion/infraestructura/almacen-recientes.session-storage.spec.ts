import { ID_IMPORTACION } from '../pruebas/dobles-importacion';
import {
  AlmacenRecientesSessionStorage,
  CLAVE_IMPORTACIONES_RECIENTES,
} from './almacen-recientes.session-storage';

describe('AlmacenRecientesSessionStorage', () => {
  let almacen: AlmacenRecientesSessionStorage;

  beforeEach(() => {
    sessionStorage.clear();
    almacen = new AlmacenRecientesSessionStorage();
  });

  it('guarda y lee solo ids (UUID) en la sesión del navegador', () => {
    almacen.guardar([ID_IMPORTACION]);
    expect(sessionStorage.getItem(CLAVE_IMPORTACIONES_RECIENTES)).toBe(JSON.stringify([ID_IMPORTACION]));
    expect(almacen.leer()).toEqual([ID_IMPORTACION]);
  });

  it('ignora lo que no es un UUID o está dañado', () => {
    sessionStorage.setItem(CLAVE_IMPORTACIONES_RECIENTES, JSON.stringify([ID_IMPORTACION, 'x', 3, '../a']));
    expect(almacen.leer()).toEqual([ID_IMPORTACION]);
    sessionStorage.setItem(CLAVE_IMPORTACIONES_RECIENTES, '{no es json');
    expect(almacen.leer()).toEqual([]);
  });
});
