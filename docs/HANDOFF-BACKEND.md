# Handoff a backend — RentAR, Sprint 1

Documento de entrega del frontend (`apps/web`) para el equipo de backend (`apps/api`, Express +
Swagger) y de base de datos (`supabase/`). Explica cómo se autentica el front, qué pantalla está
conectada a qué endpoint y qué le falta todavía a la API o a la base para cubrir las User Stories
del Sprint 1.

Estado a la fecha de la rama `feature/conexion-back` (26/09/2026). Lista de endpoints con body y
respuesta: [`api-endpoints.md`](api-endpoints.md).

## 1. Qué hay, y los dos modos del front

| US (Sprint 0) | Pantalla | Ruta | Con el back real |
|---|---|---|---|
| US-19 Registrar usuario | Registro en un paso (sin rol: toda cuenta nueva es locataria) | `/registro` | Conectado |
| US-39 Iniciar y cerrar sesión | Login, "Cerrar sesión" del UserMenu y Header público con sesión | `/login`, Header | Conectado (Supabase Auth + `/usuarios/me`) |
| US-34 Consultar propiedades a alquilar | Búsqueda con filtros, orden y paginación, y la landing | `/buscar`, `/` | Parcial (faltan datos en `/disponibles`) |
| US-02 Consultar mis propiedades | Listado del locador | `/panel/propiedades` | Parcial (faltan locatario, pagos, reclamos) |
| US-01 Registrar mis propiedades | Alta en 5 pasos, para cualquier usuario con sesión | `/panel/propiedades/nueva` | Parcial (espera el bucket de fotos y el cambio de roles de Thiago) |
| — (inicio del locador) | Panel de inicio | `/panel` | Parcial (conteos reales; el resto, vacío) |
| — (inicio del locatario) | Versión mínima: buscar o publicar | `/panel` | No usa datos del back (solo el nombre) |

El front tiene dos modos, según `NEXT_PUBLIC_USE_MOCKS` (`apps/web/.env.local`):

- **Modo mock** (`true`, por defecto): los datos salen del elenco (`apps/web/src/lib/mocks/`) y lo
  que se crea se guarda en el `localStorage` del navegador (`rentar:mock:*`). La sesión es una
  cookie `rentar_session` con `{ userId, activeRole }`. "Hoy" es el 23/09/2026. Contraseña del
  elenco: `Rentar2026`. No se llama a la API ni a Supabase.
- **Modo real** (`false`): los services llaman a `apps/api` y la sesión es la de **Supabase Auth**
  (sección 2).

## 2. Autenticación con Supabase

**`x-user-id` ya no existe.** Ni el front lo manda ni el back lo lee. Así funciona ahora:

1. **Login** (US-39): el front llama a Supabase Auth directo, con
   `supabase.auth.signInWithPassword({ email, password })`. `apps/api` no tiene ruta de login ni de
   logout (lo definió backend).
2. **Perfil:** con la sesión abierta, el front pide `GET /api/v1/usuarios/me`, que devuelve
   `{ id, nombre, apellido, email, roles }`. Los roles salen **solo** de ahí: si `/me` falla, el
   front cierra la sesión de Supabase y muestra el error, sin deducir roles de otro lado.
3. **Cada request a la API** lleva `Authorization: Bearer <access_token>`. El `apiClient`
   (`apps/web/src/services/shared/apiClient.ts`) le pide a Supabase la sesión vigente **antes de cada
   request** (`getSession()`), así nunca viaja un token vencido: el token dura 1 hora y Supabase lo
   renueva solo con el refresh token. El front no guarda el token aparte.
4. **Excepción:** `POST /registrar-usuario` va **sin** token (`auth: false` en el `apiClient`): es
   público y la cuenta todavía no existe.
5. **Back:** `authenticateGateway` valida el token contra el JWKS del proyecto
   (`config/supabase-jwt.ts`) y resuelve el usuario por `usuario.auth_user_id`.
6. **Logout:** `supabase.auth.signOut()` (alcance global: revoca el refresh token). Si falla la red,
   se cierra igual la sesión local. Después, recarga completa en la landing.
7. **Protección de `/panel/*`:** `apps/web/src/proxy.ts` (Next.js 16 renombró `middleware.ts` a
   `proxy.ts`) lee la sesión de las cookies con `@supabase/ssr`, la verifica con `getClaims()` y, si
   no hay sesión o no se puede renovar, manda a `/login?next=<ruta>`.

Detalles que importan para backend:

- **La sesión vive en cookies** (`sb-<proyecto>-auth-token`, las maneja `@supabase/ssr`), no en
  `localStorage`, para que el proxy la lea del lado del servidor.
- **Un 401 de la API** se muestra como "Tu sesión venció. Volvé a iniciar sesión para seguir.": el
  texto técnico del back ("el token de Supabase no es válido") no le sirve al usuario.
- **El front nunca consulta tablas con `supabase-js`.** RLS está activo en todas las tablas y sin
  políticas: todo dato pasa por la API. Supabase se usa solo para Auth (y, cuando exista el bucket,
  para subir fotos a Storage).
- **Claves:** el front usa solo la **publicable** (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). La
  `SUPABASE_SECRET_KEY` es exclusiva de `apps/api`.
- **Registro:** el back crea la cuenta ya confirmada (`email_confirm: true`), así que después del
  201 el front inicia sesión solo con las mismas credenciales (sin guardarlas).

### Roles: todos empiezan como locatarios (regla del equipo, 27/09/2026)

1. **Registro:** no se elige rol. `POST /registrar-usuario` va sin `rol` y el back registra a todos
   como locatario (ya lo hace: `ROL_LOCATARIO_ID`). El PR #2, que aceptaba `rol`, se cerró sin
   mergear.
2. **Publicar:** cualquier usuario con sesión puede usar el alta (`/panel/propiedades/nueva`). Mis
   propiedades (`/panel/propiedades`) sigue siendo solo para locadores.
3. **Al publicar la primera propiedad**, el back le suma el rol locador a la cuenta.
4. **Locador abarca a locatario:** para una cuenta locadora, `/usuarios/me` devuelve
   `["locador", "locatario"]`.
5. **Después del 201**, el front vuelve a pedir `/usuarios/me` sin cerrar sesión
   (`useAuth().refrescarUsuario('locador')`). Si ya tiene el rol, queda locador como rol activo y
   aparecen "Viendo como" y Mis propiedades.

**En el back desde el 29/09 (`develop` d88deca):** `POST /inmuebles` ya no exige el rol locador y
la función `registrar_propiedad_completa` (migración `20260928000000_us01_registro_atomico.sql`) crea
inmueble, fotos, tags, contrato y medios de pago en una transacción y le suma el rol locador al
usuario (`usuario_x_rol`, `ON CONFLICT DO NOTHING`). **Probado en real el 29/09:** una cuenta nueva
pasa de `["locatario"]` a `["locatario", "locador"]` y la propiedad aparece en `/mis-alquileres`.
El front conserva como respaldo el mensaje del 403 y el éxito sin "Ir a mis propiedades".

## 3. Mapa del frontend

| Carpeta | Qué contiene |
|---|---|
| `apps/web/src/services/` | **La única frontera con el backend.** Un archivo por módulo (`auth`, `usuarios`, `propiedades`, `panel`). Cada función tiene rama mock y rama real. Ver su `README.md`. |
| `apps/web/src/services/shared/` | `apiClient.ts` (cliente HTTP único, con el Bearer), `config.ts` (flag de mocks, URL de la API y las dos variables de Supabase), `errors.ts` (`ServiceError`), `mockStore.ts`, `backend-dtos.ts` (copias de DTOs del back), `session.ts`. |
| `apps/web/src/services/adapters/` | Traducen DTO del back ↔ tipo de vista, campo por campo, con lo que falta marcado como `TODO(backend)` / `TODO(db)`. |
| `apps/web/src/lib/auth/` | `AuthProvider` (usuario y rol activo), `session-cookie.ts` (`rentar_session`), `redirect.ts` (`?next=`) y `supabase/` (clientes de navegador, de servidor y de proxy). |
| `apps/web/src/lib/imagenes/` | `useFotoConRespaldo`: si una foto no carga, se muestra el placeholder. |
| `apps/web/src/proxy.ts` | Protege `/panel/*` (modo mock: cookie `rentar_session`; modo real: sesión de Supabase). |
| `apps/web/src/lib/mocks/` | El elenco del modo mock. Solo lo importan los services. |
| `packages/shared-types/` | Modelos del back (arriba de `src/index.ts`) + tipos de vista del front. Ver su `README.md`. |
| `packages/ui/` | Design system `@rentar/ui`. Catálogo vivo en `/design-system`. |

## 4. Cómo probar y cómo conectar un endpoint

### 4.1 Probar el modo real

1. Levantar la API: `npm run dev:api` (puerto **3000**, Swagger en `http://localhost:3000/api/v1/docs`).
   Necesita `apps/api/.env` con `SUPABASE_URL`, `SUPABASE_SECRET_KEY` y `SUPABASE_JWKS_URL`.
2. Crear `apps/web/.env.local` (no se commitea; ver `apps/web/.env.example`):
   ```
   NEXT_PUBLIC_USE_MOCKS=false
   NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
   NEXT_PUBLIC_SUPABASE_URL=https://<id-del-proyecto>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```
3. Levantar la web: `npm run dev:web` (puerto **3001**). Reiniciarla después de cambiar
   `.env.local`: Next lee las `NEXT_PUBLIC_*` al arrancar.
4. Entrar con una cuenta que esté en Supabase Auth **y** tenga fila en `usuario` (por ejemplo
   `locador@rentar.com`, id 1, locador con 3 inmuebles). Los usuarios 2 y 3 no están en Auth.

### 4.2 Un ejemplo: US-02 "Mis propiedades"

`apps/web/src/services/propiedades.service.ts`:

```ts
/**
 * US-02 Consultar mis propiedades — TODAS las propiedades del locador en sesión (…).
 * @backend GET /api/v1/mis-alquileres   (existe · token + rol locador; el locador sale del token)
 * @returns PropiedadLocador[]
 * TODO(backend): le faltan locatario, estado de pago, reclamos, próximo ajuste y fecha de alta.
 */
export async function listarMisPropiedades(): Promise<PropiedadLocador[]> {
  if (USE_MOCKS) {
    await delay()
    return misPropiedadesMock(requireSessionUserId())      // rama mock: el elenco
  }
  const items = await apiRequest<MisAlquileresItem[]>('/mis-alquileres')   // rama real (con Bearer)
  return items.map(misAlquileresItemToPropiedadLocador)                     // adaptador
}
```

### 4.3 Cuando el back agrega un campo

Ejemplo: `GET /mis-alquileres` empieza a devolver `locatario: { nombre, apellido }`.

1. **Tipo del back:** agregar el campo a `MisAlquileresItem` en `packages/shared-types/src/index.ts`
   (y regenerar su `dist/`, que la API usa para tipar). Si el DTO no está en `shared-types`,
   actualizar la copia en `apps/web/src/services/shared/backend-dtos.ts`.
2. **Adaptador:** en `misAlquileresItemToPropiedadLocador`, reemplazar `tenantName: null` por el dato.
3. Sacar ese campo de la lista de "lo que el back todavía no devuelve" del JSDoc del adaptador y el
   `TODO(backend)` del service.
4. **No se toca ninguna pantalla:** `/panel/propiedades` ya muestra el locatario cuando viene.

## 5. Estado de cada endpoint

**Conectado** = el front lo usa y la pantalla funciona completa; **parcial** = el front lo usa pero
faltan datos o una parte (ver sección 7); **pendiente** = no existe o el front todavía no lo puede usar.

| Endpoint | Pantalla | Estado |
|---|---|---|
| Supabase Auth `signInWithPassword` / `signOut` | `/login`, UserMenu | **Conectado** |
| `GET /usuarios/me` | Sesión (login y recarga) | **Conectado** |
| `POST /registrar-usuario` | `/registro` | **Conectado** (sin `rol`: el back registra locatario) |
| `GET /inmuebles/disponibles` | `/buscar`, landing | **Parcial**: desde el 29/09 ignora casi todos los filtros, el orden y la paginación; el front trae todas y filtra, ordena y pagina en el cliente (sección 7) |
| `GET /inmuebles/disponibles/:id` | — | Existe (antes `GET /inmuebles/:id`); el front ya no la usa: el listado trae lo que muestra la tarjeta |
| `GET /mis-alquileres` | `/panel/propiedades`, conteos de `/panel` | **Parcial**: desde el 29/09 trae locatario, próximo ajuste y si tiene reclamos sin resolver (el front los suma en el próximo PR); siguen faltando pagos y fecha de alta |
| `POST /inmuebles` | Alta | **Conectado** (29/09): alta real de punta a punta desde la pantalla, con fotos en Storage; cualquier rol, y suma el rol locador |
| Supabase Storage, bucket `fotos-propiedades` | Alta | **Conectado** (29/09): el alta sube las fotos y se probó de punta a punta. Falta la política de SELECT para borrar las de un alta fallida (sección 8) |
| `GET /locadores/:idLocador/barrios` | — | Existe desde el 29/09 (Bearer + rol locador; solo el propio id). El front no la usa: arma los barrios del filtro de US-02 con sus propias propiedades |
| `GET /usuarios/me/contextos` | "Viendo como" del UserMenu | **Pendiente** (propuesto; hoy se arma en el front con `/mis-alquileres`) |
| `GET /catalogos/ubicaciones` | Filtros de ubicación | **Pendiente** (propuesto; hoy se arman con los datos) |
| `GET /panel/cobros`, `/panel/reclamos`, `/panel/contratos`, `/solicitudes` | `/panel` | **Pendiente** (módulos de sprints futuros; en modo real se muestran vacíos) |
| `PATCH /inmuebles/:id/publicacion` | Detalle (sprint 2) | **Pendiente** (propuesto; la función del service está lista, sin usar) |

## 6. Status HTTP y errores

`apiClient` convierte el status en un `ServiceError` con `code`, y cada pantalla muestra su estado
de error:

| Status | `code` | Qué muestra el front |
|---|---|---|
| 400 / 422 | `validation` | El texto de `error` tal cual, arriba del formulario. **Tiene que estar en español y decir qué hacer.** |
| 401 | `unauthorized` | "Tu sesión venció…". En el login, las credenciales inválidas de Supabase (400) dan el mensaje genérico de US-39, que no revela si el mail existe. |
| 403 | `forbidden` | Sin permiso para esa acción (el guard de rol del front evita llegar a pedirlo). |
| 404 | `not_found` | Error del servidor con "Reintentar". **Nunca** se interpreta como credenciales incorrectas. |
| 409 | `conflict` | Registro: mail o DNI ya registrado (el front distingue cuál por el texto del error; ver sección 7). |
| 5xx / sin respuesta | `server` / `network` | "No pudimos conectarnos con RentAR" + "Reintentar". Si el dispositivo está sin red: "Parece que te quedaste sin internet". |

## 7. Brechas por US

Lo que cada pantalla necesita y todavía no hay. **Dueño:** `backend` (`apps/api`), `db` (esquema o
datos en Supabase) o `front`. No se modificó `apps/api` ni `supabase/` desde esta rama.

### US-39 Iniciar y cerrar sesión

| Brecha | Dueño |
|---|---|
| `/usuarios/me` no devuelve teléfono, DNI ni fecha de nacimiento (los va a pedir el perfil). | backend |
| No hay estado de cuenta (activa, suspendida): el front asume `activo`. | db |
| `GET /usuarios/me/contextos` para el "Viendo como" (hoy se calcula en el front). | backend |
| En el Swagger de `/usuarios/me` el esquema de seguridad se llama `bearerAuth`, pero el definido en `config/swagger.ts` es `SupabaseBearerAuth`. | backend |

### US-19 Registrar usuario

| Brecha | Dueño |
|---|---|
| El 409 trae el texto crudo del error (en inglés el de Auth, el de Postgres para el DNI). Responder un código por campo (ej. `email_duplicado`, `dni_duplicado`) y el mensaje en español. | backend |
| La contraseña: el front pide al menos 8 caracteres, mayúscula, minúscula y **un número**, solo letras y números (`PASSWORD_REGEX`); el back no exige el número. Sumarlo a su regex. | backend |
| La tabla `usuario` tiene una columna `contrasena`, y un registro la tiene cargada. Supabase Auth ya maneja las contraseñas: revisar si se puede sacar. | db |

### US-34 Consultar propiedades a alquilar

Desde el 29/09 (`develop` a00f099, "Emparejar inmueble service con repository") `/disponibles` usa
un repositorio nuevo que ignora casi todos los filtros y la paginación. Por eso el front trae todas
las disponibles y filtra, ordena y pagina en el cliente, con las mismas reglas que el modo mock
(`propiedades.service.ts#buscarPropiedades`, con `TODO(backend)`). El mapeo de la URL de `/buscar` a
los params del back (`consultaDeDisponibles`) se sacó; está en la historia (commit 60f8c63) para
cuando el back vuelva a respetar los filtros.

| Brecha | Dueño |
|---|---|
| **`/disponibles` ignora los filtros:** `buscarDisponibles` solo aplica `barrio` (igual exacto, antes "contiene") y `tipo`. Ignora `precioMin`/`precioMax`, `dormitorios`, `ambientes`, `superficieMin`/`superficieMax`, `tags`, `indiceAjuste`, `orden`/`direccion` y `page`/`limit`: siempre devuelve todas con `page: 1` y `limit` = cantidad. El controller los sigue leyendo y el Swagger los documenta. Probado el 29/09: `?dormitorios=1&page=2&limit=1` devuelve las 2 disponibles. | backend (Thiago) |
| **Consultas por item:** `getInmueblesDisponibles` (y `/mis-alquileres`) hacen, por cada inmueble y una atrás de otra, consultas de tipo, contrato, índice, tags y fotos. Con 2 propiedades, `/disponibles` tarda ~2,7 s. Con más, va a crecer lineal. Traerlo en una consulta con los embebidos (como el repositorio del 26/09). | backend |
| ~~Expensas sin contrato~~ **Resuelto (29/09, `develop` 8f9bf8c y ce677a4):** el detalle manda `null` sin contrato y el listado vuelve a pedir contrato, así que su `0` es real. El front muestra `0` como "Sin expensas" y `null` (o un `-1` viejo) vacío, nunca "$0". | — |
| ~~Nombre del estado "alquilada con fecha"~~ **Resuelto (29/09, `develop` 2264372):** el back normalizó todo a `'publicado/alquilado'` (validación, `EstadoAlquiler`, `/disponibles`, `/mis-alquileres`, con migración). El alta manda `publicado/alquilado` para una alquilada con fecha y `alquilado` sin fecha; la lectura también acepta `alquilado` + fecha, por las viejas. | — |
| El item no trae `estado_alquiler`: el front muestra "Disponible desde" si tiene `fecha_disponible`. | backend |
| No filtra por provincia ni ciudad (hoy solo hay Córdoba Capital). | backend |
| No hay fecha de publicación: "Más recientes" queda en el orden por id que devuelve el back. | db |
| Ciudades y barrios son texto libre ("Córdoba" vs. "Córdoba Capital"; "Alberdi" no está en el catálogo del front). Hace falta un catálogo de ubicaciones. | db |
| El tag "Apto profesional" del front no existe en `tags_inmueble`. | db |
| El índice CAC de la base no está en el front (US-01 habla solo de ICL e IPC): se muestra sin índice. | front / PO |

### US-02 Consultar mis propiedades

| Brecha | Dueño |
|---|---|
| Desde el 29/09 `/mis-alquileres` trae `contrato.locatario`, `contrato.fecha_proximo_ajuste` y `posee_reclamos_no_resueltos` (sí/no, no la cantidad). El front todavía no los muestra: van en el próximo PR (hoy esas columnas siguen en "—"). Siguen faltando el estado del pago y los días de atraso. | front (próximo PR) / backend |
| **`/mis-alquileres` ignora sus filtros:** documenta `barrio`, `tipo`, `estado` y `reclamos`, pero `findByLocadorId` no los aplica. Sin impacto en el front (US-02 filtra en el cliente). | backend |
| **`reclamos` se lee con `Boolean(req.query.reclamos)`**: cualquier texto, incluido `"false"`, da `true`. Comparar con `=== 'true'`. | backend |
| No hay fecha de alta: el orden "Más recientes" no tiene efecto. | db |
| En el inmueble 1, `precio_publicado` es $360.000 y `contrato.monto_alquiler`, $350.000. El front muestra el publicado para las no alquiladas y el del contrato para las alquiladas: confirmar cuál manda. | backend / db |
| **`/mis-alquileres` de `locador@rentar.com` responde 400** ("JSON object requested, multiple (or no) rows returned"). `contrato.repository#getLocatarioByContratoId` busca el locatario con `maybeSingle()` sobre `contrato_x_usuario` (`tipo_firmante = 2`), y el contrato 2 tiene los firmantes duplicados: la consulta trae dos filas y falla **toda la lista**. En el front, Mis propiedades de esa cuenta muestra "No pudimos traer tus propiedades" (probado el 30/09). Arreglo propuesto: `limit(1)` (o deduplicar) en la consulta y borrar las filas duplicadas. | backend (Thiago) / db |
| El contrato del inmueble 2 tiene los firmantes duplicados en `contrato_x_usuario` (causa del 400 de arriba). | db |

### US-01 Registrar mis propiedades

| Brecha | Dueño |
|---|---|
| ~~`POST /inmuebles` exigía `requireRole("locador")`~~ **Resuelto (29/09, d88deca):** acepta a cualquier usuario con sesión. | — |
| ~~Asignar el rol locador al crear la primera propiedad~~ **Resuelto (29/09, d88deca):** lo hace `registrar_propiedad_completa`, en la misma transacción del alta. | — |
| **Expansión de roles en `/usuarios/me`:** para las cuentas nuevas no hace falta: el registro guarda la fila de locatario y al publicar se suma la de locador, así que `/me` devuelve las dos (en ese orden, `["locatario", "locador"]`; el front no depende del orden). Queda para las cuentas locadoras viejas que no tienen la fila de locatario (ej. `locador@rentar.com`): `/me` les devuelve solo `["locador"]`. | backend / db |
| El bucket `fotos-propiedades` existe (29/09) y el front ya sube las fotos. Falta una política de SELECT para poder borrar las fotos de un alta que falla (sección 8). | db (Ivan) |
| Medios de pago: el front tiene transferencia, MercadoPago débito, MercadoPago crédito y efectivo, cada uno con recargo (0 a 3 %); la base tiene 4 sin recargo. Los dos de MercadoPago van al mismo id (3) y **el recargo se pierde**. | db (a la planning) |
| `frecuencia_ajuste` es texto ("Semestral"); el front la maneja en meses. Se manda el nombre ("Mensual", "Trimestral", "Semestral", "Anual"…) o "N meses". | db |
| `deposito` es un monto; el front lo pide en meses. Se manda meses × precio. | db |
| El tag "Apto profesional" no existe: no se manda. | db |
| El back tiene un solo campo `piso`: piso y departamento viajan juntos ("3° B"). | db |
| "Pausada" la acepta la validación del back y la base no la restringe (se guardaría `pausado`); hoy la base solo usa `publicado` y `alquilado`. | — (informativo) |

### `/panel` (inicio del locatario)

Versión mínima del diseño ("Panel de inicio" · 05b): saludo, "Buscar propiedades" y "Publicá tu
propiedad". No pide nada al back (el nombre sale de `/usuarios/me`). El panel completo del
locatario (US-11, US-12) es de otro sprint.

### `/panel` (inicio del locador)

Cobros, reclamos, contratos y solicitudes son módulos de sprints futuros. En modo real esos bloques
se muestran vacíos ("Todavía no hay cobros registrados", etc.), no con error. Los conteos de
propiedades salen del `/mis-alquileres` real. Rutas propuestas: [`api-endpoints.md`](api-endpoints.md#panel-del-locador-panel).

## 8. Bucket de fotos

**El bucket `fotos-propiedades` existe desde el 29/09/2026.** Lo creó Ivan desde el dashboard de
Supabase, fuera de las migraciones del repo. Como Ivan no estaba disponible, el front lo versionó en
`supabase/migrations/20260929000002_bucket_fotos_propiedades.sql` (primero se llamó `20260929000001_…`, la misma versión que `20260929000001_rename_estado_publicado_alquilado.sql` de Thiago; se renombró para que no choquen en `schema_migrations`): copia exacta del bucket y sus dos
políticas, idempotente (`on conflict do nothing`, `drop policy if exists` + `create policy`). **No se
aplicó** (la base ya lo tenía): sirve para que un entorno nuevo quede igual. El comentario del
archivo anota que faltan políticas de UPDATE y SELECT, sin agregarlas. Configuración (leída con el MCP, solo lectura): público, límite de 358400 bytes (350 KB), solo
`image/jpeg` e `image/png`, y dos políticas sobre `storage.objects` para el rol `authenticated`:
"subir fotos propias" (INSERT) y "borrar fotos propias" (DELETE), las dos limitadas a la carpeta
`<auth.uid>/`. Coincide con lo que espera el front (paso 1 de abajo).

**Cómo sube el front (desde el 29/09, `propiedades.service.ts#subirFotoPropiedad`):**

1. Cada foto va a `fotos-propiedades/<auth.uid>/<uuid>.<jpg|png>`, con la sesión del usuario,
   `upsert: false` y su `contentType`. Antes de subir se vuelve a validar JPG/PNG y 358400 bytes.
2. Devuelve la URL pública (`getPublicUrl`), **`peso_kb` redondeado hacia arriba**
   (`Math.ceil(bytes / 1024)`, así coincide con el `peso_kb > 350` del back) y `formato` (`jpg`/`png`).
3. Se suben en paralelo. Si falla alguna, se intentan borrar las que subieron; si `POST /inmuebles`
   falla después de subirlas, también (el alta del back es una transacción, así que no queda nada en
   la base).
4. `images.remotePatterns` de `apps/web/next.config.mjs` ya acepta
   `*.supabase.co/storage/v1/object/public/**`. Sacar `rentar.com` cuando no queden fotos del seed.

**Probado en real el 29/09**, desde la pantalla: la cuenta 18 (locadora, 1440 px) y una locataria
nueva (19, 390 px, alquilada con fecha → pasó a locadora y apareció en `/buscar`). Filas y archivos
en la sección 9.

| Brecha | Dueño |
|---|---|
| **Falta una política de SELECT para borrar.** Storage exige DELETE **y SELECT** sobre `storage.objects` para `remove()`; sin SELECT no borra nada y responde una lista vacía, sin error. Probado: forzando un error del alta, las 3 fotos subidas quedaron en el bucket. Propuesta: `create policy "ver fotos propias" on storage.objects for select to authenticated using ((bucket_id = 'fotos-propiedades') and ((storage.foldername(name))[1] = (auth.uid())::text));` (solo la carpeta propia: no habilita listar lo de otros). **Versionada en `supabase/migrations/20260930000000_bucket_fotos_select_propias.sql`** (idempotente); la aplica el PO desde el SQL Editor. Hasta que esté aplicada, el borrado sigue sin funcionar. | PO (aplicar) |

## 9. Datos de prueba para borrar

Creados durante la conexión del front. Todos los mails de prueba llevan `+test`.

| Qué | Ids | Dónde |
|---|---|---|
| Usuarios `rentar.qa+test-rol-locador@example.com`, `+test-sin-rol`, `+test-t3-locador-1440`, `+test-t3-locatario-390` | **11, 12, 15 y 16** | Supabase Auth, `usuario` y `usuario_x_rol` |
| Usuario `rentar.qa+test-roles-390@example.com` (registro sin rol, 27/09, rama `feature/roles-publicar`) | **17** | Supabase Auth, `usuario` y `usuario_x_rol` |
| Usuario `rentar.qa+test-rol-publicar@example.com` (prueba del rol al publicar, 29/09, `feature/vistas`) | **18**; `usuario_x_rol` **18** (locatario) y **19** (locador) | Supabase Auth, `usuario` y `usuario_x_rol` |
| Inmueble "[TEST] Prueba del rol al publicar (feature/vistas, 29/09) - borrar" | inmueble **5**; `foto_inmueble` **13, 14 y 15**; `inmueble_x_tag` **7**; `contrato` **5**; `medio_pago_x_contrato` **7** | cada tabla |
| Usuario `rentar.qa+test-fotos-390@example.com` (alta real con fotos, 29/09) | **19**; `usuario_x_rol` **21** (locatario) y **22** (locador) | Supabase Auth, `usuario` y `usuario_x_rol` |
| Inmuebles del alta real con fotos (29/09): "Calle de Prueba Fotos 300" (usuario 18, publicado) y "Calle de Prueba Alquilada 400" (usuario 19, `publicado/alquilado`) | inmuebles **6 y 7**; `foto_inmueble` **16 a 21**; `contrato` **6 y 7**; `medio_pago_x_contrato` **8 y 9** (sin tags) | cada tabla |
| Archivos del bucket `fotos-propiedades` | los de `foto_inmueble` 16 a 21 (carpetas de los usuarios 18 y 19) y **3 huérfanos** de la prueba del borrado (`32c9ed9b-…/6901f188-….png`, `…/67aa21ec-….png`, `…/70c9f11d-….png`), que no se pudieron borrar por la política de SELECT que falta (sección 8) | `storage.objects` |
| Inmueble "[TEST] Carga de prueba de feature/conexion-back" | inmueble **4** | `inmueble` |
| Sus filas asociadas | `inmueble_x_tag` **5 y 6**; `foto_inmueble` **10, 11 y 12**; `contrato` **4**; `medio_pago_x_contrato` **5 y 6** | cada tabla |

## 10. Observaciones para backend

Encontradas al integrar. No se tocó `apps/api` (el PR #2 se cerró sin mergear): quedan para el equipo.

1. **Publicaciones: resuelto (29/09).** El back sacó `publicacion.service.ts`, sus rutas y su
   controller (`develop` 07b3475), y `apps/api` vuelve a compilar (`tsc --noEmit` sin errores).
   El front nunca usó `/publicaciones`.
2. **`packages/shared-types/dist/` está trackeado** aunque `.gitignore` excluye `dist`, y
   `apps/api` toma los tipos de ahí: un cambio en `src/` no llega a la API si no se regenera y
   commitea el `dist`. Definir si se sigue commiteando o si la API lo compila en su build.
3. **El test de la API está desactualizado:** `apps/api/tests/api/us01-registrar-propiedades.test.ts`
   manda `x-user-id`, que el middleware ya no lee (todos sus pedidos dan 401), y escribe en la base.
4. **El manejador de errores responde 400 por defecto** (`errorHandler`), también para errores de
   la base o de Supabase que no son culpa del usuario. Debería ser 500 salvo que el error traiga su
   status. Y el texto de `error` se muestra tal cual: tiene que estar en español.
5. **Lockfile (resuelto en esta rama):** `package-lock.json` traía solo `@esbuild/linux-x64` y
   `dev:api` no arrancaba en Windows; se rearmó con los binarios de todas las plataformas (tsx pasó
   de 4.23.13 a 4.23.15, patch). También quedó una sola copia de Next (16.3.5) y de `react-dom`.
6. **`supabase/.temp/` está commiteada** (`project-ref`, `pooler-url`, versiones): sumarla al
   `.gitignore`.
7. **`.gitignore` no ignora `apps/api/node_modules`** (hoy no hay nada trackeado ahí, pero ya pasó
   una vez).
8. **El `package.json` raíz vuelve a declarar dependencias** (`next ^16.3.6`, `@supabase/ssr` y
   `@supabase/server`, commits 041bea0 y ead9eb8) sin actualizar `package-lock.json`. En el #3 se
   sacaron de ahí para tener una sola copia de Next (la de `apps/web`, 16.3.5 exacta): el próximo
   `npm install` puede volver a traer dos. No se tocó desde el front (lo habla el PO con Thiago).

## 11. Numeración de las User Stories

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

## 12. `data-testid` para Selenium

Las acciones clave de cada pantalla tienen `data-testid`, así los tests no dependen de clases CSS
ni del texto visible.

**Convención:** `<pantalla>-<elemento>[-<acción>]`, en minúsculas y con guiones. En listas, todos
los ítems comparten el testid (`buscar-tarjeta`, `panel-cobro`, `data-table-row`); en grupos de
opciones el testid lleva la clave (`mis-propiedades-tab-alquilada`,
`alta-medio-transferencia`, `user-menu-role-locatario`).

**Cambio de esta rama:** se borró `login-remember-checkbox` (se sacó "Recordarme": con Supabase la
sesión dura hasta cerrarla).

| Pantalla | `data-testid` |
|---|---|
| Header y landing | Sin sesión: `header-login-button`, `header-publish-button`, `header-drawer-login-button`, `header-drawer-publish-button`. Con sesión (29/09): `header-panel-button`, `header-user-menu` (adentro, `user-menu-item-panel`, `user-menu-item-publicar`, `user-menu-item-perfil` y `user-menu-logout`), `header-drawer-panel`, `header-drawer-publish-button`, `header-drawer-logout`; mientras se confirma la sesión, `header-session-pending`. Con sesión NO están `header-login-button`, `header-publish-button` ni `header-drawer-login-button`. Siempre: `header-menu-toggle`, `hero-search-cta`, `search-*` (buscador), `search-result-count`, `landing-more-properties-button`, `property-card-detail-button` |
| `/login` | `auth-revisando-sesion` (con sesión, mientras redirige; también en `/registro`), `login-email-input`, `login-password-input`, `login-submit-button`, `login-error-alert`, `login-register-link`, `login-forgot-link`, `login-forgot-link-mobile`, `auth-server-error`, `auth-retry-button` |
| `/registro` | `registro-login-link`, `registro-<campo>-input`, `registro-terminos-checkbox`, `registro-submit-button`, `registro-email-taken-alert`, `registro-error-alert`, `registro-success`, `registro-success-buscar`, `registro-success-publicar`, `registro-email-simulado`, `auth-server-error`, `auth-retry-button`. Borrados el 27/09 (registro en un paso, sin rol): `registro-rol-locador`, `registro-rol-locatario`, `registro-continuar-button`, `registro-back-button`, `registro-success-cta`, `registro-success-panel-link` |
| `/buscar` | `buscar-resultados`, `buscar-tarjeta`, `buscar-conteo`, `buscar-orden`, `buscar-paginacion`, `buscar-mostrando`, `buscar-sin-resultados`, `buscar-error`, `buscar-reintentar`, `buscar-abrir-filtros`, `buscar-drawer-ver`, `search-sidebar-*` / `search-drawer-*` (filtros) |
| AppShell y UserMenu | `app-shell-logo-link`, `app-shell-menu-toggle`, `app-shell-role-chip`, `app-shell-publicar` ("Publicar propiedad" del encabezado), `app-shell-publicar-drawer` (el mismo, en el menú hamburguesa), `user-menu-trigger`, `user-menu-item-<key>` (`user-menu-item-header-action`: "Publicar propiedad" en la hoja móvil), `user-menu-role-<rol>`, `user-menu-logout`, `role-context-switcher` |
| `/panel` (locatario) | `panel-locatario`, `panel-locatario-buscar`, `panel-locatario-publicar` |
| `/panel` (locador) | `panel-publicar`, `panel-registrar-pago`, `panel-pendientes`, `panel-stat-<cifra>`, `panel-cobro`, `panel-reclamo`, `panel-contrato`, `panel-error-<bloque>`, `panel-onboarding`, `panel-onboarding-publicar` |
| `/panel/propiedades` | `mis-propiedades-tab-<estado>`, `mis-propiedades-buscar`, `mis-propiedades-filtro-<barrio\|tipo\|reclamos>`, `mis-propiedades-orden`, `data-table-row` (escritorio), `data-table-card` (móvil), `mis-propiedades-ver-detalle`, `mis-propiedades-mas`, `mis-propiedades-abrir-filtros`, `mis-propiedades-drawer-aplicar`, `mis-propiedades-limpiar`, `mis-propiedades-vacio`, `mis-propiedades-sin-resultados`, `mis-propiedades-error`, `mis-propiedades-reintentar` |
| Alta | `alta-<campo>` (ej. `alta-calle`, `alta-precio`), `alta-fotos-dropzone`, `alta-foto`, `alta-foto-principal`, `alta-foto-quitar`, `alta-medio-<medio>-check` / `-recargo`, `alta-indice-<ICL\|IPC>`, `wizard-next-button`, `wizard-prev-button`, `wizard-finish-button`, `alta-mobile-volver`, `alta-mobile-salir`, `alta-errores`, `alta-publicando`, `alta-error-publicar`, `alta-reintentar`, `alta-error-login`, `alta-exito`, `alta-exito-mis-propiedades` (solo si la cuenta ya es locadora), `alta-exito-ver`, `alta-exito-panel` (locatario y no publicada), `alta-exito-otra` |
| Herramientas de desarrollo | `dev-tools-toggle`, `dev-tools-reset-mock-data` |

Para ver todos: `grep -rn "data-testid" apps/web/src packages/ui/src`.

## 13. Tipos compartidos

- Los modelos del back (`Inmueble`, `MisAlquileresItem`, `CreateInmuebleCompletoPayload`,
  `Usuario`, `Rol`, `Contrato`, `Reclamo`, `EstadoReclamo`…) están arriba de
  `packages/shared-types/src/index.ts`. `Publicacion` ya no existe.
- Los tipos de vista del front están en archivos propios (`propiedad.ts`, `filters.ts`, `panel.ts`,
  `status.ts`, `usuario-sesion.ts`, `neighborhood.ts`) y se exportan al final de `index.ts`.
- Qué adaptador conecta cada modelo con cada tipo de vista: `packages/shared-types/README.md`.
- DTOs que el back todavía no exporta (`UsuarioMeResponse`, `InmueblesDisponiblesResponse`,
  `InmuebleDetalleResponse`, `RegistrarUsuarioRequest`): copiados en `apps/web/src/services/shared/backend-dtos.ts`, con
  `TODO(backend)` para moverlos a `shared-types`.

## 14. Qué queda para el sprint 2

- Subida de fotos al bucket y alta completa desde la pantalla (sección 8).
- Detalle de la propiedad del locador (`/panel/propiedades/[id]`) con editar (US-03), eliminar
  (US-04) y publicar/pausar (`cambiarEstadoPublicacion` ya está en el service, sin usar).
- Detalle público (`/propiedad/[id]`) y solicitudes (US-35 a US-38).
- Recuperar contraseña (US-40) y perfil (US-20, US-21).
- Panel del locatario (hoy un placeholder).
- Cobros, reclamos, contratos y notificaciones de verdad.
