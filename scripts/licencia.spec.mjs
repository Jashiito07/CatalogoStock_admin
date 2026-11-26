import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

import {
  decidirEscritura,
  escaparLiteral,
  generarContenido,
  normalizarClave,
  resolverClave,
} from './licencia.mjs';

describe('resolverClave (D-59)', () => {
  it('prioriza la variable de entorno sobre el archivo', () => {
    expect(resolverClave({ entorno: 'ENTORNO', contenidoArchivo: 'ARCHIVO' })).toBe('ENTORNO');
  });
  it('usa el archivo si no hay variable', () => {
    expect(resolverClave({ entorno: undefined, contenidoArchivo: 'ARCHIVO\r\n' })).toBe('ARCHIVO');
  });
  it('devuelve vacío si no hay ninguna', () => {
    expect(resolverClave({ entorno: '', contenidoArchivo: '  \n' })).toBe('');
  });
});

describe('normalizarClave y escape', () => {
  it('rechaza espacios y saltos de línea internos', () => {
    expect(() => normalizarClave('AB CD')).toThrow();
    expect(() => normalizarClave('AB\nCD')).toThrow();
  });
  it('escapa comillas y barras', () => {
    expect(escaparLiteral(`a'b\\c`)).toBe(`a\\'b\\\\c`);
    expect(generarContenido(`a'b\\c`)).toContain(`LICENCIA_PRIMENG = 'a\\'b\\\\c';`);
  });
});

describe('decidirEscritura', () => {
  it('no sobrescribe una clave válida con una vacía', () => {
    const existente = generarContenido('CLAVE-FALSA');
    const d = decidirEscritura({ clave: '', contenidoExistente: existente });
    expect(d.escribir).toBe(false);
    expect(d.mensaje).toBe('clave aplicada');
  });
  it('escribe vacío cuando no hay archivo ni clave', () => {
    const d = decidirEscritura({ clave: '', contenidoExistente: '' });
    expect(d.escribir).toBe(true);
    expect(d.contenido).toContain(`LICENCIA_PRIMENG = '';`);
    expect(d.mensaje).toBe('sin clave');
  });
  it('actualiza cuando la clave cambia', () => {
    const d = decidirEscritura({ clave: 'NUEVA', contenidoExistente: generarContenido('VIEJA') });
    expect(d.escribir).toBe(true);
    expect(d.contenido).toContain(`'NUEVA'`);
  });
});

describe('preparar-licencia.mjs', () => {
  it('no imprime la clave en la salida', () => {
    const clave = 'CLAVE-FALSA-SECRETA-987654';
    const carpeta = mkdtempSync(join(tmpdir(), 'licencia-'));
    const destino = join(carpeta, 'local.ts');
    const r = spawnSync(process.execPath, [join(import.meta.dirname, 'preparar-licencia.mjs')], {
      env: {
        ...process.env,
        PRIMEUI_LICENSE: clave,
        LICENCIA_DESTINO: destino,
        LICENCIA_ARCHIVO_CLAVES: join(carpeta, 'no-existe.txt'),
      },
      encoding: 'utf8',
    });
    expect(r.stdout + r.stderr).not.toContain(clave);
    expect(r.stdout).toContain('clave aplicada');
    expect(readFileSync(destino, 'utf8')).toContain(clave);
  });
});