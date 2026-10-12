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
| `GET /panel/cobros`, `/panel/reclamos`, `/panel/contratos`, `/solicitudes/recibidas?estado=pendiente` | `/panel` | **Pendiente** (módulos de sprints futuros; en modo real se muestran vacíos) |
| `POST /solicitudes`, `GET /solicitudes/mias`, `GET /solicitudes/recibidas`, `PATCH /solicitudes/:id/{aceptar,rechazar,cancelar}` | `/propiedad/[id]` (US-35), `/panel/mis-solicitudes` y `/panel/solicitudes` (US-36 a US-38) | **Pendiente** (propuesto, Sprint 2; las tres pantallas están completas en modo mock, con la rama real lista en el service) |
| `GET /mis-alquileres/:id` | Detalle y edición del locador (US-03, US-04) | **Pendiente** (propuesto, tanda 3 del Sprint 2). Desde el 09/10 el detalle y la precarga de la edición **cargan en modo real con un puente**: `getMiPropiedad` pide `GET /mis-alquileres` y busca el id (sección 7, US-03 y US-04) |
| `DELETE /inmuebles/:id` (baja lógica, 09/10) | Detalle del locador (US-04) | **Conectado** (09/10, `develop` b7ebf48): baja lógica (`activo = false`) del inmueble y de sus contratos; valida el dueño; 409 si está alquilado. Errores traducidos en `propiedad.adapter.ts#errorDeEliminarPropiedad` (§7, US-04) |
| `PUT /inmuebles/:id` | Detalle (sprint 2, US-03) | **Existe en el back (10/10, `develop` b5acfa7)**: modifica datos, fotos y tags del inmueble; 409 si está alquilado. El front no lo usa todavía |
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
| **`PUT /inmuebles/:id` ampliado:** el mismo cuerpo que `POST /inmuebles`. Hoy actualiza solo las columnas de `inmueble` e ignora `tags`, `fotos` y `condiciones_contrato`. El front ya manda el cuerpo completo (decisión del PO: no se parte el formulario según lo que soporta el back). | backend |
| **Con contrato vigente, el precio, el índice y la frecuencia de ajuste no se modifican** (los fija el contrato): el back debería rechazarlo con 400. El front los muestra bloqueados. | backend |
| ~~**`DELETE /inmuebles/:id` lógico**~~ **Hecho (09/10, `develop` b7ebf48):** baja lógica con `activo = false` (booleano, no un estado nuevo: el inmueble sigue `publicado` o `pausado`). El 409 sale de `estado_alquiler`, **no del contrato vigente**: ver la sección US-04 de abajo y §10. | — |
| **Al eliminar, las solicitudes `pendiente` y `aceptada` del inmueble pasan a `cancelada`**, con un mail a cada postulante (decisión del PO). El back no lo hace (no tiene el módulo de solicitudes). En mock el modal avisa "Las N solicitudes de esta propiedad se van a cancelar"; **en real no dice nada** (`contarSolicitudesQueSeCancelan` devuelve 0). | backend |
| **Fotos de la edición:** el front sube las nuevas a Storage antes del `PUT`; si el `PUT` falla, las borra (como el alta). Mientras el `PUT` no guarde fotos, ver §10. | backend |
| **La precarga de `/editar` pierde "Débito automático" y el índice CAC.** El front no los ofrece: el medio de pago 4 se descarta y CAC (`tipo_indice` 3) queda sin índice, así que el formulario los muestra vacíos y el cuerpo del `PUT` ya no los lleva. Hoy no pasa nada porque el `PUT` ignora `condiciones_contrato`, pero **cuando se conecte el `PUT` ampliado, guardar la edición borraría esos datos reales**. Antes de conectarlo: o el front suma los dos al catálogo (decisión del PO), o el back conserva lo que el cuerpo no trae. `TODO(backend)` en `propiedad.adapter.ts#misAlquileresDetalleToPropiedadLocadorDetalle`. | backend / PO |
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

Cambio del back del 10/10 (sin probar contra la API; el front todavía no tiene la pantalla de edición).

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
| `inmuebles.routes.ts` registra dos veces `router.put("/:id")`: el nuevo (con Swagger y `requireRole("locador")`) y el viejo, que quedó debajo y nunca se ejecuta. Borrar el viejo. | backend |
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
| **No cancela solicitudes ni avisa por mail** (el módulo no existe). Ver §10, punto 19. | backend |
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
| El tag "Apto profesional" no existe: no se manda. | db |
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
| **"Ya la solicité":** el botón necesita saber si el usuario en sesión ya tiene una solicitud para ese inmueble. Propuesto `GET /solicitudes/mias?inmueble=:id`; alternativa: que el detalle devuelva `mi_solicitud` cuando llega con token. | backend |
| **`-1` o `null` en `precio` y `expensas`:** desde el 29/09 manda `null` sin contrato; el adaptador también acepta el `-1` viejo. Confirmar que ya no se manda `-1`. | backend |
| No hay fecha de publicación (el diseño dice "Publicada hace 6 días"). | db |
| **Dirección exacta sin token:** la ruta es pública y manda `direccion`, `numero` y `piso` a cualquiera. El adaptador la recorta sin sesión ("Av. Colón al 1500"), pero es solo cosmético (`api-endpoints.md`, observación 🔴). Sin token, mandar calle y cuadra, nunca la altura ni el piso. | backend |
| `fotos` sale con `select *` (`id_inmueble`, `peso_kb`, `formato`), que el detalle público no necesita. `servicio` tampoco se muestra (US-41 no lo pide). | backend |

### US-35 Enviar solicitud de alquiler (Sprint 2; actualizada en `develop` 80dfb8b, tanda 4)

| Brecha | Dueño |
|---|---|
| **No existe el módulo:** tabla de solicitudes y las 6 rutas de `api-endpoints.md` ("Solicitudes"). | db / backend |
| **Mail al locador** al crear la solicitud, con el nombre del postulante y el mensaje opcional (US-35, cuarto criterio). El front solo muestra "Le avisamos por mail a <dueño>". | backend |
| Repetir las validaciones del front (`lib/validation/solicitud.rules.ts`, `errorDeSolicitudNueva`): mensaje de hasta 600 caracteres, teléfono E.164, email, ingresos, convivientes, garantías exigidas y aceptación, una sola activa por persona e inmueble (409), no a la propia (403), solo publicadas o alquiladas con fecha. | backend |
| **Decidido (tanda 2): sin bloqueo de 30 días.** El diseño (Flujo de solicitudes · 03) dice "no puede volver a solicitar esta propiedad por 30 días"; ninguna US lo pide y no va. Solo bloquean una nueva solicitud las `pendiente` o `aceptada`; una `rechazada` o `cancelada` permite volver a solicitar enseguida. | — |

**US-35 actualizada (tanda 4): supuestos, decisiones y pendientes**

| Tema | Detalle | Dueño |
|---|---|---|
| **Contradicción de la US: ingresos** | La US dice "un número entero superior a 0" y "por defecto debe ser cero (0)". El front interpreta **0 = no lo informa** (pasa), entero positivo (pasa), negativo o con decimales (falla); al locador le muestra "No informó". Decisión del PO; **Thiago, corregir la redacción de la US**. | PO / Thiago |
| **Interpretación: "garantías exigidas marcadas"** | La US dice "se deben marcar las garantías solicitadas explícitamente por el locador". El front las **señala** ("La pide el dueño" y un aviso arriba del grupo) pero **no las tilda solas**, para que nadie declare sin querer una garantía que no tiene. Alcanza con ofrecer **al menos una** de las exigidas ("propietaria **o** caución"). Si un día una propiedad exige todas, se suma un modo. **Thiago, confirmar.** | PO / Thiago |
| **Pendiente para el Sprint 3: garantías que exige el locador** | El dato no existe en el back ni lo cargan el alta ni la edición. En el front es `requiredGuarantees` (solo el elenco lo trae: Rondeau 480). Con el back real, ninguna propiedad exige garantías (`TODO(backend)` en el adaptador). Toca US-01 y US-03 (campo nuevo en el alta y la edición) y el `POST`/`PUT` de inmuebles. | db / backend / front |
| **Supuesto: "metros cuadrados (reales)"** | Se muestra la **superficie cubierta**; si la propiedad no la tiene, la total, con la etiqueta que corresponda ("m² cubiertos" / "m² totales"). | PO |
| **Decisión del front: detalle de mascotas** | Hasta **300** caracteres, con contador. La US no pone tope. | — |
| **Teléfono y email** | Se precargan del perfil y se editan **solo para la solicitud** (no cambian el perfil). El teléfono arranca con `+54` (el producto es para Córdoba) y se puede cambiar el código de país. Se guarda en E.164 y se muestra en E.123. `/usuarios/me` **no devuelve el teléfono** (la columna existe): `TODO(backend)`. | backend |
| **DNI** | De solo lectura, del perfil. **La tabla `usuario` no tiene DNI** (§10): con el back real se muestra "—" (`TODO(db)`); no se escribe en el modal. | db |
| **Dirección exacta con sesión** | Reemplaza "el locatario siempre ve la aproximada" (tandas 1 y 2): con sesión, la exacta en el modal, el detalle y Mis solicitudes. Es cosmético mientras `/disponibles` la mande sin token (§10). | backend |
| **"Cuántas pendientes en otras propiedades"** | `GET /solicitudes/mias?estado=pendiente`; el front cuenta y excluye la propiedad actual. | backend |

### US-36 a US-38 Consultar, aceptar o rechazar y cancelar solicitudes (Sprint 2)

| Brecha | Dueño |
|---|---|
| **No existe el módulo** (misma tabla y rutas que US-35). Las pantallas `/panel/solicitudes` y `/panel/mis-solicitudes` funcionan completas en modo mock. | db / backend |
| **Decidido (tanda 2): quién cancela (US-38).** Una sola ruta, `PATCH /solicitudes/:id/cancelar`: el locador cancela una `aceptada` (US-38, Jira) y el postulante una `pendiente` (sin US en Sprint 0, mapa US-39). Otra combinación → 409 (o 403 si no es parte). Detalle en `api-endpoints.md`, "Solicitudes". | — |
| **Decidido (tanda 2): una sola aceptada por inmueble.** `PATCH /aceptar` responde 409 si el inmueble ya tiene otra `aceptada`. El locador la cancela (US-38) y vuelve a poder aceptar a otro. Aceptar no rechaza a los demás: siguen `pendiente`. | backend |
| **Decidido (tanda 2): sin motivo al rechazar.** El diseño lo propone; US-37 no lo pide. | — |
| **Columna `fecha_respuesta`** (cuándo dejó de estar pendiente) en la tabla y en `SolicitudResponse`: la usan las dos pantallas ("Aceptada el 14/09", "Te aceptaron el 21/09"). | db / backend |
| **Mails:** al locatario cuando el locador acepta (US-37) y cuando cancela una aceptada (US-38). Rechazar y la cancelación del postulante no piden mail. El front solo dice "Le avisamos por mail". | backend |
| **Dirección (decidido, tanda 4):** con sesión, la exacta en `/recibidas` y en `/mias` (reemplaza la regla de la tanda 2). | — |
| **Legajo en `/recibidas` (US-35 actualizada):** `postulante.dni`, `telefono`, `email` y `legajo`, solo para el dueño del inmueble. El detalle del postulante los muestra; la lista, no. Las solicitudes anteriores sin legajo se ven "Sin datos de legajo". | backend |
| Repetir en el back la tabla de transiciones de `lib/validation/solicitud.rules.ts` (`TRANSICIONES_SOLICITUD`). | backend |

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
   status. Ojo: los `throw new Error(...)` de los services sin `statusCode` (p. ej. `validarReglasUS01`)
   dependen de ese 400; ponerles el status antes de cambiar el default. Pendiente para otra tarea. Y el texto de `error` se muestra tal cual: tiene que estar en español.
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

9. **🔴 Crítico · `PUT /inmuebles/:id` no chequea que el inmueble sea del que llama** (el `DELETE` sí,
   desde el 09/10)
   (tanda 3 del Sprint 2). Piden token y rol `locador`, pero el controller no lee el usuario y el
   repositorio usa la clave secreta: cualquier locador puede modificar o borrar el inmueble de otro.
   Además, `PUT` pasa el body entero a `.update()`. Filtrar por `id_locador` del token y responder
   404 si no es suyo.
10. **🔴 Alto · `GET /inmuebles` está abierto** (sin token) y devuelve todos los inmuebles con la
    dirección exacta y el `id_locador`. El front no la usa: sacarla o protegerla con rol administrador.
11. ~~**`DELETE /inmuebles/:id` borra en duro y en cascada**~~ **Resuelto en parte (09/10, b7ebf48):**
    es una baja lógica y valida el dueño. Sigue sin mirar el contrato vigente, sin cancelar solicitudes
    y sin limpiar Storage (puntos 17 a 20).
12. **🟡 Bajo · 400 en lugar de 404** en `PUT` (el `DELETE` ya responde 404 desde el 09/10) cuando el inmueble no existe: el service
    tira un `Error` sin status antes del chequeo del controller (y `errorHandler` usa 400, punto 4).
13. **🟠 Fotos huérfanas en el bucket al editar:** hasta que el `PUT` guarde las fotos, cada edición
    con fotos nuevas las sube a `fotos-propiedades` y quedan sin referencia (si el `PUT` falla, el
    front sí las borra). Se resuelve con el `PUT` ampliado (§7, US-03).

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
22. **🟡 Bajo · Detalles del `DELETE`:** un error de la RPC cae al 400 por defecto (punto 4); el
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
| `/panel/propiedades` | `mis-propiedades-tab-<estado>`, `mis-propiedades-buscar`, `mis-propiedades-filtro-<barrio\|tipo\|reclamos>`, `mis-propiedades-orden`, `data-table-row` (escritorio), `data-table-card` (móvil), `mis-propiedades-ver-detalle`, `mis-propiedades-mas` (adentro, `mis-propiedades-editar`, US-03), `mis-propiedades-eliminada` (aviso "Eliminaste <dirección>." que llega con `?eliminada=<id>`), `mis-propiedades-abrir-filtros`, `mis-propiedades-drawer-aplicar`, `mis-propiedades-limpiar`, `mis-propiedades-vacio`, `mis-propiedades-sin-resultados`, `mis-propiedades-error`, `mis-propiedades-reintentar` |
| `/panel/propiedades/[id]` (US-03, US-04, Sprint 2) | `mi-propiedad`, `mi-propiedad-cargando`, `mi-propiedad-error`, `mi-propiedad-reintentar`, `mi-propiedad-no-encontrada`. Encabezado: `mi-propiedad-ver-fotos` (abre `mi-propiedad-fotos-modal`), `mi-propiedad-editar-button`, `mi-propiedad-mas` (adentro, `mi-propiedad-ver-publica` y `mi-propiedad-menu-eliminar`), `mi-propiedad-precio`, `mi-propiedad-contrato`. Resumen: `mi-propiedad-ficha`, `mi-propiedad-condiciones`, `mi-propiedad-fotos`, `mi-propiedad-editar-fotos`, `mi-propiedad-lo-que-sigue`, `mi-propiedad-ver-publica-acceso`, `mi-propiedad-zona-sensible`, `mi-propiedad-eliminar-button`. Eliminar: `mi-propiedad-eliminar-modal` (con `mi-propiedad-eliminar-solicitudes` y, si falla, `mi-propiedad-eliminar-error`), `mi-propiedad-eliminar-bloqueado-modal` (un solo botón, `confirm-action-ok`). Móvil: `mi-propiedad-editar-movil`, `mi-propiedad-acciones-button`, `mi-propiedad-acciones-movil`, `mi-propiedad-acciones-eliminar` |
| `/panel/propiedades/[id]/editar` (US-03, Sprint 2) | `editar-propiedad`, `editar-propiedad-cargando`, `editar-propiedad-no-encontrada`, `editar-propiedad-error-carga`, `editar-propiedad-aviso`, `editar-propiedad-indice-<ubicacion\|caracteristicas\|fotos\|condiciones>`, `editar-propiedad-errores`, `editar-propiedad-cambios`, `editar-propiedad-descartar`, `editar-propiedad-guardar`, `editar-propiedad-exito`, `editar-propiedad-error`, `editar-propiedad-salir-modal`, `editar-propiedad-bloqueado-<priceMonthly\|adjustmentIndex\|adjustmentEveryMonths\|status>` (con contrato vigente). Los campos conservan los `data-testid` del alta (`alta-calle`, `alta-precio`, `alta-fotos-dropzone`…), porque son los mismos componentes |
| Alta | `alta-<campo>` (ej. `alta-calle`, `alta-precio`), `alta-fotos-dropzone`, `alta-foto`, `alta-foto-principal`, `alta-foto-quitar`, `alta-medio-<medio>-check` / `-recargo`, `alta-indice-<ICL\|IPC>`, `wizard-next-button`, `wizard-prev-button`, `wizard-finish-button`, `alta-mobile-volver`, `alta-mobile-salir`, `alta-errores`, `alta-publicando`, `alta-error-publicar`, `alta-reintentar`, `alta-error-login`, `alta-exito`, `alta-exito-mis-propiedades` (solo si la cuenta ya es locadora), `alta-exito-ver`, `alta-exito-panel` (locatario y no publicada), `alta-exito-otra` |
| `/propiedad/[id]` (US-41, Sprint 2) | `detalle-propiedad`, `detalle-propiedad-cargando`, `detalle-propiedad-direccion` (con `data-precision="exacta|aproximada"`), `detalle-propiedad-galeria` (adentro, `photo-gallery-main` y `photo-gallery-thumbnail`), `detalle-propiedad-precio`, `detalle-propiedad-disponible-desde`, `detalle-propiedad-caracteristicas`, `detalle-propiedad-dueno-card`, `detalle-propiedad-dueno`, `detalle-propiedad-condiciones`, `detalle-propiedad-medios-pago`, `detalle-propiedad-enviar-mensaje-button` (deshabilitado), `detalle-propiedad-similares`, `detalle-propiedad-similares-cargando`, `detalle-propiedad-similar`, `detalle-propiedad-similares-ver-todas`, `detalle-propiedad-no-encontrada`, `detalle-propiedad-error`, `detalle-propiedad-reintentar-button`, `detalle-propiedad-buscar-button`, `detalle-propiedad-volver-button`. Botón según el estado (tarjeta del dueño): `detalle-propiedad-solicitar-login-button` (sin sesión), `detalle-propiedad-solicitar-button` (puede solicitar), `detalle-propiedad-solicitud-estado` + `detalle-propiedad-solicitud-tag` + `detalle-propiedad-ver-solicitudes-link` (ya la solicitó), `detalle-propiedad-propia`, `detalle-propiedad-no-disponible` + `detalle-propiedad-ver-similares-button`. La barra fija de móvil (`detalle-propiedad-barra-movil`) repite el botón con el prefijo `detalle-propiedad-barra-` (ej. `detalle-propiedad-barra-solicitar-button`) |
| Modal "Solicitar alquiler" (US-35, sobre `/propiedad/[id]`) | `solicitar-modal`, `solicitar-propiedad`, `solicitar-nombre`, `solicitar-dni`, `solicitar-telefono`, `solicitar-email`, `solicitar-ocupacion`, `solicitar-ingresos`, `solicitar-convivientes` (con `-menos` y `-mas`), `solicitar-mascotas-si`, `solicitar-mascotas-no`, `solicitar-mascotas-detalle`, `solicitar-garantias-exigidas` (aviso arriba del grupo), `solicitar-garantia-<propietaria\|caucion\|otra>`, `solicitar-garantia-exigida` (la etiqueta "La pide el dueño"), `solicitar-mensaje` (contador "N / 600"), `solicitar-acepto`, `solicitar-pendientes-otras`, `solicitar-errores` (resumen al tocar "Enviar"), `solicitar-enviar-button`, `solicitar-cancelar-button`, `solicitar-error`; 409: `solicitar-duplicada`, `solicitar-ver-mi-solicitud-button`, `solicitar-cerrar-button`; 401 con mensaje escrito: `solicitar-sesion-vencida`, `solicitar-reingresar-button`, `solicitar-volver-button`; éxito: `solicitar-exito`, `solicitar-exito-mail`, `solicitar-ver-solicitudes-button`, `solicitar-seguir-buscando-button` |
| `/panel` (locador), tanda 2 | `panel-solicitudes-link` ("N solicitudes nuevas" dentro de `panel-pendientes`, lleva a `/panel/solicitudes`) |
| `/panel/solicitudes` (US-36 a US-38, Sprint 2) | `solicitudes`, `solicitudes-tab-<pendientes\|aceptadas\|cerradas\|todas>`, `solicitudes-filtro-propiedad`, `solicitudes-orden`, `solicitudes-grupo`, `solicitudes-fila`, `solicitudes-aceptar-button`, `solicitudes-aceptar-bloqueado` (envuelve al "Aceptar" deshabilitado cuando la propiedad ya tiene una aceptada; el motivo va en el tooltip), `solicitudes-rechazar-button`, `solicitudes-cancelar-button` (aceptada, US-38), `solicitudes-ver-detalle` (rechazada o cancelada), `solicitudes-aviso-aceptar`. Detalle del postulante (panel del costado en escritorio; en móvil, dentro de `solicitudes-detalle-drawer`): `solicitudes-detalle`, `solicitudes-detalle-legajo` (con `solicitudes-detalle-contacto` adentro) o `solicitudes-detalle-sin-legajo`, `solicitudes-detalle-mensaje`, `solicitudes-detalle-aceptar-button`, `solicitudes-detalle-aceptar-bloqueado`, `solicitudes-detalle-rechazar-button`, `solicitudes-detalle-cancelar-button`. Modales: `solicitudes-aceptar-modal`, `solicitudes-rechazar-modal`, `solicitudes-cancelar-modal`, con `confirm-action-ok` y `confirm-action-cancel` adentro; error de la acción: `solicitudes-accion-error` + `solicitudes-accion-reintentar`; 409: `solicitudes-conflicto`. Estados: `solicitudes-cargando`, `solicitudes-vacio` (con `data-caso` = `sin_propiedades`, `sin_publicadas` o `con_publicadas`; adentro, `solicitudes-vacio-publicar` y/o `solicitudes-vacio-propiedades`), `solicitudes-sin-resultados`, `solicitudes-error`, `solicitudes-reintentar` |
| `/panel/mis-solicitudes` (US-36, Sprint 2) | `mis-solicitudes`, `mis-solicitudes-tab-<todas\|pendientes\|aceptadas\|cerradas>`, `mis-solicitudes-fila`, `mis-solicitudes-estado-texto`, `mis-solicitudes-cancelar-button` (pendiente), `mis-solicitudes-ver-button` (pendiente o aceptada), `mis-solicitudes-ver-similares-button` (rechazada o cancelada), `mis-solicitudes-cancelar-modal` (con `confirm-action-ok` y `confirm-action-cancel`), `mis-solicitudes-accion-error` + `mis-solicitudes-accion-reintentar`, `mis-solicitudes-conflicto`, `mis-solicitudes-cargando`, `mis-solicitudes-vacio`, `mis-solicitudes-vacio-buscar`, `mis-solicitudes-sin-resultados`, `mis-solicitudes-error`, `mis-solicitudes-reintentar`. Borrado: `placeholder-screen` en esta ruta |
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
  `InmuebleDetalleResponse`, `RegistrarUsuarioRequest`) y los propuestos de solicitudes
  (`CrearSolicitudRequest`, `SolicitudResponse`): copiados en `apps/web/src/services/shared/backend-dtos.ts`, con
  `TODO(backend)` para moverlos a `shared-types`.

## 14. Qué queda para el sprint 2

- Subida de fotos al bucket y alta completa desde la pantalla (sección 8).
- ~~Detalle de la propiedad del locador con editar (US-03) y eliminar (US-04)~~: hecho en el
  front (tanda 3, modo mock; en real faltan `GET /mis-alquileres/:id`, el `PUT` ampliado; el
  `DELETE` lógico existe desde el 09/10, §7). Queda publicar/pausar (sin US ni endpoint; `cambiarEstadoPublicacion` sigue
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
