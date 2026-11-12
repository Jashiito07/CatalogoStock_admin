import { CLAVE_PREFERENCIA_TEMA, PreferenciaTemaLocalStorage } from './preferencia-tema.local-storage';

function almacenamientoFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    datos,
    getItem: (clave: string) => datos.get(clave) ?? null,
    setItem: (clave: string, valor: string) => void datos.set(clave, valor),
  };
}

describe('PreferenciaTemaLocalStorage (D-41)', () => {
  it('sin valor guardado devuelve null (automático)', () => {
    expect(new PreferenciaTemaLocalStorage(almacenamientoFalso()).leer()).toBeNull();
  });

  it('guarda y lee la preferencia con una clave propia', () => {
    const falso = almacenamientoFalso();
    const almacen = new PreferenciaTemaLocalStorage(falso);
    almacen.guardar('oscuro');
    expect(falso.datos.get(CLAVE_PREFERENCIA_TEMA)).toBe('oscuro');
    expect(almacen.leer()).toBe('oscuro');
  });

  it('ignora un valor guardado no válido', () => {
    const falso = almacenamientoFalso({ [CLAVE_PREFERENCIA_TEMA]: 'morado' });
    expect(new PreferenciaTemaLocalStorage(falso).leer()).toBeNull();
  });

  it('no falla si el navegador bloquea el almacenamiento', () => {
    const bloqueado = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const almacen = new PreferenciaTemaLocalStorage(bloqueado);
    expect(almacen.leer()).toBeNull();
    expect(() => almacen.guardar('claro')).not.toThrow();
    expect(() => new PreferenciaTemaLocalStorage(null).guardar('claro')).not.toThrow();
  });
});
