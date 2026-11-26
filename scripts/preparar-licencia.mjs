// Garantiza que exista src/environments/licencia-primeng.local.ts (ignorado por Git, D-59).
// Clave: PRIMEUI_LICENSE → ~/catalogostock-claves/primeui.txt → vacío. Nunca imprime la clave.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decidirEscritura, resolverClave } from './licencia.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
// LICENCIA_DESTINO y LICENCIA_ARCHIVO_CLAVES existen solo para las pruebas.
const destino =
  process.env.LICENCIA_DESTINO ?? join(raiz, 'src', 'environments', 'licencia-primeng.local.ts');
const archivoClaves =
  process.env.LICENCIA_ARCHIVO_CLAVES ?? join(homedir(), 'catalogostock-claves', 'primeui.txt');

try {
  const contenidoArchivo = existsSync(archivoClaves) ? readFileSync(archivoClaves, 'utf8') : '';
  const clave = resolverClave({ entorno: process.env.PRIMEUI_LICENSE, contenidoArchivo });
  const contenidoExistente = existsSync(destino) ? readFileSync(destino, 'utf8') : '';
  const decision = decidirEscritura({ clave, contenidoExistente });
  if (decision.escribir) writeFileSync(destino, decision.contenido, 'utf8');
  console.log(`[licencia PrimeNG] ${decision.mensaje}`);
} catch (error) {
  // Solo el mensaje propio (nunca el valor de la clave).
  console.error(`[licencia PrimeNG] ${error instanceof Error ? error.message : 'error'}`);
  process.exit(1);
}