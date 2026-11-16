import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';

import { SesionVendedor } from '../../../usuarios/aplicacion/sesion-vendedor';
import { correoVerificado } from '../../../usuarios/dominio/codigo-correo';
import { VerificarCorreo } from '../../../usuarios/presentacion/verificar-correo/verificar-correo';

interface ColorCorporativo {
  nombre: string;
  uso: string;
  /** Clase CSS que pinta la muestra con su variable `--cs-*`. */
  clase: string;
}

/** Página de bienvenida del panel; sirve para comprobar el tema corporativo (D-06). */
@Component({
  selector: 'app-inicio',
  imports: [CardModule, ButtonModule, BadgeModule, DialogModule, VerificarCorreo],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly mensajes = inject(MessageService);
  private readonly sesion = inject(SesionVendedor);

  /** Correo del Vendedor mientras no esté verificado (D-50); `null` si ya lo está. */
  protected readonly correoPorVerificar = computed(() => {
    const usuario = this.sesion.usuario();
    return usuario !== null && !correoVerificado(usuario) ? usuario.correo : null;
  });

  protected readonly guiaVisible = signal(false);

  protected readonly colores: readonly ColorCorporativo[] = [
    { nombre: 'Primario', uso: 'Acciones principales y encabezados', clase: 'cs-muestra--primario' },
    { nombre: 'Secundario', uso: 'Acciones secundarias y etiquetas', clase: 'cs-muestra--secundario' },
    { nombre: 'Acento', uso: 'Insignias y avisos importantes', clase: 'cs-muestra--acento' },
    { nombre: 'Fondo', uso: 'Fondo general de las pantallas', clase: 'cs-muestra--fondo' },
    { nombre: 'Texto', uso: 'Texto principal', clase: 'cs-muestra--texto' },
  ];

  protected mostrarAvisoDePrueba(): void {
    this.mensajes.add({
      severity: 'success',
      summary: 'Todo listo',
      detail: 'El tema corporativo del panel está activo.',
      life: 3000,
    });
  }

  protected abrirGuiaDeColores(): void {
    this.guiaVisible.set(true);
  }
}
