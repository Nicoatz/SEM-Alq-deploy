# RentAR — guía del monorepo (SEM-Alq)

> **Las respuestas al usuario van siempre en español.**

> **Antes de tocar código de `apps/web`:** leé `apps/web/CLAUDE.md` (→ `apps/web/AGENTS.md`). La
> versión de Next.js de este monorepo (16.x) tiene cambios incompatibles con lo que un LLM entrenado
> con versiones anteriores conoce (por ejemplo, `middleware.ts` pasó a llamarse `proxy.ts`).
> `apps/web/AGENTS.md` lo reescribe `next dev` solo: no lo edites a mano.

## Qué es RentAR

Plataforma web para gestionar alquileres residenciales de larga duración directamente entre
locador, locatario y garante, sin inmobiliaria. El piloto es Córdoba Capital. Proyecto académico
de la cátedra Seminario Integrador (Ingeniería en Sistemas de Información, UTN FRC, 2026).

- Producto, usuarios y alcance: [`docs/PRODUCT.md`](docs/PRODUCT.md).
- Sistema de diseño: [`docs/DESIGN.md`](docs/DESIGN.md).
- Rutas, arquetipos, menús y elenco de datos de prueba: [`docs/MapaDePantallas.pdf`](docs/MapaDePantallas.pdf).
- Estudio inicial, Sprint 0 y User Stories: [`Documentación/md/`](Documentación/md/).
- Asistente del equipo (visión, stack, ramas): [`.agents/proyecto-rentar/SKILL.md`](.agents/proyecto-rentar/SKILL.md).

## Estructura del monorepo

```
/
├── apps/
│   ├── web/                # Next.js 16 + Ant Design 6 (frontend) — puerto 3001
│   └── api/                # Node.js + Express + Swagger (backend) — puerto 3000
├── packages/
│   ├── shared-types/       # Modelos del back + tipos de vista del front (ver su README)
│   └── ui/                 # @rentar/ui: tema de antd y componentes (design system)
├── supabase/               # migrations/ y seed.sql
├── docs/                   # PRODUCT.md, DESIGN.md, MapaDePantallas.pdf, HANDOFF-BACKEND.md, api-endpoints.md
├── Documentación/          # Documentación académica: Estudio Inicial, Sprint 0, US, planes (md y pdf)
├── .design-sync/           # Configuración y notas de /design-sync (ver NOTES.md)
└── .agents/, .claude/      # Skills: proyecto-rentar (del equipo) y playwright-cli
```

Cada módulo tiene su `README.md`: `apps/web`, `apps/web/src/services`, `apps/web/src/lib/mocks`,
`packages/shared-types`, `packages/ui`.

## Stack, versiones y puertos

- Node.js >= 20.9 (ver `.nvmrc`), npm workspaces.
- `apps/web`: Next.js 16.3.5 (App Router) + React 19 + TypeScript + Ant Design 6.6.3. antd va con
  versión **exacta** en `apps/web` y `packages/ui`: dos copias distintas rompen el tema.
- `apps/api`: Express + Swagger. Rutas en `apps/api/src/routes/v1/`, docs en
  `http://localhost:3000/api/v1/docs`.
- **Puertos:** la API usa el **3000** y la web el **3001** (`next dev -p 3001`).
- TypeScript `strict` en todo el frontend. **Nada de `any`**: si algo no se puede tipar bien, usar
  `unknown` con un comentario que explique por qué.

## Comandos

Desde la raíz:

```bash
npm install          # instala todo el workspace
npm run dev:web      # apps/web en http://localhost:3001
npm run dev:api      # apps/api en http://localhost:3000
npm run build        # build de todos los workspaces
npm run lint         # eslint de apps/web
npm run typecheck    # tsc --noEmit en shared-types, ui y web
```

NOTA: el test de la API (`apps/api/tests/api/`) todavía manda `x-user-id` y escribe en la base: no
correrlo (anotado para backend en `docs/HANDOFF-BACKEND.md` §10). `apps/api` vuelve a compilar desde
el 29/09. Para el front alcanza con `npm run typecheck`, `npm run lint` y
`npm run build --workspace=@rentar/web`.

## Convenciones de código

El código es un entregable para todo el equipo: tiene que poder leerlo alguien que no maneja
Next.js ni Ant Design.

- **Idioma:** comentarios en español; nombres de variables, funciones y componentes en inglés.
- **Encabezado en cada archivo:** qué es, qué US cubre, de dónde saca los datos y quién lo usa.
- **Secciones** en los archivos largos: `// ─── Estado local ───`, `// ─── Handlers ───`,
  `// ─── Render ───`, etc.
- **JSDoc en español** en cada componente, hook, service y utilidad. Comentar el *por qué* de cada
  regla de negocio o validación (citando el criterio de la US).
- **Marcas para buscar con grep**, siempre con explicación: `TODO(backend):` (falta algo en la API),
  `TODO(db):` (falta algo en la base) y `NOTA:` (una decisión que no es obvia).
- **User Stories:** siempre con la numeración del Sprint 0. Si algo no tiene US en el Sprint 0:
  "sin US en Sprint 0 (mapa US-xx)". Tabla de equivalencias en `docs/HANDOFF-BACKEND.md` §11.
- **Componentes:** `Componente.tsx` + `Componente.module.css`. Props con una interfaz explícita.
- **Usar primero `@rentar/ui`.** Si algo parecido existe, extenderlo o componerlo. Los cambios en
  `@rentar/ui` se consultan antes con el PO y se anotan en `.design-sync/NOTES.md`.
- **Nada de valores visuales en crudo** (colores, radios, sombras) en `.module.css` ni en
  `style={{}}`: usar las variables `var(--rentar-*)` de `packages/ui/src/tokens/css-vars.css`. Para
  una opacidad, `rgba(var(--rentar-color-ink-rgb), 0.08)` o `color-mix(...)` sobre un token.
- **Alias de import:** `@/*` dentro de `apps/web` (→ `apps/web/src/*`); `@rentar/ui` y
  `@rentar/shared-types` para los paquetes.
- **Diseño y criterios de aceptación:** el diseño de Claude Design manda en lo visual; los criterios
  de aceptación de las US (`Documentación/md/US/`) mandan en los datos y las validaciones.

## Conexión con el backend

`apps/web/src/services/` es **la única frontera con el backend**. Ninguna página ni componente
importa mocks ni llama a `fetch` directo.

- **Flag de mocks:** `NEXT_PUBLIC_USE_MOCKS` (por defecto `true`, ver `apps/web/.env.example`).
  Cada función de un service tiene dos ramas: la mock (datos del elenco) y la real (la API). Pasar a
  la API: en `apps/web/.env.local`, `NEXT_PUBLIC_USE_MOCKS=false` más las dos variables de Supabase
  (sección "Sesión"), y reiniciar `dev:web`.
- **Cliente HTTP único:** `services/shared/apiClient.ts`. Arma la URL con `NEXT_PUBLIC_API_URL`
  (por defecto `http://localhost:3000/api/v1`), manda `Authorization: Bearer <token de Supabase>`
  (salvo `auth: false`, solo para el registro), usa `cache: 'no-store'`, desarma el sobre
  `{ success, message?, data?, error? }` y convierte cada status HTTP en un `ServiceError` con código.
- **Adaptadores:** `services/adapters/`. Traducen cada DTO del back al tipo de vista que usa la
  pantalla, campo por campo, con lo que falta marcado como `TODO(backend)` o `TODO(db)`. Un dato
  que el back no manda se muestra vacío, **nunca inventado**.
- **Cada función de service** lleva la US que cubre y un bloque `@backend` con método, ruta y
  estado: `(existe)`, `(en curso en <rama>)` o `(no existe — propuesto)`.
- Paso a paso para conectar un endpoint, estado de cada endpoint, brechas por US y status HTTP que
  espera el front: [`docs/HANDOFF-BACKEND.md`](docs/HANDOFF-BACKEND.md). Lista de endpoints:
  [`docs/api-endpoints.md`](docs/api-endpoints.md).

## Sesión (Supabase Auth)

- **Modo real:** la sesión es la de **Supabase Auth**. El back no tiene rutas de login ni logout:
  `auth.service` usa `supabase.auth.signInWithPassword` / `signOut`, y después pide el perfil y los
  roles a `GET /api/v1/usuarios/me`. Si `/me` falla, se cierra la sesión y se muestra el error: los
  roles nunca se deducen de otro lado. `x-user-id` ya no existe.
- **Clientes de Supabase** (`@supabase/ssr`, en `apps/web/src/lib/auth/supabase/`): `client.ts`
  (navegador, singleton; lo usan `AuthProvider`, `auth.service` y `apiClient`), `server.ts` (Server
  Components, hoy sin uso) y `proxy.ts` (`updateSession`, con `getClaims()`). La sesión vive en
  cookies `sb-*`, no en `localStorage`, para que el proxy la lea del lado del servidor.
- **`src/proxy.ts`** protege `/panel/*`: en modo real verifica y renueva la sesión de Supabase; en
  modo mock alcanza con la cookie `rentar_session`. Sin sesión, manda a `/login?next=<ruta>`.
- **Token:** dura 1 hora y Supabase lo renueva solo. El `apiClient` pide la sesión vigente antes de
  cada request; no se guarda aparte. Un 401 se muestra como "Tu sesión venció".
- **`AuthProvider`** (`lib/auth/`): usuario y rol activo. En modo real hidrata desde la sesión de
  Supabase, escucha `SIGNED_OUT`, relee la sesión en cada cambio de ruta y hace `router.refresh()`
  cuando la sesión cambia (el caché de rutas de Next guarda los redirects del proxy). El logout
  termina con una recarga completa en la landing. La cookie `rentar_session` guarda solo el rol activo.
- **Header público con sesión** (`components/PublicHeader.tsx`): "Ir a mi panel" y el UserMenu con
  el rol activo; "Cerrar sesión" ahí usa `logout({ quedarse: true })` (sin recargar). Para que no
  parpadee, el layout público y `/login`/`/registro` leen si llega una cookie de sesión, sin
  validarla (`lib/auth/sesion-probable.ts`): con cookie, placeholder mientras carga. Eso hace
  dinámicas las páginas públicas. Con sesión, `/login` y `/registro` llevan a `/panel`.
- **El front nunca consulta tablas con `supabase-js`.** RLS está activo y sin políticas: todo dato
  pasa por `apps/api`. Supabase se usa solo para Auth (y, cuando exista el bucket
  `fotos-propiedades`, para subir fotos a Storage).
- **Variables** (`apps/web/.env.local`): `NEXT_PUBLIC_SUPABASE_URL` y
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (la clave **publicable**). La `SUPABASE_SECRET_KEY` nunca va
  en `apps/web`: es solo de `apps/api`.
- **Modo mock:** sin Supabase ni API. La sesión es la cookie `rentar_session` con `{ userId,
  activeRole }` y dura 30 días (no hay "Recordarme").

## Roles (regla del equipo, 27/09/2026)

- **Todos se registran como locatarios.** El registro no pregunta el rol.
- **Cualquier usuario con sesión puede publicar** (`/panel/propiedades/nueva` solo pide sesión). Mis
  propiedades (`/panel/propiedades`) sigue siendo solo para locadores (`RequireRole` en la página).
- **Al publicar la primera propiedad, el back lo pasa a locador.** Locador abarca a locatario:
  `/usuarios/me` devuelve `["locador", "locatario"]`. El front relee los roles después del 201
  (`useAuth().refrescarUsuario('locador')`) sin cerrar sesión; en modo mock, la cuenta se guarda
  con los dos roles en `rentar:mock:usuarios`.
- **"Publicar propiedad"** va en el encabezado del panel para cualquier rol
  (`AppShell#headerAction`); en móvil, primero en el menú hamburguesa y en la hoja del UserMenu.
- El selector "Viendo como" (`RoleContextSwitcher`) no cambió: aparece cuando la cuenta tiene dos roles.
- En el back desde el 29/09 (d88deca): `POST /inmuebles` acepta cualquier rol y suma el rol locador
  en la misma transacción (probado en real). Detalle en `docs/HANDOFF-BACKEND.md` §2 y §7 (US-01).

## Datos de prueba (modo mock)

- **El elenco único** vive en `apps/web/src/lib/mocks/`. Los datos salen de ahí: ninguna pantalla
  inventa su propio departamento, inquilino o monto. Reglas completas en su `README.md`.
- Lo que se crea en modo mock (cuentas y propiedades) se guarda en el
  `localStorage` del navegador con claves `rentar:mock:*`. El botón flotante de desarrollo
  "Reiniciar datos de prueba" lo borra.
- **"Hoy" es el 23/09/2026** en modo mock (`apps/web/src/lib/utils/fechas.ts`), para que los datos
  sean coherentes y los tests de Selenium, estables.
- Contraseña de las cuentas del elenco: `Rentar2026`.

## `data-testid` para Selenium

Las acciones clave de cada pantalla llevan `data-testid` con la forma
`<pantalla>-<elemento>[-<acción>]` (ej. `login-submit-button`, `mis-propiedades-tab-alquilada`,
`alta-precio`). Tabla por pantalla en `docs/HANDOFF-BACKEND.md` §12. Toda acción nueva suma su
`data-testid` siguiendo el mismo patrón.

## Design system y `/design-sync`

- `@rentar/ui` es el design system sincronizado con el proyecto "RentAR Design System" de Claude
  Design. Catálogo vivo en `http://localhost:3001/design-system` (solo en desarrollo).
- **Este repo (SEM-Alq) es la fuente de verdad de `/design-sync`** desde el 23/09/2026. El repo
  anterior (`LandingSeminario/versionCompleta`) quedó como histórico: no se sincroniza más desde ahí.
- Cambios de `@rentar/ui` pendientes de subir y decisiones tomadas: `.design-sync/NOTES.md`.

## Ramas y commits

- `main`: producción. `develop`: integración. `feature/<nombre>`: trabajo en curso, desde `develop`
  (el front, siempre en `feature/vistas`: ver "Forma de trabajo").
- Los PR van siempre contra `develop`.
- Commits chicos, en español (`feat(web): …`, `fix(web): …`, `feat(ui): …`, `docs: …`).
- No se hace push ni merge sin la aprobación del PO.

## Forma de trabajo

Todo el front se trabaja en `feature/vistas`. No se crean ramas por implementación. Al empezar cada
sesión y antes de cada PR: `git fetch` y `git merge origin/develop`. Un PR a `develop` por cada US o
bloque terminado, mergeado con merge commit (nunca squash). Nunca `push --force` sobre
`feature/vistas`.
