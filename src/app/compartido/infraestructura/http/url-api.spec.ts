import { resolverUrlApi } from './url-api';

const DESARROLLO = 'http://localhost:3000/api/v1';

describe('resolverUrlApi (panel en la red local)', () => {
  it('en la PC (localhost) usa la URL configurada', () => {
    expect(resolverUrlApi(DESARROLLO, { hostname: 'localhost' })).toBe(DESARROLLO);
    expect(resolverUrlApi(DESARROLLO, { hostname: '127.0.0.1' })).toBe(DESARROLLO);
  });

  it('desde el celular usa el mismo host que sirvió el panel, con el puerto de la API', () => {
    expect(resolverUrlApi(DESARROLLO, { hostname: '192.168.1.50' })).toBe(
      'http://192.168.1.50:3000/api/v1',
    );
    expect(resolverUrlApi(DESARROLLO, { hostname: 'mi-pc.local' })).toBe(
      'http://mi-pc.local:3000/api/v1',
    );
  });

  it('no cambia la URL relativa de producción (misma dirección que el panel)', () => {
    expect(resolverUrlApi('/api/v1', { hostname: '192.168.1.50' })).toBe('/api/v1');
  });

  it('no cambia una URL absoluta que no apunte a localhost', () => {
    const remota = 'https://api.catalogostock.ec/api/v1';
    expect(resolverUrlApi(remota, { hostname: '192.168.1.50' })).toBe(remota);
  });

  it('sin información de la ubicación usa la URL configurada', () => {
    expect(resolverUrlApi(DESARROLLO, null)).toBe(DESARROLLO);
  });
});
