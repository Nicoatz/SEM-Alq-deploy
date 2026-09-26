# Handoff a backend — RentAR, Sprint 1

Documento de entrega del frontend (`apps/web`, rama `feature/vistas`) para el equipo de backend
(`apps/api`, Express + Swagger) y base de datos (`supabase/`). Explica qué está simulado, cómo se
conecta cada pantalla a la API real y qué le falta hoy a la API para cubrir las User Stories del
Sprint 1.

Lista de endpoints (método, ruta, body, respuesta): [`api-endpoints.md`](api-endpoints.md).

## 1. Qué hay y qué está simulado

Pantallas del Sprint 1, completas y con sus estados (vacío, carga, error, éxito) en 390px y 1440px:

| US (Sprint 0) | Pantalla | Ruta |
|---|---|---|
| US-19 Registrar usuario | Registro en 2 pasos (rol y datos) | `/registro` |
| US-39 Iniciar y cerrar sesión | Login y "Cerrar sesión" del UserMenu | `/login` |
| US-34 Consultar propiedades a alquilar | Búsqueda con filtros, orden y paginación | `/buscar` |
| US-02 Consultar mis propiedades | Listado del locador | `/panel/propiedades` |
| US-01 Registrar mis propiedades | Alta en 5 pasos | `/panel/propiedades/nueva` |
| — (inicio del locador) | Panel de inicio | `/panel` |

Además: la landing (`/`), el `AppShell` del panel con el menú canónico del locador y placeholders
"En construcción" para las rutas de otros sprints a las que llega algún botón.

**Hoy todo corre con datos de prueba** (`NEXT_PUBLIC_USE_MOCKS=true`, el valor por defecto):

- **Datos:** salen del elenco único, `apps/web/src/lib/mocks/` (ver su `README.md`). Lo que el
  usuario crea (una cuenta en `/registro`, una propiedad en el alta) se guarda en el
  `localStorage` del navegador, con claves `rentar:mock:*`.
- **Sesión:** una cookie `rentar_session` con `{ userId, activeRole, persistent }`
  (`lib/auth/session-cookie.ts`). No es un JWT. La contraseña de las cuentas del elenco es
  `Rentar2026`.
- **"Hoy":** en modo mock es fijo, el 23/09/2026 (`lib/utils/fechas.ts`), para que los "19 días de
  atraso" del elenco y los tests de Selenium no cambien día a día.
- **Fotos del alta:** se leen en el navegador como data URL. No hay storage.
- **MercadoPago, emails y notificaciones:** no existen. Donde el diseño los menciona se muestra el
  aviso de "función simulada".

Lo que **no** está simulado y es la base para conectar: la firma de cada función de
`apps/web/src/services/` (parámetros y tipo de retorno), los tipos de vista de
`@rentar/shared-types`, los adaptadores y el cliente HTTP.

## 2. Mapa del frontend

| Carpeta | Qué contiene |
|---|---|
| `apps/web/src/services/` | **La única frontera con el backend.** Un archivo por módulo (`auth`, `usuarios`, `propiedades`, `panel`). Cada función tiene rama mock y rama real. Ver su `README.md`. |
| `apps/web/src/services/shared/` | `apiClient.ts` (cliente HTTP único), `config.ts` (flag de mocks y URL), `errors.ts` (`ServiceError`), `mockStore.ts` (lo guardado en el navegador), `backend-dtos.ts` (copias de DTOs del back), `session.ts`. |
| `apps/web/src/services/adapters/` | Traducen DTO del back ↔ tipo de vista, campo por campo, con lo que falta marcado como `TODO(backend)`. |
| `apps/web/src/lib/mocks/` | El elenco. Solo lo importan los services. |
| `apps/web/src/lib/auth/` | `AuthProvider` (usuario en sesión y rol activo), cookie de sesión, `redirect.ts` (`?next=`). |
| `apps/web/src/proxy.ts` | Sin sesión, `/panel/*` manda a `/login?next=…` (Next.js 16 renombró `middleware.ts` a `proxy.ts`). |
| `apps/web/src/app/` | Rutas: `(public)`, `(auth)` y `(app)/panel`. |
| `packages/shared-types/` | Modelos del back (arriba de `src/index.ts`, sin tocar) + tipos de vista del front (un archivo por dominio). Ver su `README.md`. |
| `packages/ui/` | Design system `@rentar/ui` (tema de antd y componentes). Catálogo vivo en `/design-system`. |

## 3. Cómo conectar un endpoint, paso a paso

### 3.1 Probar la rama real

1. Levantar la API: `npm run dev:api` (puerto **3000**, Swagger en `http://localhost:3000/api/v1/docs`).
2. Crear `apps/web/.env.local` (no se commitea; hay un `.env.example`):
   ```
   NEXT_PUBLIC_USE_MOCKS=false
   NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
   ```
3. Levantar la web: `npm run dev:web` (puerto **3001**). Reiniciarla después de cambiar `.env.local`:
   Next lee las `NEXT_PUBLIC_*` al arrancar.

Con el flag en `false`, **todas** las funciones de los services llaman a la API. Las rutas que
todavía no existen responden 404 y la pantalla muestra su estado de error ("No pudimos…" +
"Reintentar"). Eso es esperado: indica qué falta.

NOTA: hasta que exista `POST /auth/login`, para entrar al panel con la rama real se puede iniciar
sesión en modo mock y después cambiar el flag: `apiClient` traduce los ids del elenco a los
usuarios de prueba del back (`adapters/usuario.adapter.ts#toBackendUserId`: Nicolás → 1, Julieta
→ 2, Sofía → 3).

### 3.2 Un ejemplo real: US-02 "Mis propiedades"

`apps/web/src/services/propiedades.service.ts`:

```ts
/**
 * US-02 Consultar mis propiedades — TODAS las propiedades del locador en
 * sesión (alquiladas o no, publicadas o no), con locatario, estado del pago,
 * reclamos abiertos y próximo ajuste.
 * @backend GET /api/v1/mis-alquileres   (existe · locador = header x-user-id)
 * @returns PropiedadLocador[]
 * TODO(backend): hoy devuelve solo las que tienen publicación, y le faltan
 * locatario, estado de pago, reclamos, próximo ajuste, barrio y fotos (ver
 * `propiedad.adapter.ts#misAlquileresItemToPropiedadLocador`).
 */
export async function listarMisPropiedades(): Promise<PropiedadLocador[]> {
  if (USE_MOCKS) {
    await delay()
    return misPropiedadesMock(requireSessionUserId())   // rama mock: el elenco
  }
  const items = await apiRequest<MisAlquileresItem[]>('/mis-alquileres')   // rama real
  return items.map(misAlquileresItemToPropiedadLocador)
}
```

- `apiRequest` (`services/shared/apiClient.ts`) arma la URL, manda `x-user-id`, desarma el sobre
  `{ success, data, error }` y, si algo falla, tira un `ServiceError` con el código que corresponde al
  status HTTP (ver §4).
- `misAlquileresItemToPropiedadLocador` (`services/adapters/propiedad.adapter.ts`) traduce el DTO
  del back al tipo que usa la pantalla. Lo que el back no manda queda vacío y comentado:

  ```ts
  tenantName: null,       // no existe en MisAlquileresItem
  paymentStatus: null,    // no existe
  openClaims: 0,          // no existe
  nextAdjustment: null,   // no existe
  ```

### 3.3 Cuando el back agrega un campo

Ejemplo: `GET /mis-alquileres` empieza a devolver `locatario: { nombre, apellido }`.

1. **Tipo del back:** agregar el campo a `MisAlquileresItem` en `packages/shared-types/src/index.ts`
   (es del back: lo cambia el back). Si el DTO todavía no está en `shared-types`, actualizar su copia en
   `apps/web/src/services/shared/backend-dtos.ts`.
2. **Adaptador:** en `misAlquileresItemToPropiedadLocador`, reemplazar
   `tenantName: null` por `tenantName: \`${item.locatario.nombre} ${item.locatario.apellido}\``.
3. Borrar ese campo de la lista de "lo que el back todavía no devuelve" del JSDoc del adaptador y el
   `TODO(backend)` del service si ya no falta nada.
4. **No se toca ninguna pantalla:** `/panel/propiedades` ya muestra `tenantName` cuando viene.

### 3.4 Cuando el back crea una ruta propuesta

Ejemplo: `POST /api/v1/auth/login`. La función `auth.service#login` ya llama a esa ruta en su rama
real y espera `{ usuario, roles }`. Si la ruta nueva responde eso, no hay que tocar el front. Si
responde otra forma, se cambia **solo el adaptador** (`usuarioDtoToSesion`), nunca la firma de
`login` ni las pantallas.

## 4. Status HTTP y errores

`apiClient` convierte el status en un `ServiceError` con `code`, y cada pantalla muestra el estado de
error del diseño según el código:

| Status | `code` | Qué muestra el front |
|---|---|---|
| 400 / 422 | `validation` | El texto de `error` tal cual, arriba del formulario. **Tiene que estar en español y decir qué hacer.** En el login, 400 cuenta como credenciales inválidas. |
| 401 | `unauthorized` | Login: "El email o la contraseña no coinciden" (genérico, US-39: no revela si el mail existe). En el resto de las pantallas, el texto de `error`. En el alta, además, un botón "Iniciar sesión". |
| 403 | `forbidden` | Sin permiso para esa acción. |
| 404 | `not_found` | Error del servidor con "Reintentar". **Nunca** se interpreta como credenciales incorrectas. |
| 409 | `conflict` | Ya existe (ej. mail registrado, US-19). |
| 5xx / sin respuesta | `server` / `network` | "No pudimos…" + "Reintentar". |

## 5. Brechas contra la API actual

Lo que cada pantalla necesita y la API de `develop` todavía no tiene. No se modificó `apps/api`.

### US-34 Consultar propiedades a alquilar — `GET /inmuebles/disponibles` (existe)

**Novedad (26/09):** `develop` sumó filtros, orden y paginación reales a `/disponibles`
(commit "Fix endpoints de consulta propiedades disponibles con nuevo modelo bdd"), y cada item ya
trae embebida la publicación completa (`precio`, `expensas`, `tipo`, `tags` e `indice_ajuste` como
objeto `{id, descripcion}`, `foto_principal`, `fecha_disponible`, `provincia`, `barrio`). Con esto:

- Ya no hace falta el N+1 contra `GET /inmuebles/:id` por cada inmueble para tener título y precio:
  el pedido a `/disponibles` alcanza solo. Sigue pendiente actualizar la rama real de
  `propiedades.service#listarPropiedadesPublicadas`/`#buscarPropiedades` (hoy en
  `apps/web/src/services/propiedades.service.ts`) para dejar de pedir el detalle aparte.
- Los nombres de query que acepta el back **no coinciden** con los que arma el front
  (`lib/search/busquedaParams.ts`): back usa `barrio, precioMin, precioMax, tipo, dormitorios,
  ambientes, superficieMin, superficieMax, tags` (csv de ids), `indiceAjuste, page, limit, orden
  (precio|dormitorios|m2), direccion (asc|desc)`; el front manda `provincia, ciudad, barrio[],
  tipo[], dorm[], amb[], m2Min, m2Max, tag[], indice, pagina, tamanioPagina`. Hay que mapear un
  nombre a otro en el service, o alinear ambos lados.
- El back todavía no filtra por `provincia` ni `ciudad` (solo por `barrio`), y la respuesta cambió
  de forma: hoy es `{ items, total, page, limit, totalPages }`, no `{ items, page, pageSize, total }`
  como esperaba el TODO anterior.
- Sigue habiendo `GET /publicaciones/activas` (24/09) como alternativa que no se está usando; con el
  `/disponibles` nuevo probablemente ya no haga falta migrar a esa ruta.
- La ciudad se guarda como "Córdoba"; el front usa "Córdoba Capital" (`normalizarCiudad`).
- No hay catálogo de ubicaciones (`GET /catalogos/ubicaciones`, propuesto): sigue armándose en el
  front a partir de las propiedades disponibles (`propiedades.service#listarUbicaciones`).

### US-02 Consultar mis propiedades — `GET /mis-alquileres` (existe)

- Devuelve solo las propiedades **con publicación**; US-02 pide todas (también las pausadas y las
  que nunca se publicaron).
- Faltan: locatario, estado del pago (al día / con pago pendiente / retrasada) y días de atraso,
  reclamos sin resolver, próximo ajuste con su índice, barrio, expensas, foto principal y fecha de
  disponibilidad.
- No distingue "pausada" de "alquilada/publicada".

### US-01 Registrar mis propiedades — `POST /inmuebles` + `POST /publicaciones` (existen)

- `POST /inmuebles` no recibe: provincia, barrio, superficie cubierta (hoy hay un solo `m2`),
  antigüedad, estado de la publicación, fecha de disponibilidad, fotos (y su orden y principal),
  expensas, índice y cada cuántos meses se ajusta, medios de pago con recargo, interés por día de
  atraso, días de gracia, depósito y duración del contrato.
- `tags` y `servicios` son un solo número, no una lista.
- `id_locador` viaja en el body: debería salir de la sesión.
- `POST /publicaciones` exige un contrato previo ("No se puede publicar una propiedad sin asociarle
  previamente un contrato"). En US-01 la publicación nace con el alta, sin contrato.
- Son dos pedidos: si falla el segundo, el inmueble queda creado sin publicación. Propuesta: un
  solo `POST /propiedades` con `PropiedadNueva` completa.
- Estados: una alquilada **con** fecha de disponibilidad es "alquilada/publicada" y aparece en la
  búsqueda; sin fecha, no. El back no guarda la fecha, así que hoy no puede distinguirlas.
- No hay storage de fotos (tabla `foto_inmueble` en curso en `feature/registrar-usuario`).

### US-19 Registrar usuario — `POST /registrar-usuario` (en curso en `feature/registrar-usuario`)

- Todavía no está en `develop`.
- Registra a todos como locatario: hay que aceptar el `rol` elegido en el paso 1 del registro.
- La contraseña del front pide al menos 8 caracteres, mayúscula, minúscula y un número, **sin
  símbolos** (`PASSWORD_REGEX` en `apps/web/src/lib/validation/usuario.rules.ts`). El back tiene
  que validar lo mismo.

### US-39 Iniciar y cerrar sesión — `GET /usuarios/me` (existe) + login directo contra Supabase Auth

- **Decisión (rama `feature/iniciar_cerrar_sesion`):** no hay `POST /auth/login` en `apps/api`. El
  login lo hace el front llamando directo al SDK de Supabase Auth (`signInWithPassword`) para
  obtener el JWT; `apps/api` no participa del login en sí, solo valida el token resultante. Se
  probó una versión con `POST /auth/login` propio (`auth.controller`/`auth.service`/`auth.routes`,
  `getSupabaseAuth()` en `config/supabase.ts`) y se sacó: ya no existe en `apps/api/src`.
- **Novedad:** con el JWT ya no alcanza para armar la sesión de la app (el token de Supabase no trae
  nombre, apellido ni roles), así que se agregó `GET /api/v1/usuarios/me` (protegida con
  `authenticateGateway`, `usuario.controller.ts#obtenerMiPerfil`, mapeada en `usuarios.routes.ts`,
  mount `/usuarios` en `routes/v1/index.ts`). Devuelve `{ id, nombre, apellido, email, roles }` del
  usuario del token. `POST /registrar-usuario` (US-19) se separó a su propio archivo,
  `routes/v1/registrar-usuario.routes.ts`, mount `/registrar-usuario`.
- Con esto, **todas** las rutas del back (incluidas `/mis-alquileres`, `/inmuebles`, `/usuarios/me`,
  etc.) pasan por `authenticateGateway`, que exige `Authorization: Bearer <token>` y lo valida contra
  el JWKS de Supabase (ver "Observaciones para backend" más abajo) — el token se consigue del lado
  del front, no de una ruta de `apps/api`.
- **Pendiente en el front (todavía no arrancó):** hoy `apiClient.ts` sigue mandando `x-user-id`, no
  hay ningún cliente de Supabase en `apps/web` (sin `@supabase/supabase-js` en su `package.json`) y
  `lib/auth/session-cookie.ts` no guarda ningún JWT. Falta: instalar el SDK de Supabase en el front,
  hacer login/logout con él (`signInWithPassword` / `signOut`), pasar `apiClient.ts` a mandar
  `Authorization: Bearer <access_token>` de esa sesión, y usar `GET /usuarios/me` para completar el
  perfil (nombre, apellido, roles) después del login y al recargar la página. Mientras no se resuelva,
  un login real contra Supabase sigue sin poder usar el resto de las pantallas contra la API real.
- Sigue faltando: logout del lado del back no aplica (es `supabase.auth.signOut()` en el front, no
  una ruta). Falta el resumen de cada rol para "Viendo como" (`GET /usuarios/me/contextos`, propuesto).

### `/panel` (inicio del locador) — no existe nada

Cobros, reclamos, contratos y solicitudes son módulos de sprints futuros. Las rutas propuestas por
bloque están en [`api-endpoints.md`](api-endpoints.md#panel-del-locador-panel).

## 6. Numeración de las User Stories

En todo el código y los docs se usa la numeración del Sprint 0
(`Documentación/md/Estudio Inicial/Sprint 0.md`). El Mapa de pantallas y Claude Design usan otra.
Equivalencias:

| Mapa de diseño | Sprint 0 |
|---|---|
| US-01, US-02, US-19, US-34 | iguales |
| US-35 Consultar detalle de publicación | sin US en Sprint 0 (`/propiedad/[id]`, placeholder) |
| US-36 a US-39 (solicitudes) | US-35 a US-38 |
| US-40 Publicar o pausar propiedad | sin US en Sprint 0 |
| US-42 Iniciar y cerrar sesión | **US-39** |
| US-43 Recuperar contraseña | **US-40** |
| US-44 y US-45 (administración de usuarios) | sin US en Sprint 0 |

Cuando algo no tiene US en el Sprint 0, el código lo dice así: "sin US en Sprint 0 (mapa US-xx)".

## 7. `data-testid` para Selenium (`tests/e2e/`)

Las acciones clave de cada pantalla tienen `data-testid`, así los tests no dependen de clases CSS
ni del texto visible.

**Convención:** `<pantalla>-<elemento>[-<acción>]`, en minúsculas y con guiones. El prefijo es la
pantalla o el componente: `login-`, `registro-`, `buscar-`, `panel-`, `mis-propiedades-`, `alta-`,
`header-`, `hero-`, `search-`, `app-shell-`, `user-menu-`, `wizard-`, `data-table-`. En listas, todos
los ítems comparten el testid (`buscar-tarjeta`, `panel-cobro`, `data-table-row`); en grupos de
opciones el testid lleva la clave (`registro-rol-locador`, `mis-propiedades-tab-alquilada`,
`alta-medio-transferencia`, `user-menu-role-locatario`).

Los principales, por pantalla:

| Pantalla | `data-testid` |
|---|---|
| Header y landing | `header-login-button`, `header-publish-button`, `header-menu-toggle`, `hero-search-cta`, `search-*` (buscador), `landing-more-properties-button`, `property-card-detail-button` |
| `/login` | `login-email-input`, `login-password-input`, `login-remember-checkbox`, `login-submit-button`, `login-error-alert`, `login-register-link`, `login-forgot-link` |
| `/registro` | `registro-rol-locador` / `registro-rol-locatario`, `registro-continuar-button`, `registro-<campo>-input`, `registro-terminos-checkbox`, `registro-submit-button`, `registro-email-taken-alert`, `registro-success`, `registro-success-cta`, `registro-back-button` |
| `/buscar` | `buscar-resultados`, `buscar-tarjeta`, `buscar-conteo`, `buscar-orden`, `buscar-paginacion`, `buscar-mostrando`, `buscar-sin-resultados`, `buscar-error`, `buscar-reintentar`, `buscar-abrir-filtros`, `buscar-drawer-ver`, `search-sidebar-*` / `search-drawer-*` (filtros) |
| AppShell y UserMenu | `app-shell-menu-toggle`, `app-shell-role-chip`, `user-menu-trigger`, `user-menu-item-<key>`, `user-menu-role-<rol>`, `user-menu-logout`, `role-context-switcher` |
| `/panel` | `panel-publicar`, `panel-registrar-pago`, `panel-pendientes`, `panel-stat-<cifra>`, `panel-cobro`, `panel-reclamo`, `panel-contrato`, `panel-error-<bloque>`, `panel-onboarding`, `panel-onboarding-publicar` |
| `/panel/propiedades` | `mis-propiedades-tab-<estado>`, `mis-propiedades-buscar`, `mis-propiedades-filtro-<barrio\|tipo\|reclamos>`, `mis-propiedades-orden`, `data-table-row` (escritorio), `data-table-card` (móvil), `mis-propiedades-ver-detalle`, `mis-propiedades-mas`, `mis-propiedades-abrir-filtros`, `mis-propiedades-drawer-aplicar`, `mis-propiedades-limpiar`, `mis-propiedades-vacio`, `mis-propiedades-sin-resultados`, `mis-propiedades-error`, `mis-propiedades-reintentar` |
| Alta | `alta-<campo>` (ej. `alta-calle`, `alta-precio`), `alta-fotos-dropzone` (es el `input type="file"`), `alta-foto`, `alta-foto-principal`, `alta-foto-quitar`, `alta-medio-<medio>-check` / `-recargo`, `alta-indice-<ICL\|IPC>`, `wizard-next-button`, `wizard-prev-button`, `wizard-finish-button`, `alta-errores`, `alta-borrador-continuar` / `-nuevo`, `alta-publicando`, `alta-error-publicar`, `alta-reintentar`, `alta-exito`, `alta-exito-mis-propiedades` |

Para ver todos: `grep -rn "data-testid" apps/web/src packages/ui/src`.

## 8. Observaciones para backend

Encontradas al integrar. No se tocó `apps/api`: quedan para el equipo.

1. **`npm test` falla en `develop`**: el script de `apps/api` corre
   `tsx tests/api/mis-alquileres.test.ts` con el directorio de trabajo en `apps/api`, pero el test vive
   en `tests/api/` de la raíz. Desde la raíz, `npx tsx tests/api/mis-alquileres.test.ts` pasa (6/6).
2. **`auth.middleware.ts` ya no usa `x-user-id`.** `authenticateGateway`
   (`apps/api/src/gateway/middlewares/auth.middleware.ts`) valida un JWT real de Supabase: exige
   `Authorization: Bearer <token>`, lo verifica con `jose` contra el JWKS de Supabase
   (`config/supabase-jwt.ts`, `SUPABASE_JWKS_URL`) y recién ahí busca el perfil de `usuario` por
   `auth_user_id`. Sin ese header (o con uno inválido) responde 401. Este documento decía antes que
   la "sesión" era `x-user-id` con default `'1'`: eso quedó desactualizado por este cambio. El
   `x-user-id` que sigue mandando `apiClient.ts` del front no lo lee nada en el back — ver la nota de
   US-39 en la sección 5.
3. **Rutas duplicadas: corregido (26/09).** En `inmuebles.routes.ts`, `GET /disponibles` y
   `GET /:id` ya quedaron registradas una sola vez (`publicaciones.routes.ts` ya se había corregido
   antes: `GET /activas` también quedó una sola vez).
4. **Mensajes de error**: el manejador de errores responde 400 por defecto con el texto interno del
   `Error` (ej. "Regla de negocio no cumplida: …"). El front lo muestra tal cual, así que tiene que ser
   un texto para el usuario, en español y diciendo qué hacer.

## 9. Tipos compartidos

- Los modelos del back (`Inmueble`, `Publicacion`, `MisAlquileresItem`, `Usuario`, `Rol`,
  `Contrato`…) se quedaron como estaban, arriba de `packages/shared-types/src/index.ts`.
- Los tipos de vista del front están en archivos propios (`propiedad.ts`, `filters.ts`, `panel.ts`,
  `status.ts`, `usuario-sesion.ts`, `neighborhood.ts`) y se exportan al final de `index.ts`.
- Qué adaptador conecta cada modelo con cada tipo de vista: `packages/shared-types/README.md`.
- Prefijos de id del elenco: contratos `CT-2026-XXXX`, recibos `RC-2026-XXXX`, reclamos
  `RCL-2026-XXXX`, solicitudes `SOL-2026-XXXX`.

## 10. Qué queda para el sprint 2

- Detalle de la propiedad del locador (`/panel/propiedades/[id]`) con editar (US-03), eliminar
  (US-04) y publicar/pausar (`cambiarEstadoPublicacion` ya está lista en el service, sin usar).
- Detalle público (`/propiedad/[id]`) y solicitudes (US-35 a US-38).
- Recuperar contraseña (US-40) y perfil (US-20, US-21).
- Panel del locatario (hoy un placeholder).
- Cobros, reclamos, contratos y notificaciones de verdad (hoy el panel los muestra desde el mock).
