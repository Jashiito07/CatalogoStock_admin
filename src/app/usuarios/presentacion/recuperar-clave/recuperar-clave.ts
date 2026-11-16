import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { rutaLogoHorizontal } from '../../../compartido/presentacion/marca';
import { ServicioTema } from '../../../compartido/presentacion/tema/servicio-tema';
import { MOTIVOS_INGRESO } from '../../aplicacion/motivos-ingreso';
import {
  esperaTrasLimite,
  esCodigoIncorrecto,
  ErrorDatosCorreo,
  mensajeCodigoIncorrecto,
  mensajeDeErrorDeCorreo,
  MENSAJES_CORREO,
} from '../../aplicacion/mensajes-correo';
import {
  RestablecerClavePorCorreo,
  SolicitarRecuperacionPorCorreo,
} from '../../aplicacion/recuperacion-por-correo';
import { MENSAJE_CLAVE_DEBIL, MENSAJE_CLAVES_NO_COINCIDEN } from '../../dominio/clave';
import {
  ESPERA_REENVIO_SEGUNDOS,
  formatearEspera,
  normalizarCodigo,
} from '../../dominio/codigo-correo';
import { CuentaRegresiva } from '../cuenta-regresiva';
import { validadorConfirmacion, validadorReglaClave } from '../validadores-clave';

export const COMANDO_RESTABLECER_CLAVE = 'npm run restablecer-clave-vendedor';
export const MENSAJE_CONFIRMACION_OBLIGATORIA = 'Repite la clave nueva.';

type CampoCodigo = 'codigo' | 'claveNueva' | 'confirmacion';

/**
 * «¿Olvidaste tu clave?» del Vendedor (RF-USU-05, D-35, D-50; correo.md):
 *
 * 1. Escribe su correo → la pantalla siempre muestra el mismo mensaje neutro (204 exista o
 *    no la cuenta, para no revelar qué correos están registrados).
 * 2. Escribe el código de 6 dígitos, la clave nueva y su repetición.
 * 3. Vuelve al ingreso con un aviso. No se inicia sesión sola.
 *
 * Si su correo no está verificado, el código no se envía: la clave se restablece con el
 * comando del servidor. Las claves solo viven en el formulario.
 */
@Component({
  selector: 'app-recuperar-clave',
  imports: [ReactiveFormsModule, CardModule, InputTextModule, PasswordModule, ButtonModule, MessageModule],
  templateUrl: './recuperar-clave.html',
  styleUrl: './recuperar-clave.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecuperarClave {
  private readonly solicitar = inject(SolicitarRecuperacionPorCorreo);
  private readonly restablecer = inject(RestablecerClavePorCorreo);
  private readonly router = inject(Router);
  private readonly tema = inject(ServicioTema);

  protected readonly formularioCorreo = inject(NonNullableFormBuilder).group({
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  protected readonly formulario = inject(NonNullableFormBuilder).group(
    {
      codigo: ['', [Validators.required, Validators.pattern(/^\d{6}$/u)]],
      claveNueva: ['', [Validators.required, validadorReglaClave]],
      confirmacion: ['', [Validators.required]],
    },
    { validators: [validadorConfirmacion('claveNueva', 'confirmacion')] },
  );

  protected readonly paso = signal<'correo' | 'codigo'>('correo');
  protected readonly solicitando = signal(false);
  protected readonly restableciendo = signal(false);
  protected readonly intentoSolicitar = signal(false);
  protected readonly intentoRestablecer = signal(false);
  protected readonly intentosFallidos = signal(0);
  protected readonly errorSolicitud = signal<string | null>(null);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly espera = new CuentaRegresiva(inject(DestroyRef));
  protected readonly formatearEspera = formatearEspera;
  protected readonly mensajeNeutro = MENSAJES_CORREO.recuperacionSolicitada;
  protected readonly comando = COMANDO_RESTABLECER_CLAVE;
  protected readonly logo = computed(() => rutaLogoHorizontal(this.tema.temaAplicado()));

  constructor() {
    // Solo dígitos, máximo 6.
    this.formulario.controls.codigo.valueChanges.pipe(takeUntilDestroyed()).subscribe((valor) => {
      const limpio = normalizarCodigo(valor);
      if (limpio !== valor) {
        this.formulario.controls.codigo.setValue(limpio, { emitEvent: false });
      }
    });
    this.formulario.controls.claveNueva.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.formulario.controls.confirmacion.updateValueAndValidity({ emitEvent: false });
    });
  }

  protected correoInvalido(): boolean {
    const control = this.formularioCorreo.controls.correo;
    return control.invalid && (control.touched || this.intentoSolicitar());
  }

  /** Mensaje del campo, o `null` si está bien o aún no se debe mostrar. */
  protected errorDe(campo: CampoCodigo): string | null {
    const control = this.formulario.controls[campo];
    if (!(control.touched || this.intentoRestablecer())) {
      return null;
    }
    switch (campo) {
      case 'codigo':
        return control.invalid ? MENSAJES_CORREO.codigoInvalido : null;
      case 'claveNueva':
        return control.invalid ? MENSAJE_CLAVE_DEBIL : null;
      case 'confirmacion':
        if (control.hasError('required')) {
          return MENSAJE_CONFIRMACION_OBLIGATORIA;
        }
        return this.formulario.hasError('noCoinciden') ? MENSAJE_CLAVES_NO_COINCIDEN : null;
    }
  }

  protected async enviarCodigo(): Promise<void> {
    if (this.solicitando() || this.espera.segundos() > 0) {
      return;
    }
    this.intentoSolicitar.set(true);
    this.errorSolicitud.set(null);
    this.formularioCorreo.markAllAsTouched();
    if (this.formularioCorreo.invalid) {
      return;
    }
    this.solicitando.set(true);
    try {
      await this.solicitar.ejecutar(this.formularioCorreo.controls.correo.value);
      // Mismo mensaje exista o no la cuenta (principio 2 de correo.md).
      if (this.paso() === 'correo') {
        this.intentosFallidos.set(0);
      }
      this.paso.set('codigo');
      this.espera.iniciar(ESPERA_REENVIO_SEGUNDOS);
    } catch (error) {
      this.errorSolicitud.set(mensajeDeErrorDeCorreo(error));
      if (error instanceof ErrorApi && error.estado === 429) {
        this.espera.iniciar(esperaTrasLimite(error));
      }
    } finally {
      this.solicitando.set(false);
    }
  }

  protected usarOtroCorreo(): void {
    this.paso.set('correo');
    this.errorGeneral.set(null);
    this.errorSolicitud.set(null);
    this.formulario.reset();
    this.intentoRestablecer.set(false);
  }

  protected async cambiarClave(): Promise<void> {
    this.intentoRestablecer.set(true);
    this.errorGeneral.set(null);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.restableciendo()) {
      return;
    }
    const { codigo, claveNueva } = this.formulario.getRawValue();
    this.restableciendo.set(true);
    try {
      await this.restablecer.ejecutar({
        correo: this.formularioCorreo.controls.correo.value,
        codigo,
        claveNueva,
      });
      // Se sale de la pantalla: el formulario (con las claves) se destruye.
      await this.router.navigate(['/ingreso'], {
        queryParams: { motivo: MOTIVOS_INGRESO.claveRestablecida },
        replaceUrl: true,
      });
    } catch (error) {
      this.mostrarError(error);
    } finally {
      this.restableciendo.set(false);
    }
  }

  private mostrarError(error: unknown): void {
    if (esCodigoIncorrecto(error)) {
      this.intentosFallidos.update((n) => n + 1);
      this.errorGeneral.set(mensajeCodigoIncorrecto(this.intentosFallidos()));
      return;
    }
    if (error instanceof ErrorDatosCorreo) {
      this.errorGeneral.set(error.mensaje);
      return;
    }
    this.errorGeneral.set(mensajeDeErrorDeCorreo(error));
  }

  protected async volverAlIngreso(): Promise<void> {
    await this.router.navigateByUrl('/ingreso');
  }
}
