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
npm start                   # servidor de desarrollo en http://localhost:4201
npm run start:red           # igual, pero abierto a la red local (para el celular)
npm run lint                # ESLint con angular-eslint
npm test -- --watch=false   # pruebas unitarias (Vitest, una sola ejecución)
npm run build               # compilación de producción en dist/catalogostock-admin
```

El panel usa el puerto **4201** (la app móvil usa el 4200 en el navegador).

## Configuración

`src/environments/` contiene solo configuración pública, **sin credenciales**:

| Archivo | Uso | `apiUrl` |
|---|---|---|
| `environment.development.ts` | `npm start` | `http://localhost:3000/api/v1` |
| `environment.ts` | `npm run build` | `/api/v1` (mismo dominio, servido por HTTPS, RNF-01) |

Los servicios HTTP obtienen la URL con el token `URL_API` (`compartido/infraestructura/http/url-api.ts`),
no leyendo el entorno. Si la URL configurada apunta a `localhost` y el panel se abrió desde
otro host (por ejemplo, el celular con la IP de la PC), se usa **el mismo host con el puerto
de la API**: `http://<host del panel>:3000/api/v1`. Por eso no hay IPs escritas en archivos
versionados. Una URL relativa (producción) no cambia.

Las credenciales de PayPhone y cualquier secreto viven solo en el backend.

## Abrir el panel desde el celular (red local, solo desarrollo)

Sirve para probar el panel en el navegador del celular, conectado al **mismo Wi-Fi** que la PC.

1. **Averigua la IP de la PC** en el Wi-Fi. En PowerShell:
   `Get-NetIPAddress -AddressFamily IPv4 | Where-Object InterfaceAlias -like 'Wi-Fi*'`
   (o `ipconfig`, en «Adaptador de LAN inalámbrica Wi-Fi», «Dirección IPv4»).
   En los ejemplos se usa `192.168.100.113`.
2. **Permite el origen del panel en la API.** En `CatalogoStock-backend/.env` (no se sube a
   Git), agrega a `CORS_ORIGENES` el origen `http://<IP de la PC>:4201`, separado por coma.
   Si cambias el archivo, reinicia la API.
3. **Arranca la API** en `CatalogoStock-backend`: `npm run start:dev`. Nest escucha en todas
   las interfaces, así que responde en `http://<IP de la PC>:3000/api/v1`.
4. **Arranca el panel abierto a la red** en `CatalogoStock_admin`: `npm run start:red`
   (equivale a `ng serve --host 0.0.0.0 --port 4201`). La consola muestra las direcciones
   «Network», por ejemplo `http://192.168.100.113:4201/`.
5. **Abre el firewall de Windows** (una sola vez y como administrador), con la red Wi-Fi como
   **Privada** (Configuración → Red e Internet → Wi-Fi → Tipo de perfil de red → Privada):
   ```powershell
   New-NetFirewallRule -DisplayName "CatalogoStock panel 4201" -Direction Inbound -Protocol TCP -LocalPort 4201 -Action Allow -Profile Private
   New-NetFirewallRule -DisplayName "CatalogoStock API 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
   ```
6. **En el celular**, abre `http://<IP de la PC>:4201` en el navegador e ingresa con la
   cuenta del Vendedor. El panel llamará a la API en `http://<IP de la PC>:3000/api/v1`.
7. Si no carga: comprueba que ambos equipos estén en el mismo Wi-Fi, que la IP no haya
   cambiado (el router puede asignar otra) y que abrir `http://<IP de la PC>:3000/api/v1/salud`
   en el celular responda `{"estado":"ok",…}`. Si la API responde pero el panel muestra
   «No se pudo conectar con el servidor», revisa `CORS_ORIGENES` (paso 2).

Es solo para desarrollo: el tráfico va por HTTP sin cifrar dentro de la red local. En
producción el panel y la API se sirven por HTTPS en el mismo dominio (RNF-01).

## Sesión del Vendedor (RF-USU-01, RF-USU-03, D-09, D-19)

- El ingreso usa solo `POST /autenticacion/ingreso/vendedor`. Un Cliente recibe
  «Correo o clave incorrectos.» y no obtiene sesión; además, el guard `soloVendedor`
  comprueba el rol `VENDEDOR` como defensa adicional (la API valida siempre el rol).
- **Token de acceso (15 min): solo en memoria** (`SesionVendedor`). **Token de renovación
  (7 días, un solo uso): en `sessionStorage`**, para sobrevivir a una recarga de la pestaña;
  se pierde al cerrarla y nunca se guarda en `localStorage` (contrato de usuarios).
- El interceptor `interceptorAutenticacion` adjunta `Authorization: Bearer …` a las rutas
  protegidas de la API. Ante un 401 `TOKEN_VENCIDO` renueva **una sola vez** (las solicitudes
  simultáneas comparten la renovación) y repite la solicitud una vez. Cualquier otro 401 o
  una renovación rechazada cierra la sesión y lleva al ingreso. Sin conexión, la sesión se
  conserva para reintentar.
- «Cerrar sesión» llama a `POST /autenticacion/salida` y borra la sesión local aunque la
  API no responda.
- Al duplicar una pestaña, el navegador copia `sessionStorage`: si las dos pestañas renuevan
  con el mismo token, la API detecta la reutilización y cierra esa sesión en ambas (D-09).
  Basta con volver a ingresar.

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
      infraestructura/http/          Interceptor de errores, proveerHttp(), URL_API (url-api.ts)
      presentacion/
        tema/                        tema-catalogostock.ts (preset) y colores.css (--cs-*)
        traduccion-primeng.ts        Textos de PrimeNG en español (calendario, paginador)
        diseno/                      Barra superior (Vendedor, cerrar sesión) y menú lateral
        inicio/                      Página de bienvenida
    usuarios/                        Ingreso y sesión del Vendedor (F1)
      dominio/usuario.ts             Usuario, Sesión, regla «solo Vendedor»
      aplicacion/                    Puertos y SesionVendedor (tokens, renovación única)
      infraestructura/               HTTP, sessionStorage, interceptor de autenticación
      presentacion/                  Pantalla de ingreso y guards
      pruebas/                       Dobles de prueba (excluidos de la compilación)
    auditoria/                       Bitácora de actividades (F1, RF-USU-04)
      dominio/bitacora.ts            Catálogo de acciones, filtros con zona -05:00
      aplicacion/ · infraestructura/ Puerto y adaptador de GET /auditoria
      presentacion/bitacora/         p-table paginada en el servidor con filtros
    marcas/                          Marcas y «Configura tu negocio» (F2, RF-PRO-04, RF-PRO-06)
      dominio/marca.ts               Modelo, validación #RRGGBB, texto y contraste, reordenar
      aplicacion/                    Puerto ApiMarcas, EstadoMarcas (lista compartida), mensajes
      infraestructura/               ApiMarcasHttp (GET/POST/PATCH /marcas, sin DELETE)
      presentacion/                  configura-negocio, marcas, dialogo-marca, selector-color,
                                     vista-previa-marca y guards del negocio
    <modulo>/{dominio,aplicacion,infraestructura,presentacion}/   (próximas fases)
```

Módulos previstos: `usuarios`, `productos`, `inventario`, `pedidos`, `pagos`,
`conflictos` y `auditoria` (ver `docs/PLAN.md`).

## Bitácora (RF-USU-04, D-30, D-31)

- `p-table` paginada en el servidor (`pagina`, `tamanio`), de lo más reciente a lo más antiguo.
- Filtros: acción (catálogo del contrato), «Desde» y «Hasta» con `p-datepicker` y usuario
  (botón de filtro en cada fila, quitable con el chip). Las fechas se envían con hora y zona
  de Ecuador: `Desde` = `AAAA-MM-DDT00:00:00.000-05:00`, `Hasta` = `AAAA-MM-DDT23:59:59.999-05:00`.
- La API responde en UTC y el panel muestra la hora de Ecuador.
- `usuario: null` se muestra como «No identificado»; un usuario eliminado (`rol: null`),
  como «Usuario eliminado».

## Marcas y «Configura tu negocio» (RF-PRO-04, RF-PRO-06, D-43, D-48)

- **Configura tu negocio** (`/configura-tu-negocio`): si `GET /marcas?incluirInactivas=true` viene
  vacío, el guard `negocioConfigurado` lleva aquí tras el ingreso y el menú muestra el enlace
  mientras no haya marcas. Muestra las sugeridas (`GET /marcas/sugeridas`) con casilla, color y vista
  previa; permite editar el color y agregar una marca propia. «Continuar» crea con `POST /marcas`
  solo las elegidas (al menos una) y lleva a **Marcas**. Errores: 409 `MARCA_DUPLICADA` y 400 por campo
  se señalan en la tarjeta.
- **Marcas** (`/marcas`): `p-table` con color, acento, estado y orden; crear y editar en `p-dialog`
  (selector de color + campo `#RRGGBB`, acento opcional, vista previa de la cabecera con el texto
  calculado y «Contraste 4.9:1 ✔»); activar o desactivar (desactivar pide confirmación) y subir o
  bajar el orden. No existe eliminar: una marca se desactiva.
- Los colores de cada marca vienen de la API y se aplican como estilos en línea (única excepción a
  «sin hexadecimales en componentes»); el texto sobre el color se calcula igual que el servidor
  (blanco, `#1E293B`, `#0F172A`, negro: el primero con 4.5:1, RNF-11).

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

## Tema automático claro / oscuro (D-41)

- **Horario** (hora local del equipo, Ecuador): de **18:40 a 06:45** el panel usa el **modo oscuro con violeta**; de 06:45 a 18:40, el claro. Intervalo `[18:40, 06:45)`: 18:39 claro, 18:40 oscuro, 06:44 oscuro, 06:45 claro. La regla vive en `compartido/dominio/tema.ts` (`temaPorHora`, `resolverTema`) y se prueba sin depender de la zona horaria.
- **Cambia solo** con el panel abierto: `ServicioTema` revisa la hora cada 30 s y al volver a la pestaña (`visibilitychange`). Sin dependencias nuevas.
- **Selector «Automático / Claro / Oscuro»** en la barra superior, junto a «Cambiar mi clave». Automático es el valor por defecto. La preferencia se guarda en `localStorage` con la clave `catalogostock_admin_preferencia_tema` (dato no sensible; los tokens nunca van ahí) detrás del puerto `AlmacenPreferenciaTema`.
- **Sin destello**: el tema se aplica en `provideAppInitializer`, antes de la primera pantalla.
- **Cómo se aplica**: la clase `app-oscuro` en `<html>` es el `darkModeSelector` de PrimeNG y activa las variables `--cs-*` oscuras (`colores.css`), el logo `catalogostock-logo-horizontal-fondo-oscuro.svg` y `<meta name="theme-color">`. El preset (`tema-catalogostock.ts`) usa `light-dark()`.
- **Forzar el tema en desarrollo** (solo `isDevMode()`, nunca en producción): `http://localhost:4201/?tema=oscuro` (o `claro`, `automatico`). No se guarda.
- **Paleta oscura**: fondo `#0F172A`, superficies `#1E293B`, bordes `#334155`, texto `#E2E8F0`; el Acento conserva texto `#1E293B`. Contrastes (RNF-11) en `presentacion/tema/contraste.spec.ts`.
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
