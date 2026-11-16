import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  model,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FileSelectEvent, FileUpload, FileUploadModule } from 'primeng/fileupload';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';

import { EstadoMarcas } from '../../../marcas/aplicacion/estado-marcas';
import { erroresPorCampo, ErroresPorCampo } from '../../../marcas/aplicacion/mensajes-marcas';
import { Marca } from '../../../marcas/dominio/marca';
import { EstadoProductos } from '../../aplicacion/estado-productos';
import { mensajeDeErrorDeProducto } from '../../aplicacion/mensajes-productos';
import {
  CambiosProducto,
  Disponibilidad,
  DISPONIBILIDADES,
  etiquetaDisponibilidad,
  formatearTamano,
  hacerPrimero,
  imagenesOrdenadas,
  LONGITUD_MAXIMA_DESCRIPCION,
  LONGITUD_MAXIMA_NOMBRE,
  MAX_IMAGENES,
  mismoOrden,
  moverElemento,
  precioParaApi,
  Producto,
  validarArchivoImagen,
  validarDescripcion,
  validarNombre,
  validarPrecio,
} from '../../dominio/producto';

/** Una imagen en el formulario: ya guardada en el servidor o elegida y pendiente de subir. */
export interface ItemImagen {
  readonly clave: string;
  readonly tipo: 'guardada' | 'pendiente';
  /** Id de la imagen en el servidor (solo las guardadas). */
  readonly id?: string;
  /** URL para mostrar: la pública de la API o la vista previa local. */
  readonly url: string;
  readonly nombre: string;
  readonly tamano?: number;
  readonly archivo?: File;
  readonly error?: string;
}

interface OpcionMarca {
  readonly id: string;
  readonly nombre: string;
  readonly color: string;
  readonly inactiva: boolean;
}

const OPCIONES_DISPONIBILIDAD = DISPONIBILIDADES.map((valor) => ({
  valor,
  etiqueta: etiquetaDisponibilidad(valor),
}));

/**
 * Diálogo para crear o editar un producto (RF-PRO-01, RF-PRO-02, RF-PRO-04, RF-PRO-05, D-46):
 * nombre, marca (solo activas), precio como texto con 2 decimales, descripción, disponibilidad
 * (RN-09) e imágenes (hasta 5, 2 MB, JPG, PNG o WebP).
 *
 * Imágenes: las elegidas se suben al guardar, en el orden mostrado; la primera es la principal.
 * Quitar una imagen ya guardada es inmediato y pide confirmación (RNF-12). Si algo falla a mitad
 * de camino, el producto ya existe y el diálogo sigue abierto para reintentar sin duplicar.
 */
@Component({
  selector: 'app-dialogo-producto',
  imports: [
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    SelectModule,
    FileUploadModule,
    MessageModule,
    TagModule,
  ],
  templateUrl: './dialogo-producto.html',
  styleUrl: './dialogo-producto.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogoProducto implements OnDestroy {
  private readonly estado = inject(EstadoProductos);
  private readonly marcasEstado = inject(EstadoMarcas);
  private readonly confirmacion = inject(ConfirmationService);

  readonly visible = model(false);
  /** `null`: crear un producto nuevo. */
  readonly producto = input<Producto | null>(null);
  /** Algo cambió en el servidor (crear, editar, subir, ordenar o quitar): refrescar el listado. */
  readonly cambios = output<void>();
  /** El guardado terminó sin errores. */
  readonly guardado = output<Producto>();

  private readonly cargador = viewChild<FileUpload>('cargador');

  protected readonly longitudMaximaNombre = LONGITUD_MAXIMA_NOMBRE;
  protected readonly longitudMaximaDescripcion = LONGITUD_MAXIMA_DESCRIPCION;
  protected readonly maxImagenes = MAX_IMAGENES;
  protected readonly opcionesDisponibilidad = OPCIONES_DISPONIBILIDAD;
  protected readonly etiquetaDisponibilidad = etiquetaDisponibilidad;
  protected readonly formatearTamano = formatearTamano;

  /** Producto en el servidor: el recibido al abrir o el recién creado en este diálogo. */
  private readonly productoActual = signal<Producto | null>(null);
  protected readonly nombre = signal('');
  protected readonly marcaId = signal<string | null>(null);
  protected readonly precio = signal('');
  protected readonly descripcion = signal('');
  protected readonly disponibilidad = signal<Disponibilidad>('DISPONIBLE');
  protected readonly items = signal<readonly ItemImagen[]>([]);
  /** Orden de las imágenes guardadas tal como está en el servidor. */
  private readonly ordenServidor = signal<readonly string[]>([]);

  protected readonly guardando = signal(false);
  protected readonly errorGeneral = signal<string | null>(null);
  protected readonly erroresImagenes = signal<readonly string[]>([]);
  protected readonly erroresServidor = signal<ErroresPorCampo>({});
  protected readonly tocado = signal({ nombre: false, marca: false, precio: false });

  private contadorClaves = 0;
  private readonly urlsLocales = new Set<string>();

  protected readonly esEdicion = computed(() => this.productoActual() !== null);
  protected readonly titulo = computed(() => (this.esEdicion() ? 'Editar producto' : 'Nuevo producto'));

  /** Solo marcas activas; en edición se agrega (deshabilitada) la marca actual si está inactiva. */
  protected readonly opcionesMarca = computed<OpcionMarca[]>(() => {
    const opciones: OpcionMarca[] = this.marcasEstado
      .marcas()
      .filter((m) => m.activa)
      .map((m) => this.aOpcion(m, false));
    const actual = this.productoActual()?.marca;
    if (actual && !opciones.some((o) => o.id === actual.id)) {
      opciones.push({ id: actual.id, nombre: actual.nombre, color: actual.color, inactiva: true });
    }
    return opciones;
  });

  protected readonly errorNombre = computed(
    () =>
      (this.tocado().nombre ? validarNombre(this.nombre()) : null) ??
      this.erroresServidor()['nombre'] ??
      null,
  );
  protected readonly errorMarca = computed(
    () =>
      (this.tocado().marca && this.marcaId() === null ? 'Elige una marca.' : null) ??
      this.erroresServidor()['marcaId'] ??
      null,
  );
  protected readonly errorPrecio = computed(
    () =>
      (this.tocado().precio ? validarPrecio(this.precio()) : null) ??
      this.erroresServidor()['precio'] ??
      null,
  );
  protected readonly errorDescripcion = computed(
    () => validarDescripcion(this.descripcion()) ?? this.erroresServidor()['descripcion'] ?? null,
  );

  protected readonly formularioValido = computed(
    () =>
      validarNombre(this.nombre()) === null &&
      this.marcaId() !== null &&
      validarPrecio(this.precio()) === null &&
      validarDescripcion(this.descripcion()) === null,
  );

  protected readonly cupoLleno = computed(() => this.items().length >= MAX_IMAGENES);
  protected readonly hayPendientes = computed(() => this.items().some((i) => i.tipo === 'pendiente'));

  constructor() {
    // Al abrir, el formulario se llena con el producto (o con valores nuevos).
    effect(() => {
      if (!this.visible()) {
        return;
      }
      const producto = untracked(() => this.producto());
      untracked(() => this.reiniciar(producto));
    });
  }

  ngOnDestroy(): void {
    this.liberarVistasPrevias();
  }

  private aOpcion(marca: Marca, inactiva: boolean): OpcionMarca {
    return { id: marca.id, nombre: marca.nombre, color: marca.color, inactiva };
  }

  private reiniciar(producto: Producto | null): void {
    this.liberarVistasPrevias();
    this.productoActual.set(producto);
    this.nombre.set(producto?.nombre ?? '');
    this.marcaId.set(producto?.marca.id ?? null);
    this.precio.set(producto?.precio ?? '');
    this.descripcion.set(producto?.descripcion ?? '');
    this.disponibilidad.set(producto?.disponibilidad ?? 'DISPONIBLE');
    const guardadas = imagenesOrdenadas(producto?.imagenes ?? []);
    this.items.set(
      guardadas.map((imagen) => ({
        clave: imagen.id,
        tipo: 'guardada' as const,
        id: imagen.id,
        url: this.estado.urlImagen(imagen.url),
        nombre: `Imagen ${imagen.orden + 1}`,
      })),
    );
    this.ordenServidor.set(guardadas.map((i) => i.id));
    this.errorGeneral.set(null);
    this.erroresImagenes.set([]);
    this.erroresServidor.set({});
    this.tocado.set({ nombre: false, marca: false, precio: false });
  }

  protected tocar(campo: 'nombre' | 'marca' | 'precio'): void {
    this.tocado.update((t) => ({ ...t, [campo]: true }));
  }

  protected cancelar(): void {
    this.visible.set(false);
  }

  protected alCerrar(): void {
    this.liberarVistasPrevias();
  }

  // ── Imágenes ─────────────────────────────────────────────────────────────────────────

  /** `p-fileupload` entrega los archivos; se validan aquí y su lista interna se vacía. */
  protected alSeleccionar(evento: FileSelectEvent): void {
    this.agregarArchivos(Array.from(evento.currentFiles ?? evento.files ?? []));
    this.cargador()?.clear();
  }

  /** Valida (tipo, peso, cupo) y agrega a la lista las imágenes elegidas. */
  agregarArchivos(archivos: readonly File[]): void {
    const errores: string[] = [];
    const nuevos: ItemImagen[] = [];
    for (const archivo of archivos) {
      const problema = validarArchivoImagen(archivo);
      if (problema !== null) {
        errores.push(problema);
        continue;
      }
      if (this.items().length + nuevos.length >= MAX_IMAGENES) {
        errores.push(
          `Un producto admite hasta ${MAX_IMAGENES} imágenes. «${archivo.name}» no se agregó.`,
        );
        continue;
      }
      nuevos.push({
        clave: `nueva-${++this.contadorClaves}`,
        tipo: 'pendiente',
        url: this.crearVistaPrevia(archivo),
        nombre: archivo.name,
        tamano: archivo.size,
        archivo,
      });
    }
    this.erroresImagenes.set(errores);
    if (nuevos.length > 0) {
      this.items.update((lista) => [...lista, ...nuevos]);
    }
  }

  protected hacerPrincipal(indice: number): void {
    this.items.update((lista) => hacerPrimero(lista, indice));
  }

  protected mover(indice: number, direccion: -1 | 1): void {
    this.items.update((lista) => moverElemento(lista, indice, direccion));
  }

  /** RNF-12: quitar una imagen siempre pide confirmación. */
  protected pedirQuitar(item: ItemImagen): void {
    this.confirmacion.confirm({
      header: 'Quitar imagen',
      message:
        item.tipo === 'guardada'
          ? 'La imagen se borrará del producto de inmediato. ¿Quieres continuar?'
          : `«${item.nombre}» no se subirá. ¿Quieres quitarla?`,
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Quitar',
      rejectLabel: 'Cancelar',
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => void this.quitar(item),
    });
  }

  async quitar(item: ItemImagen): Promise<void> {
    if (item.tipo === 'pendiente') {
      this.descartar(item);
      return;
    }
    const producto = this.productoActual();
    if (producto === null || item.id === undefined) {
      return;
    }
    this.erroresImagenes.set([]);
    try {
      await this.estado.eliminarImagen(producto.id, item.id);
      this.items.update((lista) => lista.filter((i) => i.clave !== item.clave));
      this.ordenServidor.update((ids) => ids.filter((id) => id !== item.id));
      this.cambios.emit();
    } catch (error) {
      this.erroresImagenes.set([`No se pudo quitar la imagen. ${mensajeDeErrorDeProducto(error)}`]);
    }
  }

  private descartar(item: ItemImagen): void {
    this.items.update((lista) => lista.filter((i) => i.clave !== item.clave));
    this.revocar(item.url);
  }

  private crearVistaPrevia(archivo: File): string {
    if (typeof URL.createObjectURL !== 'function') {
      return '';
    }
    const url = URL.createObjectURL(archivo);
    this.urlsLocales.add(url);
    return url;
  }

  private revocar(url: string): void {
    if (this.urlsLocales.delete(url) && typeof URL.revokeObjectURL === 'function') {
      URL.revokeObjectURL(url);
    }
  }

  private liberarVistasPrevias(): void {
    for (const url of [...this.urlsLocales]) {
      this.revocar(url);
    }
  }

  // ── Guardar ──────────────────────────────────────────────────────────────────────────

  protected async guardar(): Promise<void> {
    this.tocado.set({ nombre: true, marca: true, precio: true });
    if (this.guardando() || !this.formularioValido()) {
      return;
    }
    this.guardando.set(true);
    this.errorGeneral.set(null);
    this.erroresImagenes.set([]);
    this.erroresServidor.set({});
    try {
      const producto = await this.guardarDatos();
      if (producto === null) {
        return;
      }
      if (!(await this.guardarImagenes(producto))) {
        return;
      }
      this.guardado.emit(this.productoActual() ?? producto);
      this.visible.set(false);
    } finally {
      this.guardando.set(false);
    }
  }

  /** Crea el producto o aplica solo los campos cambiados. `null` si falló (el error ya se muestra). */
  private async guardarDatos(): Promise<Producto | null> {
    const existente = this.productoActual();
    try {
      if (existente === null) {
        const creado = await this.estado.crear({
          nombre: this.nombre().trim(),
          marcaId: this.marcaId() ?? '',
          precio: precioParaApi(this.precio()),
          descripcion: this.descripcion(),
          disponibilidad: this.disponibilidad(),
        });
        // Desde aquí el producto existe: un reintento edita, no crea otro.
        this.productoActual.set(creado);
        this.cambios.emit();
        return creado;
      }
      const cambios = this.cambiosDe(existente);
      if (Object.keys(cambios).length === 0) {
        return existente;
      }
      const actualizado = await this.estado.actualizar(existente.id, cambios);
      this.productoActual.set(actualizado);
      this.cambios.emit();
      return actualizado;
    } catch (error) {
      this.erroresServidor.set(this.erroresDeCampo(error));
      this.errorGeneral.set(
        mensajeDeErrorDeProducto(error, { alGuardarConMarca: existente === null }),
      );
      return null;
    }
  }

  /** Errores por campo del 400 y, en 422 `MARCA_INACTIVA`, el aviso junto al selector de marca. */
  private erroresDeCampo(error: unknown): ErroresPorCampo {
    const porCampo = erroresPorCampo(error);
    if (Object.keys(porCampo).length > 0) {
      return porCampo;
    }
    const mensaje = mensajeDeErrorDeProducto(error);
    const esMarca =
      typeof error === 'object' &&
      error !== null &&
      'codigo' in error &&
      error.codigo === 'MARCA_INACTIVA';
    return esMarca ? { marcaId: mensaje } : {};
  }

  /**
   * Sube las imágenes pendientes en el orden mostrado y, si el orden final difiere del del
   * servidor, lo envía con PUT. `false` si algo falló (el diálogo queda abierto para reintentar).
   */
  private async guardarImagenes(producto: Producto): Promise<boolean> {
    let fallos = 0;
    for (const item of this.items()) {
      if (item.tipo !== 'pendiente' || item.archivo === undefined) {
        continue;
      }
      try {
        const imagen = await this.estado.subirImagen(producto.id, item.archivo);
        const guardada: ItemImagen = {
          clave: imagen.id,
          tipo: 'guardada',
          id: imagen.id,
          url: this.estado.urlImagen(imagen.url),
          nombre: item.nombre,
        };
        this.items.update((lista) => lista.map((i) => (i.clave === item.clave ? guardada : i)));
        this.ordenServidor.update((ids) => [...ids, imagen.id]);
        this.revocar(item.url);
        this.cambios.emit();
      } catch (error) {
        fallos++;
        const mensaje = mensajeDeErrorDeProducto(error);
        this.items.update((lista) =>
          lista.map((i) => (i.clave === item.clave ? { ...i, error: mensaje } : i)),
        );
      }
    }
    if (fallos > 0) {
      this.errorGeneral.set(
        `El producto se guardó, pero ${fallos === 1 ? 'una imagen no se subió' : `${fallos} imágenes no se subieron`}. ` +
          'Revisa el motivo en cada imagen, quítala o inténtalo de nuevo con «Guardar».',
      );
      return false;
    }

    const deseado = this.items().flatMap((i) => (i.id === undefined ? [] : [i.id]));
    if (deseado.length > 1 && !mismoOrden(deseado, this.ordenServidor())) {
      try {
        await this.estado.ordenarImagenes(producto.id, deseado);
        this.ordenServidor.set(deseado);
        this.cambios.emit();
      } catch (error) {
        this.errorGeneral.set(
          `El producto se guardó, pero no se pudo cambiar el orden de las imágenes. ${mensajeDeErrorDeProducto(error)}`,
        );
        return false;
      }
    }
    return true;
  }

  /** PATCH parcial: solo los campos que cambiaron. */
  private cambiosDe(existente: Producto): CambiosProducto {
    const cambios: { -readonly [K in keyof CambiosProducto]: CambiosProducto[K] } = {};
    const nombre = this.nombre().trim();
    if (nombre !== existente.nombre) {
      cambios.nombre = nombre;
    }
    const marcaId = this.marcaId();
    if (marcaId !== null && marcaId !== existente.marca.id) {
      cambios.marcaId = marcaId;
    }
    const precio = precioParaApi(this.precio());
    if (precio !== precioParaApi(existente.precio)) {
      cambios.precio = precio;
    }
    if (this.descripcion() !== existente.descripcion) {
      cambios.descripcion = this.descripcion();
    }
    if (this.disponibilidad() !== existente.disponibilidad) {
      cambios.disponibilidad = this.disponibilidad();
    }
    return cambios;
  }
}
