import { computed, inject, Injectable, signal } from '@angular/core';

import {
  CambiosMarca,
  cambiosAlMover,
  Marca,
  NuevaMarca,
  ordenarMarcas,
} from '../dominio/marca';
import { ApiMarcas } from './puertos';

/**
 * Marcas del negocio en memoria (el panel siempre está en línea, D-02). Las comparten el
 * guard de «Configura tu negocio», el menú y las pantallas. La API es la fuente de verdad:
 * cada cambio se envía a la API y la lista refleja su respuesta.
 */
@Injectable()
export class EstadoMarcas {
  private readonly api = inject(ApiMarcas);

  private readonly lista = signal<readonly Marca[] | null>(null);
  private cargaEnCurso: Promise<readonly Marca[]> | null = null;

  /** Todas las marcas (también las inactivas), ordenadas; vacío mientras no se cargan. */
  readonly marcas = computed<Marca[]>(() => [...(this.lista() ?? [])]);
  readonly cargada = computed(() => this.lista() !== null);
  /** `true` solo cuando la API confirmó que no hay marcas (D-48). */
  readonly sinMarcas = computed(() => this.lista()?.length === 0);

  /** Consulta `GET /marcas?incluirInactivas=true`. Las llamadas simultáneas comparten una. */
  cargar(): Promise<readonly Marca[]> {
    this.cargaEnCurso ??= this.api
      .listar(true)
      .then((marcas) => {
        const ordenadas = ordenarMarcas(marcas);
        this.lista.set(ordenadas);
        return ordenadas;
      })
      .finally(() => {
        this.cargaEnCurso = null;
      });
    return this.cargaEnCurso;
  }

  /**
   * Usa la lista en memoria si ya hay marcas (no se pueden borrar, por lo que no vuelven a
   * cero); si no, vuelve a consultar la API.
   */
  async asegurarCargada(): Promise<readonly Marca[]> {
    const actual = this.lista();
    return actual !== null && actual.length > 0 ? actual : this.cargar();
  }

  async crear(nueva: NuevaMarca): Promise<Marca> {
    const creada = await this.api.crear(nueva);
    this.lista.update((marcas) => ordenarMarcas([...(marcas ?? []), creada]));
    return creada;
  }

  async actualizar(id: string, cambios: CambiosMarca): Promise<Marca> {
    const actualizada = await this.api.actualizar(id, cambios);
    this.reemplazar(actualizada);
    return actualizada;
  }

  /**
   * Sube o baja una marca una posición. Numera la lista 0, 1, 2… y envía solo los `orden`
   * que cambian. Si una solicitud falla, vuelve a consultar la API para no mostrar algo falso.
   */
  async mover(id: string, direccion: -1 | 1): Promise<void> {
    const cambios = cambiosAlMover(this.marcas(), id, direccion);
    try {
      for (const cambio of cambios) {
        await this.actualizar(cambio.id, { orden: cambio.orden });
      }
    } catch (error) {
      await this.cargar().catch(() => undefined);
      throw error;
    }
  }

  private reemplazar(marca: Marca): void {
    this.lista.update((marcas) =>
      ordenarMarcas((marcas ?? []).map((actual) => (actual.id === marca.id ? marca : actual))),
    );
  }
}
