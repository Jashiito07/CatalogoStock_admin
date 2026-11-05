# CatálogoStock · Panel del vendedor

Panel web de administración de CatálogoStock (proyecto académico de ESPAM MFL). Desde aquí
el **Vendedor** gestiona lo que el Cliente ve en la app móvil: productos, marcas,
inventario, pedidos, verificación de transferencias, conflictos y bitácora (D-01).

- Funciona **siempre en línea** contra la API (`CatalogoStock-backend`); no usa SQLite
  ni cola de sincronización (D-02).
- Código, textos e interfaz en español (D-05).
- Componentes de **PrimeNG** con los colores corporativos (D-06).

Los requisitos están en `docs/DERCA.md` y el contrato de la API en `docs/contrato-api/`,
dentro del espacio de trabajo `CatalogoStock/`.

## Requisitos

- Node.js **24.15 o superior** (Angular 22 lo exige; ver `engines` en `package.json`).
- npm 11.
- La API de CatálogoStock en ejecución para usar el panel (en desarrollo,
  `http://localhost:3000/api/v1`).

## Comandos

```bash
npm install                 # instala las dependencias
npm start                   # servidor de desarrollo en http://localhost:4200
npm run lint                # ESLint con angular-eslint
npm test -- --watch=false   # pruebas unitarias (Vitest, una sola ejecución)
npm run build               # compilación de producción en dist/catalogostock-admin
```

## Configuración

`src/environments/` contiene solo configuración pública, **sin credenciales**:

| Archivo | Uso | `apiUrl` |
|---|---|---|
| `environment.development.ts` | `npm start` | `http://localhost:3000/api/v1` |
| `environment.ts` | `npm run build` | `/api/v1` (mismo dominio, servido por HTTPS, RNF-01) |

Los servicios HTTP obtienen la URL con el token `URL_API`, no leyendo el entorno.
Las credenciales de PayPhone y cualquier secreto viven solo en el backend.

## Tecnologías

| Paquete | Versión |
|---|---|
| Angular | 22.2 (standalone, sin zone.js, TypeScript estricto) |
| PrimeNG | 22.1 · `@primeuix/themes` 3.1 · PrimeIcons 8 · `@angular/cdk` 22 |
| Pruebas | Vitest con el constructor `@angular/build:unit-test` y jsdom |
| Lint | ESLint con angular-eslint 22 |

## Estructura

```text
src/
  environments/                      apiUrl por entorno (sin secretos)
  app/
    app.config.ts                    Router, HTTP, PrimeNG (tema), MessageService, es-EC
    app.routes.ts                    Rutas con carga diferida
    compartido/
      dominio/dinero.ts              Dinero exacto en centavos (sin frameworks)
      aplicacion/error-api.ts        Tipo ErrorApi { codigo, mensaje, estado, detalles }
      infraestructura/http/          Interceptor de errores, proveerHttp(), URL_API
      presentacion/
        tema/                        tema-catalogostock.ts (preset) y colores.css (--cs-*)
        diseno/                      Barra superior y menú lateral del panel
        inicio/                      Página de bienvenida
    <modulo>/{dominio,aplicacion,infraestructura,presentacion}/   (próximas fases)
```

Módulos previstos: `usuarios`, `productos`, `inventario`, `pedidos`, `pagos`,
`conflictos` y `auditoria` (ver `docs/PLAN.md`).

### Regla de dependencias

```text
presentacion ─┐
              ├─> aplicacion ─> dominio
infraestructura┘
```

- `dominio`: entidades y reglas puras. No importa Angular, PrimeNG, RxJS ni HTTP.
- `aplicacion`: casos de uso y puertos (interfaces).
- `infraestructura`: adaptadores HTTP contra la API.
- `presentacion`: páginas y componentes de Angular con PrimeNG.

## Interfaz y diseño

- Todos los controles se construyen con PrimeNG (`p-button`, `p-table`, `p-dialog`,
  `p-confirmdialog`, `p-toast`, `p-menu`, …).
- La paleta se define **una sola vez** en `src/app/compartido/presentacion/tema/`:
  Primario `#2563EB`, Secundario `#7C3AED`, Acento `#F97316`, Fondo `#F8FAFC` y
  Texto `#1E293B`. Los componentes usan las variables `--cs-*` o los tokens del preset;
  no se escriben colores hexadecimales en ellos.
- Botones secundarios: `severity="secondary"` (Secundario con texto blanco).
  Destacados: `severity="warn"` (Acento con texto `#1E293B`; **nunca** texto blanco sobre
  el Acento, RNF-11).
- Confirmación al eliminar y aviso al agregar (RNF-12). Textos en español y moneda en
  formato `es-EC` (`$12,50`).

## Reglas clave

- El panel no decide estados, totales ni stock: muestra lo que devuelve la API y cada
  acción la valida el servidor.
- El dinero se maneja con `Dinero` (centavos enteros) o texto decimal; nunca con
  `parseFloat`.
- Los errores de la API llegan a las pantallas como `ErrorApi` con un mensaje claro;
  sin conexión con la API se indica con el código `SIN_CONEXION`.
- No se registran en consola tokens, contraseñas ni datos personales.

## Git

Ramas `main` y `develop`; se trabaja en `feature/<modulo>-<descripcion>` creada desde
`develop`, con Conventional Commits y Pull Request hacia `develop`.
