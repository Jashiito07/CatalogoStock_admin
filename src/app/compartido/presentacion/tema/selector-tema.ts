import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';

import { esPreferenciaTema, PreferenciaTema } from '../../dominio/tema';
import { ServicioTema } from './servicio-tema';

export interface OpcionTema {
  valor: PreferenciaTema;
  etiqueta: string;
  icono: string;
}

export const OPCIONES_TEMA: readonly OpcionTema[] = [
  { valor: 'automatico', etiqueta: 'Automático', icono: 'pi pi-clock' },
  { valor: 'claro', etiqueta: 'Claro', icono: 'pi pi-sun' },
  { valor: 'oscuro', etiqueta: 'Oscuro', icono: 'pi pi-moon' },
];

/**
 * Selector «Automático / Claro / Oscuro» de la barra superior (D-41). Compacto: cada opción
 * es un ícono con su nombre como texto accesible y como ayuda emergente (`title`).
 */
@Component({
  selector: 'app-selector-tema',
  imports: [FormsModule, SelectButtonModule],
  template: `
    <p-selectbutton
      class="cs-selector-tema"
      [options]="opciones"
      optionLabel="etiqueta"
      optionValue="valor"
      [allowEmpty]="false"
      [ngModel]="tema.preferencia()"
      (ngModelChange)="elegir($event)"
      ariaLabelledBy="cs-selector-tema-nombre"
      data-prueba="selector-tema"
    >
      <ng-template #item let-opcion>
        <span class="cs-selector-tema__opcion" [attr.title]="'Tema: ' + opcion.etiqueta">
          <i [class]="opcion.icono" aria-hidden="true"></i>
          <span class="cs-solo-lector">{{ opcion.etiqueta }}</span>
        </span>
      </ng-template>
    </p-selectbutton>
    <span id="cs-selector-tema-nombre" class="cs-solo-lector">Tema de color</span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .cs-selector-tema__opcion {
      display: inline-flex;
      align-items: center;
    }

    .cs-solo-lector {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectorTema {
  protected readonly tema = inject(ServicioTema);
  protected readonly opciones: OpcionTema[] = [...OPCIONES_TEMA];

  protected elegir(valor: unknown): void {
    if (esPreferenciaTema(valor)) {
      this.tema.seleccionar(valor);
    }
  }
}
