import { inject, Injectable } from '@angular/core';

import { ErrorApi } from '../../compartido/aplicacion/error-api';
import { esCodigoCorreoValido } from '../dominio/codigo-correo';
import { ErrorDatosCorreo, MENSAJES_CORREO } from './mensajes-correo';
import { ApiAutenticacion } from './puertos';
import { SesionVendedor } from './sesion-vendedor';

/** Vuelve a leer al Vendedor (`GET /usuarios/yo`) y actualiza la sesión. */
@Injectable({ providedIn: 'root' })
export class RefrescarUsuario {
  private readonly api = inject(ApiAutenticacion);
  private readonly sesion = inject(SesionVendedor);

  async ejecutar(opciones: { readonly marcarVerificado?: boolean } = {}): Promise<void> {
    try {
      this.sesion.actualizarUsuario(await this.api.obtenerUsuarioActual());
    } catch {
      // El correo ya quedó verificado en el servidor: no se muestra un error por el refresco.
      const usuario = this.sesion.usuario();
      if (opciones.marcarVerificado && usuario && !usuario.correoVerificadoEn) {
        this.sesion.actualizarUsuario({
          ...usuario,
          correoVerificadoEn: new Date().toISOString(),
        });
      }
    }
  }
}

/**
 * Pide el código de verificación al correo registrado de la cuenta (RF-USU-05, D-50;
 * correo.md, `POST /usuarios/yo/correo/verificacion`). Nunca recibe un correo distinto.
 * Si la API responde 409 `CORREO_YA_VERIFICADO`, se refresca el usuario para ocultar el aviso.
 */
@Injectable({ providedIn: 'root' })
export class SolicitarVerificacionCorreo {
  private readonly api = inject(ApiAutenticacion);
  private readonly refrescar = inject(RefrescarUsuario);

  async ejecutar(): Promise<void> {
    try {
      await this.api.solicitarVerificacionCorreo();
    } catch (error) {
      if (error instanceof ErrorApi && error.codigo === 'CORREO_YA_VERIFICADO') {
        await this.refrescar.ejecutar();
      }
      throw error;
    }
  }
}

/**
 * Confirma el correo con el código de 6 dígitos (`POST /usuarios/yo/correo/confirmacion`).
 * Tras el 204 el servidor ya lo marcó como verificado; se pide el usuario oficial
 * (`GET /usuarios/yo`) y, si ese refresco falla, se anota la fecha local solo para ocultar
 * el aviso (la próxima carga la reemplaza por la del servidor).
 */
@Injectable({ providedIn: 'root' })
export class ConfirmarVerificacionCorreo {
  private readonly api = inject(ApiAutenticacion);
  private readonly refrescar = inject(RefrescarUsuario);

  async ejecutar(codigo: string): Promise<void> {
    if (!esCodigoCorreoValido(codigo)) {
      throw new ErrorDatosCorreo('codigo', MENSAJES_CORREO.codigoInvalido);
    }
    await this.api.confirmarVerificacionCorreo(codigo);
    await this.refrescar.ejecutar({ marcarVerificado: true });
  }
}
