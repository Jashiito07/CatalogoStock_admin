import { registerLocaleData } from '@angular/common';
import localeEsEc from '@angular/common/locales/es-EC';
import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';

import { routes } from './app.routes';
import { proveerHttp } from './compartido/infraestructura/http/proveer-http';
import { PreferenciaTemaLocalStorage } from './compartido/infraestructura/preferencia-tema.local-storage';
import {
  ALMACEN_PREFERENCIA_TEMA,
  CLASE_TEMA_OSCURO,
  ServicioTema,
} from './compartido/presentacion/tema/servicio-tema';
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
        // Modo oscuro (D-41): lo activa la clase `app-oscuro` en <html> (ServicioTema).
        options: { darkModeSelector: `.${CLASE_TEMA_OSCURO}` },
      },
      ripple: true,
    }),
    MessageService,
    // D-41: preferencia de tema en localStorage (dato no sensible) detrás de un puerto.
    {
      provide: ALMACEN_PREFERENCIA_TEMA,
      useFactory: () => new PreferenciaTemaLocalStorage(globalThis.localStorage ?? null),
    },
    // El tema se aplica antes de la primera pantalla (sin destello del tema equivocado).
    provideAppInitializer(() => inject(ServicioTema).iniciar()),
    { provide: LOCALE_ID, useValue: 'es-EC' },
  ],
};
