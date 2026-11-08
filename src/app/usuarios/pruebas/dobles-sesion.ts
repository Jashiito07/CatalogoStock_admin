/**
 * Dobles de prueba del módulo `usuarios`. Solo se usan en las pruebas
 * (tsconfig.app.json excluye las carpetas `pruebas/`).
 */
import { Mock } from 'vitest';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { AlmacenTokenRenovacion, ApiAutenticacion } from '../aplicacion/puertos';
import { Rol, Sesion, Usuario } from '../dominio/usuario';

export function crearUsuario(rol: Rol = 'VENDEDOR', nombre = 'Rosa Vendedora'): Usuario {
  return {
    id: rol === 'VENDEDOR' ? '11111111-1111-4111-8111-111111111111' : '22222222-2222-4222-8222-222222222222',
    nombre,
    correo: rol === 'VENDEDOR' ? 'vendedora@correo.com' : 'cliente@correo.com',
    telefono: '+593991234567',
    rol,
    privacidadAceptadaEn: null,
    versionPrivacidad: null,
    creadoEn: '2026-11-05T15:00:00.000Z',
  };
}

let contador = 0;

/** Sesión con tokens distintos en cada llamada (como la rotación del servidor). */
export function crearSesion(rol: Rol = 'VENDEDOR'): Sesion {
  contador += 1;
  return {
    tokenAcceso: `acceso-${contador}`,
    venceAccesoEn: '2026-11-07T15:15:00.000Z',
    tokenRenovacion: `renovacion-${contador}`,
    venceRenovacionEn: '2026-11-14T15:00:00.000Z',
    usuario: crearUsuario(rol),
  };
}

export interface ApiAutenticacionFalsa {
  ingresarVendedor: Mock<(correo: string, clave: string) => Promise<Sesion>>;
  renovar: Mock<(tokenRenovacion: string) => Promise<Sesion>>;
  salir: Mock<(tokenRenovacion: string) => Promise<void>>;
  obtenerUsuarioActual: Mock<() => Promise<Usuario>>;
}

export function crearApiFalsa(): ApiAutenticacionFalsa & ApiAutenticacion {
  const api: ApiAutenticacionFalsa = {
    ingresarVendedor: vi.fn(),
    renovar: vi.fn(),
    salir: vi.fn().mockResolvedValue(undefined),
    obtenerUsuarioActual: vi.fn(),
  };
  return api as ApiAutenticacionFalsa & ApiAutenticacion;
}

export class AlmacenEnMemoria extends AlmacenTokenRenovacion {
  valor: string | null = null;

  leer(): string | null {
    return this.valor;
  }

  guardar(token: string): void {
    this.valor = token;
  }

  borrar(): void {
    this.valor = null;
  }
}

export const errorCredenciales = (): ErrorApi =>
  new ErrorApi('CREDENCIALES_INVALIDAS', 'Correo o clave incorrectos.', 401);

export const errorTokenInvalido = (): ErrorApi =>
  new ErrorApi('TOKEN_INVALIDO', 'La sesión no es válida. Inicie sesión de nuevo.', 401);

export const errorSinConexion = (): ErrorApi =>
  new ErrorApi('SIN_CONEXION', 'No se pudo conectar con el servidor.', 0);
