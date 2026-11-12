import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { PasswordModule } from 'primeng/password';

import { ErrorApi } from '../../../compartido/aplicacion/error-api';
import {
  MENSAJE_ERROR_DESCONOCIDO,
  MENSAJE_SIN_CONEXION,
} from '../../../compartido/infraestructura/http/interceptor-errores';
import { rutaLogoHorizontal } from '../../../compartido/presentacion/marca';
import { ServicioTema } from '../../../compartido/presentacion/tema/servicio-tema';
import { MOTIVOS_INGRESO } from '../../aplicacion/motivos-ingreso';
import { MENSAJE_SESION_TERMINADA, SesionVendedor } from '../../aplicacion/sesion-vendedor';
import { RUTA_INICIO_PANEL } from '../guardias';

export const MENSAJE_SALIDA = 'Cerraste sesión. ¡Hasta pronto!';

const AVISOS_POR_MOTIVO: Readonly<Record<string, string>> = {
  [MOTIVOS_INGRESO.sesionTerminada]: MENSAJE_SESION_TERMINADA,
  [MOTIVOS_INGRESO.sinConexion]: MENSAJE_SIN_CONEXION,
  [MOTIVOS_INGRESO.salida]: MENSAJE_SALIDA,
};

export const MENSAJE_CORREO_INVALIDO = 'Ingresa un correo válido.';
export const MENSAJE_CLAVE_OBLIGATORIA = 'Ingresa tu clave.';

/** Convierte un error del ingreso en un mensaje claro, sin detalles técnicos. */
export function mensajeDeErrorDeIngreso(error: unknown): string {
  if (!(error instanceof ErrorApi)) {
    return MENSAJE_ERROR_DESCONOCIDO;
  }
  if (error.codigo === 'DEMASIADAS_SOLICITUDES') {
    const segundos = error.detalles?.['reintentarEnSegundos'];
    return typeof segundos === 'number' && segundos > 0
      ? `${error.mensaje} Podrás intentarlo de nuevo en ${segundos} segundos.`
      : error.mensaje;
  }
  // El contrato garantiza que `mensaje` está en español y se puede mostrar
  // (por ejemplo, «Correo o clave incorrectos.» también para un Cliente, D-19).
  return error.mensaje;
}

/**
 * Ingreso del Vendedor al panel (RF-USU-01, RF-USU-03, D-19). Usa solo
 * `/autenticacion/ingreso/vendedor`: un Cliente recibe «Correo o clave incorrectos»
 * y no obtiene sesión.
 */
@Component({
  selector: 'app-ingreso',
  imports: [
    ReactiveFormsModule,
    CardModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    MessageModule,
  ],
  templateUrl: './ingreso.html',
  styleUrl: './ingreso.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Ingreso {
  private readonly sesion = inject(SesionVendedor);
  private readonly router = inject(Router);

  /** Parámetro de consulta `motivo` (sesión terminada, sin conexión o salida). */
  readonly motivo = input<string>();

  protected readonly formulario = inject(NonNullableFormBuilder).group({
    correo: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    clave: ['', [Validators.required]],
  });

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly intentoEnviar = signal(false);
  protected readonly aviso = computed(() => {
    const motivo = this.motivo();
    return motivo ? (AVISOS_POR_MOTIVO[motivo] ?? null) : null;
  });

  private readonly tema = inject(ServicioTema);

  /** Logo horizontal oficial (D-38): variante para fondo oscuro en modo oscuro (D-41). */
  protected readonly logo = computed(() => rutaLogoHorizontal(this.tema.temaAplicado()));
  protected readonly mensajeCorreoInvalido = MENSAJE_CORREO_INVALIDO;
  protected readonly mensajeClaveObligatoria = MENSAJE_CLAVE_OBLIGATORIA;

  protected campoInvalido(campo: 'correo' | 'clave'): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && (control.touched || this.intentoEnviar());
  }

  protected async ingresar(): Promise<void> {
    this.intentoEnviar.set(true);
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid || this.enviando()) {
      return;
    }
    const { correo, clave } = this.formulario.getRawValue();
    this.enviando.set(true);
    this.error.set(null);
    try {
      await this.sesion.ingresar(correo, clave);
      await this.router.navigateByUrl(RUTA_INICIO_PANEL);
    } catch (error) {
      this.error.set(mensajeDeErrorDeIngreso(error));
    } finally {
      this.enviando.set(false);
    }
  }
}
