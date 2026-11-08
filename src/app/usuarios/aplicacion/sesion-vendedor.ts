import { computed, inject, Injectable, signal } from '@angular/core';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import {
  MENSAJE_CREDENCIALES_INVALIDAS,
  puedeUsarElPanel,
  Sesion,
  Usuario,
} from '../dominio/usuario';
import { AlmacenTokenRenovacion, ApiAutenticacion } from './puertos';

export const MENSAJE_SESION_TERMINADA = 'Tu sesión terminó. Ingresa de nuevo para continuar.';

/** Resultado de comprobar si hay una sesión utilizable (lo usan los guards). */
export type EstadoSesion = 'activa' | 'sin-sesion' | 'sin-conexion';

/**
 * Sesión del Vendedor en el panel (RF-USU-01, RF-USU-03, D-09, D-19).
 *
 * Almacenamiento (contrato de usuarios, «Panel web»):
 * - El token de acceso (15 min) vive **solo en memoria** en este servicio: no lo puede
 *   leer otro script desde el almacenamiento del navegador y desaparece al recargar.
 * - El token de renovación (7 días, un solo uso) se guarda en `sessionStorage` mediante
 *   `AlmacenTokenRenovacion`: sobrevive a una recarga de la pestaña, pero se pierde al
 *   cerrarla y no se comparte con otras pestañas. Nunca en `localStorage`.
 *
 * El rol solo decide qué pantalla mostrar; los permisos los comprueba la API.
 */
@Injectable({ providedIn: 'root' })
export class SesionVendedor {
  private readonly api = inject(ApiAutenticacion);
  private readonly almacen = inject(AlmacenTokenRenovacion);

  private tokenAcceso: string | null = null;
  private renovacionEnCurso: Promise<string> | null = null;

  private readonly usuarioActual = signal<Usuario | null>(null);

  /** Vendedor con sesión iniciada, o `null`. */
  readonly usuario = this.usuarioActual.asReadonly();
  readonly activa = computed(() => puedeUsarElPanel(this.usuarioActual()));

  /** Token de acceso en memoria para el interceptor; `null` sin sesión. */
  obtenerTokenAcceso(): string | null {
    return this.tokenAcceso;
  }

  /**
   * Inicia sesión con `/autenticacion/ingreso/vendedor` (D-19). Si, por un error del
   * servidor, llegara una sesión de otro rol, se revoca y se responde con el mismo
   * mensaje genérico, sin guardar nada (RF-USU-03, defensa adicional).
   */
  async ingresar(correo: string, clave: string): Promise<void> {
    const sesion = await this.api.ingresarVendedor(correo.trim(), clave);
    if (!puedeUsarElPanel(sesion.usuario)) {
      await this.revocarSesionAjena(sesion);
      throw new ErrorApi('CREDENCIALES_INVALIDAS', MENSAJE_CREDENCIALES_INVALIDAS, 401);
    }
    this.establecer(sesion);
  }

  /**
   * Renueva la sesión con el token de renovación guardado (rotación, D-09).
   * Varias solicitudes que fallan a la vez comparten **una sola** renovación: reenviar
   * un token ya rotado haría que la API revocara toda la sesión.
   */
  renovar(): Promise<string> {
    this.renovacionEnCurso ??= this.ejecutarRenovacion().finally(() => {
      this.renovacionEnCurso = null;
    });
    return this.renovacionEnCurso;
  }

  /**
   * Comprueba que haya una sesión del Vendedor; tras recargar la página la recupera con
   * el token de renovación de `sessionStorage`.
   */
  async asegurarSesion(): Promise<EstadoSesion> {
    if (this.tokenAcceso !== null && this.activa()) {
      return 'activa';
    }
    if (this.almacen.leer() === null) {
      return 'sin-sesion';
    }
    try {
      await this.renovar();
      return 'activa';
    } catch (error) {
      return error instanceof ErrorApi && esErrorTransitorio(error) ? 'sin-conexion' : 'sin-sesion';
    }
  }

  /**
   * Cierra la sesión (RF-USU-01): pide a la API revocar la familia del token y borra la
   * sesión local aunque la API no responda (el servidor la dejará vencer).
   */
  async cerrarSesion(): Promise<void> {
    const tokenRenovacion = this.almacen.leer();
    try {
      if (tokenRenovacion !== null && this.tokenAcceso !== null) {
        await this.api.salir(tokenRenovacion);
      }
    } catch {
      // Sin respuesta de la API: se descarta la sesión local de todas formas.
    } finally {
      this.descartar();
    }
  }

  /** Borra la sesión local (tokens y usuario) sin llamar a la API. */
  descartar(): void {
    this.tokenAcceso = null;
    this.almacen.borrar();
    this.usuarioActual.set(null);
  }

  private async ejecutarRenovacion(): Promise<string> {
    const tokenRenovacion = this.almacen.leer();
    if (tokenRenovacion === null) {
      this.descartar();
      throw new ErrorApi('NO_AUTENTICADO', MENSAJE_SESION_TERMINADA, 401);
    }
    let sesion: Sesion;
    try {
      sesion = await this.api.renovar(tokenRenovacion);
    } catch (error) {
      // Sin conexión o límite de intentos: el token puede seguir siendo válido y se
      // conserva para reintentar. Cualquier otro rechazo (TOKEN_INVALIDO) termina la sesión.
      if (!(error instanceof ErrorApi && esErrorTransitorio(error))) {
        this.descartar();
      }
      throw error;
    }
    if (!puedeUsarElPanel(sesion.usuario)) {
      await this.revocarSesionAjena(sesion);
      throw new ErrorApi('NO_AUTENTICADO', MENSAJE_SESION_TERMINADA, 401);
    }
    this.establecer(sesion);
    return sesion.tokenAcceso;
  }

  private establecer(sesion: Sesion): void {
    this.tokenAcceso = sesion.tokenAcceso;
    this.almacen.guardar(sesion.tokenRenovacion);
    this.usuarioActual.set(sesion.usuario);
  }

  /** Revoca en la API una sesión que el panel no acepta y no deja rastro local. */
  private async revocarSesionAjena(sesion: Sesion): Promise<void> {
    this.tokenAcceso = sesion.tokenAcceso;
    try {
      await this.api.salir(sesion.tokenRenovacion);
    } catch {
      // Si no se pudo revocar, el servidor la dejará vencer.
    } finally {
      this.descartar();
    }
  }
}

/** Errores que no invalidan la sesión: la API no respondió, falló o pidió esperar. */
export function esErrorTransitorio(error: ErrorApi): boolean {
  return error.esSinConexion || error.estado === 429 || error.estado >= 500;
}
