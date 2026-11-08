/**
 * Usuario y sesión del contrato de usuarios (docs/contrato-api/usuarios.md).
 * Capa de dominio: TypeScript puro, sin Angular ni HTTP.
 */
export const ROLES = ['CLIENTE', 'VENDEDOR'] as const;

export type Rol = (typeof ROLES)[number];

/** «Usuario (respuesta pública)»: nunca incluye la clave, su hash ni tokens. */
export interface Usuario {
  readonly id: string;
  readonly nombre: string;
  readonly correo: string;
  readonly telefono: string;
  readonly rol: Rol;
  readonly privacidadAceptadaEn: string | null;
  readonly versionPrivacidad: string | null;
  readonly creadoEn: string;
}

/** «Sesión» del contrato (D-09): acceso de 15 minutos y renovación de 7 días con rotación. */
export interface Sesion {
  readonly tokenAcceso: string;
  readonly venceAccesoEn: string;
  readonly tokenRenovacion: string;
  readonly venceRenovacionEn: string;
  readonly usuario: Usuario;
}

/**
 * RF-USU-03: el panel solo es para el Vendedor (D-01). La API ya filtra por canal
 * (D-19) y comprueba el rol en cada ruta; esta regla es una defensa adicional que
 * solo decide qué pantalla mostrar, nunca un permiso.
 */
export function puedeUsarElPanel(usuario: Pick<Usuario, 'rol'> | null | undefined): boolean {
  return usuario?.rol === 'VENDEDOR';
}

/** Mensaje único del contrato para credenciales incorrectas o rol no permitido (D-19). */
export const MENSAJE_CREDENCIALES_INVALIDAS = 'Correo o clave incorrectos.';
