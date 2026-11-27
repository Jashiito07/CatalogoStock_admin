import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';

import { aFilaBitacora, FilaBitacora, iconoSeveridad } from '../../../auditoria/presentacion/bitacora/bitacora';
import { SesionVendedor } from '../../../usuarios/aplicacion/sesion-vendedor';
import { correoVerificado } from '../../../usuarios/dominio/codigo-correo';
import { VerificarCorreo } from '../../../usuarios/presentacion/verificar-correo/verificar-correo';
import {
  DISPONIBILIDADES,
  Disponibilidad,
  etiquetaDisponibilidad,
  iconoDisponibilidad,
} from '../../../productos/dominio/producto';
import { fechaHoraEcuador } from '../../dominio/fecha-ecuador';
import { anchoRelativo, arcosDona, porcentaje, RADIO_DONA } from '../../dominio/graficos';
import { ResumenPanel } from '../../aplicacion/resumen-panel';

/** Variante visual (clases `cs-etiqueta--*`) de cada disponibilidad. */
const VARIANTE_DISPONIBILIDAD: Readonly<Record<Disponibilidad, string>> = {
  DISPONIBLE: 'ok',
  AGOTADO: 'error',
  PENDIENTE_REPOSICION: 'aviso',
};

/** Color de cada tramo del gráfico (variables `--cs-g*`, no textuales). */
const COLOR_DISPONIBILIDAD: Readonly<Record<Disponibilidad, string>> = {
  DISPONIBLE: 'var(--cs-g4)',
  AGOTADO: 'var(--cs-g6)',
  PENDIENTE_REPOSICION: 'var(--cs-g2)',
};

interface TramoDisponibilidad {
  readonly valor: Disponibilidad;
  readonly etiqueta: string;
  readonly icono: string;
  readonly variante: string;
  readonly color: string;
  readonly cantidad: number;
}

/**
 * Inicio del panel (maqueta combinada, etapa 4): resumen del catálogo con datos reales de la API.
 * Tarjetas de resumen, tres gráficos pequeños en HTML/CSS/SVG, importaciones recientes y actividad
 * reciente de la bitácora. No muestra ventas ni pedidos: llegan en la Fase 6.
 */
@Component({
  selector: 'app-inicio',
  imports: [DatePipe, RouterLink, ButtonModule, TagModule, VerificarCorreo],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio implements OnInit {
  private readonly sesion = inject(SesionVendedor);
  protected readonly resumen = inject(ResumenPanel);

  protected readonly zonaEcuador = '-0500';
  protected readonly hoy = new Date();
  protected readonly radioDona = RADIO_DONA;
  protected readonly fechaHora = fechaHoraEcuador;
  protected readonly iconoSeveridad = iconoSeveridad;
  protected readonly porcentaje = porcentaje;
  protected readonly anchoRelativo = anchoRelativo;

  /** Correo del Vendedor mientras no esté verificado (D-50); `null` si ya lo está. */
  protected readonly correoPorVerificar = computed(() => {
    const usuario = this.sesion.usuario();
    return usuario !== null && !correoVerificado(usuario) ? usuario.correo : null;
  });

  protected readonly nombreVendedor = computed(() => this.sesion.usuario()?.nombre ?? '');

  /** Tramos del gráfico de disponibilidad (solo los que tienen productos). */
  protected readonly tramos = computed<TramoDisponibilidad[]>(() => {
    const seccion = this.resumen.productos();
    if (seccion.estado !== 'listo') {
      return [];
    }
    return DISPONIBILIDADES.map((valor) => ({
      valor,
      etiqueta: etiquetaDisponibilidad(valor),
      icono: iconoDisponibilidad(valor),
      variante: VARIANTE_DISPONIBILIDAD[valor],
      color: COLOR_DISPONIBILIDAD[valor],
      cantidad: seccion.datos.porDisponibilidad[valor],
    }));
  });

  /** Mayor cantidad de productos de una marca: escala del gráfico «Productos por marca». */
  protected readonly maximoPorMarca = computed(() => {
    const seccion = this.resumen.productos();
    return seccion.estado === 'listo' ? Math.max(0, ...seccion.datos.porMarca.map((m) => m.total)) : 0;
  });

  /** Arcos del donut «Correos de clientes»: verificados y sin verificar. */
  protected readonly arcosCorreo = computed(() => {
    const seccion = this.resumen.clientes();
    return seccion.estado === 'listo'
      ? arcosDona([seccion.datos.verificados, seccion.datos.sinVerificar])
      : [];
  });

  protected readonly actividad = computed<FilaBitacora[]>(() => {
    const seccion = this.resumen.actividad();
    return seccion.estado === 'listo' ? seccion.datos.map(aFilaBitacora) : [];
  });

  /** «jueves, 26 de noviembre» en hora de Ecuador, sobre el saludo. */
  protected readonly fechaLarga = new Intl.DateTimeFormat('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Guayaquil',
  }).format(this.hoy);

  ngOnInit(): void {
    void this.resumen.cargar();
  }

  protected recargar(): void {
    void this.resumen.cargar();
  }
}
