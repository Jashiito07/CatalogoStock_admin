import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';

import { EstadoMarcas } from '../../aplicacion/estado-marcas';
import { mensajeDeErrorDeMarca } from '../../aplicacion/mensajes-marcas';
import { Marca } from '../../dominio/marca';
import { DialogoMarca } from '../dialogo-marca/dialogo-marca';

export const MENSAJE_DESACTIVAR =
  'Los productos de esta marca dejarán de mostrarse a los clientes.';

/**
 * Sección «Marcas» del panel (RF-PRO-04, D-43): `p-table` con color, estado y orden;
 * crear y editar en un diálogo; activar o desactivar (con confirmación al desactivar) y
 * reordenar. No existe eliminar: una marca se desactiva.
 */
@Component({
  selector: 'app-marcas',
  imports: [
    RouterLink,
    TableModule,
    ButtonModule,
    TagModule,
    MessageModule,
    ConfirmDialogModule,
    DialogoMarca,
  ],
  providers: [ConfirmationService],
  templateUrl: './marcas.html',
  styleUrl: './marcas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Marcas implements OnInit {
  protected readonly estado = inject(EstadoMarcas);
  private readonly confirmacion = inject(ConfirmationService);
  private readonly avisos = inject(MessageService);

  protected readonly cargando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly ocupada = signal<string | null>(null);
  protected readonly dialogoVisible = signal(false);
  protected readonly marcaEnEdicion = signal<Marca | null>(null);

  ngOnInit(): void {
    void this.cargar();
  }

  async cargar(): Promise<void> {
    this.error.set(null);
    this.cargando.set(true);
    try {
      await this.estado.cargar();
    } catch (error) {
      this.error.set(mensajeDeErrorDeMarca(error));
    } finally {
      this.cargando.set(false);
    }
  }

  protected nueva(): void {
    this.marcaEnEdicion.set(null);
    this.dialogoVisible.set(true);
  }

  protected editar(marca: Marca): void {
    this.marcaEnEdicion.set(marca);
    this.dialogoVisible.set(true);
  }

  protected alGuardar(marca: Marca | null): void {
    if (marca === null) {
      return;
    }
    const creada = this.marcaEnEdicion() === null;
    this.avisos.add({
      severity: 'success',
      summary: creada ? 'Marca creada' : 'Marca actualizada',
      detail: marca.nombre,
      life: 3000,
    });
  }

  /** Activar es directo; desactivar pide confirmación (RNF-12). */
  protected alternarActiva(marca: Marca): void {
    if (!marca.activa) {
      void this.cambiarActiva(marca, true);
      return;
    }
    this.confirmacion.confirm({
      header: `Desactivar ${marca.nombre}`,
      message: MENSAJE_DESACTIVAR,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desactivar',
      rejectLabel: 'Cancelar',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => void this.cambiarActiva(marca, false),
    });
  }

  async cambiarActiva(marca: Marca, activa: boolean): Promise<void> {
    await this.ejecutar(marca, async () => {
      await this.estado.actualizar(marca.id, { activa });
      this.avisos.add({
        severity: 'success',
        summary: activa ? 'Marca activada' : 'Marca desactivada',
        detail: marca.nombre,
        life: 3000,
      });
    });
  }

  async mover(marca: Marca, direccion: -1 | 1): Promise<void> {
    await this.ejecutar(marca, () => this.estado.mover(marca.id, direccion));
  }

  private async ejecutar(marca: Marca, accion: () => Promise<unknown>): Promise<void> {
    if (this.ocupada() !== null) {
      return;
    }
    this.ocupada.set(marca.id);
    try {
      await accion();
    } catch (error) {
      this.avisos.add({
        severity: 'error',
        summary: 'No se pudo guardar el cambio',
        detail: mensajeDeErrorDeMarca(error),
        life: 6000,
      });
    } finally {
      this.ocupada.set(null);
    }
  }
}
