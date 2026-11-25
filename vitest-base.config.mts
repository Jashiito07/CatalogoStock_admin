import { defineConfig } from 'vitest/config';

/**
 * Configuración base de Vitest para `ng test`.
 * Las pruebas que arrancan Angular completo (rutas, guards, diálogos de PrimeNG) tardan cerca de
 * 5 s en una máquina cargada o en la integración continua; con el límite por defecto fallaban de
 * forma intermitente. Se sube a 30 s: no oculta fallos reales, solo evita falsos negativos por lentitud.
 */
export default defineConfig({
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
