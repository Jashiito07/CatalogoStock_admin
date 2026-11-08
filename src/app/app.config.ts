import { registerLocaleData } from '@angular/common';
import localeEsEc from '@angular/common/locales/es-EC';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { proveerHttp } from './compartido/infraestructura/http/proveer-http';
import { TemaCatalogoStock } from './compartido/presentacion/tema/tema-catalogostock';
import { TRADUCCION_PRIMENG } from './compartido/presentacion/traduccion-primeng';
import { proveerUsuarios } from './usuarios/infraestructura/proveer-usuarios';

registerLocaleData(localeEsEc);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    proveerHttp(),
    proveerUsuarios(),
    providePrimeNG({
      translation: TRADUCCION_PRIMENG,
      theme: {
        preset: TemaCatalogoStock,
        // Solo tema claro: el contraste de RNF-11 se validó sobre el Fondo corporativo.
        options: { darkModeSelector: false },
      },
      ripple: true,
    }),
    MessageService,
    { provide: LOCALE_ID, useValue: 'es-EC' },
  ],
};
