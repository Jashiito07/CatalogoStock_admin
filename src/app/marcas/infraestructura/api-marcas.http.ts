import { HttpClient, HttpParams } from '@angular/common/http';
import { EnvironmentProviders, inject, Injectable, makeEnvironmentProviders } from '@angular/core';
import { firstValueFrom, map } from 'rxjs';

import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { ApiMarcas } from '../aplicacion/puertos';
import { EstadoMarcas } from '../aplicacion/estado-marcas';
import { CambiosMarca, Marca, MarcaSugerida, NuevaMarca } from '../dominio/marca';

export const RUTA_MARCAS = '/marcas';

interface ListaApi<T> {
  readonly elementos: readonly T[];
}

/** Adaptador HTTP de `ApiMarcas` (docs/contrato-api/productos.md, «Endpoints: marcas»). */
@Injectable()
export class ApiMarcasHttp extends ApiMarcas {
  private readonly http = inject(HttpClient);
  private readonly urlApi = inject(URL_API);

  private get base(): string {
    return `${this.urlApi}${RUTA_MARCAS}`;
  }

  listar(incluirInactivas: boolean): Promise<readonly Marca[]> {
    const params = incluirInactivas ? new HttpParams().set('incluirInactivas', 'true') : undefined;
    return firstValueFrom(
      this.http
        .get<ListaApi<Marca>>(this.base, params ? { params } : {})
        .pipe(map((respuesta) => respuesta.elementos)),
    );
  }

  sugeridas(): Promise<readonly MarcaSugerida[]> {
    return firstValueFrom(
      this.http
        .get<ListaApi<MarcaSugerida>>(`${this.base}/sugeridas`)
        .pipe(map((respuesta) => respuesta.elementos)),
    );
  }

  crear(marca: NuevaMarca): Promise<Marca> {
    return firstValueFrom(this.http.post<Marca>(this.base, marca));
  }

  actualizar(id: string, cambios: CambiosMarca): Promise<Marca> {
    return firstValueFrom(this.http.patch<Marca>(`${this.base}/${encodeURIComponent(id)}`, cambios));
  }
}

/** Adaptadores y estado compartido del módulo `marcas`. */
export function proveerMarcas(): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: ApiMarcas, useClass: ApiMarcasHttp }, EstadoMarcas]);
}
