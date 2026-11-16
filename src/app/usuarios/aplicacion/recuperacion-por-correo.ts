import { inject, Injectable } from '@angular/core';

import { esCodigoCorreoValido } from '../dominio/codigo-correo';
import { cumpleReglaClave, MENSAJE_CLAVE_DEBIL } from '../dominio/clave';
import { ErrorDatosCorreo, MENSAJES_CORREO } from './mensajes-correo';
import { ApiAutenticacion } from './puertos';

const FORMATO_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

/**
 * Pide el código de recuperación al correo de la cuenta (RF-USU-05, D-50; correo.md,
 * `POST /autenticacion/recuperacion/solicitud`). La API responde 204 siempre, exista o no
 * la cuenta; la pantalla muestra siempre el mismo mensaje neutro.
 */
@Injectable({ providedIn: 'root' })
export class SolicitarRecuperacionPorCorreo {
  private readonly api = inject(ApiAutenticacion);

  async ejecutar(correo: string): Promise<void> {
    const limpio = correo.trim();
    if (!FORMATO_CORREO.test(limpio) || limpio.length > 254) {
      throw new ErrorDatosCorreo('correo', MENSAJES_CORREO.correoInvalido);
    }
    await this.api.solicitarRecuperacionPorCorreo(limpio);
  }
}

/**
 * Restablece la clave con el código recibido (`POST /autenticacion/recuperacion`). El
 * servidor revoca todas las sesiones; el panel no tiene sesión en este punto.
 * Las claves no se guardan en ningún lugar.
 */
@Injectable({ providedIn: 'root' })
export class RestablecerClavePorCorreo {
  private readonly api = inject(ApiAutenticacion);

  async ejecutar(entrada: {
    readonly correo: string;
    readonly codigo: string;
    readonly claveNueva: string;
  }): Promise<void> {
    const correo = entrada.correo.trim();
    if (!FORMATO_CORREO.test(correo)) {
      throw new ErrorDatosCorreo('correo', MENSAJES_CORREO.correoInvalido);
    }
    if (!esCodigoCorreoValido(entrada.codigo)) {
      throw new ErrorDatosCorreo('codigo', MENSAJES_CORREO.codigoInvalido);
    }
    if (!cumpleReglaClave(entrada.claveNueva)) {
      throw new ErrorDatosCorreo('claveNueva', MENSAJE_CLAVE_DEBIL);
    }
    await this.api.restablecerClave({
      correo,
      codigo: entrada.codigo,
      claveNueva: entrada.claveNueva,
    });
  }
}
