import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';

import {
  esperaTrasLimite,
  esCodigoIncorrecto,
  mensajeCodigoIncorrecto,
  mensajeDeErrorDeCorreo,
  MENSAJES_CORREO,
} from '../../aplicacion/mensajes-correo';
import {
  ConfirmarVerificacionCorreo,
  SolicitarVerificacionCorreo,
} from '../../aplicacion/verificacion-correo';
import {
  ESPERA_REENVIO_SEGUNDOS,
  esCodigoCorreoValido,
  formatearEspera,
  normalizarCodigo,
} from '../../dominio/codigo-correo';
import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import { CuentaRegresiva } from '../cuenta-regresiva';

/**
 * Aviso «Verifica tu correo» del Vendedor (RF-USU-05, D-50; correo.md). Se muestra en
 * Inicio mientras `correoVerificadoEn` sea `null`:
 *
 * 1. «Enviar código» → `POST /usuarios/yo/correo/verificacion` (solo al correo registrado).
 * 2. El Vendedor escribe los 6 dígitos y pulsa «Confirmar».
 * 3. Al confirmar, la sesión se actualiza y el padre deja de mostrarlo.
 *
 * Errores: 409 (ya verificado), 422 (código incorrecto, con intentos), 429 (cuenta
 * regresiva) y 503 (correo no disponible, se puede reintentar).
 */
@Component({
  selector: 'app-verificar-correo',
  imports: [ReactiveFormsModule, CardModule, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './verificar-correo.html',
  styleUrl: './verificar-correo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificarCorreo {
  /** Correo registrado de la cuenta: a esa dirección se envía el código. */
  readonly correo = input.required<string>();

  private readonly solicitar = inject(SolicitarVerificacionCorreo);
  private readonly confirmar = inject(ConfirmarVerificacionCorreo);
  private readonly avisos = inject(MessageService);

  protected readonly codigo = new FormControl('', { nonNullable: true });
  protected readonly enviando = signal(false);
  protected readonly confirmando = signal(false);
  protected readonly codigoEnviado = signal(false);
  protected readonly intentosFallidos = signal(0);
  protected readonly errorEnvio = signal<string | null>(null);
  protected readonly errorCodigo = signal<string | null>(null);
  protected readonly espera = new CuentaRegresiva(inject(DestroyRef));
  protected readonly formatearEspera = formatearEspera;

  constructor() {
    // Solo dígitos, máximo 6 (también si el navegador sugiere el código recibido).
    this.codigo.valueChanges.pipe(takeUntilDestroyed()).subscribe((valor) => {
      const limpio = normalizarCodigo(valor);
      if (limpio !== valor) {
        this.codigo.setValue(limpio, { emitEvent: false });
      }
      this.errorCodigo.set(null);
    });
  }

  protected async enviarCodigo(): Promise<void> {
    if (this.enviando() || this.espera.segundos() > 0) {
      return;
    }
    this.enviando.set(true);
    this.errorEnvio.set(null);
    try {
      await this.solicitar.ejecutar();
      this.codigoEnviado.set(true);
      this.intentosFallidos.set(0);
      this.codigo.reset('');
      this.espera.iniciar(ESPERA_REENVIO_SEGUNDOS);
      this.avisos.add({
        severity: 'success',
        summary: 'Código enviado',
        detail: 'Revisa tu correo e ingresa los 6 dígitos.',
        life: 4000,
      });
    } catch (error) {
      this.errorEnvio.set(mensajeDeErrorDeCorreo(error));
      if (error instanceof ErrorApi && error.estado === 429) {
        this.espera.iniciar(esperaTrasLimite(error));
      }
    } finally {
      this.enviando.set(false);
    }
  }

  protected async confirmarCodigo(): Promise<void> {
    if (this.confirmando()) {
      return;
    }
    this.errorCodigo.set(null);
    if (!esCodigoCorreoValido(this.codigo.value)) {
      this.errorCodigo.set(MENSAJES_CORREO.codigoInvalido);
      return;
    }
    this.confirmando.set(true);
    try {
      await this.confirmar.ejecutar(this.codigo.value);
      this.avisos.add({
        severity: 'success',
        summary: 'Correo verificado',
        detail: 'Ahora puedes recuperar tu clave desde tu correo.',
        life: 4000,
      });
    } catch (error) {
      if (esCodigoIncorrecto(error)) {
        this.intentosFallidos.update((n) => n + 1);
        this.errorCodigo.set(mensajeCodigoIncorrecto(this.intentosFallidos()));
      } else {
        this.errorCodigo.set(mensajeDeErrorDeCorreo(error));
        if (error instanceof ErrorApi && error.estado === 429) {
          this.espera.iniciar(esperaTrasLimite(error));
        }
      }
    } finally {
      this.confirmando.set(false);
    }
  }
}
