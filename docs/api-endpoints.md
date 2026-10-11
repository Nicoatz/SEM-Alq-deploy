# Endpoints que usa el frontend — Sprints 1 y 2

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
| `GET /usuarios/me` | Bearer | conectado | US-39 | `usuarios.service#getUsuarioActual` (y `useAuth().refrescarUsuario` después de publicar) | — | `{ id, nombre, apellido, email, roles: string[] }` → `usuarioMeToSesion`. Propuesto: una cuenta locadora devuelve `["locador", "locatario"]` |
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
- **`/usuarios/me`:** 401 sin token, con token inválido o si el usuario de Auth no tiene fila en
  `usuario`. **Locador abarca a locatario:** una cuenta que publicó devuelve
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
| `PUT /inmuebles/:id` | Bearer + rol `locador` (solo el dueño del inmueble) | **conectado** (11/10, `develop` b5acfa7; recorrido en real pendiente) | US-03 | `propiedades.service#actualizarPropiedad(id, guardada, editada)` (cuerpo: `propiedad.adapter.ts#cambiosToUpdateInmueble`, solo lo que cambió respecto de la precarga; errores: `#errorDeActualizarPropiedad`: 403/404 → "No encontramos esta propiedad.", 409 → "No podés editar una propiedad alquilada.", 400 con el texto del back) | Campos editables, todos opcionales: `tipo, descripcion, provincia, ciudad, barrio, direccion, numero, piso, m2_totales, m2_cubiertos, ambientes, dormitorios, banos, antiguedad, precio_publicado, fecha_disponible, servicios`, más `fotos` (3 a 50, una principal como máximo) y `tags` (ids). Lo que se omite conserva su valor; `fotos` y `tags`, si se envían, **reemplazan** la lista completa (`tags: []` los borra) | 200 con el inmueble actualizado. Todo ocurre en la función SQL `actualizar_propiedad_completa` (una transacción, con la fila bloqueada). **No se puede cambiar** `estado_alquiler` ni datos del contrato (400). 400 id inválido o datos incorrectos, 401, 403 (no es el dueño), 404 (no existe o está inactivo), 409 (`alquilado` o `publicado/alquilado`) |
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
| 🟠 Media | `PUT` cambia `precio_publicado`, pero `/disponibles` y `/disponibles/:id` muestran (y filtran por) `contrato.monto_alquiler`: el precio editado no se ve en la búsqueda (HANDOFF §10, punto 25). Las fotos que se sacan en una edición quedan en el bucket (punto 27). | `services/inmueble.service.ts`, función `actualizar_propiedad_completa` |
| 🔴 Alta | El default de `error.middleware` pasó a 500: las validaciones del alta sin `statusCode` ahora salen como 500 (HANDOFF §10, punto 24). | `gateway/middlewares/error.middleware.ts`, `services/inmueble.service.ts` |

## Solicitudes (Sprint 2)

**Ninguna existe todavía: son la propuesta del front** (módulo nuevo, sin tabla ni rutas). Las firmas
de `services/solicitudes.service.ts` ya son las definitivas; los DTOs propuestos están en
`apps/web/src/services/shared/backend-dtos.ts` (`CrearSolicitudRequest`, `SolicitudResponse`) y el
adaptador, en `services/adapters/solicitud.adapter.ts`. Prefijo `/solicitudes`, igual que las rutas
existentes (`/inmuebles`, `/mis-alquileres`). Todas con **Bearer**: el usuario sale del token.

| Método y ruta | Auth | Estado | US (Jira) | Service | Body / query | Respuesta (`data`) | Errores | Mail que dispara |
|---|---|---|---|---|---|---|---|---|
| `POST /solicitudes` | Bearer, cualquier rol | pendiente (propuesto) | US-35 (actualizada, 80dfb8b) | `solicitudes.service#enviarSolicitud` | `CrearSolicitudRequest` (`backend-dtos.ts`): `{ id_inmueble, mensaje?, telefono, email, ocupacion, ingresos, convivientes, mascotas, detalle_mascotas, garantias, acepta_condiciones: true }`. Mensaje hasta **600**; `telefono` en **E.164** (`+` + código de país + número, 10 a 15 dígitos); `email` con formato `nombre@dominio.ext`; `ocupacion` `sin_informar` \| `relacion_dependencia` \| `monotributista` \| `autonoma` \| `estudiante` \| `jubilada`; `ingresos` entero ≥ 0 (0 = no informa); `convivientes` ≥ 1; `detalle_mascotas` hasta 300 (solo si `mascotas`); `garantias` ⊆ `propietaria`, `caucion`, `otra`. Nombre, apellido y DNI salen del token | `SolicitudResponse` (201, `estado: 'pendiente'`) | 400 si un dato no cumple lo anterior, si falta la aceptación, si el inmueble exige garantías y no se ofrece **al menos una**, o si la propiedad no está disponible; 401; 403 si es su propia publicación; 404 si el inmueble no existe; **409 si ya tiene una solicitud pendiente o aceptada para ese inmueble** | Al **locador**: nombre y apellido del postulante y el mensaje, si lo hay (US-35) |
| `GET /solicitudes/mias` | Bearer | pendiente (propuesto) | US-36 (y US-35: estado del botón del detalle y "N pendientes en otras propiedades") | `#listarMisSolicitudes`; con `?inmueble=:id`, `#getMiSolicitudParaPropiedad`; con `?estado=pendiente`, `#contarMisSolicitudesPendientes` (el front cuenta y excluye la propiedad actual) | `inmueble` y `estado` (opcionales) | `SolicitudResponse[]` del usuario del token, de la más nueva a la más vieja. **Sin** `dni`, `telefono`, `email` ni `legajo` (no los necesita) | 401 | — |
| `GET /solicitudes/recibidas` | Bearer + rol `locador` | pendiente (propuesto) | US-36 (y US-35: el legajo) | `#listarSolicitudesRecibidas`; con `?estado=pendiente`, `panel.service#getSolicitudesPendientes` | `estado` (opcional) | `SolicitudResponse[]` de los inmuebles del locador, **con** `postulante.dni`, `postulante.telefono`, `postulante.email` y `legajo` (solo para el dueño del inmueble) | 401, 403 | — |
| `PATCH /solicitudes/:id/aceptar` | Bearer + rol `locador` (dueño del inmueble) | pendiente (propuesto) | US-37 | `#aceptarSolicitud` | — | `SolicitudResponse` (`aceptada`) | 401, 403/404 si no es suya, **409 si ya no está pendiente o si el inmueble ya tiene otra aceptada** | Al **locatario**: que se aceptó (US-37) |
| `PATCH /solicitudes/:id/rechazar` | Bearer + rol `locador` (dueño del inmueble) | pendiente (propuesto) | US-37 | `#rechazarSolicitud` | — (sin motivo: US-37 no lo pide) | `SolicitudResponse` (`rechazada`) | 401, 403/404, 409 si ya no está pendiente | — (US-37 solo pide mail al aceptar) |
| `PATCH /solicitudes/:id/cancelar` | Bearer (el dueño del inmueble o el postulante) | pendiente (propuesto) | US-38 (locador) y sin US en Sprint 0 (postulante) | `#cancelarSolicitud` | — | `SolicitudResponse` (`cancelada`) | 401; 403/404 si no es ni el dueño ni el postulante; **409 si el estado no corresponde a quien llama** (ver "Quién cancela") | Al **locatario**, si cancela el locador (US-38) |

`SolicitudResponse` (propuesto):

```ts
{
  id: number
  estado: 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada'
  mensaje: string | null
  fecha_creacion: string            // ISO, con hora
  fecha_respuesta: string | null    // ISO, con hora: cuándo dejó de estar pendiente; null si sigue pendiente
  inmueble: { id, direccion, numero, piso, barrio, foto_principal: string | null }
  postulante: { id, nombre, apellido, dni?, telefono?, email? }   // dni, telefono y email: solo en /recibidas
  legajo?: {                                                       // solo en /recibidas; null si es anterior
    ocupacion, ingresos, convivientes, mascotas, detalle_mascotas, garantias
  } | null
}
```

Notas:

- **Quién cancela (decidido por el PO, tanda 2 del Sprint 2):** una sola ruta,
  `PATCH /solicitudes/:id/cancelar`. El back decide según quién llama y el estado:
  - **dueño del inmueble + `aceptada`** → `cancelada` (US-38: "dar de baja una solicitud tras haberla
    aceptado"), con mail al locatario;
  - **postulante + `pendiente`** → `cancelada` (sin US en Sprint 0, mapa US-39);
  - el dueño o el postulante con cualquier otro estado → **409**; alguien que no es ninguno de los dos
    → **403** (o 404, para no revelar que existe).
- **Transiciones permitidas** (las mismas que `TRANSICIONES_SOLICITUD` en
  `apps/web/src/lib/validation/solicitud.rules.ts`): aceptar y rechazar, del locador desde
  `pendiente`; cancelar, del locador desde `aceptada` o del postulante desde `pendiente`. Cada una
  guarda `fecha_respuesta`.
- **Una sola aceptada por inmueble (decidido por el PO):** `PATCH /aceptar` responde 409 si el
  inmueble ya tiene otra solicitud `aceptada`. Para aceptar a otro postulante, el locador primero
  cancela la aceptada (US-38).
- **Una sola activa por persona e inmueble:** una `pendiente` o `aceptada` impide otra (409). Una
  `rechazada` o `cancelada` no: se puede volver a solicitar (nada vuelve a `pendiente`; se crea una
  nueva).
- **Aceptar no rechaza a las demás** solicitudes del inmueble (Flujo de solicitudes · 02).
- **Dirección con sesión (decidido por el PO con la US-35 actualizada):** quien inició sesión ve la
  **exacta** con el piso, en `/recibidas`, en `/mias`, en el modal y en el detalle de
  `/propiedad/[id]`. Un visitante sin sesión ve la aproximada en el detalle, y las tarjetas de
  `/buscar` son aproximadas para todos. Reemplaza la regla de las tandas 1 y 2.
- **Privacidad del legajo:** el DNI, el teléfono, el email, los ingresos y el resto del legajo los ve
  solo el dueño del inmueble, en el detalle del postulante; nunca en un listado. `/mias` no los manda.
- **Garantías exigidas:** el inmueble puede exigir garantías (`requiredGuarantees` en el front);
  alcanza con que el postulante ofrezca **al menos una**. **El back no tiene el dato** (ni el alta ni
  la edición lo cargan): queda para el Sprint 3 (HANDOFF §7).

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
