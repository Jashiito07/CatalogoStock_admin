import { HttpClient, HttpParams } from '@angular/common/http';
import { EnvironmentProviders, inject, Injectable, makeEnvironmentProviders } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { ApiClientes, Portapapeles } from '../aplicacion/puertos';
import { CodigoRecuperacion, ConsultaClientes, PaginaClientes } from '../dominio/cliente';
import { PortapapelesNavegador } from './portapapeles.navegador';

export const RUTA_USUARIOS = '/usuarios';

/** Adaptador HTTP de `ApiClientes` (docs/contrato-api/recuperacion-clave.md). */
@Injectable()
export class ApiClientesHttp extends ApiClientes {
  private readonly http = inject(HttpClient);
  private readonly urlApi = inject(URL_API);

  listar(consulta: ConsultaClientes): Promise<PaginaClientes> {
    let params = new HttpParams()
      .set('pagina', String(consulta.pagina))
      .set('tamanio', String(consulta.tamanio));
    if (consulta.busqueda) {
      params = params.set('busqueda', consulta.busqueda);
    }
    return firstValueFrom(
      this.http.get<PaginaClientes>(`${this.urlApi}${RUTA_USUARIOS}`, { params }),
    );
  }

  /** Sin cuerpo (contrato). El código de la respuesta no se registra en ningún lugar. */
  generarCodigoRecuperacion(idCliente: string): Promise<CodigoRecuperacion> {
    const url = `${this.urlApi}${RUTA_USUARIOS}/${encodeURIComponent(idCliente)}/codigo-recuperacion`;
    return firstValueFrom(this.http.post<CodigoRecuperacion>(url, null));
  }
}

/** Adaptadores del módulo `clientes`. */
export function proveerClientes(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ApiClientes, useClass: ApiClientesHttp },
    { provide: Portapapeles, useClass: PortapapelesNavegador },
  ]);
}
