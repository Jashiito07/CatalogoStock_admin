import { DestroyRef, signal } from '@angular/core';

/**
 * Cuenta regresiva en segundos para habilitar «Reenviar código». Se detiene sola al llegar
 * a 0 y al destruirse el componente que la creó.
 */
export class CuentaRegresiva {
  readonly segundos = signal(0);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  constructor(destroyRef: DestroyRef) {
    destroyRef.onDestroy(() => this.detener());
  }

  iniciar(segundos: number): void {
    this.detener();
    this.segundos.set(Math.max(0, Math.ceil(segundos)));
    if (this.segundos() === 0) {
      return;
    }
    this.temporizador = setInterval(() => {
      const restante = this.segundos() - 1;
      this.segundos.set(Math.max(0, restante));
      if (restante <= 0) {
        this.detener();
      }
    }, 1000);
  }

  detener(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
    }
    this.temporizador = null;
  }
}
