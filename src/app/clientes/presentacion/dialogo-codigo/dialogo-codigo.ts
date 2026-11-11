import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';

import { horaEcuador } from '../../../compartido/dominio/fecha-ecuador';
import { Portapapeles } from '../../aplicacion/puertos';
import { CodigoRecuperacion } from '../../dominio/cliente';

export const AVISO_CODIGO_UNICO = 'Compártelo solo con el cliente. No se volverá a mostrar.';
export const MENSAJE_CODIGO_COPIADO = 'Código copiado';
export const MENSAJE_NO_SE_PUDO_COPIAR = 'No se pudo copiar';

/**
 * Muestra **una sola vez** el código de recuperación recién generado (RF-USU-05, D-39):
 * el código de 6 dígitos, el cliente, la hora de vencimiento en hora de Ecuador y el
 * botón «Copiar». El código solo vive en la entrada de este componente: no se guarda en
 * ningún almacenamiento ni se escribe en registros; al cerrar, el padre lo descarta.
 */
@Component({
  selector: 'app-dialogo-codigo',
  imports: [DialogModule, ButtonModule, MessageModule],
  templateUrl: './dialogo-codigo.html',
  styleUrl: './dialogo-codigo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoCodigo {
  private readonly portapapeles = inject(Portapapeles);
  private readonly avisos = inject(MessageService);

  /** Código recién generado; `null` oculta el diálogo. */
  readonly codigo = input<CodigoRecuperacion | null>(null);
  /** El Vendedor cerró el diálogo: el padre debe descartar el código. */
  readonly cerrado = output<void>();

  protected readonly aviso = AVISO_CODIGO_UNICO;
  protected readonly visible = computed(() => this.codigo() !== null);
  protected readonly horaVencimiento = computed(() => {
    const codigo = this.codigo();
    return codigo === null ? '' : horaEcuador(codigo.venceEn);
  });
  /** Lectura por dígitos para los lectores de pantalla («4 8 2 9 1 3»). */
  protected readonly codigoDeletreado = computed(() =>
    [...(this.codigo()?.codigo ?? '')].join(' '),
  );

  protected alCambiarVisible(visible: boolean): void {
    if (!visible) {
      this.cerrado.emit();
    }
  }

  protected cerrar(): void {
    this.cerrado.emit();
  }

  protected async copiar(): Promise<void> {
    const codigo = this.codigo();
    if (codigo === null) {
      return;
    }
    try {
      await this.portapapeles.copiar(codigo.codigo);
      this.avisos.add({
        severity: 'success',
        summary: MENSAJE_CODIGO_COPIADO,
        detail: `Compártelo con ${codigo.cliente.nombre}.`,
        life: 3000,
      });
    } catch {
      this.avisos.add({
        severity: 'error',
        summary: MENSAJE_NO_SE_PUDO_COPIAR,
        detail: 'Selecciona el código y cópialo manualmente.',
        life: 5000,
      });
    }
  }
}
