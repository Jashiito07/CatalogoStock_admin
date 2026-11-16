import { HttpClient, HttpParams } from '@angular/common/http';
import { EnvironmentProviders, inject, Injectable, makeEnvironmentProviders } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';

import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { ApiProductos } from '../aplicacion/puertos';
import { EstadoProductos } from '../aplicacion/estado-productos';
import {
  CambiosProducto,
  ConsultaProductos,
  ImagenProducto,
  NuevoProducto,
  PaginaProductos,
  Producto,
} from '../dominio/producto';

export const RUTA_PRODUCTOS = '/productos';

interface ListaApi<T> {
  readonly elementos: readonly T[];
}

/**
 * Resuelve la ruta pública de una imagen (`/api/v1/imagenes/<uuid>.<ext>`, D-46) contra el
 * origen de la API. Con una URL de API relativa (producción) la ruta ya es del mismo dominio;
 * con una absoluta (desarrollo, `http://localhost:3000/api/v1`) se antepone su origen.
 */
export function resolverUrlImagen(urlApi: string, ruta: string): string {
  if (/^https?:\/\//i.test(ruta) || !/^https?:\/\//i.test(urlApi)) {
    return ruta;
  }
  return `${new URL(urlApi).origin}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
}

/**
 * Adaptador HTTP de `ApiProductos` (docs/contrato-api/productos.md, «Endpoints: productos» e
 * «imágenes»). La subida es `multipart/form-data` con el campo `archivo`; el navegador pone el
 * `Content-Type` con su límite, por eso no se fija a mano.
 */
@Injectable()
export class ApiProductosHttp extends ApiProductos {
  private readonly http = inject(HttpClient);
  private readonly urlApi = inject(URL_API);

  private get base(): string {
    return `${this.urlApi}${RUTA_PRODUCTOS}`;
  }

  private ruta(id: string): string {
    return `${this.base}/${encodeURIComponent(id)}`;
  }

  listar(consulta: ConsultaProductos): Promise<PaginaProductos> {
    let params = new HttpParams()
      .set('pagina', String(consulta.pagina))
      .set('tamanio', String(consulta.tamanio));
    if (consulta.marcaId) {
      params = params.set('marcaId', consulta.marcaId);
    }
    if (consulta.busqueda) {
      params = params.set('busqueda', consulta.busqueda);
    }
    if (consulta.disponibilidad) {
      params = params.set('disponibilidad', consulta.disponibilidad);
    }
    return firstValueFrom(this.http.get<PaginaProductos>(this.base, { params }));
  }

  obtener(id: string): Promise<Producto> {
    return firstValueFrom(this.http.get<Producto>(this.ruta(id)));
  }

  crear(producto: NuevoProducto): Promise<Producto> {
    return firstValueFrom(this.http.post<Producto>(this.base, producto));
  }

  actualizar(id: string, cambios: CambiosProducto): Promise<Producto> {
    return firstValueFrom(this.http.patch<Producto>(this.ruta(id), cambios));
  }

  eliminar(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(this.ruta(id)));
  }

  subirImagen(productoId: string, archivo: File): Promise<ImagenProducto> {
    const cuerpo = new FormData();
    cuerpo.append('archivo', archivo, archivo.name);
    return firstValueFrom(this.http.post<ImagenProducto>(`${this.ruta(productoId)}/imagenes`, cuerpo));
  }

  ordenarImagenes(productoId: string, ids: readonly string[]): Promise<readonly ImagenProducto[]> {
    // La respuesta es la lista de imágenes; se tolera también `{ elementos }`.
    return firstValueFrom(
      this.http
        .put<readonly ImagenProducto[] | ListaApi<ImagenProducto>>(
          `${this.ruta(productoId)}/imagenes/orden`,
          { ids },
        )
        .pipe(map((r) => (Array.isArray(r) ? r : (r as ListaApi<ImagenProducto>).elementos))),
    );
  }

  eliminarImagen(productoId: string, imagenId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${this.ruta(productoId)}/imagenes/${encodeURIComponent(imagenId)}`),
    );
  }

  urlImagen(ruta: string): string {
    return resolverUrlImagen(this.urlApi, ruta);
  }
}

/** Adaptadores y estado del módulo `productos`. */
export function proveerProductos(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ApiProductos, useClass: ApiProductosHttp },
    EstadoProductos,
  ]);
}
