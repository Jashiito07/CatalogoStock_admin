import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

import { Portapapeles } from '../aplicacion/puertos';

/**
 * Portapapeles con la Clipboard API del navegador. Solo existe en un contexto seguro
 * (HTTPS o `localhost`); abierto por la IP de la red local en HTTP no está disponible y
 * falla, para que la pantalla pida copiar el código a mano.
 */
@Injectable()
export class PortapapelesNavegador extends Portapapeles {
  private readonly documento = inject(DOCUMENT);

  async copiar(texto: string): Promise<void> {
    const portapapeles = this.documento.defaultView?.navigator.clipboard;
    if (!portapapeles) {
      throw new Error('Portapapeles no disponible');
    }
    await portapapeles.writeText(texto);
  }
}
