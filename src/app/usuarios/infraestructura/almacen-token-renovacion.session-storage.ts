import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

import { AlmacenTokenRenovacion } from '../aplicacion/puertos';

export const CLAVE_TOKEN_RENOVACION = 'catalogostock.panel.tokenRenovacion';

/**
 * Guarda el token de renovación en `sessionStorage` (contrato de usuarios, «Panel web»):
 * dura lo que la pestaña y no se comparte con otras pestañas ni sobrevive al cierre del
 * navegador. Nunca se usa `localStorage`. Si el navegador bloquea el almacenamiento,
 * la sesión funciona solo en memoria hasta recargar.
 */
@Injectable()
export class AlmacenTokenRenovacionSessionStorage extends AlmacenTokenRenovacion {
  private readonly almacen = obtenerSessionStorage(inject(DOCUMENT).defaultView);
  private enMemoria: string | null = null;

  leer(): string | null {
    try {
      return this.almacen?.getItem(CLAVE_TOKEN_RENOVACION) ?? this.enMemoria;
    } catch {
      return this.enMemoria;
    }
  }

  guardar(token: string): void {
    this.enMemoria = token;
    try {
      this.almacen?.setItem(CLAVE_TOKEN_RENOVACION, token);
    } catch {
      // Almacenamiento bloqueado o lleno: queda solo en memoria.
    }
  }

  borrar(): void {
    this.enMemoria = null;
    try {
      this.almacen?.removeItem(CLAVE_TOKEN_RENOVACION);
    } catch {
      // Nada que borrar.
    }
  }
}

function obtenerSessionStorage(ventana: Window | null): Storage | null {
  try {
    return ventana?.sessionStorage ?? null;
  } catch {
    return null;
  }
}
