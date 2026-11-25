import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';

import { Disponibilidad, etiquetaDisponibilidad } from '../../../productos/dominio/producto';
import {
  advertenciasDeRevision,
  advertenciasInformativas,
  Borrador,
  infoAdvertencia,
  precioActualDistinto,
  precioDeBorrador,
  puedeEditar,
} from '../../dominio/importacion';

type SeveridadTag = 'success' | 'danger' | 'warn';
const SEVERIDAD_DISPONIBILIDAD: Readonly<Record<Disponibilidad, SeveridadTag>> = {
  DISPONIBLE: 'success',
  AGOTADO: 'danger',
  PENDIENTE_REPOSICION: 'warn',
};

/**
 * Borrador como tarjeta para el celular (D-61, RF-PRO-01): código, nombre, precio (actual → nuevo si
 * el borrador actualiza un producto), etiquetas de advertencia, casilla de selección grande y botón
 * «Editar». Solo muestra: seleccionar y editar los decide la pantalla de revisión.
 */
@Component({
  selector: 'app-tarjeta-borrador',
  imports: [FormsModule, ButtonModule, CheckboxModule, TagModule],
  templateUrl: './tarjeta-borrador.html',
  styleUrl: './tarjeta-borrador.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TarjetaBorrador {
  readonly borrador = input.required<Borrador>();
  readonly seleccionable = input(false);
  readonly seleccionado = input(false);

  readonly seleccionadoCambio = output<boolean>();
  readonly editar = output<Borrador>();

  protected readonly etiquetaDisponibilidad = etiquetaDisponibilidad;
  protected readonly precioDeBorrador = precioDeBorrador;
  protected readonly precioActualDistinto = precioActualDistinto;
  protected readonly infoAdvertencia = infoAdvertencia;
  protected readonly advertenciasDeRevision = advertenciasDeRevision;
  protected readonly advertenciasInformativas = advertenciasInformativas;
  protected readonly puedeEditar = puedeEditar;

  protected severidad(disponibilidad: Disponibilidad): SeveridadTag {
    return SEVERIDAD_DISPONIBILIDAD[disponibilidad];
  }
}
