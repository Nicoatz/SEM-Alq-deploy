# `apps/web` — frontend de RentAR

Next.js 16 (App Router) + React 19 + Ant Design 6. Usa el design system `@rentar/ui` y los tipos de
`@rentar/shared-types`.

> Next.js 16 tiene cambios incompatibles con versiones anteriores (por ejemplo, `middleware.ts` pasó
> a llamarse `proxy.ts`, y `searchParams` es una promesa). Antes de tocar código, leé `AGENTS.md`.

## Cómo levantarlo

Desde la raíz del monorepo:

```bash
npm install
npm run dev:web      # http://localhost:3001
```

La API (`npm run dev:api`) usa el puerto 3000. Por defecto la web **no la necesita**: corre con datos
de prueba (modo mock).

### Pasar de modo mock a modo real

1. Copiar `apps/web/.env.example` a `apps/web/.env.local` (no se commitea) y completar:

   | Variable | Para qué |
   |---|---|
   | `NEXT_PUBLIC_USE_MOCKS` | `false` = la API real; `true` (por defecto) = datos de prueba. |
   | `NEXT_PUBLIC_API_URL` | URL de la API, por defecto `http://localhost:3000/api/v1`. |
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase (la sesión es de Supabase Auth). |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave **publicable** (`sb_publishable_…`). Nunca la secreta: esa es solo de `apps/api`. |

2. Levantar la API (`npm run dev:api`, con su `apps/api/.env`) y **reiniciar** `npm run dev:web`:
   Next lee las `NEXT_PUBLIC_*` al arrancar.
3. Entrar con una cuenta que esté en Supabase Auth y en la tabla `usuario` (por ejemplo, el locador
   de prueba `locador@rentar.com`; la contraseña la tiene el equipo).

Cómo funciona la sesión real: `CLAUDE.md`, sección "Sesión (Supabase Auth)". Estado de cada
endpoint y brechas: `docs/HANDOFF-BACKEND.md`.

### Forzar el modo mock sin tocar `.env.local`

Si tu `apps/web/.env.local` tiene `NEXT_PUBLIC_USE_MOCKS=false` (modo real) y querés probar con los
datos de prueba un rato, no hace falta editarlo: pasá la variable al proceso al levantar la web.
Next **no pisa** con los archivos `.env*` una variable que ya viene del entorno, así que gana la del
comando:

```bash
# Git Bash
NEXT_PUBLIC_USE_MOCKS=true npm run dev:web
```

```powershell
# PowerShell
$env:NEXT_PUBLIC_USE_MOCKS = 'true'; npm run dev:web
```

En PowerShell la variable queda puesta en esa terminal: cerrala (o
`Remove-Item Env:NEXT_PUBLIC_USE_MOCKS`) para volver a lo que diga `.env.local`. En los dos casos
hay que reiniciar `dev:web` para cambiar de modo: Next lee las `NEXT_PUBLIC_*` al arrancar.

Cuentas de prueba del modo mock (contraseña `Rentar2026`):

| Email | Roles | Para probar |
|---|---|---|
| `nicolas.arrieta@rentar.test` | locador | Panel con datos, Mis propiedades (7), alta. Detalle, edición y eliminar (US-03, US-04): Obispo Trejo 1250 tiene contrato vigente (precio y ajuste bloqueados, no se puede eliminar); Rondeau 480 se puede eliminar y cancela 2 solicitudes. Solicitudes recibidas (US-36 a US-38): 5 en Rondeau 480 y Fructuoso Rivera 785, con una aceptada (Diego) para probar cancelarla y la regla de una sola aceptada |
| `sofia.ledesma@rentar.test` | locador y locatario | Cambio de rol ("Viendo como") |
| `julieta.peralta@rentar.test` | locatario | Login de locatario (va a `/panel`, la versión mínima: buscar o publicar). Solicitar alquiler (US-35 actualizada): ya solicitó Rondeau 480 (`/propiedad/prop-rondeau-480` muestra "Tu solicitud · Pendiente"); el envío completo se prueba con Fructuoso Rivera 785 (`/propiedad/prop-rivera-785`), con el aviso "Tenés 1 solicitud pendiente en otra propiedad". Mis solicitudes: los cuatro estados; cancela la pendiente de Rondeau 480 |
| `matias.quiroga@rentar.test`, `diego.ferreyra@rentar.test` | locatario | Postulantes del elenco (Sprint 2, no están en el mapa). Con Diego se prueban las garantías que exige Rondeau 480 (su solicitud anterior está rechazada, así que puede volver a solicitar). Ver `src/lib/mocks/README.md` |

Un locador recién registrado en `/registro` ve el panel vacío (onboarding). Lo creado se guarda en
el navegador; el botón flotante de desarrollo "Reiniciar datos de prueba" lo borra.

## Rutas

| Ruta | Pantalla | US (Sprint 0) | Dónde está |
|---|---|---|---|
| `/` | Landing: buscador, recién publicadas, barrios, "Cómo funciona" y cierre para locadores | US-34 (entrada a `/buscar`) | `app/(public)/page.tsx` → `components/landing/` |
| `/buscar` | Búsqueda de propiedades | US-34 | `app/(public)/buscar/` → `components/buscar/` |
| `/propiedad/[id]` | Detalle público de la propiedad y modal "Solicitar alquiler" | US-41 y US-35 (Jira) | `app/(public)/propiedad/[id]/` → `components/detalle-propiedad/` |
| `/panel/solicitudes` | Solicitudes recibidas del locador (solo locador) | US-36, US-37 y US-38 (Jira) | `components/solicitudes/` |
| `/panel/mis-solicitudes` | Mis solicitudes (cualquier usuario con sesión) | US-36 (Jira); cancelar una pendiente: sin US en Sprint 0 | `components/mis-solicitudes/` |
| `/login` | Iniciar sesión | US-39 | `app/(auth)/login/` → `components/auth/LoginForm.tsx` |
| `/registro` | Registro en un paso (sin rol) | US-19 | `app/(auth)/registro/` → `components/auth/RegistroForm.tsx` |
| `/panel` | Inicio del locador (o el mínimo del locatario: buscar o publicar) | sin US en Sprint 0 | `app/(app)/panel/page.tsx` → `components/panel/` |
| `/panel/propiedades` | Mis propiedades | US-02 | `components/mis-propiedades/` |
| `/panel/propiedades/nueva` | Alta de propiedad en 5 pasos | US-01 | `components/alta/` |
| `/panel/propiedades/[id]` | Detalle de una propiedad del locador: Resumen y eliminar (solo locador) | US-03 y US-04 (Jira) | `components/mi-propiedad/` |
| `/panel/propiedades/[id]/editar` | Editar una propiedad en una sola página (solo locador) | US-03 (Jira) | `components/editar-propiedad/` |
| `/design-system` | Catálogo vivo de `@rentar/ui` (solo desarrollo) | — | `components/DesignSystem.tsx` |

**Placeholders** ("En construcción", `components/PlaceholderScreen.tsx`): existen solo para que
ningún botón del Sprint 1 quede roto. Se reemplazan ruta por ruta cuando llega su sprint.

| Ruta | Llega desde | US |
|---|---|---|
| `/recuperar` | "¿Olvidaste tu contraseña?" del login | US-40 |
| `/panel/contratos`, `/cobros`, `/reclamos`, `/mensajes`, `/reportes`, `/suscripcion` | Menú del locador | US-05, US-08/09, US-14 a 18, US-24 a 26, US-28, US-30 a 33 |
| `/panel/perfil`, `/panel/notificaciones` | UserMenu | US-20/21, US-22/23 |

`proxy.ts` protege `/panel/*`: sin sesión manda a `/login?next=…` y, después del login, vuelve ahí
(US-39). En modo real verifica y renueva la sesión de Supabase; en modo mock, la cookie
`rentar_session`. Mis propiedades (`/panel/propiedades`, su detalle y su edición) y Solicitudes
recibidas (`/panel/solicitudes`) además exigen el rol locador (`RequireRole` en cada página). El alta (`/panel/propiedades/nueva`) está abierta
para cualquier usuario con sesión: al publicar la primera propiedad, la cuenta pasa a ser locadora.

## Estructura de `src/`

| Carpeta | Qué hay |
|---|---|
| `app/` | Rutas. `(public)` con Header y Footer, `(auth)` con `AuthLayout`, `(app)/panel` con `AppShell`. |
| `components/` | Pantallas y sus piezas, una carpeta por pantalla (`auth/`, `buscar/`, `detalle-propiedad/`, `panel/`, `mis-propiedades/`, `alta/`, `mi-propiedad/`, `editar-propiedad/`, `solicitudes/`, `mis-solicitudes/`, `landing/`). |
| `services/` | **La única frontera con el backend.** Ver `services/README.md`. |
| `lib/mocks/` | El elenco de datos de prueba. Solo lo usan los services. Ver su `README.md`. |
| `lib/auth/` | Sesión: `AuthProvider`, cookie `rentar_session`, redirección después del login y `supabase/` (clientes de Supabase de navegador, servidor y proxy). |
| `lib/imagenes/` | `useFotoConRespaldo`: si una foto no carga, el placeholder. |
| `lib/validation/` | Reglas de los formularios (`usuario.rules.ts`, `propiedad.rules.ts`), comentadas con el criterio de US que cubren. |
| `lib/search/`, `lib/mis-propiedades/`, `lib/solicitudes/` | Filtros, orden, paginación y textos (funciones puras) de `/buscar`, Mis propiedades y las solicitudes. |
| `lib/catalogs/` | Textos fijos: barrios, características, tipos, índices, medios de pago. |
| `lib/hooks/useServiceCall.ts` | Carga de un bloque de datos con sus estados (cargando, error, listo). |
| `lib/utils/fechas.ts` | "Hoy" (fijo en 23/09/2026 en modo mock) y textos de días. |
| `lib/navigation/navConfig.tsx` | Menú lateral del panel por rol. |
| `proxy.ts` | Protección de `/panel/*` (mock: cookie; real: sesión de Supabase). |

## Comandos del workspace

```bash
npm run dev --workspace=apps/web        # = npm run dev:web desde la raíz
npm run build --workspace=apps/web
npm run lint --workspace=apps/web
npm run typecheck --workspace=apps/web  # genera los tipos de rutas y corre tsc
```
