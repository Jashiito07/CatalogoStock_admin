import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import {
  calcularContraste,
  ContrasteMarca,
  esColorValido,
  textoContraste,
} from '../../dominio/marca';

interface Franja {
  readonly fondo: string;
  readonly texto: string;
}

const FRANJA_NEUTRA: Franja = {
  fondo: 'var(--cs-primario)',
  texto: 'var(--cs-sobre-primario)',
};

/**
 * Vista previa de la cabecera de una marca (D-43, RNF-11): su color de fondo, el texto que
 * se calcula sobre él y la razón de contraste. Los colores de la marca vienen de los datos y
 * por eso se aplican como estilos en línea; el resto de la pantalla usa las variables `--cs-*`.
 */
@Component({
  selector: 'app-vista-previa-marca',
  templateUrl: './vista-previa-marca.html',
  styleUrl: './vista-previa-marca.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VistaPreviaMarca {
  readonly nombre = input('');
  readonly color = input.required<string>();
  readonly colorAcento = input<string | null>(null);
  /** Vista reducida (tarjetas de «Configura tu negocio»): sin leyenda de acento. */
  readonly compacta = input(false);

  protected readonly nombreMostrado = computed(() => this.nombre().trim() || 'Nombre de la marca');

  protected readonly principal = computed(() => this.analizar(this.color()));
  protected readonly acento = computed(() => {
    const color = this.colorAcento();
    return color !== null && esColorValido(color) ? this.analizar(color) : null;
  });

  protected readonly franjaPrincipal = computed<Franja>(() => {
    const p = this.principal();
    return p === null ? FRANJA_NEUTRA : { fondo: this.color(), texto: p.texto };
  });

  protected readonly franjaAcento = computed<Franja | null>(() => {
    const a = this.acento();
    const color = this.colorAcento();
    return a === null || color === null ? null : { fondo: color, texto: a.texto };
  });

  protected readonly leyendaPrincipal = computed(() => {
    const p = this.principal();
    return p === null ? 'Elige un color válido para ver el contraste.' : this.leyenda(p);
  });
  protected readonly leyendaAcento = computed(() => {
    const a = this.acento();
    return a === null ? null : this.leyenda(a);
  });

  private analizar(color: string): ContrasteMarca | null {
    return esColorValido(color) ? calcularContraste(color) : null;
  }

  private leyenda(contraste: ContrasteMarca): string {
    return `${textoContraste(contraste)} · texto ${contraste.texto}`;
  }
}
