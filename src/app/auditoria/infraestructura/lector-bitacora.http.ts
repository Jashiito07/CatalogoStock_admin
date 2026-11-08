import { HttpClient, HttpParams } from '@angular/common/http';
import { EnvironmentProviders, inject, Injectable, makeEnvironmentProviders } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { LectorBitacora } from '../aplicacion/puertos';
import { ConsultaBitacora, PaginaBitacora } from '../dominio/bitacora';

export const RUTA_AUDITORIA = '/auditoria';

/** Adaptador HTTP de `GET /api/v1/auditoria` (docs/contrato-api/auditoria.md). */
@Injectable()
export class LectorBitacoraHttp extends LectorBitacora {
  private readonly http = inject(HttpClient);
  private readonly urlApi = inject(URL_API);

  consultar(consulta: ConsultaBitacora): Promise<PaginaBitacora> {
    let params = new HttpParams();
    for (const [nombre, valor] of Object.entries(consulta)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        params = params.set(nombre, String(valor));
      }
    }
    return firstValueFrom(
      this.http.get<PaginaBitacora>(`${this.urlApi}${RUTA_AUDITORIA}`, { params }),
    );
  }
}

/** Adaptadores del módulo `auditoria`. */
export function proveerAuditoria(): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: LectorBitacora, useClass: LectorBitacoraHttp }]);
}
