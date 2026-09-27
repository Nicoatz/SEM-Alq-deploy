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
| US-39 Iniciar y cerrar sesión | Login y "Cerrar sesión" del UserMenu | `/login` | Conectado (Supabase Auth + `/usuarios/me`) |
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

Lo que falta en el back (en curso, Thiago) está en la sección 7, US-01. Mientras tanto el front
tolera las dos cosas: un 403 de `POST /inmuebles` se muestra como "Todavía no podés publicar desde
esta cuenta, estamos terminando este cambio" (sin perder lo cargado), y si después del 201 la
cuenta sigue sin el rol, el éxito se muestra sin "Ir a mis propiedades".

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
| `GET /inmuebles/disponibles` | `/buscar`, landing | **Parcial**: filtros, orden y paginación en el servidor desde el 26/09; algunas búsquedas se resuelven todavía en el cliente (sección 7) |
| `GET /inmuebles/disponibles/:id` | — | Existe (antes `GET /inmuebles/:id`); el front ya no la usa: el listado trae lo que muestra la tarjeta |
| `GET /mis-alquileres` | `/panel/propiedades`, conteos de `/panel` | **Parcial**: sin locatario, pagos, reclamos, ajuste ni fecha de alta |
| `POST /inmuebles` | Alta | **Parcial**: el body se validó con una carga de prueba (201); desde la pantalla falta la subida de fotos (bucket). Todavía exige el rol locador (sección 7, US-01) |
| Supabase Storage, bucket `fotos-propiedades` | Alta | **Pendiente**: el bucket no existe (lo maneja Ivan) |
| `GET /publicaciones/activas` | — | **Pendiente**: no está montada y el archivo no compila (sección 10) |
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

Desde el 26/09 (`develop`, "Fix endpoints de consulta propiedades disponibles con nuevo modelo
bdd") `/disponibles` filtra, ordena y pagina en el servidor y cada item trae precio, expensas, tipo,
tags, índice, foto principal y fecha de disponibilidad. El front ya lo usa así: se sacó el N+1 contra
el detalle y el caché de 30 s. Los filtros de la URL de `/buscar` se traducen a los del back en un
solo lugar: `propiedad.adapter.ts#consultaDeDisponibles` (tiene la tabla completa).

| Brecha | Dueño |
|---|---|
| `orden=precio` no ordena los inmuebles: ordena el contrato embebido (`order(..., { foreignTable })`), así que `asc` y `desc` devuelven lo mismo (probado el 27/09). Mientras tanto, los órdenes por precio se resuelven en el cliente. | backend |
| Acepta un solo valor por filtro (barrio, tipo), cantidades exactas (sin "4 o más") y `tags` devuelve las que tengan **cualquiera** de los elegidos. US-34 pide selección múltiple y "que cumplan con todos los criterios". Cuando la búsqueda no se puede mandar exacta, el front trae todas y filtra en el cliente. | backend |
| No filtra por provincia ni ciudad: el front las filtra sobre la página que vuelve (hoy solo hay Córdoba Capital). | backend |
| Una página fuera de rango responde **400** ("Requested range not satisfiable"). El front pide la última en ese caso; lo esperable sería 200 con `items: []`. | backend |
| El item no trae `estado_alquiler`: el front muestra "Disponible desde" si tiene `fecha_disponible`. | backend |
| `/disponibles` lista `publicado` y `alquilado_disponible`, pero la validación de `POST /inmuebles` solo acepta `publicado`, `pausado` o `alquilado` (`inmueble.service.ts`, y `EstadoAlquiler` de `shared-types` tampoco tiene `alquilado_disponible`). Por eso el alta guarda una alquilada con fecha como `alquilado` + `fecha_disponible`, y esas no aparecen en la búsqueda (en la base no hay ningún `alquilado_disponible`). Propuesta: aceptar `alquilado_disponible` en la validación y en `EstadoAlquiler`. Cuando esté, el front cambia el adaptador del alta (alquilada con fecha → `alquilado_disponible`) y Mis propiedades lee los dos estados. | backend |
| Solo lista inmuebles con contrato (`contrato!inner`), porque el precio sale de `contrato.monto_alquiler`. El alta crea el contrato junto con el inmueble, así que no bloquea (consulta abierta con Thiago). | backend |
| No hay fecha de publicación: "Más recientes" usa el orden por defecto del back (id descendente). | db |
| Ciudades y barrios son texto libre ("Córdoba" vs. "Córdoba Capital"; "Alberdi" no está en el catálogo del front, así que filtrar por ese barrio se resuelve en el cliente). Hace falta un catálogo de ubicaciones. | db |
| El tag "Apto profesional" del front no existe en `tags_inmueble`. | db |
| El índice CAC de la base no está en el front (US-01 habla solo de ICL e IPC): se muestra sin índice. | front / PO |

### US-02 Consultar mis propiedades

| Brecha | Dueño |
|---|---|
| `/mis-alquileres` no trae locatario, estado del pago, días de atraso, reclamos abiertos ni próximo ajuste. En modo real, esas columnas muestran "—" para las alquiladas. | backend |
| No hay fecha de alta: el orden "Más recientes" no tiene efecto. | db |
| En el inmueble 1, `precio_publicado` es $360.000 y `contrato.monto_alquiler`, $350.000. El front muestra el publicado para las no alquiladas y el del contrato para las alquiladas: confirmar cuál manda. | backend / db |
| El contrato del inmueble 2 tiene los firmantes duplicados en `contrato_x_usuario`. | db |

### US-01 Registrar mis propiedades

| Brecha | Dueño |
|---|---|
| **`POST /inmuebles` tiene `requireRole("locador")`**: un locatario recibe 403. Con la regla nueva, tiene que aceptar a cualquier usuario con sesión. | backend (Thiago) |
| **Asignar el rol locador al crear la primera propiedad** (fila en `usuario_x_rol` con `id_rol = 1`), en la misma operación del alta. Hoy la cuenta queda locataria y el front muestra el éxito sin "Ir a mis propiedades" (`TODO(backend)` en `AltaPropiedad`). | backend (Thiago) |
| **Expansión de roles en `/usuarios/me`**: una cuenta locadora tiene que devolver `["locador", "locatario"]` (locador abarca a locatario). Hoy devuelve solo las filas de `usuario_x_rol`. Definir si se guarda la fila de locatario o se expande en `requireRole`/`/me`. | backend (Thiago) |
| **No existe el bucket `fotos-propiedades`** en Storage. El back exige al menos 3 fotos con URL, así que el alta desde la pantalla avisa y no manda nada (sección 8). | db (Ivan) |
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

## 8. Para cuando exista el bucket de fotos

1. Implementar `subirFotoPropiedad()` en `apps/web/src/services/propiedades.service.ts` (hoy tira
   el error acordado, con `TODO(db)`): subir cada foto al bucket `fotos-propiedades` en
   `<auth.uid>/<archivo>`, con la sesión del usuario, y devolver la URL pública, `peso_kb` y
   `formato`.
2. **`peso_kb` redondeado hacia arriba** (`Math.ceil(bytes / 1024)`): el front deja cargar hasta
   350 × 1024 bytes y el back rechaza `peso_kb > 350`; así coinciden.
3. Sumar el host del bucket ya está hecho (`images.remotePatterns` de `apps/web/next.config.mjs`
   acepta `*.supabase.co/storage/v1/object/public/**`). Sacar `rentar.com` cuando no queden fotos
   de prueba del seed.
4. **Probar el caché de `/buscar`:** después de un alta real publicada, la propiedad tiene que
   aparecer en `/buscar` enseguida (el alta llama a `olvidarDisponibles()`). No se pudo probar sin
   bucket.
5. Repetir el recorrido del alta completo a 390 y 1440 px y verificar con el MCP las cinco tablas
   (`inmueble`, `inmueble_x_tag`, `foto_inmueble`, `contrato`, `medio_pago_x_contrato`).

## 9. Datos de prueba para borrar

Creados durante la conexión del front. Todos los mails de prueba llevan `+test`.

| Qué | Ids | Dónde |
|---|---|---|
| Usuarios `rentar.qa+test-rol-locador@example.com`, `+test-sin-rol`, `+test-t3-locador-1440`, `+test-t3-locatario-390` | **11, 12, 15 y 16** | Supabase Auth, `usuario` y `usuario_x_rol` |
| Inmueble "[TEST] Carga de prueba de feature/conexion-back" | inmueble **4** | `inmueble` |
| Sus filas asociadas | `inmueble_x_tag` **5 y 6**; `foto_inmueble` **10, 11 y 12**; `contrato` **4**; `medio_pago_x_contrato` **5 y 6** | cada tabla |

## 10. Observaciones para backend

Encontradas al integrar. No se tocó `apps/api` (el PR #2 se cerró sin mergear): quedan para el equipo.

1. **`npm run build` de la raíz falla en `apps/api`** por `src/services/publicacion.service.ts`:
   importa `repositories/publicacion.repository`, que no existe, y tipos que ya no están en
   `@rentar/shared-types` (`PublicacionDTO`, `Inmueble.m2`, `Inmueble.tags`). Por eso
   `publicaciones.routes.ts` no está montada y `GET /publicaciones/activas` responde 404 (tampoco
   hay tabla `publicacion`). Definir si se borra o se rehace.
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
| Header y landing | `header-login-button`, `header-publish-button`, `header-menu-toggle`, `hero-search-cta`, `search-*` (buscador), `search-result-count`, `landing-more-properties-button`, `property-card-detail-button` |
| `/login` | `login-email-input`, `login-password-input`, `login-submit-button`, `login-error-alert`, `login-register-link`, `login-forgot-link`, `login-forgot-link-mobile`, `auth-server-error`, `auth-retry-button` |
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
  `Usuario`, `Rol`, `Contrato`…) están arriba de `packages/shared-types/src/index.ts`. `Publicacion`
  ya no existe.
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
