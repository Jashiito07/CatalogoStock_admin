/**
 * Entorno de producción. Sin credenciales ni secretos: solo configuración pública.
 * En despliegue el panel se sirve por HTTPS junto a la API (RNF-01), por eso la URL
 * es relativa al mismo dominio.
 */
export const environment = {
  produccion: true,
  apiUrl: '/api/v1',
};
