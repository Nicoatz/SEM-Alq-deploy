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
| US-04 Eliminar mis propiedades | Baja lógica de una propiedad desde su detalle | `/panel/propiedades/[id]` | Parcial (conectada el 09/10; el back no mira el contrato vigente ni cancela solicitudes, §7) |
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
| `apps/web/src/services/` | **La única frontera con el backend.** Un archivo por módulo (`auth`, `usuarios`, `propiedades`, `solicitudes`, `panel`). Cada función tiene rama mock y rama real. Ver su `README.md`. |
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
| `GET /inmuebles/disponibles` | `/buscar`, landing | **Conectado**: desde ce677a4 (29/09) filtra, ordena y pagina (probado el 06/10). La landing pide `limit=6`; `/buscar` todavía trae todas y filtra en el cliente (sección 7). Tarda 7–10 s |
| `GET /inmuebles/disponibles/:id` | `/propiedad/[id]` (US-41) | **Conectado** (09/10, revisado contra la base real): la usa `getPropiedad`, con `Authorization` si hay sesión (la ruta lo ignora). Todavía le faltan dueño, estado, condiciones, medios de pago y si el usuario ya la solicitó: esas secciones no se muestran (sección 7, US-41) |
| `GET /mis-alquileres` | `/panel/propiedades`, conteos de `/panel`; **puente** del detalle y la edición del locador (US-03, US-04) | **Parcial**: desde el 29/09 trae locatario, próximo ajuste y si tiene reclamos sin resolver (el front los suma en el próximo PR); siguen faltando pagos y fecha de alta |
| `POST /inmuebles` | Alta | **Conectado** (29/09): alta real de punta a punta desde la pantalla, con fotos en Storage; cualquier rol, y suma el rol locador |
| Supabase Storage, bucket `fotos-propiedades` | Alta | **Conectado** (29/09): el alta sube las fotos y, si falla, las borra (desde el 30/09, con la política de SELECT; sección 8) |
| `GET /locadores/:idLocador/barrios` | — | Existe desde el 29/09 (Bearer + rol locador; solo el propio id). El front no la usa: arma los barrios del filtro de US-02 con sus propias propiedades |
| `GET /usuarios/me/contextos` | "Viendo como" del UserMenu | **Pendiente** (propuesto; hoy se arma en el front con `/mis-alquileres`) |
| `GET /catalogos/ubicaciones` | Filtros de ubicación | **Pendiente** (propuesto; hoy se arman con los datos) |
| `GET /panel/cobros`, `/panel/reclamos`, `/panel/contratos` | `/panel` | **Pendiente** (módulos de sprints futuros; en modo real se muestran vacíos) |
| `GET /solicitudes/recibidas?estado=pendiente` | `/panel` (inicio del locador) | **Conectado** (13/10, tanda 5): `panel.service#getSolicitudesPendientes` |
| `POST /solicitudes`, `GET /solicitudes/preparar`, `GET /solicitudes/mias`, `GET /solicitudes/recibidas`, `PATCH /solicitudes/:id/{aceptar,rechazar,cancelar}` | `/propiedad/[id]` (US-35), `/panel/mis-solicitudes` y `/panel/solicitudes` (US-36 a US-38) | **Conectado** (13/10, tanda 5; `develop` 0060e0a). Errores traducidos en `solicitud.adapter.ts`. Brechas en §7, "US-35 a US-38" |
| `GET /solicitudes/:id` | Detalle del postulante (US-36) | **Pendiente** (propuesto). Puente: `getSolicitudRecibida` filtra `GET /recibidas?inmueble=` en el cliente (§7, brecha 5) |
| `GET /mis-alquileres/:id` | Detalle y edición del locador (US-03, US-04) | **Pendiente** (propuesto, tanda 3 del Sprint 2). Desde el 09/10 el detalle y la precarga de la edición **cargan en modo real con un puente**: `getMiPropiedad` pide `GET /mis-alquileres` y busca el id (sección 7, US-03 y US-04) |
| `DELETE /inmuebles/:id` (baja lógica, 09/10) | Detalle del locador (US-04) | **Conectado** (09/10, `develop` b7ebf48): baja lógica (`activo = false`) del inmueble y de sus contratos; valida el dueño; 409 si está alquilado. Errores traducidos en `propiedad.adapter.ts#errorDeEliminarPropiedad` (§7, US-04) |
| `PUT /inmuebles/:id` | `/panel/propiedades/[id]/editar` (US-03) | **Conectado** (11/10, `develop` b5acfa7; probado en real y en mock, §7 US-03): cuerpo PARCIAL, solo con lo que cambió y solo datos del inmueble (más `fotos` y `tags`, que reemplazan la lista). Las condiciones del alquiler y el estado son de solo lectura en `/editar`. Errores traducidos en `propiedad.adapter.ts#errorDeActualizarPropiedad` |
| `PATCH /inmuebles/:id/publicacion` | Detalle (sprint 2) | **Pendiente** (propuesto; la función del service está lista, sin usar) |
| `GET /usuarios/me/perfil`, `PATCH /usuarios/me`, `PATCH /usuarios/me/legajo` | `/panel/perfil` (US-20, US-21, Sprint 3) | **Pendiente** (propuesto, tanda 1 del Sprint 3): en mock funciona; la rama real ya llama a estas rutas (§7, "US-20 y US-21") |
| Supabase Auth `updateUser` (correo y contraseña) | `/panel/perfil` (US-21) | **Listo en el front, sin probar en real**: falta configurar el dashboard (§7, "US-20 y US-21"; la contraseña es **bloqueante**) |

## 6. Status HTTP y errores

`apiClient` convierte el status en un `ServiceError` con `code`, y cada pantalla muestra su estado
de error:

| Status | `code` | Qué muestra el front |
|---|---|---|
| 400 / 422 | `validation` | El texto de `error` tal cual, arriba del formulario. **Tiene que estar en español y decir qué hacer.** |
| 401 | `unauthorized` | "Tu sesión venció…". En el login, las credenciales inválidas de Supabase (400) dan el mensaje genérico de US-39, que no revela si el mail existe. |
| 403 | `forbidden` | Sin permiso para esa acción (el guard de rol del front evita llegar a pedirlo). |
| 404 | `not_found` | Error del servidor con "Reintentar". **Nunca** se interpreta como credenciales incorrectas. |
| 409 | `conflict` | Registro: mail o DNI ya registrado (el front distingue cuál por el texto del error; ver sección 7). Perfil (`PATCH /usuarios/me`, propuesto): DNI duplicado o identidad bloqueada por un contrato, distinguidos por el `codigo` del sobre (§7, "US-20 y US-21"). |
| 5xx / sin respuesta | `server` / `network` | "No pudimos conectarnos con RentAR" + "Reintentar". Si el dispositivo está sin red: "Parece que te quedaste sin internet". |

## 7. Brechas por US

Lo que cada pantalla necesita y todavía no hay. **Dueño:** `backend` (`apps/api`), `db` (esquema o
datos en Supabase) o `front`. No se modificó `apps/api` ni `supabase/` desde esta rama.

### US-20 y US-21 Mi perfil (Sprint 3, tanda 1, `/panel/perfil`)

La pantalla funciona en **modo mock**; la rama real llama a rutas **propuestas** que todavía no
existen. Contrato completo (body, respuesta, errores y ejemplo) en
[`api-endpoints.md`](api-endpoints.md), "Perfil y legajo". Front: `services/perfil.service.ts`,
`services/adapters/perfil.adapter.ts`, `components/perfil/*`, `app/auth/confirmar/route.ts`.

**Lo que el back tiene que hacer**

| # | Qué | Para qué | Dueño |
|---|---|---|---|
| 1 | `GET /usuarios/me/perfil` → `PerfilResponse` | Mostrar el perfil (US-20): DNI, teléfono, fecha de nacimiento, roles, contrato que bloquea y legajo. Aparte de `/usuarios/me` para que el DNI y los ingresos no viajen en cada cambio de ruta | backend |
| 2 | `PATCH /usuarios/me` con 409 `DNI_DUPLICADO` y 409 `IDENTIDAD_BLOQUEADA_POR_CONTRATO` | Editar datos personales (US-21). Repetir las validaciones de la tabla de `api-endpoints.md` | backend |
| 3 | `PATCH /usuarios/me/legajo` | Editar el legajo (US-21) | backend |
| 4 | Guardar el legajo: situación ocupacional, ingreso mensual (entero > 0 o `NULL`) y garantías (varias) por usuario. Sugerencia: columnas `id_situacion_ocupacional` e `ingreso_mensual` en `usuario` y una tabla `usuario_x_garantia`, reusando los catálogos de las solicitudes | US-20 / US-21 | db |
| 5 | Sumar `legajo` a `GET /solicitudes/preparar` (misma forma que `LegajoDto`) | US-21: "los datos del legajo se precargan en las solicitudes nuevas". Mientras no venga, en real el modal usa los valores por defecto de US-35 | backend |
| 6 | **Sincronizar `usuario.email` con `auth.users.email`** cuando se confirma un cambio de correo (trigger `AFTER UPDATE OF email ON auth.users`, o que `/usuarios/me` y `/me/perfil` lean el correo del token) | Supabase cambia solo `auth.users`; sin esto, el perfil y las solicitudes muestran el correo viejo | backend / db |
| 7 | Sumar `codigo` al sobre de error (`{ success: false, error, codigo }`) | Distinguir los dos 409 de `PATCH /usuarios/me` sin leer el texto | backend |

**Contraseña: BLOQUEANTE para pasar a real.** El front cambia la contraseña con
`supabase.auth.updateUser({ password, current_password })`. Supabase **solo verifica la contraseña
actual si está activa la opción "Require current password when changing password"** (en las
opciones de contraseña de Authentication del dashboard; guía "Password security" de Supabase. En un
Auth propio: `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD=true`). **Sin esa opción, Supabase ignora `current_password` y cambia la contraseña
aunque la actual esté mal**: la prueba "cambiar la contraseña ingresando mal la actual (falla)" pasaría
a ser un agujero. Con la opción activa, la actual incorrecta responde **400 `current_password_invalid`**
(el texto dice "Current password required when setting new password.", engañoso: el front mira el
`code`, verificado en `supabase/auth`, `internal/api/user.go`). `same_password` y `weak_password`
son 422. No activar "Secure password change" (pide un código por mail si la sesión tiene más de 24 h:
el front lo traduce, pero no tiene la pantalla para el código).

**Correo: pasos del dashboard (los hace quien tenga acceso; el front no los toca).** "Secure email
change" queda **activo** (decisión del PO): Supabase manda un enlace al correo actual y otro al
nuevo, y el cambio se aplica cuando se confirman los dos. El perfil lo dice así: "Te mandamos un
enlace a tu correo actual y otro a <nuevo>. El cambio se aplica cuando confirmes los dos."

1. **Authentication → URL Configuration → Redirect URLs:** sumar
   `http://localhost:3001/auth/confirmar` y la URL de producción `https://<dominio>/auth/confirmar`
   (si no, Supabase ignora `emailRedirectTo` y manda a la Site URL).
2. **Authentication → Emails → "Change email address":** cambiar el enlace por
   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email_change` (el `RedirectTo` ya trae
   `?next=/panel/perfil`). Con eso `/auth/confirmar` verifica con `verifyOtp` y el enlace funciona
   aunque se abra en otro dispositivo. Con la plantilla por defecto (`{{ .ConfirmationURL }}`) también
   anda, pero solo en el navegador donde se pidió el cambio (flujo PKCE: `?code=`).
3. Dejar **"Secure email change" activo** (Authentication → Sign In / Providers → Email).
4. Probar: pedir el cambio desde `/panel/perfil`, confirmar los dos enlaces y verificar que el perfil
   muestre el correo nuevo (necesita el punto 6 de la tabla para que lo muestre `usuario.email`).

`/auth/confirmar` vuelve a `/panel/perfil?correo=confirmado|parcial|error`: el perfil muestra un aviso
según el resultado (el primer enlace de "Secure email change" vuelve como `parcial`).

**Decisiones del PO de esta tanda**

- **Ingresos:** en el perfil, 0 falla y vacío pasa (US-21). En la solicitud, un ingreso vacío en el
  perfil se precarga **vacío**, no 0: el 0 de US-35 es "prefiero no informarlo" y lo decide el usuario
  en cada solicitud.
- **Legajo completo** (US-20): situación distinta de "-", ingreso cargado y al menos una garantía
  (`lib/perfil/legajo.ts`).
- **Diseño vs. US** (gana la US): sin "Guardar cambios" global (se guarda por bloque); nombre y DNI
  bloqueados (no "piden confirmación"); garantías de US-35; el legajo se muestra para todos. Quedan
  fuera documentación (FileDropzone), verificación de teléfono, "Cómo te avisamos", "Resumen de la
  cuenta" y "Dar de baja": no están en US-20 ni US-21.
- **Aviso al salir:** cubre recargar, cerrar y los links internos; **no** cubre el botón Atrás ni el
  selector "Viendo como" (`lib/hooks/useAvisoCambiosSinGuardar.ts`).
- **Datos sensibles en mock:** el DNI y el ingreso que se editan en el perfil viven solo en memoria
  (no en `localStorage`). Ver §10, "Pendientes del front".

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

Desde ce677a4 (29/09) `/disponibles` vuelve a aplicar los filtros, el orden y la paginación
(`page`/`limit`, tope 1000), con el id descendente como orden de base. Probado contra la API real el
06/10/2026 con 11 disponibles: precio, dormitorios, ambientes, superficie, tags, índice, barrio,
tipo, `orden=m2` y `page=2&limit=4` responden lo esperado. La landing ya lo usa ("Recién publicadas"
pide `?page=1&limit=6`). `/buscar` todavía trae todas y filtra, ordena y pagina en el cliente
(`propiedades.service.ts#buscarPropiedades`, con `TODO(backend)`); pasarla al back queda para
`feature/vistas`, con el mapeo de la URL a los params (`consultaDeDisponibles`, commit 60f8c63).

| Brecha | Dueño |
|---|---|
| ~~**`/disponibles` ignora los filtros**~~ **Resuelto (ce677a4, 29/09; probado el 06/10).** | — |
| **`barrio` filtra por nombre exacto** (`General Paz`); con el slug que usa el front (`general-paz`) da 0. Propuesta: cuando `/buscar` filtre en el back, el front traduce el slug al nombre (el catálogo de barrios es del front). | front |
| **"4 o más" dormitorios o ambientes:** `dormitorios` y `ambientes` son igual exacto. Sumar un filtro de mínimo (por ejemplo `dormitoriosMin` y `ambientesMin`). | backend |
| **Consultas por item:** `getInmueblesDisponibles` (y `/mis-alquileres`) hacen, por cada inmueble y una atrás de otra, consultas de tipo, contrato, índice, tags y fotos. Medido el 06/10: con `limit=6` tarda 7–10 s, y con las 11 disponibles, ~13 s. Traerlo en una consulta con los embebidos (como el repositorio del 26/09). | backend |
| ~~Expensas sin contrato~~ **Resuelto (29/09, `develop` 8f9bf8c y ce677a4):** el detalle manda `null` sin contrato y el listado vuelve a pedir contrato, así que su `0` es real. El front muestra `0` como "Sin expensas" y `null` (o un `-1` viejo) vacío, nunca "$0". | — |
| ~~Nombre del estado "alquilada con fecha"~~ **Resuelto (29/09, `develop` 2264372):** el back normalizó todo a `'publicado/alquilado'` (validación, `EstadoAlquiler`, `/disponibles`, `/mis-alquileres`, con migración). El alta manda `publicado/alquilado` para una alquilada con fecha y `alquilado` sin fecha; la lectura también acepta `alquilado` + fecha, por las viejas. | — |
| El item no trae `estado_alquiler`: el front muestra "Disponible desde" si tiene `fecha_disponible`. | backend |
| No filtra por provincia ni ciudad (hoy solo hay Córdoba Capital). | backend |
| No hay fecha de publicación: "Más recientes" queda en el orden por id que devuelve el back. | db |
| Ciudades y barrios son texto libre ("Córdoba" vs. "Córdoba Capital"; "Alberdi" no está en el catálogo del front). Hace falta un catálogo de ubicaciones. | db |
| El tag "Apto profesional" del front no existe en `tags_inmueble`. | db |
| El índice CAC de la base no está en el front (US-01 habla solo de ICL e IPC): se muestra sin índice. | front / PO |

### US-03 Modificar y US-04 Eliminar mis propiedades (Sprint 2, tanda 3)

**US-03 y US-04 no tienen criterios de aceptación** (ni en `Documentación/md/US/` ni en Jira,
SCRUM-20 y SCRUM-21): se usó el diseño ("Detalle de propiedad del locador" · 01, 05 y 06) como
criterio, igual que con US-41. El PO tiene una propuesta de criterios para cargar.

| Brecha | Dueño |
|---|---|
| **No existe `GET /mis-alquileres/:id`** (el detalle de una propiedad del dueño, con dirección exacta, condiciones, fotos, tags y contrato vigente; 404 si no es suya). Ver `api-endpoints.md`. **Puente (09/10):** `getMiPropiedad` pide `GET /mis-alquileres` (todas las del dueño) y busca el id; si no está, "No encontramos esta propiedad". No escala: cuando exista la ruta, se borra `propiedad.adapter.ts#misAlquileresItemToDetalleResponse` y se pide solo esa. | backend |
| **`/mis-alquileres` no manda `contrato.estado` ni `fecha_fin_contrato`.** Con el puente, **el contrato vigente se DEDUCE de `estado_alquiler`** (`alquilado` o `publicado/alquilado` = vigente). Es una aproximación: en la base hay `publicado/alquilado` cuyo contrato está en estado "disponible" (inmueble 13) y el front los toma como vigentes (bloquea precio, ajuste y eliminar); y no se usa el locatario porque hay contratos vigentes sin él (inmueble 3). Además, el contrato va **sin fecha de fin**: el encabezado dice "Contrato vigente" (sin "hasta…"), "Lo que sigue" no muestra el vencimiento y el aviso de eliminar no dice hasta cuándo. Sumar los dos campos al item (o a la ruta nueva). | backend |
| **Contratos vigentes sin locatario** en los datos de prueba (inmueble 3: contrato 3 vigente, sin fila de locatario en `contrato_x_usuario`). El front muestra "—" en "Locatario". `ContratoVigenteResumen.tenantName` y `endDate` pasaron a admitir `null` (`@rentar/shared-types`). | db |
| **Catálogos por texto:** `/mis-alquileres` manda tipo, tags, índice y medios de pago como descripción, no como id. El puente los vuelve a ids con los mapeos del Sprint 1 (CAC → sin índice; "Débito automático" no se ofrece en el front y se descarta). La ruta nueva debería mandar ids, como el cuerpo de `POST /inmuebles`. | backend |
| No hay fecha de publicación (`publishedAt` va en `null`: el encabezado no dice "publicada el…"). | db |
| ~~**`PUT /inmuebles/:id` ampliado**~~ **Ya no aplica (11/10):** el `PUT` real (`develop` b5acfa7) es parcial y solo modifica el inmueble, sus fotos y sus tags. Las condiciones del alquiler no se editan en este endpoint ni en este sprint (decisión confirmada con backend). Ver US-03 más abajo. | — |
| ~~**Con contrato vigente, el precio y el ajuste no se modifican**~~ **Resuelto (10/10):** con el inmueble `alquilado` o `publicado/alquilado`, el `PUT` rechaza **cualquier** cambio con 409. El front no muestra el formulario (aviso de bloqueo, §7 US-03). | — |
| ~~**`DELETE /inmuebles/:id` lógico**~~ **Hecho (09/10, `develop` b7ebf48):** baja lógica con `activo = false` (booleano, no un estado nuevo: el inmueble sigue `publicado` o `pausado`). El 409 sale de `estado_alquiler`, **no del contrato vigente**: ver la sección US-04 de abajo y §10. | — |
| **Al eliminar, las solicitudes `pendiente` y `aceptada` del inmueble pasan a `cancelada`**, con un mail a cada postulante (decisión del PO). El back tiene el módulo desde el 12/10, pero el `DELETE` no las cancela (§7, "US-35 a US-38", brecha 10). En mock el modal avisa "Las N solicitudes de esta propiedad se van a cancelar"; **en real no dice nada** (`contarSolicitudesQueSeCancelan` devuelve 0; decisión del PO, tanda 5). | backend |
| **Fotos de la edición:** el front sube las nuevas a Storage solo si cambiaron las fotos, antes del `PUT`; si el `PUT` falla, las borra (como el alta). Las que se **sacan** quedan en el bucket: §10, punto 27. | backend |
| ~~**La precarga de `/editar` pierde "Débito automático" y el índice CAC**~~ **Ya no es un riesgo de borrado (11/10, confirmado en el código):** la precarga sigue sin mostrarlos (el front no los ofrece), pero en `/editar` las condiciones son de solo lectura y no viajan en el `PUT`, y la función SQL `actualizar_propiedad_completa` solo actualiza columnas de `inmueble`, `foto_inmueble` e `inmueble_x_tag` (rechaza con 400 cualquier clave del contrato). Nota actualizada en `propiedad.adapter.ts#misAlquileresDetalleToPropiedadLocadorDetalle`. | — |
| **Fotos del seed que no existen:** las del inmueble 1 (y otras cargadas a mano) apuntan a `https://rentar.com/fotos/...`, que da 404. El front muestra la foto de respaldo, pero el navegador registra el 404 en la consola. Reemplazarlas por fotos del bucket o borrarlas. | db |
| **Decidido (tanda 3):** solo la pestaña Resumen; sin "Pausar" (no tiene US ni endpoint); "Eliminar" con contrato vigente queda habilitado y abre el aviso de bloqueo. | — |

**Probado en real el 09/10** (`locador@rentar.com`, 390 y 1440 px, rama `feature/conexion-detalle`):
`/mis-alquileres` trae todas las del dueño, también las pausadas (14, 18) y las alquiladas (2, 3), así
que el puente las encuentra. El 1 (publicada) y el 14 y el 18 (pausadas) salen sin contrato; el 2 y el 3
(alquiladas) con "Contrato vigente" y el ajuste ICL del 01/03/2027, el 2 con locatario y el 3 con "—".
La precarga de `/editar` del 1 trae todos los campos. Un id que no es del dueño (999999) muestra
"No encontramos esta propiedad". En `/propiedad/[id]`, el 14 (pausada) y el 999999 dan 404 del back
y la pantalla "Esta publicación ya no está disponible". Con sesión, todos los pedidos llevan
`Authorization: Bearer …`.

### US-02 Consultar mis propiedades

| Brecha | Dueño |
|---|---|
| Desde el 29/09 `/mis-alquileres` trae `contrato.locatario`, `contrato.fecha_proximo_ajuste` y `posee_reclamos_no_resueltos` (sí/no, no la cantidad). El front todavía no los muestra: van en el próximo PR (hoy esas columnas siguen en "—"). Siguen faltando el estado del pago y los días de atraso. | front (próximo PR) / backend |
| **`/mis-alquileres` ignora sus filtros:** documenta `barrio`, `tipo`, `estado` y `reclamos`, pero `findByLocadorId` no los aplica. Sin impacto en el front (US-02 filtra en el cliente). | backend |
| **`reclamos` se lee con `Boolean(req.query.reclamos)`**: cualquier texto, incluido `"false"`, da `true`. Comparar con `=== 'true'`. | backend |
| No hay fecha de alta: el orden "Más recientes" no tiene efecto. | db |
| En el inmueble 1, `precio_publicado` es $360.000 y `contrato.monto_alquiler`, $350.000. El front muestra el publicado para las no alquiladas y el del contrato para las alquiladas: confirmar cuál manda. | backend / db |
| ~~**`/mis-alquileres` de `locador@rentar.com` responde 400**~~ **Arreglado en código (30/09, sin probar contra la API; falta confirmar en `develop`):** el error era "JSON object requested, multiple (or no) rows returned". `contrato.repository#getLocatarioByContratoId` usaba `maybeSingle()` sobre `contrato_x_usuario` (`tipo_firmante = 2`) y, con los firmantes duplicados del contrato 2, traía dos filas y fallaba **toda la lista**. Ahora usa `limit(1)`. Además, `contrato.repository#findByInmuebleId` tenía el mismo problema con `maybeSingle()` si un inmueble tenía más de un contrato: ahora trae todos y devuelve el más reciente que no esté finalizado (estado 3) o, si no hay, el último. Esto también alcanza a `/inmuebles/disponibles` y su detalle, que usan la misma función. | — |
| El contrato del inmueble 2 tiene los firmantes duplicados en `contrato_x_usuario`. Ya no rompe la API, pero son datos sucios: borrar las filas repetidas. | db |
| ~~`contrato.repository#deleteByInmuebleId` borra solo un contrato si el inmueble tiene varios~~ **Ya no aplica (09/10):** eliminar un inmueble es una baja lógica (`eliminar_inmueble_logico`) que finaliza e inactiva **todos** sus contratos; `inmueble.service#delete` ya no llama a `deleteByInmuebleId`. | — |

### US-03 Modificar mis propiedades

Cambio del back del 10/10 (`develop` a68f44b y b5acfa7). **Conectado en el front el 11/10**
(`feature/conexion-editar`): `propiedades.service#actualizarPropiedad` llama al `PUT` con un cuerpo
parcial y `propiedad.adapter.ts#errorDeActualizarPropiedad` traduce los errores. La función SQL
está aplicada en la base (revisado el 11/10 con una consulta de solo lectura: coincide con la migración).

**Decisión (confirmada con backend):** el `PUT` solo modifica datos del inmueble. Las condiciones del
alquiler (plazo, índice, medios de pago, días de gracia, depósito y cualquier otro dato del contrato)
no se editan en este endpoint ni en este sprint. Ninguna US cubre editarlas: §10, punto 29.

Campos del formulario de `/editar`:

| Campo | Columna | En `/editar` |
|---|---|---|
| Tipo, calle, número, barrio | `tipo`, `direccion`, `numero`, `barrio` | Editable |
| Piso y departamento | `piso` (van juntos: "7° B") | Editable |
| Ambientes, dormitorios, baños, antigüedad, superficie total y cubierta | columnas homónimas | Editable |
| Características | `tags` (ids; el `PUT` reemplaza la lista) | Editable. "Apto profesional" ya no se ofrece (no existe en la base, §10 punto 28) |
| Descripción | `descripcion` | Editable |
| Disponible desde | `fecha_disponible` | Editable |
| Fotos y principal | `fotos` (el `PUT` reemplaza la lista) | Editable |
| Precio mensual | `precio_publicado` | Editable (ver §10, punto 25) |
| Ciudad y provincia | `ciudad`, `provincia` | Fijas (Córdoba Capital), como en el alta: nunca salen como cambio |
| Estado de la publicación | `estado_alquiler` | Solo lectura: el `PUT` lo rechaza (400); publicar y pausar van por `PATCH /inmuebles/:id/publicacion` (propuesto) |
| Expensas, interés por día, días de gracia, medios de pago, índice, frecuencia, depósito y duración | contrato | Solo lectura (deshabilitados, sin textos extra) |
| — (no está en el formulario) | `servicios` | No se manda: se conserva |

Cómo se arma el cuerpo (`propiedad.adapter.ts#cambiosToUpdateInmueble`):

- Se compara **contra la precarga de la pantalla**, no contra la base (decisión del PO): si otra pestaña
  cambió un campo que acá no se tocó, comparar contra la base lo mandaría con el valor viejo y lo pisaría.
- Los dos lados se traducen a la forma del back con las reglas del alta y van solo las claves distintas
  (así piso + depto o el barrio no salen como cambio si no se tocaron).
- `tags`: se comparan como conjunto de ids; si cambió, va la lista completa (`[]` borra todos).
- `fotos`: si cambió la lista, el orden o la principal, va la lista **completa** en el orden final. Las
  guardadas viajan con su `url`, `peso_kb` y `formato` (la precarga los conserva desde `/mis-alquileres`;
  en la base todas tienen peso mayor que 0); las nuevas se suben antes a Storage.
- Si no hay nada para el back, no se llama al `PUT` y la pantalla muestra "No hay cambios para guardar.".
- La precarga toma el precio de `precio_publicado` (antes salía de `contrato.monto_alquiler`, y un precio
  editado habría vuelto con el valor viejo). El depósito se sigue pasando a meses sobre el monto del contrato.

| Status del back | Lo que ve el locador (arriba del formulario) |
|---|---|
| 403 (no es el dueño o no tiene el rol) y 404 (no existe o está dada de baja) | "No encontramos esta propiedad." (mismo mensaje, para no revelar que una propiedad ajena existe) |
| 409 (alquilada) | "No podés editar una propiedad alquilada." Solo llega si la pantalla quedó vieja |
| 400 | El texto del back, sin traducir: los mensajes de la función SQL ya están en español; un error de la base (tipo o clave foránea) llega con el texto de Postgres y no se disfraza |
| 401, 5xx, sin red | Sin traducir |

**Alquilada (`alquilado` o `publicado/alquilado`):** `/editar` muestra el aviso "No podés editar una
propiedad alquilada" ("<dirección> está alquilada a <locatario>. Para editarla, primero tiene que
terminar el contrato.") sin formulario y sin llamar al back, como el aviso de eliminar. El detalle no
ofrece "Editar publicación" ni "Editar fotos", y Mis propiedades saca "Editar" del menú.

**Probado en modo mock el 11/10** (cuenta del elenco del locador, 1440 px):

| Caso | Resultado |
|---|---|
| Campos | Estado, expensas, interés, días de gracia, medios de pago, índice, frecuencia, depósito y duración deshabilitados; precio editable; sin "Apto profesional" |
| Guardar precio y descripción | "Guardamos los cambios."; el contador vuelve a "Sin cambios" y el elenco guardado tiene los dos valores nuevos |
| Cambio que no llega al back (un espacio al final del piso) | "No hay cambios para guardar."; no se actualiza lo guardado (el contador sigue en 1) |
| Alquilada (Obispo Trejo 1250) | Aviso de bloqueo sin formulario; en el detalle no están `mi-propiedad-editar-button`, `-editar-movil` ni `-editar-fotos` |

**Probado en real el 11/10** (`locador@rentar.com`, `dev:api` local contra la base, 390 y 1440 px,
`feature/conexion-editar`). Con una propiedad de prueba propia, dada de alta desde la app como
pausada (inmueble 25, §9):

| Caso | Cuerpo del `PUT /inmuebles/25` | Resultado |
|---|---|---|
| Precio y descripción | `{"descripcion": "…", "precio_publicado": 320000}` | 200, "Guardamos los cambios.", el contador vuelve a "Sin cambios". En la base: `precio_publicado` 320.000 y la descripción nueva; el contrato 22 **sin tocar** (`monto_alquiler` 300.000, expensas, índice, frecuencia, depósito y duración iguales) |
| Sumar Cochera y Balcón | `{"tags": [2, 4]}` | 200; la precarga vuelve con las dos marcadas |
| Sacar las dos | `{"tags": []}` | 200; en la base, sin filas en `inmueble_x_tag` |
| Fotos: agregar una, marcarla principal y sacar otra | `{"fotos": [3 fotos]}`: las 2 guardadas con su URL, `peso_kb` y `formato`, y la nueva (subida antes a Storage, `POST …/fotos-propiedades/…` 200) con `es_principal: true` | 200. En la base: `foto_inmueble` 79, 80 y 81 (las filas 76 a 78 se reemplazaron), la nueva como principal y con `orden` 3. La foto sacada **sigue en el bucket** (§10, punto 27) |
| Cambio que no llega al back (un espacio al final del piso) | — (ningún `PUT`) | "No hay cambios para guardar."; el contador sigue en 1 |
| Alquilada (inmueble 2) | — (ningún `PUT`) | `/editar`: "No podés editar una propiedad alquilada · Bv. Chacabuco 720, 2A está alquilada a Ana Inquilina. Para editarla, primero tiene que terminar el contrato.", sin formulario. Detalle: sin `mi-propiedad-editar-button`, `-editar-movil` ni `-editar-fotos`. Mis propiedades (390): el menú de la alquilada solo tiene "Ver detalle"; el de la 25, "Ver detalle" y "Editar" |
| Id inexistente (999999) | — | "No encontramos esta propiedad" (no está en `/mis-alquileres`) |
| Campos a 390 | — | Estado y condiciones deshabilitados, precio editable, sin scroll horizontal |

Todos los pedidos llevan `Authorization: Bearer …`. Consola sin errores. No se forzaron el 409
(habría que alquilar la propiedad entre que se abre la pantalla y se guarda), el 404 del `PUT`
(habría que dar de baja la propiedad con la pantalla abierta), el 403 de una propiedad de otro
locador (no se llega al `PUT`: la precarga ya da "No encontramos esta propiedad") ni un 400 del back
(el front valida lo mismo antes); el mapeo está en `errorDeActualizarPropiedad`. La propiedad de
prueba quedó pausada a propósito: no aparece en `/buscar`, así que el punto 25 (precio editado que
no se ve en la búsqueda) se confirmó en la base (`precio_publicado` 320.000 contra `monto_alquiler`
300.000) y en el código, no en pantalla. Capturas en
`Desktop/RentAR/Capturas vistas/Sprint2/implementado/editar-real/`.

Lo que hace el back:

| Qué hace | Detalle |
|---|---|
| `PUT /inmuebles/:id` | Bearer + rol `locador`. El controlador toma el id del usuario del token y llama a `inmueble.service#update(id, idLocador, data)`, que a su vez llama a la función SQL `actualizar_propiedad_completa(p_id_inmueble, p_id_locador, p_data)` (migración `20261010000000_actualizar_propiedad_atomica.sql`): bloquea la fila, valida y actualiza datos, fotos y tags en una sola transacción. |
| Campos editables | `tipo, descripcion, provincia, ciudad, barrio, direccion, numero, piso, m2_totales, m2_cubiertos, ambientes, dormitorios, banos, antiguedad, precio_publicado, fecha_disponible, servicios`. Todos opcionales: la clave que no se envía conserva su valor. |
| Fotos y tags | Si se envía `fotos`, **reemplaza** todas las existentes (3 a 50, con `url`, `formato` y `peso_kb` válidos, una principal como máximo; si ninguna es principal, lo es la primera). Si se envía `tags` (ids), reemplaza los existentes; `[]` los borra. |
| Qué no se puede cambiar | `estado_alquiler` y los datos del contrato (monto, expensas, índice, depósito, etc.): 400. Se sacó `estado_alquiler` de `UpdateInmuebleDTO`. |
| Respuestas | 200 con el inmueble actualizado, 400 id inválido o datos incorrectos, 401 sin sesión, 403 si el inmueble es de otro locador, 404 si no existe o está inactivo, 409 si está `alquilado` o `publicado/alquilado`. |
| Errores de la función SQL | `error.middleware` traduce los `RAISE EXCEPTION` (código `P0001`) a 404, 403, 409 o 400 según el mensaje; los errores de integridad (`23503`) y de conversión (`22P02`) dan 400, y todo lo demás 500 (antes el valor por defecto era 400). |
| Se quitó `inmueble.repository#update` | Era código muerto, reemplazado por `actualizarPropiedadCompleta`. |

| Brecha | Dueño |
|---|---|
| ~~`inmuebles.routes.ts` registra dos veces `router.put("/:id")`~~ **Ya no pasa en `develop` b5acfa7** (revisado el 11/10: hay un solo `router.put`). | — |
| La US-03 no tiene archivo en `Documentación/md/US/` (solo está en el Sprint 0): faltan los criterios de aceptación para confirmar los campos editables y las validaciones. | PO / backend |
| El service valida dueño y estado, y la función SQL lo vuelve a validar (doble chequeo; el de SQL es el que protege ante concurrencia). | — |

### US-04 Eliminar mis propiedades

Cambio del back del 09/10 (`develop` b7ebf48). **Conectado en el front el 09/10** (`feature/vistas`):
`propiedades.service#eliminarPropiedad` llama al `DELETE` y `propiedad.adapter.ts#errorDeEliminarPropiedad`
traduce los errores:

| Status del back | Lo que ve el locador (en el modal) |
|---|---|
| 403 (no es el dueño o no tiene el rol) y 404 (no existe o ya estaba dada de baja) | "No encontramos esta propiedad." (mismo mensaje, para no revelar que una propiedad ajena existe) |
| 409 (alquilada) | "No podés eliminar una propiedad con contrato vigente." |
| 400, 401, 5xx, sin red | Sin traducir (el 400 puede ser un error de la base, §10.4: no se disfraza de "no encontrada") |

El aviso de bloqueo del front ("No podés eliminar una propiedad con contrato vigente", sin llamar al
back) sigue igual: con el puente del detalle, el contrato vigente se deduce de `estado_alquiler`, la
misma regla que usa el back para el 409. El 409 solo llega si la pantalla quedó vieja.

| Qué hace | Detalle |
|---|---|
| `DELETE /inmuebles/:id` | Bearer + rol `locador`. Llama a la función SQL `eliminar_inmueble_logico(p_id_inmueble, p_id_locador)` (migración `20261009000000_us04_eliminacion_logica_inmueble.sql`), que bloquea la fila, valida y actualiza en una sola transacción. |
| Baja lógica | El inmueble queda `activo = false` y sus contratos `estado = 3` (finalizado) y `activo = false`. No se borra ninguna fila (fotos, tags y reclamos se conservan). |
| Regla de negocio | **Confirmada por backend (Camila) el 09/10: una propiedad se puede eliminar siempre que NO esté alquilada.** En el código: `alquilado` o `publicado/alquilado` da 409 "No se puede eliminar un inmueble que está alquilado."; `publicado` y `pausado` se eliminan; cualquier otro valor da 409 "El estado del inmueble no permite eliminarlo." (ver §10, punto 23). |
| Estados en la base (09/10) | `inmueble.estado_alquiler` es `varchar` sin CHECK ni enum. Valores: `publicado`, `pausado`, `alquilado` y `publicado/alquilado` (los cuatro que acepta el alta). `contrato.estado`: 1 disponible, 2 vigente, 3 finalizado. |
| El front frente a la regla | El aviso de bloqueo sale de `activeContract`, que el puente del detalle deduce de `estado_alquiler` (`alquilado` o `publicado/alquilado`): **bloquea exactamente lo alquilado, ni más ni menos**, para los cuatro valores de la base. Solo difiere con un valor fuera de esos cuatro (§10, punto 23). |
| Respuestas | 200 éxito, 400 id inválido, 401 sin sesión, 403 si el inmueble es de otro locador, 404 si no existe o ya estaba inactivo, 409 por el estado. El front las trata según la sección 6 (el 409 es `conflict`). |
| Qué ocultan los listados | Con `activo = false` el inmueble sale de `/inmuebles/disponibles`, del detalle público, de `/mis-alquileres` y de los barrios del locador; y `/inmuebles/disponibles` también descarta inmuebles con contrato inactivo o finalizado. |

| Brecha | Dueño |
|---|---|
| ~~Faltaba la columna `activo`~~ **Resuelto (09/10):** la migración `20261009000000_us04_eliminacion_logica_inmueble.sql` ahora agrega `activo BOOLEAN NOT NULL DEFAULT TRUE` a `inmueble` y a `contrato` (con `IF NOT EXISTS`). En la base real las columnas se crearon a mano en el SQL Editor y se verificó con `information_schema.columns`. | — |
| ~~Un inmueble dado de baja se podía leer y editar~~ **Resuelto (09/10, sin probar):** `inmueble.repository#findById`, `findAll` y `contrato.repository#findByInmuebleId` filtran por `activo`, y `inmueble.service#update` responde 404 si el inmueble no existe o está inactivo. **Resuelto (10/10, `develop` b5acfa7):** `PUT /inmuebles/:id` ahora exige rol `locador` y valida que el inmueble sea del que lo edita (403). | backend |
| ~~El comentario Swagger de `DELETE /inmuebles/:id` tenía el formato roto~~ En `develop` b7ebf48 el bloque `@openapi` está bien formado (revisado el 09/10). | — |
| **El bloqueo no mira el contrato vigente** (`contrato.estado = 2`), solo `estado_alquiler`. Ver §10, punto 17. | backend |
| **No cancela solicitudes ni avisa por mail** (el módulo existe desde el 12/10, pero el `DELETE` no las toca). Ver §10, punto 19, y §7 "US-35 a US-38", brecha 10. | backend |
| **Las fotos quedan en el bucket público** después de la baja. Ver §10, punto 20. | backend / PO |
| La US-04 no tiene archivo en `Documentación/md/US/` (solo está en el Sprint 0): faltan los criterios de aceptación. La regla "no eliminar si está alquilada" la confirmó backend el 09/10 (arriba); falta que el PO la cargue en la US. | PO |

**Probado en real el 09/10** (`locador@rentar.com`, `dev:api` local contra la base, 390 y 1440 px,
`feature/vistas`). Con una propiedad de prueba propia (inmueble 24, §9):

| Caso | Resultado |
|---|---|
| Modal de confirmar | "¿Eliminar Calle de Prueba Eliminar 999?", sin texto de solicitudes (en real no hay módulo) |
| Confirmar | `DELETE /inmuebles/24` → 200 con `Authorization: Bearer`; vuelve a Mis propiedades con "Eliminaste Calle de Prueba Eliminar 999." y la lista pasa de 12 a 11 filas. En la base: `activo = false` y el contrato 21 con `estado = 3`, `activo = false` |
| Confirmar con la pantalla vieja (otra pestaña) | `DELETE` → 404 "Inmueble no encontrado."; el modal muestra "No encontramos esta propiedad." |
| `/panel/propiedades/24` y `/propiedad/24` después | "No encontramos esta propiedad" y "Esta publicación ya no está disponible" (404 del back) |
| Alquilada (inmueble 2, de `locador@rentar.com`) | Aviso de bloqueo ("…está alquilada a Ana Inquilina…"), sin ningún `DELETE` |
| Modo mock | Igual que antes: el modal avisa "La solicitud de esta propiedad se va a cancelar…" y elimina |
| 409 | No se forzó (habría que alquilar una propiedad entre que se abre la pantalla y se confirma); el mapeo está en `errorDeEliminarPropiedad` |

Consola: solo 404 esperados (el `DELETE` repetido, `/disponibles/24`, `/solicitudes/mias`, que no
existe, y `favicon.ico`). Capturas en `Desktop/RentAR/Capturas vistas/Sprint2/implementado/eliminar-real/`.

### US-01 Registrar mis propiedades

| Brecha | Dueño |
|---|---|
| ~~`POST /inmuebles` exigía `requireRole("locador")`~~ **Resuelto (29/09, d88deca):** acepta a cualquier usuario con sesión. | — |
| ~~Asignar el rol locador al crear la primera propiedad~~ **Resuelto (29/09, d88deca):** lo hace `registrar_propiedad_completa`, en la misma transacción del alta. | — |
| **Expansión de roles en `/usuarios/me`:** para las cuentas nuevas no hace falta: el registro guarda la fila de locatario y al publicar se suma la de locador, así que `/me` devuelve las dos (en ese orden, `["locatario", "locador"]`; el front no depende del orden). Queda para las cuentas locadoras viejas que no tienen la fila de locatario (ej. `locador@rentar.com`): `/me` les devuelve solo `["locador"]`. | backend / db |
| ~~Faltaba la política de SELECT para borrar las fotos de un alta que falla~~ **Resuelto (30/09):** aplicada (sección 8). | — |
| Medios de pago: el front tiene transferencia, MercadoPago débito, MercadoPago crédito y efectivo, cada uno con recargo (0 a 3 %); la base tiene 4 sin recargo. Los dos de MercadoPago van al mismo id (3) y **el recargo se pierde**. | db (a la planning) |
| `frecuencia_ajuste` es texto ("Semestral"); el front la maneja en meses. Se manda el nombre ("Mensual", "Trimestral", "Semestral", "Anual"…) o "N meses". | db |
| `deposito` es un monto; el front lo pide en meses. Se manda meses × precio. | db |
| El tag "Apto profesional" no existe: el alta lo descartaba sin avisar. Desde el 11/10 el alta y la edición no lo ofrecen (§10, punto 28). | db |
| El back tiene un solo campo `piso`: piso y departamento viajan juntos ("3° B"). | db |
| "Pausada" la acepta la validación del back y la base no la restringe (se guardaría `pausado`); hoy la base solo usa `publicado` y `alquilado`. | — (informativo) |

### US-41 Consultar detalle de propiedad (Sprint 2, `/propiedad/[id]`)

El front usa `GET /inmuebles/disponibles/:id` (existe; conectado y revisado contra la base real el
09/10). Lo que le falta lo cubre el adaptador (`propiedad.adapter.ts#inmuebleDetalleToPropiedadDetalle`)
sin inventar datos: la sección que no tiene datos no se muestra. Con sesión, el pedido lleva
`Authorization: Bearer …` (la ruta hoy lo ignora).

NOTA: el back no tiene un detalle del dueño aparte. El dueño que abre su publicación en
`/propiedad/[id]` ve lo mismo que cualquier usuario con sesión, y una suya pausada o alquilada sin
fecha le da 404; su detalle completo está en `/panel/propiedades/[id]`.

| Brecha | Dueño |
|---|---|
| **Dueño:** no trae el locador (id y nombre). La tarjeta del dueño va sin nombre ("el dueño") y el front no puede saber si la publicación es propia (para no ofrecer "Solicitar alquiler" a su dueño). Sumar `locador: { id, nombre, apellido }`. Sin teléfono ni email: el contacto se habilita al aceptar la solicitud. | backend |
| **Estado:** no trae `estado_alquiler`. Hoy se deduce (con `fecha_disponible` → alquilada/publicada) y una alquilada sin fecha o pausada responde 404. Decidir si el detalle responde esas con su estado (el diseño muestra "Ya no está disponible") o se queda el 404. | backend / PO |
| **Condiciones del contrato:** faltan `duracion_meses`, `frecuencia_ajuste` y `deposito` (hoy solo viene `indice_ajuste`). Sin ellas, "Condiciones del contrato" no se muestra. | backend |
| **Medios de pago:** faltan los del contrato (`medio_pago_x_contrato`). Sin ellos, "Cómo se paga" no se muestra. | backend |
| ~~**"Ya la solicité"**~~ **Conectado (13/10, tanda 5):** el botón usa `GET /solicitudes/mias?inmueble=:id`. Sigue como alternativa más barata que el detalle devuelva `mi_solicitud` cuando llega con token. | backend |
| **`-1` o `null` en `precio` y `expensas`:** desde el 29/09 manda `null` sin contrato; el adaptador también acepta el `-1` viejo. Confirmar que ya no se manda `-1`. | backend |
| No hay fecha de publicación (el diseño dice "Publicada hace 6 días"). | db |
| **Dirección exacta sin token:** la ruta es pública y manda `direccion`, `numero` y `piso` a cualquiera. El adaptador la recorta sin sesión ("Av. Colón al 1500"), pero es solo cosmético (`api-endpoints.md`, observación 🔴). Sin token, mandar calle y cuadra, nunca la altura ni el piso. | backend |
| `fotos` sale con `select *` (`id_inmueble`, `peso_kb`, `formato`), que el detalle público no necesita. `servicio` tampoco se muestra (US-41 no lo pide). | backend |

### US-35 a US-38 Solicitudes de alquiler (Sprint 2; conectadas en la tanda 5, 13/10)

El módulo está en `develop` desde el 12/10 (Thiago: f003e3a, 26fbd25, fae15e7, 46ac7c5 y 0060e0a).
El front lo usa desde `feature/conexion-solicitudes`: `services/solicitudes.service.ts` (rama
real), `services/adapters/solicitud.adapter.ts` (DTOs, vistas y errores traducidos) y
`services/shared/backend-dtos.ts` (copia de `apps/api/src/dtos/solicitud.dto.ts`). Lo que el back
todavía no hace se apaga en real con constantes del service (`avisaPorMail`, `puedeCancelarAceptada`,
`muestraCanceladas`, todas `= USE_MOCKS`); ninguna pantalla lee `USE_MOCKS`.

**Brechas del back (13/10).** Archivo y línea en `develop` 0060e0a (la 17, en el front de `feature/conexion-solicitudes`).

| # | Brecha | Dónde | Qué hace el front mientras tanto | Dueño |
|---|---|---|---|---|
| 1 | **El locador no puede cancelar una aceptada (US-38).** `PATCH /:id/cancelar` solo acepta al postulante (`solicitud.id_locatario !== user.id` → 404) y solo desde `pendiente`. | `apps/api/src/services/solicitud.service.ts:317` y `:321` | En real se oculta "Cancelar solicitud"; el detalle del postulante dice "Por ahora no se puede dar de baja una solicitud aceptada." y los textos que prometían la baja no la nombran (`puedeCancelarAceptada`). Decisión del PO, tanda 5. | backend |
| 2 | **Aceptar no controla "una sola aceptada por inmueble"** (decisión del PO, tanda 2) **ni cambia el estado del inmueble.** | `apps/api/src/services/solicitud.service.ts:282` (`aceptarSolicitud` → `cambiarEstadoPorLocador`, `:334`) | El front mantiene el bloqueo ("Aceptar" deshabilitado si hay otra aceptada). Solo en real, el modal de aceptar avisa: "Una vez aceptada, por ahora no vas a poder darla de baja ni aceptar a otro postulante para esta propiedad." | backend |
| 3 | **Las canceladas no se devuelven nunca:** `/mias` y `/recibidas` filtran `neq('id_estado_solicitud', 4)`, también con `?estado=cancelada` (siempre vacío). | `apps/api/src/repositories/solicitud.repository.ts:121` y `:159` | En "Cerradas": "Las solicitudes canceladas todavía no se muestran." Una cancelada en la visita queda en pantalla hasta recargar (`muestraCanceladas`). | backend |
| 4 | **`/mias` (y las respuestas de los `PATCH` y del `POST`) mandan el DNI, el teléfono, el email y el legajo** del propio usuario. Habíamos propuesto que no. | `apps/api/src/repositories/solicitud.repository.ts:432` a `:446` (`findByIdWithRelations`, la usan todas las rutas) | El adaptador los descarta salvo en el detalle del postulante (vista `'locador-detalle'`). No se guardan ni se loguean. | backend |
| 5 | **No hay `GET /solicitudes/:id`.** | `apps/api/src/routes/v1/solicitudes.routes.ts` | Puente: `getSolicitudRecibida(id, propertyId)` pide `GET /recibidas?inmueble=:propertyId` y busca el id. La lista ya no trae datos sensibles; el detalle los pide aparte. | backend |
| 6 | **No se mandan los mails** de US-35 (al locador, al crear), US-37 (al locatario, al aceptar) ni US-38 (al locatario, al cancelar una aceptada). | `apps/api/src/services/solicitud.service.ts` (`create`, `aceptarSolicitud`, `cancelarSolicitud`) | En real no se dice "Le avisamos por mail…" (`avisaPorMail`); el éxito del envío dice "Vas a ver su respuesta en Mis solicitudes." | backend |
| 7 | **El teléfono vuelve sin el "+"**: se guarda solo con dígitos (migración `20261012000002`) y así sale en `postulante.telefono` y en `/preparar`. | `apps/api/src/services/solicitud.service.ts:225`; `apps/api/src/repositories/solicitud.repository.ts:435` | El adaptador le agrega el "+" (E.164) antes de mostrarlo en E.123. | backend |
| 8 | **`POST /solicitudes` no valida que la propiedad esté publicada** (solo lo hace `/preparar`) **ni las garantías exigidas**. | `apps/api/src/services/solicitud.service.ts:110` (`create`; compará con `:47`) | El modal llama antes a `/preparar`, que sí responde 409 "ya no recibe solicitudes". Un `POST` directo a una pausada o alquilada pasa. | backend |
| 9 | **`/preparar` no detecta una solicitud duplicada**: el 409 llega recién al enviar. | `apps/api/src/services/solicitud.service.ts:29` (`prepare`) | El botón del detalle ya muestra "Ya la solicitaste" con `/mias?inmueble=`; si se escapa, el modal explica el 409 del envío. | backend |
| 10 | **`DELETE /inmuebles/:id` no cancela las solicitudes** del inmueble, y siguen apareciendo en `/mias` y `/recibidas`. | `apps/api/src/services/inmueble.service.ts:236` | Como hoy: `contarSolicitudesQueSeCancelan` devuelve 0 en real y el modal de eliminar no promete nada (decisión del PO, tanda 5; va al issue de back). | backend |
| 11 | **Mensajes en tuteo o técnicos:** "No puedes solicitar una propiedad propia." (`:44`, `:125`), "Debe iniciar sesión…" (`:34`, `:115`…), "No se encontró el perfil del usuario autenticado." (401, `:58`). | `apps/api/src/services/solicitud.service.ts` | El adaptador los reemplaza: los 400 que repiten una regla del front, por `MENSAJES_SOLICITUD`; el resto, por los mensajes del front o el genérico. | backend |
| 12 | **Un 5xx expone el texto crudo de Supabase/Postgres** en `error` (el middleware devuelve `err.message`). | `apps/api/src/gateway/middlewares/error.middleware.ts:11` y `:46` | El adaptador muestra "Ocurrió un error inesperado. Probá de nuevo." | backend |
| 13 | **`/mias` y `/recibidas` hacen 6 consultas por fila** (N+1: `findByIdWithRelations` por cada solicitud). | `apps/api/src/repositories/solicitud.repository.ts:142`, `:180` y `:373` | Nada (no cambia la pantalla); se nota con muchas solicitudes. | backend |
| 14 | **`estado` es texto libre** (`estado_solicitud.nombre`), no un enum. | `apps/api/src/dtos/solicitud.dto.ts` (`SolicitudResponse.estado`) | El adaptador lo valida: en una lista descarta la fila con `console.warn` (solo id y estado); en una respuesta de un elemento, error `server`. | backend |
| 15 | **`garantias_exigidas` siempre vacío** en `/preparar`: el esquema no guarda las garantías que exige el inmueble. | `apps/api/src/services/solicitud.service.ts:95` | En real ninguna propiedad exige garantías (ya anotado para el Sprint 3, abajo). | db / backend |
| 16 | **En real, el dueño ve "Solicitar alquiler" en su propia propiedad**: `GET /inmuebles/disponibles/:id` no trae `id_locador` (ni el dueño), así que el front no puede saber que es suya (en mock el botón sale deshabilitado, "es tuya"). Visto en el recorrido real del 13/10 con el usuario 20 sobre el inmueble 8. | `apps/web/src/components/detalle-propiedad/estadoAccion.ts:56` (necesita `propiedad.owner`); `apps/web/src/services/adapters/propiedad.adapter.ts:427` (`owner: null`) | Lo frena el 403 de `/preparar`: el modal muestra "No podés solicitar tu propia publicación." antes del formulario y no se crea nada. No se arregla en esta tanda (decisión del PO). | backend |

**Cómo se resolvió lo que no es brecha (tanda 5)**

| Tema | Detalle |
|---|---|
| Ingresos | El back usa `null` para "no informa" (y convierte un 0 en `null`). El front sigue con 0 = no informa: el adaptador manda `null` y convierte `null` en 0 al leer. |
| 409 por duplicado | Es por inmueble ("Ya tenés una solicitud activa para esta propiedad", pendiente o aceptada). Coincide con `esSolicitudActiva`; se muestra "Ya habías enviado una solicitud para esta propiedad." |
| Precarga del modal | `GET /solicitudes/preparar?id_inmueble=` (`prepararSolicitud`): nombre, apellido y DNI (de solo lectura), teléfono y email (editables, solo para esta solicitud) y garantías exigidas. Su 409 se muestra como "Esta propiedad ya no recibe solicitudes." y su 403 como "No podés solicitar tu propia publicación.", antes del formulario. Resuelve el "`/usuarios/me` no devuelve el teléfono" y el "DNI —" de la tanda 4. |
| Botón del detalle y contador | `GET /mias?inmueble=:id` (la más reciente decide el botón) y `GET /mias?estado=pendiente` (el front excluye la propiedad actual). Como `/mias` no trae canceladas, una cancelada se ve como "Solicitar alquiler": es correcto, porque no bloquea. |
| Detalle del postulante | La lista (`listarSolicitudesRecibidas`) no trae DNI, contacto ni legajo (sí el resumen de la tanda C, abajo); el detalle los pide con `getSolicitudRecibida` (puente de la brecha 5). Después de aceptar o rechazar, la fila se actualiza con la respuesta y el detalle se vuelve a pedir; la lista no se recarga. |
| Panel del locador | `getSolicitudesPendientes` pide `GET /recibidas?estado=pendiente`. |
| Motivo del rechazo (tanda B del testing) | `PATCH /rechazar` con `{ mensaje_rechazo }` solo si el locador escribió un motivo (opcional, ≤ 200, US-37); el 400 por largo se muestra como "El motivo puede tener hasta 200 caracteres.". `SolicitudResponse.mensaje_rechazo` llega a las dos vistas: US-36 lo muestra en los listados truncado a 80 (Mis solicitudes lo despliega con "Ver motivo completo") y completo en el detalle del postulante. En la tanda 5 no se mandaba (se había leído que US-37 no lo pedía). |
| Resumen y tiempo en la lista (tanda C del testing, US-36) | El resumen de cada fila (convivientes, mascotas, garantías y "Declaró ingresos: sí/no") sale del `legajo` que `GET /recibidas` ya manda en cada solicitud: **no hace falta endpoint nuevo**. El adaptador lo arma con `resumenDeLegajo` (`Solicitud.summary`) y descarta el monto y el DNI. Sigue abierta la brecha de que el back los mande igual en la lista (viajan por la red aunque no se muestren). El tiempo de las pendientes ("hace 3 h", "hace 2 días") se calcula con `fecha_creacion` completa (TIMESTAMPTZ; el adaptador no le saca la hora). |

**Pendientes de las tandas anteriores que siguen abiertos**

| Tema | Detalle | Dueño |
|---|---|---|
| **Contradicción de la US: ingresos** | La US dice "un número entero superior a 0" y "por defecto debe ser cero (0)". El front interpreta **0 = no lo informa** (pasa), entero positivo (pasa), negativo o con decimales (falla); al locador le muestra "No informó". Decisión del PO; **Thiago, corregir la redacción de la US**. | PO / Thiago |
| **Interpretación: "garantías exigidas marcadas"** | La US dice "se deben marcar las garantías solicitadas explícitamente por el locador". El front las **señala** ("La pide el dueño" y un aviso arriba del grupo) pero **no las tilda solas**, para que nadie declare sin querer una garantía que no tiene. Alcanza con ofrecer **al menos una** de las exigidas ("propietaria **o** caución"). Si un día una propiedad exige todas, se suma un modo. **Thiago, confirmar.** | PO / Thiago |
| **Pendiente para el Sprint 3: garantías que exige el locador** | El dato no existe en el back ni lo cargan el alta ni la edición (brecha 15). En el front es `requiredGuarantees` (solo el elenco lo trae: Rondeau 480). Toca US-01 y US-03 (campo nuevo en el alta y la edición) y el `POST`/`PUT` de inmuebles. | db / backend / front |
| **Supuesto: "metros cuadrados (reales)"** | Se muestra la **superficie cubierta**; si la propiedad no la tiene, la total, con la etiqueta que corresponda ("m² cubiertos" / "m² totales"). | PO |
| **Decisión del front: detalle de mascotas** | Hasta **300** caracteres, con contador. El back pone el mismo tope. | — |
| **Dirección exacta con sesión** | Con sesión, la exacta en el modal, el detalle, Mis solicitudes y Solicitudes recibidas. Es cosmético mientras `/disponibles` la mande sin token (§10). | backend |
| **Decidido (tanda 2): sin bloqueo de 30 días.** | Solo bloquean una nueva solicitud las `pendiente` o `aceptada`; una `rechazada` o `cancelada` permite volver a solicitar enseguida (el back hace lo mismo). | — |
| Repetir en el back la tabla de transiciones de `lib/validation/solicitud.rules.ts` (`TRANSICIONES_SOLICITUD`) | Hoy el back cubre aceptar, rechazar y la cancelación del postulante; falta la del locador (brecha 1) y la regla de una sola aceptada (brecha 2). | backend |

### `/panel` (inicio del locatario)

Versión mínima del diseño ("Panel de inicio" · 05b): saludo, "Buscar propiedades" y "Publicá tu
propiedad". No pide nada al back (el nombre sale de `/usuarios/me`). El panel completo del
locatario (US-11, US-12) es de otro sprint.

### `/panel` (inicio del locador)

Cobros, reclamos y contratos son módulos de sprints futuros. En modo real esos bloques
se muestran vacíos ("Todavía no hay cobros registrados", etc.), no con error. Los conteos de
propiedades salen del `/mis-alquileres` real, y las solicitudes pendientes, de
`GET /solicitudes/recibidas?estado=pendiente` (tanda 5). Rutas propuestas: [`api-endpoints.md`](api-endpoints.md#panel-del-locador-panel).

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

**Borrado de las fotos de un alta que falla: resuelto (30/09).** Storage exige DELETE **y SELECT**
para `remove()`, y el bucket no tenía SELECT: las fotos quedaban en el bucket, sin error. La política
"ver fotos propias" (SELECT, `authenticated`, solo la carpeta propia) está versionada en
`supabase/migrations/20260930000000_bucket_fotos_select_propias.sql` y **aplicada desde el SQL Editor**
el 30/09. Probado: forzando un error del alta, las 3 fotos subidas se borraron.

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
| Archivos del bucket `fotos-propiedades` | los 6 de `foto_inmueble` 16 a 21 (carpetas de los usuarios 18 y 19). Los 3 huérfanos de la primera prueba del borrado se borraron el 30/09 | `storage.objects` |
| Usuario `nicoartaz+test3009@gmail.com` (QA de `develop` en real, 30/09, `feature/vistas`: registro, login/logout, alta con 3 fotos y pase a locador) | **20**; `usuario_x_rol` **23** (locatario) y **24** (locador) | Supabase Auth, `usuario` y `usuario_x_rol` |
| Inmueble "Calle QA 30-09 1234" (Güemes, usuario 20, publicado) | inmueble **8**; `foto_inmueble` **22, 23 y 24**; `inmueble_x_tag` **8**; `contrato` **8**; `medio_pago_x_contrato` **10** | cada tabla |
| Archivos del bucket `fotos-propiedades` del inmueble 8 | los 3 de `foto_inmueble` 22 a 24 (carpeta `6ac3e808-…`, del usuario 20) | `storage.objects` |
| Inmueble "[TEST] Carga de prueba de feature/conexion-back" | inmueble **4** | `inmueble` |
| Sus filas asociadas | `inmueble_x_tag` **5 y 6**; `foto_inmueble` **10, 11 y 12**; `contrato` **4**; `medio_pago_x_contrato` **5 y 6** | cada tabla |
| Inmuebles con datos que no son verosímiles (vistos en la prueba de la landing, 06/10): **17** ($ 1.000.000.000 por mes, 10 m²) y **13** (PH de 20 ambientes y 15 dormitorios, dirección "bispo Trejo al 1200"). Corregir o borrar | inmuebles **13 y 17** | `inmueble`, `contrato` y asociadas |
| Fotos repetidas de personas reales: la misma foto (carpeta `3e12c119-…`) es la principal de los inmuebles **12, 13, 15, 16 y 17**. El repo es público y la landing las muestra: reemplazarlas por fotos de ambientes | `foto_inmueble` de esos 5 inmuebles | `foto_inmueble` y `storage.objects` |
| Inmueble "[TEST] Prueba de eliminar (US-04, 09/10) - no usar" ("Calle de Prueba Eliminar 999", Güemes, monoambiente, `locador@rentar.com`). **Ya eliminado (baja lógica, `activo = false`)** en el recorrido de US-04 | inmueble **24**; `foto_inmueble` **70, 71 y 72**; `contrato` **21** (`estado = 3`, `activo = false`); `medio_pago_x_contrato` **38**; sin tags | cada tabla |
| Archivos del bucket `fotos-propiedades` del inmueble 24: 3 PNG grises de 1×1 px (67 bytes), sin nada identificable. Siguen públicos después de la baja (§10, punto 20) | `3e12c119-0702-46ec-a9a2-597c2f5c884f/3a0620ed-b680-412d-bf4a-560df0d8c48c.png`, `3e12c119-0702-46ec-a9a2-597c2f5c884f/032451de-b9a9-4d97-a2ce-3a24a3883570.png` y `3e12c119-0702-46ec-a9a2-597c2f5c884f/178df7bc-bfcf-4b76-a186-69e0898f4992.png` | `storage.objects` |
| Inmueble "[TEST] Prueba de editar (US-03, 11/10) - no usar" ("Calle de Prueba Editar 777, 2° A", Güemes, departamento, **pausado**, `locador@rentar.com`). Editado en el recorrido de US-03: precio 320.000 (el contrato quedó en 300.000), sin tags | inmueble **25**; `foto_inmueble` **79, 80 y 81** (las 76 a 78 las reemplazó el `PUT`); `contrato` **22**; `medio_pago_x_contrato` **39** | cada tabla |
| Archivos del bucket `fotos-propiedades` del inmueble 25: 4 PNG de color liso de 64×48 px, sin nada identificable. Uno (`8b74d05b-…`) ya no está en `foto_inmueble`: se sacó en la edición y quedó en el bucket (§10, punto 27) | `3e12c119-0702-46ec-a9a2-597c2f5c884f/c6d06f89-6e92-45ef-be07-991e923a4299.png`, `…/1800e362-9907-4700-800b-9973d62b8d4e.png`, `…/8fac0b62-1476-41f3-aa21-61a62c43fa36.png` y `…/8b74d05b-db0e-43af-b924-388002d47a2d.png` | `storage.objects` |
| Solicitud **4** (A): usuario **12** sobre el inmueble **8**, **cancelada** por el postulante. Mensaje "[TEST tanda 5] Solicitud A del usuario 16 - borrar". Recorrido real de la tanda 5 (13/10, `feature/conexion-solicitudes`) | `solicitud` **4** (sin filas en `solicitud_x_garantia`) | `solicitud` |
| Solicitud **5** (B): usuario **12** sobre el inmueble **8**, **aceptada** por el locador (usuario 20). Mensaje "[TEST tanda 5] Solicitud B del usuario 16 - borrar". **Deja el inmueble 8 con una aceptada que no se puede dar de baja** (§7, "US-35 a US-38", brechas 1 y 2): el equipo ya está avisado | `solicitud` **5** (sin filas en `solicitud_x_garantia`) | `solicitud` |
| Solicitud **6** (C): usuario **16** sobre el inmueble **8**, **rechazada** por el locador (usuario 20). Mensaje "[TEST tanda 5] Solicitud C del usuario 12 - borrar" | `solicitud` **6** (sin filas en `solicitud_x_garantia`) | `solicitud` |
| Solicitud **21** (tanda B, A): usuario **16** sobre el inmueble **8**, **rechazada sin motivo** por el locador (usuario 20); el `PATCH` salió sin cuerpo y `mensaje_rechazo` quedó `null`. Mensaje "[TEST tanda B] Solicitud A del usuario 16 - borrar". Recorrido real de la tanda B del testing (16/10, `feature/fix-testing-s2-b`). NOTA: hasta este día la tabla tenía cruzados los usuarios de las solicitudes 4, 5 y 6 (se corrigió mirando la base: 4 y 5 son del usuario 12 y 6 del 16; el texto de sus mensajes conserva el número equivocado) | `solicitud` **21** (sin filas en `solicitud_x_garantia`) | `solicitud` |
| Solicitud **22** (tanda B, B): usuario **16** sobre el inmueble **8**, **rechazada con un motivo de 81 caracteres** por el locador (usuario 20): "Gracias por tu interés. Elegimos a otra persona que podía mudarse antes de princi". Mensaje "[TEST tanda B] Solicitud B del usuario 16 - borrar" | `solicitud` **22** (sin filas en `solicitud_x_garantia`) | `solicitud` |

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
4. ~~**El manejador de errores responde 400 por defecto**~~ **Cambiado el 10/10 (`develop` b5acfa7):**
   el default pasó a 500, pero sin ponerles antes el status a los `throw new Error(...)` de los
   services, que era lo que pedía este punto. Ver el punto 24. El texto de `error` se sigue
   mostrando tal cual: tiene que estar en español.
5. **Lockfile (resuelto en esta rama):** `package-lock.json` traía solo `@esbuild/linux-x64` y
   `dev:api` no arrancaba en Windows; se rearmó con los binarios de todas las plataformas (tsx pasó
   de 4.23.13 a 4.23.15, patch). También quedó una sola copia de Next (16.3.5) y de `react-dom`.
6. **`supabase/.temp/` está commiteada** (`project-ref`, `pooler-url`, versiones): sumarla al
   `.gitignore`.
7. **`.gitignore` no ignora `apps/api/node_modules`** (hoy no hay nada trackeado ahí, pero ya pasó
   una vez).
8. ~~**El `package.json` raíz vuelve a declarar dependencias**~~ **Resuelto (06/10, en
   `feature/nuevo-landing`, a pedido de Thiago; commit 16f6bbc).** El raíz declaraba `next ^16.3.6`,
   `@supabase/ssr` y `@supabase/server` (041bea0 y ead9eb8) sin actualizar el lock: `npm ci` fallaba
   y un `npm install` traía Next 16.4.0 además de 16.3.5. Además, en la raíz convivían `react`
   19.3.0 y `react-dom` 19.2.8 (500 en `/propiedad/[id]` con `next dev`). Se sacaron las tres del
   raíz (cada paquete declara lo que usa; `@supabase/server` no lo importa nadie) y se fijaron
   `react` y `react-dom` en 19.2.8 con `overrides`. **Después de traer el cambio: borrar
   `node_modules` y correr `npm ci`.**

9. ~~**🔴 Crítico · `PUT /inmuebles/:id` no chequea que el inmueble sea del que llama**~~ **Resuelto
   (10/10, `develop` b5acfa7):** el service y la función SQL `actualizar_propiedad_completa` validan
   el dueño (403) y la función actualiza solo columnas editables (ya no pasa el body a `.update()`).
10. **🔴 Alto · `GET /inmuebles` está abierto** (sin token) y devuelve todos los inmuebles con la
    dirección exacta y el `id_locador`. El front no la usa: sacarla o protegerla con rol administrador.
11. ~~**`DELETE /inmuebles/:id` borra en duro y en cascada**~~ **Resuelto en parte (09/10, b7ebf48):**
    es una baja lógica y valida el dueño. Sigue sin mirar el contrato vigente, sin cancelar solicitudes
    y sin limpiar Storage (puntos 17 a 20).
12. ~~**🟡 Bajo · 400 en lugar de 404** en `PUT`~~ **Resuelto (10/10, `develop` b5acfa7):** el service
    responde 404 si el inmueble no existe o está inactivo.
13. ~~**🟠 Fotos huérfanas en el bucket al editar**~~ **Resuelto en parte (10/10):** el `PUT` ya guarda
    las fotos, así que las nuevas quedan referenciadas (si el `PUT` falla, el front las borra). Las que
    se **sacan** en una edición siguen en el bucket: punto 27.

14. **🔴 Alto · `GET /inmuebles/disponibles` y `/disponibles/:id` devuelven calle, altura y piso sin
    token.** La regla de producto (US-35 actualizada) es que un visitante sin sesión vea la dirección
    aproximada; el front la esconde, pero el dato viaja igual en la respuesta pública. Sin token,
    mandar la calle y la cuadra, nunca el piso.
15. **🟠 Medio · El registro (US-19) pide el DNI, pero la tabla `usuario` no lo guarda** (no hay
    columna). La US-35 actualizada lo muestra en la solicitud y al locador: con el back real va "—".
    Sumar la columna y devolverla en `/usuarios/me` (junto con el `telefono`, que sí se guarda pero
    `/me` no lo devuelve).

16. **🔴 Alto · Contraseña de prueba expuesta en el repo (dueño: testing).** El test de Selenium
    `Tests_Selenium/Sprint 1/US-02 Consultar mis propiedades.side` (commit del 30/09, ya en
    `develop`) guarda en texto plano la contraseña real de una cuenta de prueba del back. Cambiar esa
    contraseña en Supabase Auth, sacarla del `.side` (Selenium IDE la puede leer de una variable o
    pedirla al correr) y tenerla en cuenta en el historial de git. Anotado el 09/10, al conectar el
    detalle.

17. **🟠 Medio · `DELETE /inmuebles/:id` bloquea por `estado_alquiler`, no por contrato vigente**
    (`eliminar_inmueble_logico`). Un inmueble `publicado` o `pausado` con un contrato en estado 2
    (dato inconsistente, pero posible) se elimina y **su contrato vigente queda finalizado sin aviso**.
    Al revés, uno `publicado/alquilado` con el contrato "disponible" (inmueble 13) no se puede
    eliminar. Propuesta: 409 si existe un contrato con `estado = 2`, además del estado. Para Camila.
18. **🟡 Bajo · 403 para un inmueble ajeno, chequeado antes de ver si está inactivo:** con distintos
    ids se puede saber cuáles existen (403) y cuáles no (404). Propuesta: 404 en los tres casos (no
    existe, ya dado de baja, de otro), como pide el front. El front ya los muestra igual. Para Camila.
19. **🟠 Medio · No cancela las solicitudes del inmueble ni avisa a los postulantes** (decisión del
    PO, §7). Queda para cuando exista el módulo de solicitudes. Para Camila.
20. **🟠 Medio · Fotos en el bucket público después de la baja:** las filas de `foto_inmueble` se
    conservan (es lógica) y los archivos siguen en `fotos-propiedades`, con sus URLs públicas
    abriendo. Decidir si se borran, se mueven o se deja el bucket privado. Para Camila / PO.
21. **🟡 Bajo · Inactiva también los contratos históricos:** todos los del inmueble pasan a
    `estado = 3` y `activo = false`, y las lecturas filtran por `activo`: el historial no se borra,
    pero queda oculto. Confirmar con el PO ("se conservan contratos y reclamos"). Para Camila.
22. **🟡 Bajo · Detalles del `DELETE`:** un error de la RPC caía al 400 por defecto (punto 4; desde el
    10/10, al 500, salvo los `P0001`, que van a 400); el
    `if (!eliminado) 404` del controller nunca se ejecuta (el service tira o devuelve `true`); el 403
    por rol tiene un texto técnico ("Acceso denegado: Se requiere el rol 'locador'…"). Para Camila.

23. **🟡 Bajo · Un `estado_alquiler` fuera de los cuatro conocidos se bloquea con 409.** La regla
    confirmada es "se elimina siempre que no esté alquilada", pero `eliminar_inmueble_logico` rechaza
    cualquier valor que no sea `publicado` ni `pausado` ("El estado del inmueble no permite
    eliminarlo."). Hoy no hay ninguno en la base, pero la columna es `varchar` sin CHECK y el `PUT`
    no valida `estado_alquiler`, así que puede aparecer. En ese caso el front (que lo trata como no
    alquilado) dejaría confirmar y mostraría el 409 como "No podés eliminar una propiedad con
    contrato vigente.", que no es la causa. Propuesta: un CHECK con los cuatro valores (o un enum) y
    validar el estado en el `PUT`. Además, con `estado_alquiler` en `NULL` la función lo deja
    eliminar (`NOT IN` con `NULL` no entra al `IF`). No se corrigió en el front. Para Camila.

**Anotados al conectar `PUT /inmuebles/:id` (US-03, 11/10). Para Camila, en orden de prioridad:**

24. **🔴 Alto · El default 500 de `error.middleware` cambia el código de las validaciones del alta
    (US-01).** Los 23 `throw new Error(...)` de `inmueble.service` sin `statusCode` (por ejemplo,
    "Se deben cargar al menos tres fotos de la propiedad.", "Las fotos no deben superar los 350kb
    de peso.") antes salían como 400 y ahora salen como **500**. Qué pasa en el front (revisado en
    el código, sin cambios): el `apiClient` toma igual el texto de `error`, así que el formulario de
    publicar muestra "No pudimos publicarla · <texto del back> Tus datos siguen acá: no perdiste
    nada.", pero el error queda como `server` en vez de `validation`, y **el alta ofrece "Intentar de
    nuevo" en errores que van a volver a fallar** (son datos inválidos, no una caída). Casi no se ve
    porque el front valida lo mismo antes de mandar. Propuesta: ponerles `statusCode: 400` a esas
    validaciones (o una clase `ValidationError`). También un NOT NULL de la base (`23502`) sale
    como 500. No se corrigió en el front.
25. **🔴 Alto · El precio editado no se ve en la búsqueda.** Es lo único de la edición que ven los
    inquilinos: el precio viejo en `/buscar` y el filtro por precio sobre el valor equivocado. El `PUT` cambia `precio_publicado`, pero
    `/inmuebles/disponibles` (y su filtro de precio) y `/inmuebles/disponibles/:id` muestran
    `contrato.monto_alquiler` (`inmueble.service`, `precio: contrato?.monto_alquiler ?? …`). Un
    locador edita el precio en `/editar`, lo ve en Mis propiedades y en su detalle, y `/buscar` y el
    detalle público siguen con el viejo. Propuesta: que el `PUT` actualice también el monto del
    contrato cuando no hay uno vigente, o que las vistas públicas lean `precio_publicado`.
26. **🟡 Bajo · Línea suelta en la migración.** `supabase/migrations/20261010000000_actualizar_propiedad_atomica.sql`
    empieza con una línea `sql` (resto de un bloque de código): `supabase db push` falla. En la base la
    función está aplicada (se cargó a mano). Borrar esa línea.
27. **🟠 Medio · Fotos sacadas en una edición quedan en el bucket.** El `PUT` reemplaza las filas de
    `foto_inmueble`, pero los archivos que dejaron de estar en la lista siguen en `fotos-propiedades`,
    con su URL pública. El front no los borra (decisión del PO). Definir quién los borra (el back
    después del `PUT`, o un proceso de limpieza), junto con el punto 20.
28. **🟡 Bajo · Falta crear el tag "Apto profesional"** en `tags_inmueble` (`TODO(db)`). Hasta ahora el
    alta real lo descartaba sin avisar; desde el 11/10 el alta y la edición no lo ofrecen
    (`lib/catalogs/characteristics.ts#characteristicOptionsCarga`). Cuando exista, sumar su id en
    `propiedad.adapter.ts#CHARACTERISTIC_BY_TAG_ID` y volver a ofrecerlo.
29. **PO · Ninguna US cubre editar las condiciones de una publicación** (precio del contrato, expensas,
    plazo, índice, medios de pago, días de gracia, depósito). La US-06 es para el contrato de una
    solicitud aceptada, no para la publicación. Hoy esos datos se cargan en el alta y no se pueden
    cambiar después.

Los puntos 9 a 12 y 14 tienen un texto de issue para GitHub (lo abre el PO).

### Pendientes del front anotados en el QA de `develop` (30/09)

No se arreglaron en el PR del QA; quedan anotados para cuando toque:

1. **Bloqueo por rol de las páginas del locador.** Hoy solo `/panel/propiedades` y
   `/panel/propiedades/[id]` están envueltas en `RequireRole role="locador"` (y, desde el Sprint 2,
   `/panel/solicitudes` y `/panel/propiedades/[id]/editar`). Contratos,
   Cobros, Reclamos, Mensajes, Reportes y Suscripción son placeholders sin bloqueo: un locatario no
   las ve en el menú (`navConfig.tsx`), pero entra si escribe la URL. Cuando cada una se implemente,
   envolverla en `RequireRole` (y que el back responda 403 a un locatario, ver §6), salvo las que
   también sean del locatario (Contratos, Cobros, Reclamos y Mensajes lo van a ser con su panel).
2. **Doble "Publicar propiedad" en Mis propiedades.** En escritorio aparece en el encabezado del
   panel (`AppShell#headerAction`, regla de roles del 27/09) y otra vez en el `PageHeader` de la
   pantalla (`mis-propiedades-publicar`); en móvil, además del menú, está el CTA fijo de abajo
   (`mis-propiedades-publicar-movil`). Lo decide el PO con el diseño: no se tocó.
3. **Accesibilidad (menor): las flechitas de los `InputNumber` dicen "Increase Value" / "Decrease
   Value".** Es el `aria-label` de los botones de subir y bajar (por ejemplo, Antigüedad y Superficie
   en el alta). Está fijo en inglés en `@rc-component/input-number` (`StepHandler.js`): no pasa por
   el locale `es_ES` ni hay una prop para cambiarlo. El PO decidió dejarlas como están (30/09).
   Revisarlo cuando se actualice antd, por si una versión futura lo expone en el locale o como prop.
4. **Datos sensibles en `localStorage` en modo mock (Sprint 3, anotado; no se arregla en esta
   tanda).** En mock, el registro (US-19) guarda la cuenta nueva con el **DNI y la contraseña** en
   `rentar:mock:usuarios`, y las solicitudes (US-35) guardan el legajo con los **ingresos** en
   `rentar:mock:solicitudes`. El perfil (US-21) ya no suma datos sensibles: el DNI y el ingreso que
   se editan ahí viven solo en memoria (`services/perfil.service.ts`). La contraseña que se cambia
   en el perfil sí va a `rentar:mock:usuarios`, igual que la del registro (para poder entrar con la
   nueva). En modo real no se guarda nada de esto en el navegador.

## 11. Numeración de las User Stories

En todo el código y los docs se usa la numeración del Sprint 0
(`Documentación/md/Estudio Inicial/Sprint 0.md`). El Mapa de pantallas y Claude Design usan otra.
Equivalencias:

| Mapa de diseño | Sprint 0 / Jira |
|---|---|
| US-01, US-02, US-04, US-19, US-34 | iguales |
| US-35 Consultar detalle de publicación | **US-41** Consultar detalle de propiedad (Jira, Sprint 2; no está en el Sprint 0) |
| US-36 Solicitar alquiler | **US-35** Enviar solicitud de alquiler |
| US-37 / US-38 Solicitudes recibidas (consultar, aceptar o rechazar) | **US-36 / US-37** |
| US-39 Mis solicitudes / cancelar | **US-36 / US-38** |
| US-40 Publicar o pausar propiedad | sin US en Sprint 0 |
| US-42 Iniciar y cerrar sesión | **US-39** |
| US-43 Recuperar contraseña | **US-40** |
| US-44 y US-45 (administración de usuarios) | sin US en Sprint 0 |

Desde el Sprint 2, el código y los docs usan la numeración de Jira (`Documentación/md/US/`), que
coincide con la del Sprint 0 y suma las US nuevas (US-41). Cuando algo no tiene US, el código lo
dice así: "sin US en Sprint 0 (mapa US-xx)".

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
| Header y landing | Sin sesión: `header-login-button`, `header-publish-button`, `header-drawer-login-button`, `header-drawer-publish-button`. Con sesión (29/09): `header-panel-button`, `header-user-menu` (adentro, `user-menu-item-panel`, `user-menu-item-publicar`, `user-menu-item-perfil` y `user-menu-logout`), `header-drawer-panel`, `header-drawer-publish-button`, `header-drawer-logout`; mientras se confirma la sesión, `header-session-pending`. Con sesión NO están `header-login-button`, `header-publish-button` ni `header-drawer-login-button`. Siempre: `header-menu-toggle` |
| Landing (`/`) | Buscador: `landing-buscador` (el formulario), `landing-buscador-barrio`, `landing-buscador-tipo`, `landing-buscador-precio-min`, `landing-buscador-precio-max`, `landing-buscador-dorm` (desde 768 px), `landing-buscador-submit`, `landing-buscador-mas-filtros` (abre y cierra), `landing-buscador-mas-filtros-contador`, `landing-buscador-mas-filtros-panel`, `landing-buscador-mas-filtros-cerrar` (móvil), `landing-buscador-dorm-movil-<todos\|1\|2\|3\|4>` (móvil), `landing-buscador-amb-<todos\|1\|2\|3\|4>`, `landing-buscador-tag-<clave>`, `landing-buscador-m2-min`, `landing-buscador-m2-max`, `landing-buscador-indice-<todos\|IPC\|ICL>`, `landing-buscador-limpiar`, `landing-buscador-mas-filtros-buscar`, `landing-buscador-chip-<barrio>`. Recién publicadas: `landing-recientes`, `landing-ver-todas`, `landing-tarjeta`, `landing-cargando`, `landing-sin-propiedades`, `landing-sin-propiedades-publicar`, `landing-error`, `landing-reintentar`. Resto: `landing-barrios`, `landing-barrio-<barrio>`, `landing-como-funciona`, `landing-como-funciona-paso-<1..4>`, `landing-publicar` |
| `/login` | `auth-revisando-sesion` (con sesión, mientras redirige; también en `/registro`), `login-email-input`, `login-password-input`, `login-submit-button`, `login-error-alert`, `login-register-link`, `login-forgot-link`, `login-forgot-link-mobile`, `auth-server-error`, `auth-retry-button` |
| `/registro` | `registro-login-link`, `registro-<campo>-input`, `registro-terminos-checkbox`, `registro-submit-button`, `registro-email-taken-alert`, `registro-error-alert`, `registro-success`, `registro-success-buscar`, `registro-success-publicar`, `registro-email-simulado`, `auth-server-error`, `auth-retry-button`. Borrados el 27/09 (registro en un paso, sin rol): `registro-rol-locador`, `registro-rol-locatario`, `registro-continuar-button`, `registro-back-button`, `registro-success-cta`, `registro-success-panel-link` |
| `/buscar` | `buscar-resultados`, `buscar-tarjeta`, `buscar-conteo`, `buscar-orden`, `buscar-paginacion`, `buscar-mostrando`, `buscar-sin-resultados`, `buscar-error`, `buscar-reintentar`, `buscar-abrir-filtros`, `buscar-drawer-ver`, `search-sidebar-*` / `search-drawer-*` (filtros) |
| AppShell y UserMenu | `app-shell-logo-link`, `app-shell-menu-toggle`, `app-shell-role-chip`, `app-shell-publicar` ("Publicar propiedad" del encabezado), `app-shell-publicar-drawer` (el mismo, en el menú hamburguesa), `user-menu-trigger`, `user-menu-item-<key>` (`user-menu-item-header-action`: "Publicar propiedad" en la hoja móvil), `user-menu-role-<rol>`, `user-menu-logout`, `role-context-switcher` |
| `/panel` (locatario) | `panel-locatario`, `panel-locatario-buscar`, `panel-locatario-publicar` |
| `/panel` (locador) | `panel-publicar`, `panel-registrar-pago`, `panel-pendientes`, `panel-stat-<cifra>`, `panel-cobro`, `panel-reclamo`, `panel-contrato`, `panel-error-<bloque>`, `panel-onboarding`, `panel-onboarding-publicar` |
| `/panel/propiedades` | `mis-propiedades-tab-<estado>`, `mis-propiedades-buscar`, `mis-propiedades-filtro-<barrio\|tipo\|reclamos>`, `mis-propiedades-orden`, `data-table-row` (escritorio), `data-table-card` (móvil), `mis-propiedades-ver-detalle`, `mis-propiedades-mas` (adentro, `mis-propiedades-editar`, US-03; no está en las alquiladas), `mis-propiedades-eliminada` (aviso "Eliminaste <dirección>." que llega con `?eliminada=<id>`), `mis-propiedades-abrir-filtros`, `mis-propiedades-drawer-aplicar`, `mis-propiedades-limpiar`, `mis-propiedades-vacio`, `mis-propiedades-sin-resultados`, `mis-propiedades-error`, `mis-propiedades-reintentar` |
| `/panel/propiedades/[id]` (US-03, US-04, Sprint 2) | `mi-propiedad`, `mi-propiedad-cargando`, `mi-propiedad-error`, `mi-propiedad-reintentar`, `mi-propiedad-no-encontrada`. Encabezado: `mi-propiedad-ver-fotos` (abre `mi-propiedad-fotos-modal`), `mi-propiedad-editar-button` (no está si la propiedad está alquilada, US-03), `mi-propiedad-mas` (adentro, `mi-propiedad-ver-publica` y `mi-propiedad-menu-eliminar`), `mi-propiedad-precio`, `mi-propiedad-contrato`. Resumen: `mi-propiedad-ficha`, `mi-propiedad-condiciones`, `mi-propiedad-fotos`, `mi-propiedad-editar-fotos` (no está si está alquilada), `mi-propiedad-lo-que-sigue`, `mi-propiedad-ver-publica-acceso`, `mi-propiedad-zona-sensible`, `mi-propiedad-eliminar-button`. Eliminar: `mi-propiedad-eliminar-modal` (con `mi-propiedad-eliminar-solicitudes` y, si falla, `mi-propiedad-eliminar-error`), `mi-propiedad-eliminar-bloqueado-modal` (un solo botón, `confirm-action-ok`). Móvil: `mi-propiedad-editar-movil` (no está si está alquilada), `mi-propiedad-acciones-button`, `mi-propiedad-acciones-movil`, `mi-propiedad-acciones-eliminar` |
| `/panel/propiedades/[id]/editar` (US-03, Sprint 2) | `editar-propiedad`, `editar-propiedad-cargando`, `editar-propiedad-no-encontrada`, `editar-propiedad-error-carga`, `editar-propiedad-aviso`, `editar-propiedad-indice-<ubicacion\|caracteristicas\|fotos\|condiciones>`, `editar-propiedad-errores`, `editar-propiedad-cambios`, `editar-propiedad-descartar`, `editar-propiedad-guardar`, `editar-propiedad-exito`, `editar-propiedad-sin-cambios` ("No hay cambios para guardar."), `editar-propiedad-error`, `editar-propiedad-salir-modal`, `editar-propiedad-bloqueada` y `editar-propiedad-bloqueada-volver` (alquilada: aviso sin formulario). **Se fueron (11/10):** `editar-propiedad-bloqueado-<priceMonthly\|adjustmentIndex\|adjustmentEveryMonths\|status>` (una alquilada ya no llega al formulario). Los campos conservan los `data-testid` del alta (`alta-calle`, `alta-precio`, `alta-fotos-dropzone`…), porque son los mismos componentes |
| Alta | `alta-<campo>` (ej. `alta-calle`, `alta-precio`), `alta-fotos-dropzone`, `alta-foto`, `alta-foto-principal`, `alta-foto-quitar`, `alta-medio-<medio>-check` / `-recargo`, `alta-indice-<ICL\|IPC>`, `wizard-next-button`, `wizard-prev-button`, `wizard-finish-button`, `alta-mobile-volver`, `alta-mobile-salir`, `alta-errores`, `alta-publicando`, `alta-error-publicar`, `alta-reintentar`, `alta-error-login`, `alta-exito`, `alta-exito-mis-propiedades` (solo si la cuenta ya es locadora), `alta-exito-ver`, `alta-exito-panel` (locatario y no publicada), `alta-exito-otra` |
| `/propiedad/[id]` (US-41, Sprint 2) | `detalle-propiedad`, `detalle-propiedad-cargando`, `detalle-propiedad-direccion` (con `data-precision="exacta|aproximada"`), `detalle-propiedad-galeria` (adentro, `photo-gallery-main` y `photo-gallery-thumbnail`), `detalle-propiedad-precio`, `detalle-propiedad-disponible-desde`, `detalle-propiedad-caracteristicas`, `detalle-propiedad-dueno-card`, `detalle-propiedad-dueno`, `detalle-propiedad-condiciones`, `detalle-propiedad-medios-pago`, `detalle-propiedad-enviar-mensaje-button` (deshabilitado), `detalle-propiedad-similares`, `detalle-propiedad-similares-cargando`, `detalle-propiedad-similar`, `detalle-propiedad-similares-ver-todas`, `detalle-propiedad-no-encontrada`, `detalle-propiedad-error`, `detalle-propiedad-reintentar-button`, `detalle-propiedad-buscar-button`, `detalle-propiedad-volver-button`. Botón según el estado (tarjeta del dueño): `detalle-propiedad-solicitar-login-button` (sin sesión), `detalle-propiedad-solicitar-button` (puede solicitar), `detalle-propiedad-solicitud-estado` + `detalle-propiedad-solicitud-tag` + `detalle-propiedad-ver-solicitudes-link` (ya la solicitó), `detalle-propiedad-propia`, `detalle-propiedad-no-disponible` + `detalle-propiedad-ver-similares-button`. La barra fija de móvil (`detalle-propiedad-barra-movil`) repite el botón con el prefijo `detalle-propiedad-barra-` (ej. `detalle-propiedad-barra-solicitar-button`) |
| Modal "Solicitar alquiler" (US-35, sobre `/propiedad/[id]`) | `solicitar-modal`, `solicitar-propiedad`, `solicitar-nombre`, `solicitar-dni`, `solicitar-telefono`, `solicitar-email`, `solicitar-ocupacion`, `solicitar-ingresos`, `solicitar-convivientes` (con `-menos` y `-mas`), `solicitar-mascotas-si`, `solicitar-mascotas-no`, `solicitar-mascotas-detalle`, `solicitar-garantias-exigidas` (aviso arriba del grupo), `solicitar-garantia-<propietaria\|caucion\|otra>`, `solicitar-garantia-exigida` (la etiqueta "La pide el dueño"), `solicitar-mensaje` (contador "N / 600"), `solicitar-acepto`, `solicitar-pendientes-otras`, `solicitar-errores` (resumen al tocar "Enviar"), `solicitar-enviar-button`, `solicitar-cancelar-button`, `solicitar-error`; mientras carga `/preparar`: `solicitar-preparando`; si `/preparar` falla: `solicitar-preparar-error` + `solicitar-preparar-reintentar` (error del servidor o de red) o `solicitar-no-solicitable` (es suya, no existe o ya no recibe solicitudes); 409: `solicitar-duplicada`, `solicitar-ver-mi-solicitud-button`, `solicitar-cerrar-button`; 401 con mensaje escrito: `solicitar-sesion-vencida`, `solicitar-reingresar-button`, `solicitar-volver-button`; éxito: `solicitar-exito`, `solicitar-exito-mail` (solo si el back manda el mail; si no, `solicitar-exito-respuesta`), `solicitar-ver-solicitudes-button`, `solicitar-seguir-buscando-button` |
| `/panel` (locador), tanda 2 | `panel-solicitudes-link` ("N solicitudes nuevas" dentro de `panel-pendientes`, lleva a `/panel/solicitudes`) |
| `/panel/solicitudes` (US-36 a US-38, Sprint 2) | `solicitudes`, `solicitudes-tab-<pendientes\|aceptadas\|cerradas\|todas>`, `solicitudes-filtro-propiedad`, `solicitudes-orden`, `solicitudes-grupo`, `solicitudes-fila` (la elegida lleva `aria-current="true"` en el botón del nombre, solo en escritorio), `solicitudes-fila-tiempo` ("hace 3 h", "hace 2 días" o "aceptada el 14/09"), `solicitudes-fila-resumen` (convivientes, mascotas, garantías y si declaró ingresos), `solicitudes-fila-mensaje` (extracto de 2 líneas o "Sin mensaje."). **Acciones de la fila, solo en móvil (<768 px; en escritorio están en el detalle, tanda C):** `solicitudes-aceptar-button`, `solicitudes-aceptar-bloqueado` (envuelve al "Aceptar" deshabilitado cuando la propiedad ya tiene una aceptada; el motivo va en el tooltip), `solicitudes-rechazar-button`, `solicitudes-cancelar-button` (aceptada, US-38), `solicitudes-ver-detalle` (rechazada o cancelada). En todos los anchos: `solicitudes-motivo-rechazo` (rechazada con motivo, truncado a 80), `solicitudes-aviso-aceptar`, `solicitudes-cerradas-aviso` (en "Cerradas", modo real: las canceladas no llegan). Detalle del postulante (panel del costado en escritorio; en móvil, dentro de `solicitudes-detalle-drawer`): `solicitudes-detalle`, `solicitudes-detalle-legajo` (con `solicitudes-detalle-contacto` adentro) o `solicitudes-detalle-sin-legajo`; mientras se piden los datos del postulante, `solicitudes-detalle-cargando`; si fallan, `solicitudes-detalle-error` + `solicitudes-detalle-reintentar`; aceptada en modo real, `solicitudes-detalle-aviso-aceptada`; `solicitudes-detalle-mensaje`, `solicitudes-detalle-motivo-rechazo` (rechazada: el motivo completo o "No escribiste un motivo."), `solicitudes-detalle-aceptar-button`, `solicitudes-detalle-aceptar-bloqueado`, `solicitudes-detalle-rechazar-button`, `solicitudes-detalle-cancelar-button` (solo en mock: en real se oculta, §7 brecha 1). Modales: `solicitudes-aceptar-modal` (en real, con `solicitudes-aceptar-aviso`), `solicitudes-rechazar-modal` (con `solicitudes-rechazar-motivo`, el TextArea opcional de 200), `solicitudes-cancelar-modal`, con `confirm-action-ok` y `confirm-action-cancel` adentro; error de la acción: `solicitudes-accion-error` + `solicitudes-accion-reintentar`; 409: `solicitudes-conflicto`. Estados: `solicitudes-cargando`, `solicitudes-vacio` (con `data-caso` = `sin_propiedades`, `sin_publicadas` o `con_publicadas`; adentro, `solicitudes-vacio-publicar` y/o `solicitudes-vacio-propiedades`), `solicitudes-sin-resultados`, `solicitudes-error`, `solicitudes-reintentar` |
| `/panel/mis-solicitudes` (US-36, Sprint 2) | `mis-solicitudes`, `mis-solicitudes-tab-<todas\|pendientes\|aceptadas\|cerradas>`, `mis-solicitudes-fila`, `mis-solicitudes-estado-texto`, `mis-solicitudes-motivo-rechazo` (rechazada con motivo; adentro, `mis-solicitudes-motivo-rechazo-texto` y, si pasa de 80, `mis-solicitudes-motivo-rechazo-toggle` con `aria-expanded`), `mis-solicitudes-cancelar-button` (pendiente), `mis-solicitudes-ver-button` (pendiente o aceptada), `mis-solicitudes-ver-similares-button` (rechazada o cancelada), `mis-solicitudes-cancelar-modal` (con `confirm-action-ok` y `confirm-action-cancel`), `mis-solicitudes-accion-error` + `mis-solicitudes-accion-reintentar`, `mis-solicitudes-conflicto`, `mis-solicitudes-cargando`, `mis-solicitudes-vacio`, `mis-solicitudes-vacio-buscar`, `mis-solicitudes-sin-resultados`, `mis-solicitudes-error`, `mis-solicitudes-reintentar`, `mis-solicitudes-cerradas-aviso` (en "Cerradas", modo real). Borrado: `placeholder-screen` en esta ruta |
| `/panel/perfil` (US-20, US-21, Sprint 3) | `perfil`, `perfil-cargando`, `perfil-error`, `perfil-reintentar`. Cada bloque: `perfil-datos`, `perfil-legajo`, `perfil-acceso`, `perfil-roles`, y en móvil su `-toggle` (pliega y despliega, con `aria-expanded`). Datos personales: `perfil-nombre`, `perfil-apellido`, `perfil-dni`, `perfil-email`, `perfil-telefono`, `perfil-fecha-nacimiento`, `perfil-sin-cargar-<dni\|telefono\|fecha-nacimiento>` con `perfil-completar-<campo>`, `perfil-bloqueo-contrato`, `perfil-datos-editar`, `perfil-datos-form`, `perfil-<nombre\|apellido\|dni\|telefono\|fecha-nacimiento>-input`, `perfil-datos-guardar`, `perfil-datos-cancelar`, `perfil-datos-error`, `perfil-datos-exito`. Correo: `perfil-email-cambio`, `perfil-email-cambiar`, `perfil-email-form`, `perfil-email-input`, `perfil-email-enviar`, `perfil-email-cancelar`, `perfil-email-pendiente`, `perfil-email-simular-confirmacion` (solo mock), `perfil-email-exito`, `perfil-email-error`, `perfil-email-enlace` (aviso al volver de `/auth/confirmar`). Legajo: `perfil-legajo-chip` ("2 de 3"), `perfil-legajo-estado` (con `data-estado="completo\|incompleto"`), `perfil-legajo-faltantes`, `perfil-legajo-ocupacion`, `perfil-legajo-ingresos`, `perfil-legajo-garantias`, `perfil-sin-cargar-<ocupacion\|ingresos\|garantias>`, `perfil-legajo-editar`, `perfil-legajo-form`, `perfil-legajo-ocupacion-input`, `perfil-legajo-ingresos-input`, `perfil-legajo-garantia-<propietaria\|caucion\|otra>`, `perfil-legajo-guardar`, `perfil-legajo-cancelar`, `perfil-legajo-error`, `perfil-legajo-exito`. Contraseña: `perfil-password-editar`, `perfil-password-form`, `perfil-password-actual`, `perfil-password-nueva`, `perfil-password-repetir`, `perfil-password-fuerza`, `perfil-password-guardar`, `perfil-password-cancelar`, `perfil-password-error`, `perfil-password-exito`. Roles: `perfil-rol-<locatario\|locador>`, `perfil-ser-locador`, `perfil-ser-locador-link`. Aviso de salida: `aviso-salida` (modal, con `confirm-action-ok` = "Salir sin guardar" y `confirm-action-cancel` = "Seguir editando"). Borrado: `placeholder-screen` en esta ruta |
| Herramientas de desarrollo | `dev-tools-toggle`, `dev-tools-reset-mock-data` |

Para ver todos: `grep -rn "data-testid" apps/web/src packages/ui/src`.

### Landing nueva: testids viejos → nuevos (01/10/2026)

La landing se rehízo (rama `feature/nuevo-landing`) y sus testids pasaron a un set nuevo en español
con el prefijo `landing-` (decisión del PO). `<barrio>` es el slug del catálogo (`nueva-cordoba`,
`guemes`, `centro`, `general-paz`, `cofico`, `alta-cordoba`).

| Antes | Ahora |
|---|---|
| `hero-search-cta` | `landing-buscador-submit` |
| `hero-how-it-works-cta` | Se sacó: "Cómo funciona" está en el Header y el Footer (`/#como-funciona`). La sección es `landing-como-funciona`. |
| `search-neighborhood-select` | `landing-buscador-barrio` (select nativo). Los atajos de barrio: `landing-buscador-chip-<barrio>`. |
| `search-type-select` | `landing-buscador-tipo` |
| `search-price-min-input`, `search-price-max-input`, `search-price-slider` | `landing-buscador-precio-min`, `landing-buscador-precio-max` (selects con montos fijos; ya no hay slider) |
| `search-bedrooms-select` | `landing-buscador-dorm` (desde 768 px); en móvil, `landing-buscador-dorm-movil-<valor>` dentro de "Más filtros" |
| `search-characteristics-chips` | `landing-buscador-tag-<clave>` (casillas dentro de "Más filtros") |
| `search-result-count` | Se sacó: la landing ya no filtra ni cuenta, lleva a `/buscar` (`buscar-conteo`). |
| `landing-more-properties-button` | `landing-ver-todas` |
| `property-card-detail-button` | `landing-tarjeta` (la tarjeta de `/buscar`: la tarjeta entera es el link) |
| `landing-error`, `landing-reintentar` | Sin cambios |

Nuevos, sin equivalente anterior: `landing-buscador`, `landing-buscador-mas-filtros*`,
`landing-buscador-amb-<valor>`, `landing-buscador-m2-min` / `-max`, `landing-buscador-indice-<valor>`,
`landing-buscador-limpiar`, `landing-recientes`, `landing-cargando`, `landing-sin-propiedades*`,
`landing-barrios`, `landing-barrio-<barrio>`, `landing-como-funciona-paso-<n>` y `landing-publicar`.

## 13. Tipos compartidos

- Los modelos del back (`Inmueble`, `MisAlquileresItem`, `CreateInmuebleCompletoPayload`,
  `Usuario`, `Rol`, `Contrato`, `Reclamo`, `EstadoReclamo`…) están arriba de
  `packages/shared-types/src/index.ts`. `Publicacion` ya no existe.
- Los tipos de vista del front están en archivos propios (`propiedad.ts`, `filters.ts`, `panel.ts`,
  `solicitud.ts`, `status.ts`, `usuario-sesion.ts`, `neighborhood.ts`) y se exportan al final de `index.ts`.
- Qué adaptador conecta cada modelo con cada tipo de vista: `packages/shared-types/README.md`.
- DTOs que el back todavía no exporta (`UsuarioMeResponse`, `InmueblesDisponiblesResponse`,
  `InmuebleDetalleResponse`, `RegistrarUsuarioRequest`) y los de solicitudes (`CrearSolicitudRequest`,
  `SolicitudResponse`, `SolicitudPreparacionResponse`, copias de `apps/api/src/dtos/solicitud.dto.ts`): copiados en `apps/web/src/services/shared/backend-dtos.ts`, con
  `TODO(backend)` para moverlos a `shared-types`.

## 14. Qué queda para el sprint 2

- Subida de fotos al bucket y alta completa desde la pantalla (sección 8).
- ~~Detalle de la propiedad del locador con editar (US-03) y eliminar (US-04)~~: hecho en el
  front (tanda 3). En real: el `DELETE` lógico está conectado desde el 09/10 y el `PUT` parcial desde
  el 11/10 (§7); falta `GET /mis-alquileres/:id` (hoy, puente). Queda publicar/pausar (sin US ni endpoint; `cambiarEstadoPublicacion` sigue
  en el service, sin usar).
- ~~Detalle público (`/propiedad/[id]`) y solicitudes (US-35 a US-38)~~: hecho en el front (tandas 1
  y 2, modo mock; el back no tiene el módulo de solicitudes).
- Recuperar contraseña (US-40) y perfil (US-20, US-21).
- Panel del locatario (hoy un placeholder).
- Cobros, reclamos, contratos y notificaciones de verdad.
- **Accesibilidad, para `feature/vistas`** (las marcó Lighthouse el 02/10/2026; no son de la
  landing):
  - `/login`: el ícono de mostrar contraseña del `Input.Password` de antd es un objetivo táctil
    chico (`target-size`).
  - `/buscar`: el texto de la paginación (`paginationText` en `Buscar.module.css`) no llega al
    contraste mínimo, y los links de la paginación de antd no son rastreables (`crawlable-anchors`,
    SEO).
