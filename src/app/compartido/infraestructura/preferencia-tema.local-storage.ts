import { AlmacenPreferenciaTema } from '../aplicacion/preferencia-tema.puerto';
import { esPreferenciaTema, PreferenciaTema } from '../dominio/tema';

/** Clave propia en `localStorage`. Solo guarda la preferencia de tema (dato no sensible). */
export const CLAVE_PREFERENCIA_TEMA = 'catalogostock_admin_preferencia_tema';

/** Adaptador del puerto con `localStorage`; si el navegador lo bloquea, no falla. */
export class PreferenciaTemaLocalStorage implements AlmacenPreferenciaTema {
  constructor(private readonly almacenamiento: Pick<Storage, 'getItem' | 'setItem'> | null) {}

  leer(): PreferenciaTema | null {
    try {
      const valor = this.almacenamiento?.getItem(CLAVE_PREFERENCIA_TEMA);
      return esPreferenciaTema(valor) ? valor : null;
    } catch {
      return null;
    }
  }

  guardar(preferencia: PreferenciaTema): void {
    try {
      this.almacenamiento?.setItem(CLAVE_PREFERENCIA_TEMA, preferencia);
    } catch {
      // Sin almacenamiento la elección vale solo durante esta sesión.
    }
  }
}
