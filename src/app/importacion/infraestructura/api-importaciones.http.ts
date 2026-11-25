import { HttpClient, HttpEventType, HttpParams, HttpResponse } from '@angular/common/http';
import { EnvironmentProviders, inject, Injectable, makeEnvironmentProviders } from '@angular/core';
import { filter, firstValueFrom, map, tap } from 'rxjs';

import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { EstadoImportacion } from '../aplicacion/estado-importacion';
import { AlmacenImportacionesRecientes, ApiImportaciones } from '../aplicacion/puertos';
import {
  Borrador,
  CambiosBorrador,
  ConsultaBorradores,
  Importacion,
  PaginaBorradores,
  porcentajeDeSubida,
  ResultadoBorrador,
} from '../dominio/importacion';
import { AlmacenRecientesSessionStorage } from './almacen-recientes.session-storage';

export const RUTA_IMPORTACIONES = '/productos/importaciones';

interface RespuestaLote {
  readonly resultados: readonly ResultadoBorrador[];
}

/**
 * Adaptador HTTP de `ApiImportaciones` (docs/contrato-api/productos-importacion.md). El análisis
 * es `multipart/form-data` con los campos `marcaId` y `archivo`; el navegador pone el
 * `Content-Type` con su límite, por eso no se fija a mano. El PDF no se guarda en el panel.
 */
@Injectable()
export class ApiImportacionesHttp extends ApiImportaciones {
  private readonly http = inject(HttpClient);
  private readonly urlApi = inject(URL_API);

  private get base(): string {
    return `${this.urlApi}${RUTA_IMPORTACIONES}`;
  }

  private ruta(id: string): string {
    return `${this.base}/${encodeURIComponent(id)}`;
  }

  analizar(
    archivo: File,
    marcaId: string,
    alProgreso?: (porcentaje: number) => void,
  ): Promise<Importacion> {
    const cuerpo = new FormData();
    cuerpo.append('marcaId', marcaId);
    cuerpo.append('archivo', archivo, archivo.name);
    // `reportProgress` da el avance real de la subida; la respuesta llega al final como evento.
    const respuesta = this.http
      .post<Importacion>(this.base, cuerpo, { observe: 'events', reportProgress: true })
      .pipe(
        tap((evento) => {
          if (evento.type === HttpEventType.UploadProgress) {
            alProgreso?.(porcentajeDeSubida(evento.loaded, evento.total));
          }
        }),
        filter((evento): evento is HttpResponse<Importacion> => evento.type === HttpEventType.Response),
        map((evento) => evento.body as Importacion),
      );
    return firstValueFrom(respuesta);
  }

  obtener(id: string): Promise<Importacion> {
    return firstValueFrom(this.http.get<Importacion>(this.ruta(id)));
  }

  listarBorradores(id: string, consulta: ConsultaBorradores): Promise<PaginaBorradores> {
    let params = new HttpParams()
      .set('pagina', String(consulta.pagina))
      .set('tamanio', String(consulta.tamanio))
      .set('estado', consulta.estado);
    if (consulta.conAdvertencias) {
      params = params.set('conAdvertencias', 'true');
    }
    if (consulta.busqueda) {
      params = params.set('busqueda', consulta.busqueda);
    }
    if (consulta.paginaPdf !== undefined) {
      params = params.set('paginaPdf', String(consulta.paginaPdf));
    }
    return firstValueFrom(
      this.http.get<PaginaBorradores>(`${this.ruta(id)}/borradores`, { params }),
    );
  }

  editarBorrador(id: string, cambios: CambiosBorrador): Promise<Borrador> {
    return firstValueFrom(
      this.http.patch<Borrador>(`${this.base}/borradores/${encodeURIComponent(id)}`, cambios),
    );
  }

  async aprobar(ids: readonly string[]): Promise<readonly ResultadoBorrador[]> {
    return (await this.enviarLote('aprobar', ids)).resultados;
  }

  async descartar(ids: readonly string[]): Promise<readonly ResultadoBorrador[]> {
    return (await this.enviarLote('descartar', ids)).resultados;
  }

  private enviarLote(accion: 'aprobar' | 'descartar', ids: readonly string[]): Promise<RespuestaLote> {
    return firstValueFrom(this.http.post<RespuestaLote>(`${this.base}/borradores/${accion}`, { ids }));
  }
}

/** Adaptadores y estado del módulo `importacion`. */
export function proveerImportacion(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ApiImportaciones, useClass: ApiImportacionesHttp },
    { provide: AlmacenImportacionesRecientes, useClass: AlmacenRecientesSessionStorage },
    EstadoImportacion,
  ]);
}
