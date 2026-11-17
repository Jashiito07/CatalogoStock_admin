import { HttpClient, HttpParams } from '@angular/common/http';
import { EnvironmentProviders, inject, Injectable, makeEnvironmentProviders } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { ApiClientes, Portapapeles } from '../aplicacion/puertos';
import {
  CodigoRecuperacion,
  ConsultaClientes,
  EstadoClienteActualizado,
  PaginaClientes,
} from '../dominio/cliente';
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
    if (consulta.activo !== undefined) {
      params = params.set('activo', String(consulta.activo));
    }
    if (consulta.correoVerificado !== undefined) {
      params = params.set('correoVerificado', String(consulta.correoVerificado));
    }
    return firstValueFrom(
      this.http.get<PaginaClientes>(`${this.urlApi}${RUTA_USUARIOS}`, { params }),
    );
  }

  /**
   * `?correoVerificado=false&tamanio=1`: solo interesa el `total`. Si la API es antigua y
   * ignora el filtro, el elemento devuelto no trae `correoVerificadoEn: null`; entonces el
   * `total` sería el de todos los clientes y no se debe mostrar: se devuelve 0.
   */
  async contarSinCorreoVerificado(): Promise<number> {
    const pagina = await this.listar({ pagina: 1, tamanio: 1, correoVerificado: false });
    const primero = pagina.elementos[0];
    if (primero !== undefined && primero.correoVerificadoEn !== null) {
      return 0;
    }
    return pagina.total;
  }

  /** Sin cuerpo (contrato). El código de la respuesta no se registra en ningún lugar. */
  generarCodigoRecuperacion(idCliente: string): Promise<CodigoRecuperacion> {
    const url = `${this.urlApi}${RUTA_USUARIOS}/${encodeURIComponent(idCliente)}/codigo-recuperacion`;
    return firstValueFrom(this.http.post<CodigoRecuperacion>(url, null));
  }

  /** `{ "activo": boolean }` (contrato usuarios-gestion.md, D-53). */
  cambiarEstado(idCliente: string, activo: boolean): Promise<EstadoClienteActualizado> {
    const url = `${this.urlApi}${RUTA_USUARIOS}/${encodeURIComponent(idCliente)}/estado`;
    return firstValueFrom(this.http.patch<EstadoClienteActualizado>(url, { activo }));
  }
}

/** Adaptadores del módulo `clientes`. */
export function proveerClientes(): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: ApiClientes, useClass: ApiClientesHttp },
    { provide: Portapapeles, useClass: PortapapelesNavegador },
  ]);
}
