# Endpoints que usa el frontend — Sprint 1

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
| `GET /inmuebles/disponibles` | — | parcial (ver notas) | US-34 | `propiedades.service#listarPropiedadesPublicadas`, `#listarPropiedadesRecientes`, `#buscarPropiedades`, `#contarPropiedades`, `#listarUbicaciones` | el front manda solo `page=1&limit=1000` (la landing, `page=1&limit=6`). El back documenta `barrio, precioMin, precioMax, tipo, dormitorios, ambientes, superficieMin, superficieMax, tags, indiceAjuste, page, limit, orden, direccion`, pero desde el 29/09 solo aplica `barrio` (igual exacto) y `tipo` | `{ items: InmuebleDisponibleResponse[], total, page, limit, totalPages }` (hoy siempre todas, `page: 1`); cada item con `tipo`, `tags` e `indice_ajuste` como `{ id, descripcion }`, `precio`, `expensas` (0 sin contrato), `foto_principal` y `fecha_disponible` → `inmuebleDisponibleToPropiedadResumen` |
| `GET /inmuebles/disponibles/:id` | — | existe, sin usar | US-34 (detalle) | — (antes `GET /inmuebles/:id`, renombrada el 26/09) | — | `InmuebleDetalleResponse`: como el item de arriba más `servicio` y `fotos`. 400 id inválido, 404 |
| `GET /locadores/:idLocador/barrios` | Bearer + rol `locador` (solo el propio id; otro → 403) | existe, sin usar | US-02 (filtro de barrio) | — | — | `string[]` (barrios de las propiedades del locador) |
| `GET /mis-alquileres` | Bearer + rol `locador` | parcial | US-02 | `propiedades.service#listarMisPropiedades` | el back documenta `barrio, tipo, estado, reclamos`, pero no los aplica (el front filtra en el cliente) | `MisAlquileresItem[]` (todos los inmuebles del locador; desde el 29/09 también `contrato.locatario`, `contrato.fecha_proximo_ajuste` y `posee_reclamos_no_resueltos`, que el front suma en el próximo PR; con `fotos`, `foto_principal`, `tags` y `contrato` con `monto_alquiler`, `expensas`, `indice_aumento` como texto y `medios_pago` como nombres) → `misAlquileresItemToPropiedadLocador`. 401 / 403 |
| `POST /inmuebles` | Bearer, cualquier rol (desde el 29/09, d88deca: además le suma el rol locador al usuario, en una transacción) | conectado (29/09: alta real de punta a punta con fotos en Storage) | US-01 | `propiedades.service#registrarPropiedad` | `CreateInmuebleCompletoPayload`: inmueble + `tags: number[]` + `fotos: { url, peso_kb, formato, es_principal }[]` (3 a 50, jpg/png, ≤ 350 KB) + `condiciones_contrato` (`monto_alquiler, expensas, indice_aumento (id), frecuencia_ajuste (texto), duracion_meses, deposito (monto), interes_por_dia, dias_gracia, medios_pago: number[]`) → `propiedadNuevaToCreateInmueble` | `Inmueble` creado (201). 400 con el mensaje de cada regla, 401. Si volviera un 403, el front muestra "Todavía no podés publicar desde esta cuenta…" |
| Supabase Storage, bucket `fotos-propiedades` | sesión del usuario | conectado (29/09; desde el 30/09 también borra las fotos de un alta fallida) | US-01 | `propiedades.service#subirFotoPropiedad` | archivo en `<auth.uid>/<uuid>.<jpg\|png>`, `upsert: false` | URL pública, `peso_kb` (redondeado hacia arriba) y `formato` |
| `GET /catalogos/ubicaciones` | — | pendiente (propuesto) | US-34 | `propiedades.service#listarUbicaciones` | — | `UbicacionOpciones` (hoy se arma con los datos) |
| `DELETE /inmuebles/:id` | Bearer + rol `locador` (solo el dueño del inmueble) | existe en el back (09/10, sin probar; el front no lo usa todavía) | US-04 | — (a futuro: `propiedades.service`, detalle de `/panel/propiedades/[id]`) | — | Mensaje de éxito, sin `data` (200). **Baja lógica:** el inmueble queda con `activo = false` (no se borra la fila) y sus contratos pasan a `estado = 3` (finalizado) y `activo = false`, todo en la función SQL `eliminar_inmueble_logico` (una transacción). Solo se puede eliminar un inmueble `publicado` o `pausado`. 400 id inválido, 401, 403 (no es el dueño), 404 (no existe o ya estaba inactivo), 409 (`alquilado` o `publicado/alquilado`, o un estado que no permite eliminar). Un inmueble inactivo desaparece de `/inmuebles/disponibles`, de `/mis-alquileres`, de los barrios del locador y del detalle público |
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

- Desde el 29/09 el back ignora casi todos los filtros y la paginación, así que el front trae todas
  en un pedido (hasta 1000) y filtra, ordena y pagina en el cliente, con las mismas reglas que el
  modo mock. Sirve para el piloto; no escala. Detalle y brechas en `HANDOFF-BACKEND.md` §7 (US-34).
- `GET /inmuebles/disponibles/:id` manda `-1` en `precio` y `expensas` sin contrato (hoy el front
  no la usa).

## Panel del locador (`/panel`)

Módulos de sprints futuros. En modo real, las funciones devuelven vacío (con `TODO(backend)`) y la
pantalla muestra sus estados vacíos; los conteos de propiedades salen de `GET /mis-alquileres`.

| Método y ruta | Auth | Estado | US del módulo | Service | Respuesta (`data`) |
|---|---|---|---|---|---|
| `GET /panel/cobros` | Bearer | pendiente (propuesto) | US-08, US-09 | `panel.service#getResumenCobros` | `ResumenCobros` |
| `GET /panel/reclamos` | Bearer | pendiente (propuesto) | US-14 a US-18 | `panel.service#getResumenReclamos` | `ResumenReclamos` |
| `GET /panel/contratos?dias=60` | Bearer | pendiente (propuesto) | US-05 a US-07 | `panel.service#getEventosContratos` | `EventoContratoPanel[]` |
| `GET /solicitudes?estado=pendiente` | Bearer | pendiente (propuesto) | US-36 | `panel.service#getSolicitudesPendientes` | `SolicitudPanel[]` |

Cómo se calcula cada cifra (cobrado del mes, vencidos, días de atraso, reclamos sin responder,
eventos de 60 días): encabezado de `apps/web/src/lib/mocks/panel.mock.ts`. El back puede devolver
las cifras ya calculadas con esas mismas reglas.

Todos los tipos de respuesta propuestos están en `packages/shared-types/src/` (`propiedad.ts`,
`filters.ts`, `panel.ts`, `usuario-sesion.ts`).
