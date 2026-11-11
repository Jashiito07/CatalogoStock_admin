import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { MENSAJE_ERROR_DESCONOCIDO } from '../../../compartido/infraestructura/http/interceptor-errores';
import { SesionVendedor } from '../../aplicacion/sesion-vendedor';
import {
  MENSAJE_CLAVE_DEBIL,
  MENSAJE_CLAVE_IGUAL_A_LA_ACTUAL,
  MENSAJE_CLAVES_NO_COINCIDEN,
} from '../../dominio/clave';
import { RUTA_INICIO_PANEL } from '../guardias';
import { mensajeDeErrorDeIngreso } from '../ingreso/ingreso';
import { validadorCambioClave, validadorReglaClave } from '../validadores-clave';

export const MENSAJE_CLAVE_CAMBIADA = 'Tu clave se cambió';
export const MENSAJE_CLAVE_ACTUAL_INCORRECTA = 'La clave actual no es correcta.';
export const MENSAJE_CLAVE_ACTUAL_OBLIGATORIA = 'Ingresa tu clave actual.';
export const MENSAJE_CONFIRMACION_OBLIGATORIA = 'Repite la clave nueva.';

/** Mensaje claro para un error del cambio de clave, sin detalles técnicos. */
export function mensajeDeErrorDeCambioClave(error: unknown): string {
  if (!(error instanceof ErrorApi)) {
    return MENSAJE_ERROR_DESCONOCIDO;
  }
  if (error.codigo === 'CLAVE_ACTUAL_INCORRECTA') {
    return MENSAJE_CLAVE_ACTUAL_INCORRECTA;
  }
  // 400 DATOS_INVALIDOS (regla de la clave o nueva igual a la actual) y 429 traen un
  // mensaje del contrato apto para mostrarse; el 429 agrega los segundos de espera.
  return mensajeDeErrorDeIngreso(error);
}

/**
 * «Cambiar mi clave» del Vendedor con la sesión iniciada (RF-USU-05, D-39):
 * `POST /usuarios/yo/clave`. La API conserva esta sesión y cierra las demás.
 * Las claves solo viven en el formulario y se descartan al salir de la pantalla.
 */
@Component({
  selector: 'app-cambiar-clave',
  imports: [ReactiveFormsModule, CardModule, PasswordModule, ButtonModule, MessageModule],
  templateUrl: './cambiar-clave.html',
  styleUrl: './cambiar-clave.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambiarClave {
  private readonly sesion = inject(SesionVendedor);
  private readonly router = inject(Router);
  private readonly avisos = inject(MessageService);

  protected readonly formulario = inject(NonNullableFormBuilder).group(
    {
      claveActual: ['', [Validators.required]],
      claveNueva: ['', [Validators.required, validadorReglaClave]],
      confirmacion: ['', [Validators.required]],
    },
    { validators: [validadorCambioClave('claveActual', 'claveNueva', 'confirmacion')] },
  );

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly intentoEnviar = signal(false);

  protected readonly mensajes = {
    claveActual: MENSAJE_CLAVE_ACTUAL_OBLIGATORIA,
    reglaClave: MENSAJE_CLAVE_DEBIL,
    igualALaActual: MENSAJE_CLAVE_IGUAL_A_LA_ACTUAL,
    confirmacion: MENSAJE_CONFIRMACION_OBLIGATORIA,
    noCoinciden: MENSAJE_CLAVES_NO_COINCIDEN,
  };

  private mostrarErrores(campo: 'claveActual' | 'claveNueva' | 'confirmacion'): boolean {
    return this.formulario.controls[campo].touched || this.intentoEnviar();
  }

  /** Mensaje del campo o `null` si está bien (o aún no se debe mostrar). */
  protected errorDe(campo: 'claveActual' | 'claveNueva' | 'confirmacion'): string | null {
    if (!this.mostrarErrores(campo)) {
      return null;
    }
    const control = this.formulario.controls[campo];
    switch (campo) {
      case 'claveActual':
        return control.hasError('required') ? this.mensajes.claveActual : null;
      case 'claveNueva':
        if (control.hasError('required') || control.hasError('reglaClave')) {
          return this.mensajes.reglaClave;
        }
        return this.formulario.hasError('igualALaActual') ? this.mensajes.igualALaActual : null;
      case 'confirmacion':
        if (control.hasError('required')) {
          return this.mensajes.confirmacion;
        }
        return this.formulario.hasError('noCoinciden') ? this.mensajes.noCoinciden : null;
    }
  }

  protected async cambiar(): Promise<void> {
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando()) {
      return;
    }
    const { claveActual, claveNueva } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    try {
      await this.sesion.cambiarClave(claveActual, claveNueva);
      this.avisos.add({
        severity: 'success',
        summary: MENSAJE_CLAVE_CAMBIADA,
        detail: 'Las demás sesiones abiertas con tu cuenta se cerraron.',
        life: 5000,
      });
      // Se sale de la pantalla: el formulario (con las claves) se destruye.
      await this.router.navigateByUrl(RUTA_INICIO_PANEL);
    } catch (error) {
      this.error.set(mensajeDeErrorDeCambioClave(error));
    } finally {
      this.enviando.set(false);
    }
  }

  protected async cancelar(): Promise<void> {
    await this.router.navigateByUrl(RUTA_INICIO_PANEL);
  }
}
