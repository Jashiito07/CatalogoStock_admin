import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ColorPickerModule } from 'primeng/colorpicker';
import { InputTextModule } from 'primeng/inputtext';

import { COLOR_MARCA_PREDETERMINADO, esColorValido, normalizarColor } from '../../dominio/marca';

let contador = 0;

/**
 * Selector de color de una marca: `p-colorpicker` más un campo hexadecimal (`#RRGGBB`).
 * `valor` puede contener un texto aún inválido mientras el Vendedor escribe; quien lo usa
 * valida con `esColorValido`. Solo emite colores completos en mayúsculas o el texto crudo.
 */
@Component({
  selector: 'app-selector-color',
  imports: [FormsModule, ColorPickerModule, InputTextModule],
  templateUrl: './selector-color.html',
  styleUrl: './selector-color.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorColor {
  readonly etiqueta = input.required<string>();
  readonly valor = model.required<string>();
  /** Mensaje del servidor para este campo (400 por campo). */
  readonly errorExterno = input<string | null>(null);

  protected readonly idCampo = `color-marca-${++contador}`;
  protected readonly valido = computed(() => esColorValido(this.valor()));
  protected readonly valorDelSelector = computed(() =>
    this.valido() ? this.valor() : COLOR_MARCA_PREDETERMINADO,
  );

  protected alElegir(color: unknown): void {
    if (typeof color === 'string') {
      this.valor.set(normalizarColor(color));
    }
  }

  protected alEscribir(evento: Event): void {
    this.valor.set(normalizarColor((evento.target as HTMLInputElement).value));
  }
}
