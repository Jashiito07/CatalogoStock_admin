import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { BadgeModule } from 'primeng/badge';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';

interface ColorCorporativo {
  nombre: string;
  uso: string;
  /** Clase CSS que pinta la muestra con su variable `--cs-*`. */
  clase: string;
}

/** Página de bienvenida del panel; sirve para comprobar el tema corporativo (D-06). */
@Component({
  selector: 'app-inicio',
  imports: [CardModule, ButtonModule, BadgeModule, DialogModule],
  templateUrl: './inicio.html',
  styleUrl: './inicio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly mensajes = inject(MessageService);

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
