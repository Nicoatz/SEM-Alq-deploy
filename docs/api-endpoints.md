# Endpoints que usa el frontend — Sprints 1 a 3

Lista de las rutas de `apps/api` (y de Supabase) que llama `apps/web`, sacada de los bloques
`@backend` de `apps/web/src/services/*.service.ts` y verificada contra la API de `develop` el
25-26/09/2026. Sirve para completar el Swagger (`http://localhost:3000/api/v1/docs`).

- **Base:** `NEXT_PUBLIC_API_URL`, por defecto `http://localhost:3000/api/v1`.
- **Sobre de respuesta:** siempre `{ success, message?, data?, error? }` (`ApiResponse<T>`). El front
  lee `data`; si `success` es `false` o el status no es 2xx, muestra `error` (tiene que estar en
  español y decir qué hacer).
- **Auth:** `Authorization: Bearer <access_token de Supabase>`, que arma
  `services/shared/apiClient.ts` con la sesión vigente. **`x-user-id` ya no existe.** Detalle en
  [`HANDOFF-BACKEND.md`](HANDOFF-BACKEND.md#2-autenticación-con-supabase).
- **Estado:** **conectado** = el front lo usa y la pantalla funciona completa; **parcial** = lo usa
  pero faltan datos; **pendiente** = no existe (propuesto) o el front todavía no lo puede usar.

## Autenticación y usuarios

| Método y ruta | Auth | Estado | US | Service | Body | Respuesta (`data`) |
|---|---|---|---|---|---|---|
| Supabase Auth `signInWithPassword` | — (SDK, clave publicable) | conectado | US-39 | `auth.service#login` | `{ email, password }` | Sesión en cookies `sb-*` (la maneja `@supabase/ssr`) |
| Supabase Auth `signOut` | sesión | conectado | US-39 | `auth.service#logout` | — | — |
| `GET /usuarios/me` | Bearer | conectado | US-39 | `usuarios.service#getUsuarioActual` (y `useAuth().refrescarUsuario` después de publicar) | — | `{ id, nombre, apellido, email, numero_documento, telefono, fecha_nacimiento, roles: string[] }` (el back ya manda todo; `usuarioMeToSesion` hoy usa solo `id, nombre, apellido, email, roles`). Propuesto: una cuenta locadora devuelve `["locador", "locatario"]` |
| `POST /registrar-usuario` | **sin token** | conectado | US-19 | `auth.service#registrarUsuario` | `{ nombre, apellido, email, contraseña, confirmar_contraseña, telefono, numero_documento, fecha_nacimiento, acepta_terminos }` (sin `rol`) | `Usuario` (`id, nombre, apellido, email, numero_documento, telefono, fecha_nacimiento`) → `registroResponseToSesion` |
| `GET /usuarios/me/contextos` | Bearer | pendiente (propuesto) | US-39 (cambio de rol) | `panel.service#getResumenRoles` | — | `ResumenContextoRol[]` (hoy se arma en el front) |

Notas:

- **Login:** no hay `POST /auth/login` ni `/auth/logout` en `apps/api` (decisión de backend). Las
  credenciales inválidas de Supabase (400 `invalid_credentials`) se muestran con el mensaje genérico
  de US-39.
- **Registro:** no lleva rol. Toda cuenta nueva es locataria (regla del equipo, 27/09/2026) y pasa
  a ser también locadora al publicar su primera propiedad. El PR #2 (`rol` en el body) se cerró sin
  mergear. Errores: 400 con el mensaje de la validación; **409** si el mail ya existe
  (Supabase Auth) o si el DNI ya existe (índice único `uq_usuario_numero_documento`). El back crea
  la cuenta confirmada: el front inicia sesión solo después del 201.
- **`/usuarios/me`:** 401 sin token o con token inválido. Desde `feature/consultar_usuario` el perfil
  sale de la fila de `usuario` (`usuarioService.obtenerMiPerfil`, por `authUserId`) y, si no existe,
  responde **404** "No se encontró el perfil del usuario autenticado." (lo mapea el `apiClient`).
  La contraseña nunca se devuelve. **Locador abarca a locatario:** una cuenta que publicó devuelve
  `["locatario", "locador"]` (el registro guarda locatario y el alta suma locador, desde el 29/09).
  Las cuentas locadoras viejas sin la fila de locatario devuelven solo `["locador"]`.

## Propiedades

| Método y ruta | Auth | Estado | US | Service | Body / query | Respuesta (`data`) |
|---|---|---|---|---|---|---|
| `GET /inmuebles/disponibles` | — | parcial (ver notas) | US-34 | `propiedades.service#listarPropiedadesPublicadas`, `#listarPropiedadesRecientes`, `#buscarPropiedades`, `#contarPropiedades`, `#listarUbicaciones` | el front manda solo `page=1&limit=1000` (la landing, `page=1&limit=6`). El back documenta `barrio, precioMin, precioMax, tipo, dormitorios, ambientes, superficieMin, superficieMax, tags, indiceAjuste, page, limit, orden, direccion`, y desde ce677a4 (29/09) filtra, ordena y pagina con todos (probado el 06/10; `barrio` por nombre exacto, `dormitorios`/`ambientes` igual exacto) | `{ items: InmuebleDisponibleResponse[], total, page, limit, totalPages }`, por id descendente; cada item con `tipo`, `tags` e `indice_ajuste` como `{ id, descripcion }`, `precio`, `expensas` (0 sin contrato), `foto_principal` y `fecha_disponible` → `inmuebleDisponibleToPropiedadResumen` |
| `GET /inmuebles/disponibles/:id` | — (público; el front manda Bearer si hay sesión, hoy se ignora) | **conectado** (09/10; faltan datos) | US-41 (detalle público, Jira) | `propiedades.service#getPropiedad` (antes `GET /inmuebles/:id`, renombrada el 26/09) | — | `InmuebleDetalleResponse`: como el item de arriba más `servicio` y `fotos` → `inmuebleDetalleToPropiedadDetalle`. 400 id inválido, 404 si no existe o no está disponible (el front muestra los dos como "Esta publicación ya no está disponible"). Le faltan dueño, estado, condiciones del contrato, medios de pago y si el usuario ya la solicitó (ver `HANDOFF-BACKEND.md` §7, US-41) |
| `GET /locadores/:idLocador/barrios` | Bearer + rol `locador` (solo el propio id; otro → 403) | existe, sin usar | US-02 (filtro de barrio) | — | — | `string[]` (barrios de las propiedades del locador) |
| `GET /mis-alquileres/:id` | Bearer + rol `locador` | **pendiente (propuesto)**; hoy el front usa el puente `GET /mis-alquileres` + buscar el id (09/10) | US-03 y US-04 (detalle del locador) | `propiedades.service#getMiPropiedad` | — | `MisAlquileresDetalleResponse` (`apps/web/src/services/shared/backend-dtos.ts`): los mismos campos que el cuerpo de `POST /inmuebles` (dirección **exacta**, `tags`, `fotos` con `orden` y `es_principal`, `condiciones_contrato`), más `fecha_publicacion` y `contrato_vigente: { id, locatario, fecha_fin, proximo_ajuste, monto_actual } \| null`. **404 si el inmueble no existe, está eliminado o no es del que llama** (el front muestra lo mismo en los tres casos). Va en la familia `/mis-alquileres`, que ya filtra por dueño, para no confundirla con el detalle público |
| `GET /mis-alquileres` | Bearer + rol `locador` | parcial | US-02 | `propiedades.service#listarMisPropiedades` | el back documenta `barrio, tipo, estado, reclamos`, pero no los aplica (el front filtra en el cliente) | `MisAlquileresItem[]` (todos los inmuebles del locador; desde el 29/09 también `contrato.locatario`, `contrato.fecha_proximo_ajuste` y `posee_reclamos_no_resueltos`, que el front suma en el próximo PR; con `fotos`, `foto_principal`, `tags` y `contrato` con `monto_alquiler`, `expensas`, `indice_aumento` como texto y `medios_pago` como nombres) → `misAlquileresItemToPropiedadLocador`. 401 / 403 |
| `POST /inmuebles` | Bearer, cualquier rol (desde el 29/09, d88deca: además le suma el rol locador al usuario, en una transacción) | conectado (29/09: alta real de punta a punta con fotos en Storage) | US-01 | `propiedades.service#registrarPropiedad` | `CreateInmuebleCompletoPayload`: inmueble + `tags: number[]` + `fotos: { url, peso_kb, formato, es_principal }[]` (3 a 50, jpg/png, ≤ 350 KB) + `condiciones_contrato` (`monto_alquiler, expensas, indice_aumento (id), frecuencia_ajuste (texto), duracion_meses, deposito (monto), interes_por_dia, dias_gracia, medios_pago: number[]`) → `propiedadNuevaToCreateInmueble` | `Inmueble` creado (201). 400 con el mensaje de cada regla, 401. Si volviera un 403, el front muestra "Todavía no podés publicar desde esta cuenta…" |
| Supabase Storage, bucket `fotos-propiedades` | sesión del usuario | conectado (29/09; desde el 30/09 también borra las fotos de un alta fallida) | US-01 | `propiedades.service#subirFotoPropiedad` | archivo en `<auth.uid>/<uuid>.<jpg\|png>`, `upsert: false` | URL pública, `peso_kb` (redondeado hacia arriba) y `formato` |
| `GET /catalogos/ubicaciones` | — | pendiente (propuesto) | US-34 | `propiedades.service#listarUbicaciones` | — | `UbicacionOpciones` (hoy se arma con los datos) |
| `DELETE /inmuebles/:id` | Bearer + rol `locador` (solo el dueño del inmueble) | **conectado** (09/10, `develop` b7ebf48) | US-04 | `propiedades.service#eliminarPropiedad` (errores: `propiedad.adapter.ts#errorDeEliminarPropiedad`: 403/404 → "No encontramos esta propiedad.", 409 → "No podés eliminar una propiedad con contrato vigente.") | — | Mensaje de éxito, sin `data` (200). **Baja lógica:** el inmueble queda con `activo = false` (no se borra la fila) y sus contratos pasan a `estado = 3` (finalizado) y `activo = false`, todo en la función SQL `eliminar_inmueble_logico` (una transacción). Solo se puede eliminar un inmueble `publicado` o `pausado`. 400 id inválido, 401, 403 (no es el dueño), 404 (no existe o ya estaba inactivo), 409 (`alquilado` o `publicado/alquilado`, o un estado que no permite eliminar). Un inmueble inactivo desaparece de `/inmuebles/disponibles`, de `/mis-alquileres`, de los barrios del locador y del detalle público |
| `PUT /inmuebles/:id` | Bearer + rol `locador` (solo el dueño del inmueble) | **conectado** (11/10, `develop` b5acfa7; probado en real con el inmueble 25) | US-03 | `propiedades.service#actualizarPropiedad(id, guardada, editada)` (cuerpo: `propiedad.adapter.ts#cambiosToUpdateInmueble`, solo lo que cambió respecto de la precarga; errores: `#errorDeActualizarPropiedad`: 403/404 → "No encontramos esta propiedad.", 409 → "No podés editar una propiedad alquilada.", 400 con el texto del back) | Campos editables, todos opcionales: `tipo, descripcion, provincia, ciudad, barrio, direccion, numero, piso, m2_totales, m2_cubiertos, ambientes, dormitorios, banos, antiguedad, precio_publicado, fecha_disponible, servicios`, más `fotos` (3 a 50, una principal como máximo) y `tags` (ids). Lo que se omite conserva su valor; `fotos` y `tags`, si se envían, **reemplazan** la lista completa (`tags: []` los borra) | 200 con el inmueble actualizado. Todo ocurre en la función SQL `actualizar_propiedad_completa` (una transacción, con la fila bloqueada). **No se puede cambiar** `estado_alquiler` ni datos del contrato (400). 400 id inválido o datos incorrectos, 401, 403 (no es el dueño), 404 (no existe o está inactivo), 409 (`alquilado` o `publicado/alquilado`) |
| `PATCH /inmuebles/:id/publicacion` | Bearer + rol `locador` | pendiente (propuesto) | publicar/pausar (sin US en Sprint 0, mapa US-40) | `propiedades.service#cambiarEstadoPublicacion` (sin usar) | `{ activa: boolean }` | — |

Mapeos del alta (US-01), documentados en `services/adapters/propiedad.adapter.ts`:

- Tipo: `departamento → 1`, `casa → 2`, `ph → 3`, `monoambiente → 4`.
- Tags: `mascotas → 1`, `cochera → 2`, `amoblado → 3`, `balcon → 4`; `apto-profesional` no se manda.
- Medios de pago: `transferencia → 1`, `efectivo → 2`, MercadoPago débito y crédito → `3`
  (deduplicado); el recargo no se guarda.
- Índice: `ICL → 1`, `IPC → 2` (la base además tiene CAC, 3).
- Estado: `publicada → 'publicado'`, `pausada → 'pausado'`, `alquilada` con fecha de
  disponibilidad → `'publicado/alquilado'` (+ `fecha_disponible`; así aparece en `/buscar`), y sin
  fecha → `'alquilado'`.
- `frecuencia_ajuste`: "Mensual", "Bimestral", "Trimestral", "Cuatrimestral", "Semestral", "Anual" o
  "N meses". `deposito`: meses × precio. Piso y depto van juntos en `piso` ("3° B").

Búsqueda (US-34), `GET /inmuebles/disponibles`:

- Desde ce677a4 (29/09) el back filtra, ordena y pagina (probado el 06/10). La landing ya le pide
  `limit=6`; `/buscar`, las opciones de ubicación y "Propiedades similares" todavía traen todas en un
  pedido (hasta 1000) y filtran, ordenan y paginan en el cliente, con las mismas reglas que el modo
  mock: pasarlas al back queda para la tanda de conexión. Detalle y brechas en `HANDOFF-BACKEND.md`
  §7 (US-34).
- `GET /inmuebles/disponibles/:id` manda `null` en `precio` y `expensas` cuando el inmueble no tiene
  contrato. NOTA: antes del 29/09 mandaba `-1`; el adaptador acepta los dos (y cualquier negativo)
  como "no informado" y la pantalla muestra "Consultar" (`TODO(backend)`: confirmar que ya no
  manda `-1`).

## Problemas de las rutas de inmuebles (tanda 3 del Sprint 2)

Encontrados al revisar `PUT` y `DELETE /inmuebles/:id` para US-03 y US-04 (y el de `/disponibles`, con la
US-35 actualizada). En orden de gravedad;
detalle y propuesta en `HANDOFF-BACKEND.md` §10 (y el texto del issue, que abre el PO).

| Gravedad | Problema | Dónde |
|---|---|---|
| ~~🔴 Crítica~~ | ~~`PUT /inmuebles/:id` no chequea que el inmueble sea del que llama~~ **Resuelto (10/10, b5acfa7):** valida el dueño (403) y solo actualiza columnas editables, en la función SQL `actualizar_propiedad_completa`. | — |
| 🔴 Alta | `GET /inmuebles` está **abierto** (sin token) y devuelve todos los inmuebles con la **dirección exacta** y el `id_locador`. El front no la usa. | `routes/v1/inmuebles.routes.ts` (línea 7), `inmueble.repository.ts#findAll` |
| 🟠 Media | `DELETE` (lógico desde el 09/10) **bloquea por `estado_alquiler` y no por contrato vigente**, **no cancela solicitudes** y **deja las fotos en el bucket público**. Responde 403 (no 404) para un inmueble ajeno. | `supabase/migrations/20261009000000_us04_eliminacion_logica_inmueble.sql` (`eliminar_inmueble_logico`) |
| 🔴 Alta | `GET /inmuebles/disponibles` y `/disponibles/:id` (públicas) devuelven **calle, altura y piso sin token**: la regla "sin sesión, la aproximada" del front es solo cosmética. Sin token, mandar la calle y la cuadra, nunca el piso. | `routes/v1/inmuebles.routes.ts`, `InmuebleDisponibleResponse` / `InmuebleDetalleResponse` |
| ~~🟡 Baja~~ | ~~`PUT` responde 400 en lugar de 404~~ **Resuelto (10/10, b5acfa7):** 404 si no existe o está inactivo. | — |
| 🔴 Alta | `PUT` cambia `precio_publicado`, pero `/disponibles` y `/disponibles/:id` muestran (y filtran por) `contrato.monto_alquiler`: el precio editado no se ve en la búsqueda, que es lo que ven los inquilinos (HANDOFF §10, punto 25). | `services/inmueble.service.ts`, función `actualizar_propiedad_completa` |
| 🟠 Media | Las fotos que se sacan en una edición quedan en el bucket público (HANDOFF §10, punto 27). | `services/inmueble.service.ts`, función `actualizar_propiedad_completa` |
| 🔴 Alta | El default de `error.middleware` pasó a 500: las validaciones del alta sin `statusCode` ahora salen como 500 (HANDOFF §10, punto 24). | `gateway/middlewares/error.middleware.ts`, `services/inmueble.service.ts` |

## Solicitudes (Sprint 2)

**Existen en `develop` desde el 12/10** (Thiago) y el front las usa desde la tanda 5 (13/10). Código
del back: `apps/api/src/routes/v1/solicitudes.routes.ts`, `controllers/solicitud.controller.ts`,
`services/solicitud.service.ts`, `repositories/solicitud.repository.ts` y `dtos/solicitud.dto.ts`.
En el front: `services/solicitudes.service.ts`, `services/adapters/solicitud.adapter.ts` (DTOs,
vistas y errores traducidos) y la copia de los DTOs en `services/shared/backend-dtos.ts`. Todas con
**Bearer** (el usuario sale del token) y el sobre `{ success, data, message?, error? }`. Las
diferencias con la propuesta original y lo que falta están en
[`HANDOFF-BACKEND.md`](HANDOFF-BACKEND.md) §7, "US-35 a US-38".

| Método y ruta | Auth | Estado | US (Jira) | Service | Body / query | Respuesta (`data`) | Errores | Mail que dispara |
|---|---|---|---|---|---|---|---|---|
| `GET /solicitudes/preparar` | Bearer | existe | US-35 | `#prepararSolicitud` | `?id_inmueble=` (entero) | `SolicitudPreparacionResponse`: `usuario` (nombre, apellido, DNI, teléfono sin "+", email), catálogos de ocupación y garantías, `garantias_exigidas` (hoy siempre `[]`) y `valores_iniciales` | 400 id inválido; 401; 403 propia; 404 no existe; 409 "ya no recibe solicitudes" (no está `publicado` ni `publicado/alquilado`). **No** detecta una duplicada | — |
| `POST /solicitudes` | Bearer, cualquier rol | existe | US-35 (actualizada) | `#enviarSolicitud` | `CrearSolicitudRequest`: `{ id_inmueble, mensaje?, telefono, email, ocupacion, ingresos, convivientes, mascotas, detalle_mascotas, garantias, acepta_condiciones }`. `telefono` E.164 (el back lo guarda sin "+"); `ingresos` entero > 0 o **`null`** = no informa (un 0 lo pasa a `null`); `detalle_mascotas` ≤ 300; mensaje ≤ 600 | `SolicitudResponse` (201, `pendiente`) | 400 por dato inválido; 401; 403 propia; 404 no existe; **409 "Ya tenés una solicitud activa para esta propiedad"** (pendiente o aceptada). **No** valida que esté publicada ni las garantías exigidas | Al **locador** (US-35): **no se manda todavía** |
| `GET /solicitudes/mias` | Bearer | existe | US-36 (y US-35: botón del detalle y "N pendientes en otras propiedades") | `#listarMisSolicitudes`; con `?inmueble=`, `#getMiSolicitudParaPropiedad`; con `?estado=pendiente`, `#contarMisSolicitudesPendientes` | `estado`, `inmueble` (opcionales) | `SolicitudResponse[]`, de la más nueva a la más vieja. **Sin canceladas** (`?estado=cancelada` da vacío). **Con** DNI, contacto y legajo propios (el adaptador los descarta) | 400 filtro inválido; 401 | — |
| `GET /solicitudes/recibidas` | Bearer + rol `locador` | existe | US-36 | `#listarSolicitudesRecibidas` (lista, sin datos sensibles); con `?inmueble=`, `#getSolicitudRecibida` (puente del detalle); con `?estado=pendiente`, `panel.service#getSolicitudesPendientes` | `estado`, `inmueble` (opcionales) | `SolicitudResponse[]` de los inmuebles del locador, con DNI, contacto y legajo. **Sin canceladas** | 400; 401; 403 sin rol | — |
| `GET /solicitudes/:id` | Bearer (dueño o postulante) | **no existe — propuesto** | US-36 | `#getSolicitudRecibida` (hoy por el puente de arriba) | — | `SolicitudResponse` con DNI, contacto y legajo solo para el dueño del inmueble | 401; 404 si no es parte | — |
| `PATCH /solicitudes/:id/aceptar` | Bearer + rol `locador` (dueño) | existe | US-37 | `#aceptarSolicitud` | — | `SolicitudResponse` (`aceptada`) | 400; 401; 403; 404 si no es suya; 409 si ya no está pendiente. **No** controla que el inmueble ya tenga otra aceptada (lo sostiene el front) ni cambia el estado del inmueble | Al **locatario** (US-37): **no se manda todavía** |
| `PATCH /solicitudes/:id/rechazar` | Bearer + rol `locador` (dueño) | existe | US-37 | `#rechazarSolicitud` | Body opcional `{ mensaje_rechazo }` (≤ 200). **El front lo manda solo si hay motivo** (sin espacios en los bordes); sin motivo, el `PATCH` va sin cuerpo. US-36 lo muestra en los listados, truncado a 80 | `SolicitudResponse` (`rechazada`) | 400 (también si el motivo pasa de 200: "El mensaje de rechazo no puede superar los 200 caracteres.", que el front traduce); 401; 403; 404; 409 si ya no está pendiente | — |
| `PATCH /solicitudes/:id/cancelar` | Bearer (**solo el postulante**) | existe | Sin US en Sprint 0 (postulante, mapa US-39). **US-38 (locador) no está** | `#cancelarSolicitud` | — | `SolicitudResponse` (`cancelada`) | 400; 401; **404 si no es el postulante (también el locador)**; 409 si no está pendiente | Al **locatario** si cancela el locador (US-38): no aplica todavía |

`SolicitudResponse` (`apps/api/src/dtos/solicitud.dto.ts`):

```ts
{
  id: number
  estado: string                    // nombre de estado_solicitud: pendiente | aceptada | rechazada | cancelada
  mensaje: string | null
  mensaje_rechazo?: string | null   // motivo del rechazo (US-37), ≤ 200; null si no tiene
  fecha_creacion: string            // ISO, con hora
  fecha_respuesta: string | null    // ISO: cuándo dejó de estar pendiente (también al cancelar)
  inmueble: { id, direccion, numero, piso?, barrio, foto_principal: string | null }
  postulante: { id, nombre, apellido?, dni?, telefono?, email? }   // siempre; teléfono sin "+"
  legajo: { ocupacion, ingresos: number | null, convivientes, mascotas, detalle_mascotas, garantias } | null
}
```

Notas:

- **Quién cancela (decidido por el PO, tanda 2 del Sprint 2):** una sola ruta,
  `PATCH /solicitudes/:id/cancelar`, que decide según quién llama y el estado:
  - **dueño del inmueble + `aceptada`** → `cancelada` (US-38), con mail al locatario. **El back
    todavía no lo hace** (HANDOFF §7, brecha 1): en real el front oculta el botón.
  - **postulante + `pendiente`** → `cancelada` (sin US en Sprint 0, mapa US-39). **Hecho.**
- **Transiciones permitidas** (las mismas que `TRANSICIONES_SOLICITUD` en
  `apps/web/src/lib/validation/solicitud.rules.ts`): aceptar y rechazar, del locador desde
  `pendiente`; cancelar, del locador desde `aceptada` (falta en el back) o del postulante desde
  `pendiente`. Cada una guarda `fecha_respuesta`.
- **Una sola aceptada por inmueble (decidido por el PO):** `PATCH /aceptar` debería responder 409 si
  el inmueble ya tiene otra `aceptada`. **El back todavía no lo controla** (brecha 2): lo sostiene el
  front.
- **Una sola activa por persona e inmueble:** una `pendiente` o `aceptada` impide otra (409). Una
  `rechazada` o `cancelada` no. **Hecho.**
- **Aceptar no rechaza a las demás** solicitudes del inmueble (Flujo de solicitudes · 02). **Hecho.**
- **Dirección con sesión:** quien inició sesión ve la **exacta** con el piso, en `/recibidas`, en
  `/mias`, en el modal y en el detalle de `/propiedad/[id]`.
- **Privacidad del legajo:** el DNI, el teléfono, el email, los ingresos y el resto del legajo los ve
  solo el dueño del inmueble, en el detalle del postulante; nunca en un listado. El back los manda
  siempre (brecha 4): el adaptador los descarta.
- **Garantías exigidas:** el inmueble puede exigir garantías (`requiredGuarantees` en el front);
  alcanza con que el postulante ofrezca **al menos una**. **El back no tiene el dato** (ni el alta ni
  la edición lo cargan; `garantias_exigidas` llega vacío): queda para el Sprint 3 (HANDOFF §7).

## Perfil y legajo (Sprint 3, US-20 y US-21) · PROPUESTO

**Ninguna de estas rutas existe todavía.** Son la propuesta del front (Sprint 3, tanda 1): la
pantalla `/panel/perfil` funciona en modo mock y su rama real ya llama a estas rutas. Cuando el back
las haga, la conexión es ajustar `services/adapters/perfil.adapter.ts`. Código del front:
`services/perfil.service.ts`, `services/adapters/perfil.adapter.ts` y los DTO en
`services/shared/backend-dtos.ts` ("Perfil y legajo"). Todas con **Bearer**: el usuario sale del
token y no hay forma de pedir ni cambiar el perfil de otro (US-20). Brechas y pasos del dashboard en
[`HANDOFF-BACKEND.md`](HANDOFF-BACKEND.md) §7, "US-20 y US-21".

| Método y ruta | Auth | Estado | US | Service | Body | Respuesta (`data`) | Errores |
|---|---|---|---|---|---|---|---|
| `GET /usuarios/me/perfil` | Bearer | pendiente (propuesto) | US-20 | `perfil.service#getMiPerfil` | — | `PerfilResponse` (abajo) | 401 |
| `PATCH /usuarios/me` | Bearer | pendiente (propuesto) | US-21 | `perfil.service#actualizarDatosPersonales` | `ActualizarPerfilRequest`: solo los campos que cambian | `PerfilResponse` actualizado | 400, 401, **409 `DNI_DUPLICADO`**, **409 `IDENTIDAD_BLOQUEADA_POR_CONTRATO`** |
| `PATCH /usuarios/me/legajo` | Bearer | pendiente (propuesto) | US-21 | `perfil.service#actualizarLegajo` | `LegajoDto` (el legajo entero) | `LegajoDto` guardado | 400, 401 |
| Supabase Auth `updateUser({ email }, { emailRedirectTo })` | sesión | listo en el front (sin probar en real) | US-21 | `perfil.service#solicitarCambioDeCorreo` | `{ email }` | `user.new_email` (pendiente) | 422 `email_exists`, 400 `email_address_invalid`, 429 `over_email_send_rate_limit` |
| Supabase Auth `updateUser({ password, current_password })` | sesión | listo en el front; **bloqueante** (ver abajo) | US-21 | `perfil.service#cambiarContrasena` | `{ password, current_password }` | — | 400 `current_password_invalid`, 422 `same_password`, 422 `weak_password` |
| `GET /solicitudes/preparar?id_inmueble=` | Bearer | conectado; **falta el legajo** | US-35 + US-21 | `solicitudes.service#prepararSolicitud` | — | Lo de hoy + `legajo: LegajoDto \| null` (propuesto) | (sin cambios) |

**`PerfilResponse`** (`GET /usuarios/me/perfil`, también la respuesta de `PATCH /usuarios/me`):

```json
{
  "id": 12,
  "nombre": "Sofía",
  "apellido": "Ledesma",
  "email": "sofia.ledesma@rentar.test",
  "numero_documento": "35123456",
  "telefono": "5493515550102",
  "fecha_nacimiento": "1991-02-03",
  "roles": ["locatario", "locador"],
  "contrato_bloqueante": { "codigo": "CT-2026-0148", "estado": "vigente" },
  "legajo": { "ocupacion": "relacion_dependencia", "ingresos": 1450000, "garantias": ["propietaria"] }
}
```

- `telefono`: solo dígitos, con código de país (como en las solicitudes). `null` si no tiene.
- `numero_documento`, `fecha_nacimiento`: `null` si no los tiene (US-20: "Sin cargar").
- `contrato_bloqueante`: un contrato **vigente o pendiente de firma** del que el usuario es parte
  (locador o locatario), o `null`. Si hay varios, cualquiera: el front solo lo nombra.
- `legajo`: `null` si nunca lo cargó. `ocupacion` y `garantias` usan los mismos códigos que las
  solicitudes (`sin_informar`, `relacion_dependencia`…; `propietaria`, `caucion`, `otra`).
  `ingresos`: entero mayor a 0, o `null` (US-21: "un número entero mayor a 0, o vacío"; acá el 0 no
  existe).
- Es una ruta aparte de `/usuarios/me` **a propósito**: `/me` lo pide el `AuthProvider` en cada
  cambio de ruta, y el DNI y los ingresos solo se muestran en el perfil (US-20).

**`ActualizarPerfilRequest`** (`PATCH /usuarios/me`): `{ nombre?, apellido?, numero_documento?,
telefono?, fecha_nacimiento? }`. Solo viaja lo que cambió. El correo **no** va acá (lo cambia
Supabase Auth). Validaciones que el back tiene que repetir (US-21):

| Campo | Regla | Error |
|---|---|---|
| `nombre`, `apellido` | Obligatorios, 2 a 100 caracteres, solo letras, espacios, apóstrofos y guiones | 400 |
| `numero_documento` | 7 u 8 dígitos | 400 |
| `numero_documento` | Único en la plataforma | **409**, `codigo: "DNI_DUPLICADO"` |
| `nombre`, `apellido`, `numero_documento` | No se pueden cambiar si el usuario es parte de un contrato vigente o pendiente de firma | **409**, `codigo: "IDENTIDAD_BLOQUEADA_POR_CONTRATO"` |
| `telefono` | E.164 sin el "+": 10 a 15 dígitos, solo números; `null` lo borra | 400 |
| `fecha_nacimiento` | `YYYY-MM-DD`, mayor de 18 años | 400 |

**Errores con `codigo`.** Para distinguir los dos 409 sin leer el texto, el front propone sumar un
campo `codigo` al sobre de error: `{ "success": false, "error": "Ya existe una cuenta con ese DNI.",
"codigo": "DNI_DUPLICADO" }`. `apiClient` lo guarda en `ServiceError.apiCode`. Sin `codigo`, el
front trata cualquier 409 de esta ruta como DNI duplicado.

**`LegajoDto`** (`PATCH /usuarios/me/legajo`): `{ ocupacion, ingresos, garantias }`, el legajo
entero (reemplaza al anterior). Responde el legajo guardado. 400 si `ingresos` no es un entero mayor
a 0 (o `null`), o si un código no existe.

## Contratos (Sprint 3, US-05) · PROPUESTO

**Ninguna de estas rutas existe todavía.** Son la propuesta del front (Sprint 3, tanda 2): el listado
y el alta funcionan en modo mock y la rama real ya llama a estas rutas. Front:
`services/contratos.service.ts`, `services/adapters/contrato.adapter.ts` y los DTO en
`services/shared/backend-dtos.ts` ("Contratos"). Todas con **Bearer** y **solo para el locador dueño
del inmueble** (el usuario sale del token). Antes de hacerlas, ver el **bloqueante del esquema** en
[`HANDOFF-BACKEND.md`](HANDOFF-BACKEND.md) §7, "US-05".

| Método y ruta | Estado | Service | Body / query | Respuesta (`data`) | Errores |
|---|---|---|---|---|---|
| `GET /contratos` | pendiente (propuesto) | `contratos.service#listarContratos` | — | `ContratoResumenResponse[]` | 401 |
| `GET /contratos/preparar?id_solicitud=` | pendiente (propuesto) | `#prepararContrato` | `id_solicitud` | `ContratoResponse` sin guardar (`id`, `codigo` y `condiciones` en `null`, `clausulas: []`) | 404 (la solicitud no existe o no es de un inmueble suyo), **409** `SOLICITUD_NO_ACEPTADA`, `SOLICITUD_CON_CONTRATO`, `PROPIEDAD_CON_CONTRATO` |
| `POST /contratos` | pendiente (propuesto) | `#guardarBorrador` (sin id) | `ContratoRequest` | 201 `ContratoResponse` (`estado: "borrador"`) | 400, 404, **409** `SOLICITUD_CON_CONTRATO`, `PROPIEDAD_CON_CONTRATO` |
| `PUT /contratos/:id` | pendiente (propuesto) | `#guardarBorrador` (con id) | `ContratoRequest` | 200 `ContratoResponse` | 400, 404, **409** `CONTRATO_NO_EDITABLE` |
| `DELETE /contratos/:id` | pendiente (propuesto) | `#eliminarBorrador` | — | 204 | 404, **409** `CONTRATO_NO_EDITABLE` |
| `POST /contratos/:id/enviar` | pendiente (propuesto) | `#enviarAFirmar` | — | 200 `ContratoEnviadoResponse` | 400 (falta un dato), 404, **409** `CONTRATO_NO_EDITABLE`, `PROPIEDAD_CON_CONTRATO` |
| `GET /contratos/:id` | pendiente (propuesto) | `#getContrato` | — | `ContratoResponse` (desde US-07, `ContratoDetalleResponse`: ver "Firma de contratos") | 404 (no existe o no es suyo: no se distingue) |
| `GET /solicitudes/recibidas` | conectado; **faltan dos campos** | `solicitudes.service#listarSolicitudesRecibidas` | (sin cambios) | Lo de hoy + `id_contrato`, `estado_contrato` y `inmueble_con_contrato` (propuestos) | (sin cambios) |

**Los 409 llevan `codigo`** en el sobre (`{ success: false, error, codigo }`), como los del perfil. El
front los traduce en `contrato.adapter.ts#errorDeContrato`; sin `codigo`, usa el más común de cada ruta.

**`ContratoResumenResponse`** (`GET /contratos`), una fila del listado. Sin DNI ni contacto:

```json
{
  "id": 207,
  "codigo": "CT-2026-0207",
  "estado": "pendiente_firma",
  "inmueble": { "id": 8, "direccion": "Rondeau", "numero": 480, "piso": "PB", "barrio": "Güemes" },
  "locatario": { "nombre": "Julieta", "apellido": "Peralta" },
  "monto_actual": 385000,
  "fecha_inicio": "2026-10-01",
  "fecha_fin": "2029-09-30",
  "indice": "ICL",
  "proximo_ajuste": "2027-04-01",
  "id_solicitud": 31
}
```

- `estado`: `borrador`, `pendiente_firma`, `vigente`, `finalizado` o `rescindido`.
- `codigo`: `null` en los borradores (se asigna al enviar a firmar).
- `indice`: `sin_ajuste`, `ICL`, `IPC` o `CAC`. `proximo_ajuste`: `null` si no quedan ajustes.
- `monto_actual`: el monto con los ajustes aplicados (en un borrador, el inicial cargado o `null`).

**`ContratoResponse`** (`GET /contratos/:id`, `/preparar`, y la respuesta de `POST` y `PUT`):

```json
{
  "id": 207,
  "codigo": "CT-2026-0207",
  "estado": "pendiente_firma",
  "id_solicitud": 31,
  "fecha_aceptacion_solicitud": "2026-09-21",
  "inmueble": {
    "id": 8, "direccion": "Rondeau", "numero": 480, "piso": "PB", "barrio": "Güemes",
    "precio_publicado": 385000, "indice_publicacion": "ICL",
    "medios_pago": [1, 4], "dias_gracia": 5, "interes_por_dia": 0.5
  },
  "locador": { "id": 1, "nombre": "Nicolás", "apellido": "Arrieta", "numero_documento": "30123456", "email": "nicolas.arrieta@rentar.test", "telefono": "543515550101" },
  "locatario": { "id": 3, "nombre": "Julieta", "apellido": "Peralta", "numero_documento": "40123456", "email": "julieta.peralta@rentar.test", "telefono": "543515550103" },
  "garantias_ofrecidas": ["caucion"],
  "garantes": [{ "nombre_apellido": "Hugo Peralta", "numero_documento": "14902338", "email": "hugo.peralta@rentar.test" }],
  "condiciones": {
    "fecha_inicio": "2026-10-01", "duracion_meses": 36, "monto_inicial": 385000, "deposito": 385000,
    "dia_vencimiento": 10, "indice": "ICL", "periodicidad": "semestral"
  },
  "clausulas": [{ "clave": "objeto", "tipo": "fija", "titulo": "Partes, objeto y destino", "texto": "…", "editada": false }],
  "ultimo_paso": 3
}
```

- `locador` y `locatario` salen de `usuario`: el front **no** los manda al guardar.
- `garantias_ofrecidas`: las que el locatario ofreció en la solicitud (`solicitud_x_garantia`).
- `medios_pago`: ids de `medio_pago`, como en `/mis-alquileres`.
- `clausulas`: el texto completo que se firma. Las arma el front con su plantilla
  (`apps/web/src/lib/contratos/plantilla.ts`); el back las **guarda tal cual**. `clave` es la de la
  plantilla (`objeto`, `plazo`, `precio`…) o `propia-<n>`.
- `ultimo_paso`: de 0 a 3, para retomar el borrador donde quedó.

**`ContratoRequest`** (`POST /contratos` y `PUT /contratos/:id`): `{ id_solicitud, garantes,
condiciones, clausulas, ultimo_paso }`. Un borrador puede guardarse con datos incompletos
(`condiciones` con campos en `null`). Validaciones que el back tiene que repetir **al enviar**
(`POST /contratos/:id/enviar` responde 400 con el primer error):

| Dato | Regla (US-05) |
|---|---|
| Garantes | Hasta 3. Nombre y apellido, DNI (7 u 8 dígitos) y correo (formato de US-35), los tres obligatorios. Sin repetir DNI ni correo entre garantes. No pueden ser el locador ni el locatario. |
| `fecha_inicio` | Obligatoria, no anterior a hoy. |
| `duracion_meses` | Entero mayor a 0. |
| `monto_inicial` | Entero mayor a 0. |
| `deposito` | Entero mayor o igual a 0 (puede ser `null`: sin depósito). |
| `dia_vencimiento` | Entero de 1 a 28. |
| `periodicidad` | Obligatoria si `indice` no es `sin_ajuste`; `null` si lo es. |
| Cláusulas | Las editables y las propias, no vacías y de hasta 1.000 caracteres. Las fijas no se pueden cambiar. |

- **Fecha de fin** (la calcula el back al guardar): inicio + N meses − 1 día; si ese día no existe en
  el mes de destino, el último día de ese mes (31/01 + 1 mes → 28/02). **Ajustes:** floor((N − 1) /
  período); el primero, en inicio + período. Casos verificados en `lib/contratos/fechas.ts`.
- **`POST /contratos/:id/enviar`**: pasa a `pendiente_firma`, asigna el código `CT-AAAA-NNNN`
  (correlativo por año) y lo deja inmutable. **No toca el inmueble** (sigue publicado, decisión del
  PO). 409 `PROPIEDAD_CON_CONTRATO` si mientras tanto otro contrato del inmueble quedó vigente o
  pendiente.
- **`ContratoEnviadoResponse`**: `{ id, codigo, estado: "pendiente_firma" }`.

## Firma de contratos (Sprint 3, US-07) · PROPUESTO

**Ninguna de estas rutas existe todavía.** Propuesta del front (Sprint 3, tanda 3): el detalle y la
firma funcionan en modo mock y la rama real ya llama a estas rutas. Front: `contratos.service.ts`
(`getDetalleContrato`, `firmarContrato`, `rechazarFirma`, `cancelarEnvio`, `reenviarInvitacion`),
`contrato.adapter.ts#contratoDetalleDeDto` y los DTO de `backend-dtos.ts` ("Firma de contratos").
Todas con **Bearer**; el usuario sale del token. **Firman el locador y el locatario** (decisión del
PO): el garante es un dato del contrato y no firma en el Sprint 3.

| Método y ruta | Estado | Service | Quién | Body | Respuesta (`data`) | Errores |
|---|---|---|---|---|---|---|
| `GET /contratos?rol=locatario` | pendiente (propuesto) | `#getMiAlquiler` | el usuario como locatario | — | `ContratoResumenResponse[]` (los contratos donde es locatario; el front elige el pendiente de firma o el vigente) | 401 |
| `GET /contratos/:id` | pendiente (propuesto; amplía el de US-05) | `#getDetalleContrato` (y `#getContrato` del alta) | locador o locatario del contrato; un **borrador, solo el locador** | — | `ContratoDetalleResponse` | **404** si no existe o no es parte (**uno solo**, sin distinguir) |
| `POST /contratos/:id/firmar` | pendiente (propuesto) | `#firmarContrato` | locador o locatario | — | 200 `ContratoDetalleResponse` | 404, **409** `CONTRATO_NO_PENDIENTE`, `YA_FIRMO`, `FIRMA_RECHAZADA` |
| `POST /contratos/:id/rechazar` | pendiente (propuesto) | `#rechazarFirma` | **solo el locatario** | `{ "motivo": string \| null }` | 200 `ContratoDetalleResponse` | 400 (motivo de más de 300), 403 (es el locador), 404, **409** `CONTRATO_NO_PENDIENTE`, `YA_FIRMO`, `FIRMA_RECHAZADA` |
| `POST /contratos/:id/cancelar-envio` | pendiente (propuesto) | `#cancelarEnvio` | **solo el locador** | — | 200 `ContratoDetalleResponse` (`estado: "borrador"`) | 403 (es el locatario), 404, **409** `OTRA_PARTE_FIRMO`, `CONTRATO_NO_PENDIENTE` |
| `POST /contratos/:id/reenviar` | pendiente (propuesto) | `#reenviarInvitacion` | **solo el locador** | `{ "rol": "locatario" }` | 200 `ContratoDetalleResponse` | 403, 404, **409** `FIRMANTE_NO_PENDIENTE`, `CONTRATO_NO_PENDIENTE`, **429** (menos de una hora desde la última invitación) |

**El historial viene dentro del detalle** (propuesta): no tiene otro uso y así la pantalla hace un
solo pedido. Las cuatro acciones responden el detalle actualizado, así el front no vuelve a pedirlo.

**`ContratoDetalleResponse`** = `ContratoResponse` (ver "Contratos") más:

```json
{
  "fecha_envio": "2026-09-22T11:40:00",
  "fecha_firma_completa": null,
  "firmas_registradas": true,
  "fecha_fin": "2029-09-30",
  "firmantes": [
    { "rol": "locador", "id_usuario": 1, "nombre": "Nicolás", "apellido": "Arrieta", "estado": "firmado",
      "fecha_firma": "2026-09-23T15:47:00", "fecha_rechazo": null, "motivo_rechazo": null,
      "fecha_ultima_invitacion": "2026-09-22T11:40:00" },
    { "rol": "locatario", "id_usuario": 3, "nombre": "Julieta", "apellido": "Peralta", "estado": "pendiente",
      "fecha_firma": null, "fecha_rechazo": null, "motivo_rechazo": null,
      "fecha_ultima_invitacion": "2026-09-23T15:47:00" }
  ],
  "historial": [
    { "id": 4, "tipo": "firmado", "fecha": "2026-09-23T15:47:00", "rol": "locador", "nombre": "Nicolás Arrieta", "motivo": null },
    { "id": 3, "tipo": "reenviado", "fecha": "2026-09-23T15:47:00", "rol": "locatario", "nombre": "Julieta Peralta", "motivo": null },
    { "id": 2, "tipo": "enviado", "fecha": "2026-09-22T11:40:00", "rol": null, "nombre": null, "motivo": null },
    { "id": 1, "tipo": "creado", "fecha": "2026-09-21T17:22:00", "rol": null, "nombre": null, "motivo": null }
  ]
}
```

- `firmantes[].estado`: `pendiente`, `firmado` o `rechazado`. **La IP se guarda en la base y NO viaja
  al front** (US-07: "se deben registrar la fecha, la hora y la IP de cada firma").
- `fecha_ultima_invitacion`: el envío o el último reenvío. Con eso el front explica hasta cuándo no
  se puede reenviar (una hora después).
- `historial[].tipo`: `creado`, `enviado`, `firmado`, `rechazado`, `reenviado`, `envio_cancelado` o
  `vigente`. Del más reciente al más viejo. `motivo` solo en `rechazado`.
- `fecha_firma_completa`: la de la última firma, cuando firmaron las dos partes ("Firmado por todas
  las partes el dd/mm/aaaa").
- `firmas_registradas`: `false` en los contratos cargados antes de RentAR (sin firmas ni historial).

**Reglas que tiene que aplicar el back**

| Acción | Regla (US-07) |
|---|---|
| Firmar | Solo `pendiente_firma`. Una parte no firma dos veces (409 `YA_FIRMO`). Registra fecha, hora e **IP**. Quien rechazó no puede firmar después (409 `FIRMA_RECHAZADA`, decisión del PO): el locador cancela el envío y lo vuelve a enviar. |
| Última firma | En **una transacción**: el contrato pasa a `vigente` (con `fecha_firma_completa`); el inmueble, a **alquilado** (deja de salir en `/inmuebles/disponibles`); y sus solicitudes `pendiente` pasan a `rechazada` con `mensaje_rechazo` = "La propiedad ya fue alquilada." |
| Rechazar | Solo el locatario y solo `pendiente_firma`. Motivo opcional, hasta 300 caracteres (`null` si viene vacío). **No cambia el estado del contrato.** |
| Cancelar el envío | Solo el locador, mientras el **locatario** no haya firmado (la firma del propio locador no cuenta y se borra). Vuelve a `borrador`, borra las firmas y queda editable. **Conserva el `codigo`** (si se vuelve a enviar, sale con el mismo). |
| Reenviar | Solo el locador, a un firmante `pendiente` (hoy, el locatario). Una vez por hora por firmante: 429 si pasó menos. Actualiza `fecha_ultima_invitacion`. Hoy no se manda ningún mail (el front lo aclara). |

## Mis alquileres (Sprint 3, US-27) · PROPUESTO

Ficha y listado del locatario. Front: `contratos.service.ts` (`listarMisAlquileres`,
`contarMisAlquileres`, `getMiAlquiler`). **`GET /mis-alquileres` no cambia**: es de las propiedades del
locador.

| Método y ruta | Estado | Service | Respuesta (`data`) | Errores |
|---|---|---|---|---|
| `GET /contratos?rol=locatario` | pendiente (propuesto) | `#listarMisAlquileres`, `#contarMisAlquileres`, `#getMiAlquiler` (sin id) | `ContratoResumenResponse[]` de los contratos donde el usuario es **locatario**, **con `locador: { nombre, apellido }`** | 401 |
| `GET /contratos/:id` | pendiente (propuesto; ver "Firma de contratos") | `#getMiAlquiler(id)` | `ContratoDetalleResponse` + `monto_actual` + `inmueble.foto_principal` | 404 único (no existe o no es su locatario) |

- Estados que cuentan: `pendiente_firma`, `vigente` y `finalizado` (el front filtra si llegan otros).
- Con uno, el front muestra la ficha; con dos o más, el listado. El front ordena (pendientes, vigentes,
  finalizados).
- `locador` en la fila: solo nombre y apellido. El contacto (`email`, `telefono`) viene en el detalle.

## Panel del locador (`/panel`)

Módulos de sprints futuros. En modo real, las funciones devuelven vacío (con `TODO(backend)`) y la
pantalla muestra sus estados vacíos; los conteos de propiedades salen de `GET /mis-alquileres`.

| Método y ruta | Auth | Estado | US del módulo | Service | Respuesta (`data`) |
|---|---|---|---|---|---|
| `GET /panel/cobros` | Bearer | pendiente (propuesto) | US-08, US-09 | `panel.service#getResumenCobros` | `ResumenCobros` |
| `GET /panel/reclamos` | Bearer | pendiente (propuesto) | US-14 a US-18 | `panel.service#getResumenReclamos` | `ResumenReclamos` |
| `GET /panel/contratos?dias=60` | Bearer | pendiente (propuesto) | US-05 a US-07 | `panel.service#getEventosContratos` | `EventoContratoPanel[]` |
| `GET /solicitudes/recibidas?estado=pendiente` | Bearer + rol `locador` | pendiente (propuesto; ver "Solicitudes") | US-36 | `panel.service#getSolicitudesPendientes` | `SolicitudResponse[]` → `SolicitudPanel` |

Cómo se calcula cada cifra (cobrado del mes, vencidos, días de atraso, reclamos sin responder,
eventos de 60 días): encabezado de `apps/web/src/lib/mocks/panel.mock.ts`. El back puede devolver
las cifras ya calculadas con esas mismas reglas.

Todos los tipos de respuesta propuestos están en `packages/shared-types/src/` (`propiedad.ts`,
`filters.ts`, `panel.ts`, `usuario-sesion.ts`).
