import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { URL_API } from '../../compartido/infraestructura/http/url-api';
import { ApiAutenticacion } from '../aplicacion/puertos';
import { Sesion, Usuario } from '../dominio/usuario';

/** Rutas de autenticación del contrato de usuarios, relativas a `URL_API`. */
export const RUTAS_AUTENTICACION = {
  ingresoVendedor: '/autenticacion/ingreso/vendedor',
  renovacion: '/autenticacion/renovacion',
  salida: '/autenticacion/salida',
  usuarioActual: '/usuarios/yo',
} as const;

/** Rutas públicas: el interceptor no les adjunta el token ni intenta renovar ante un 401. */
export const RUTAS_PUBLICAS_AUTENTICACION: readonly string[] = [
  RUTAS_AUTENTICACION.ingresoVendedor,
  RUTAS_AUTENTICACION.renovacion,
];

/** Adaptador HTTP de `ApiAutenticacion` (docs/contrato-api/usuarios.md). */
@Injectable()
export class ApiAutenticacionHttp extends ApiAutenticacion {
  private readonly http = inject(HttpClient);
  private readonly urlApi = inject(URL_API);

  ingresarVendedor(correo: string, clave: string): Promise<Sesion> {
    return firstValueFrom(
      this.http.post<Sesion>(this.url(RUTAS_AUTENTICACION.ingresoVendedor), { correo, clave }),
    );
  }

  renovar(tokenRenovacion: string): Promise<Sesion> {
    return firstValueFrom(
      this.http.post<Sesion>(this.url(RUTAS_AUTENTICACION.renovacion), { tokenRenovacion }),
    );
  }

  async salir(tokenRenovacion: string): Promise<void> {
    await firstValueFrom(
      this.http.post<null>(this.url(RUTAS_AUTENTICACION.salida), { tokenRenovacion }),
    );
  }

  obtenerUsuarioActual(): Promise<Usuario> {
    return firstValueFrom(this.http.get<Usuario>(this.url(RUTAS_AUTENTICACION.usuarioActual)));
  }

  private url(ruta: string): string {
    return `${this.urlApi}${ruta}`;
  }
}
