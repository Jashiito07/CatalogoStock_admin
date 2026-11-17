import { Injectable } from '@angular/core';

import { AlmacenImportacionesRecientes } from '../aplicacion/puertos';

export const CLAVE_IMPORTACIONES_RECIENTES = 'cs.importaciones-recientes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Recuerda en `sessionStorage` solo los ids (UUID) de las importaciones abiertas hace poco, para
 * retomarlas. No guarda nombres de archivo, productos ni datos personales. Si el navegador no
 * permite el almacenamiento, el panel sigue funcionando sin recientes.
 */
@Injectable()
export class AlmacenRecientesSessionStorage extends AlmacenImportacionesRecientes {
  leer(): readonly string[] {
    try {
      const valor: unknown = JSON.parse(sessionStorage.getItem(CLAVE_IMPORTACIONES_RECIENTES) ?? '[]');
      return Array.isArray(valor)
        ? valor.filter((id): id is string => typeof id === 'string' && UUID.test(id))
        : [];
    } catch {
      return [];
    }
  }

  guardar(ids: readonly string[]): void {
    try {
      sessionStorage.setItem(CLAVE_IMPORTACIONES_RECIENTES, JSON.stringify(ids));
    } catch {
      // Sin almacenamiento disponible: no se recuerdan las importaciones.
    }
  }
}
