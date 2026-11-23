import { computed, inject, Injectable, signal } from '@angular/core';

import {
  CambiosMarca,
  cambiosAlMover,
  Marca,
  MarcaSugerida,
  mismaMarcaConocida,
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

  private readonly listaSugeridas = signal<readonly MarcaSugerida[]>([]);
  private sugeridasEnCurso: Promise<readonly MarcaSugerida[]> | null = null;

  /**
   * Marcas conocidas (`GET /marcas/sugeridas`, D-56): fuente de sus colores fijos. Vacía hasta
   * que se consulta; sin ella el panel no bloquea nada y el servidor sigue imponiendo la regla.
   */
  readonly sugeridas = computed(() => this.listaSugeridas());

  private readonly _cargandoSugeridas = signal(false);
  private readonly _falloSugeridas = signal(false);
  /** `true` mientras se consulta `GET /marcas/sugeridas` (el combobox muestra «cargando»). */
  readonly cargandoSugeridas = this._cargandoSugeridas.asReadonly();
  /** `true` si la última consulta de sugeridas falló: el combobox ofrece solo «Agregar nueva marca…». */
  readonly falloSugeridas = this._falloSugeridas.asReadonly();

  /** Consulta `GET /marcas/sugeridas` una sola vez; si falla, devuelve lo que haya (vacío). */
  cargarSugeridas(): Promise<readonly MarcaSugerida[]> {
    if (this.listaSugeridas().length > 0) {
      return Promise.resolve(this.listaSugeridas());
    }
    if (this.sugeridasEnCurso === null) {
      this._cargandoSugeridas.set(true);
      this._falloSugeridas.set(false);
    }
    this.sugeridasEnCurso ??= Promise.resolve()
      .then(() => this.api.sugeridas())
      .then((sugeridas) => {
        this.listaSugeridas.set(sugeridas);
        return sugeridas;
      })
      .catch(() => {
        this._falloSugeridas.set(true);
        return this.listaSugeridas();
      })
      .finally(() => {
        this._cargandoSugeridas.set(false);
        this.sugeridasEnCurso = null;
      });
    return this.sugeridasEnCurso;
  }

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
    // La conocida recién creada deja de ofrecerse en el combobox sin volver a consultar.
    this.listaSugeridas.update((sugeridas) =>
      sugeridas.map((s) =>
        mismaMarcaConocida(s.nombre, creada.nombre) ? { ...s, yaCreada: true } : s,
      ),
    );
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
