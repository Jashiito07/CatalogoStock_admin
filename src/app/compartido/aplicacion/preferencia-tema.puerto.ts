import { PreferenciaTema } from '../dominio/tema';

/**
 * Preferencia de tema del Vendedor, guardada en el navegador (D-41). Es un dato no sensible;
 * nunca se guardan aquí tokens ni credenciales. Es síncrona para poder aplicar el tema
 * antes de la primera pantalla, sin destello.
 */
export interface AlmacenPreferenciaTema {
  /** `null` si nunca se eligió o el valor guardado no es válido (se usa «automático»). */
  leer(): PreferenciaTema | null;
  guardar(preferencia: PreferenciaTema): void;
}
