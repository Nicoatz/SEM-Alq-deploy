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
| `GET /usuarios/me` | Bearer | conectado | US-39 | `usuarios.service#getUsuarioActual` | — | `{ id, nombre, apellido, email, roles: string[] }` → `usuarioMeToSesion` |
| `POST /registrar-usuario` | **sin token** | conectado | US-19 | `auth.service#registrarUsuario` | `{ nombre, apellido, email, contraseña, confirmar_contraseña, telefono, numero_documento, fecha_nacimiento, acepta_terminos, rol }` | `Usuario` (`id, nombre, apellido, email, numero_documento, telefono, fecha_nacimiento`) → `registroResponseToSesion` |
| `GET /usuarios/me/contextos` | Bearer | pendiente (propuesto) | US-39 (cambio de rol) | `panel.service#getResumenRoles` | — | `ResumenContextoRol[]` (hoy se arma en el front) |

Notas:

- **Login:** no hay `POST /auth/login` ni `/auth/logout` en `apps/api` (decisión de backend). Las
  credenciales inválidas de Supabase (400 `invalid_credentials`) se muestran con el mensaje genérico
  de US-39.
- **Registro:** `rol` acepta `locatario` o `locador`; hoy el back lo ignora y registra locatario (se
  resuelve con el PR #2). Errores: 400 con el mensaje de la validación; **409** si el mail ya existe
  (Supabase Auth) o si el DNI ya existe (índice único `uq_usuario_numero_documento`). El back crea
  la cuenta confirmada: el front inicia sesión solo después del 201.
- **`/usuarios/me`:** 401 sin token, con token inválido o si el usuario de Auth no tiene fila en
  `usuario`.

## Propiedades

| Método y ruta | Auth | Estado | US | Service | Body / query | Respuesta (`data`) |
|---|---|---|---|---|---|---|
| `GET /inmuebles/disponibles` | — | parcial (ver notas) | US-34 | `propiedades.service#listarPropiedadesPublicadas`, `#buscarPropiedades`, `#contarPropiedades`, `#listarUbicaciones` | `barrio, precioMin, precioMax, tipo (id), dormitorios, ambientes, superficieMin, superficieMax, tags (csv de ids), indiceAjuste (id), page, limit, orden (precio\|dormitorios\|m2), direccion (asc\|desc)`, armados por `propiedad.adapter#consultaDeDisponibles` | `{ items: InmuebleDisponibleResponse[], total, page, limit, totalPages }`; cada item con `tipo`, `tags` e `indice_ajuste` como `{ id, descripcion }`, `precio`, `expensas`, `foto_principal` y `fecha_disponible` → `inmuebleDisponibleToPropiedadResumen`. 400 si la página no existe |
| `GET /inmuebles/disponibles/:id` | — | existe, sin usar | US-34 (detalle) | — (antes `GET /inmuebles/:id`, renombrada el 26/09) | — | `InmuebleDetalleResponse`: como el item de arriba más `servicio` y `fotos`. 400 id inválido, 404 |
| `GET /mis-alquileres` | Bearer + rol `locador` | parcial | US-02 | `propiedades.service#listarMisPropiedades` | — | `MisAlquileresItem[]` (todos los inmuebles del locador, con `fotos`, `foto_principal`, `tags` y `contrato` con `monto_alquiler`, `expensas`, `indice_aumento` como texto y `medios_pago` como nombres) → `misAlquileresItemToPropiedadLocador`. 401 / 403 |
| `POST /inmuebles` | Bearer + rol `locador` | parcial (falta el bucket) | US-01 | `propiedades.service#registrarPropiedad` | `CreateInmuebleCompletoPayload`: inmueble + `tags: number[]` + `fotos: { url, peso_kb, formato, es_principal }[]` (3 a 50, jpg/png, ≤ 350 KB) + `condiciones_contrato` (`monto_alquiler, expensas, indice_aumento (id), frecuencia_ajuste (texto), duracion_meses, deposito (monto), interes_por_dia, dias_gracia, medios_pago: number[]`) → `propiedadNuevaToCreateInmueble` | `Inmueble` creado (201). 400 con el mensaje de cada regla, 401, 403 |
| Supabase Storage, bucket `fotos-propiedades` | sesión del usuario | pendiente (no existe el bucket) | US-01 | `propiedades.service#subirFotoPropiedad` | archivo en `<auth.uid>/<archivo>` | URL pública, `peso_kb` (redondeado hacia arriba) y `formato` |
| `GET /publicaciones/activas` | — | pendiente (no montada, no compila) | US-34 | — | — | — |
| `GET /catalogos/ubicaciones` | — | pendiente (propuesto) | US-34 | `propiedades.service#listarUbicaciones` | — | `UbicacionOpciones` (hoy se arma con los datos) |
| `PATCH /inmuebles/:id/publicacion` | Bearer + rol `locador` | pendiente (propuesto) | publicar/pausar (sin US en Sprint 0, mapa US-40) | `propiedades.service#cambiarEstadoPublicacion` (sin usar) | `{ activa: boolean }` | — |

Mapeos del alta (US-01), documentados en `services/adapters/propiedad.adapter.ts`:

- Tipo: `departamento → 1`, `casa → 2`, `ph → 3`, `monoambiente → 4`.
- Tags: `mascotas → 1`, `cochera → 2`, `amoblado → 3`, `balcon → 4`; `apto-profesional` no se manda.
- Medios de pago: `transferencia → 1`, `efectivo → 2`, MercadoPago débito y crédito → `3`
  (deduplicado); el recargo no se guarda.
- Índice: `ICL → 1`, `IPC → 2` (la base además tiene CAC, 3).
- Estado: `publicada → 'publicado'`, `pausada → 'pausado'`, `alquilada → 'alquilado'` (+
  `fecha_disponible` si se cargó).
- `frecuencia_ajuste`: "Mensual", "Bimestral", "Trimestral", "Cuatrimestral", "Semestral", "Anual" o
  "N meses". `deposito`: meses × precio. Piso y depto van juntos en `piso` ("3° B").

Búsqueda (US-34), `GET /inmuebles/disponibles`:

- El front manda al back lo que puede resolver exacto y, si no, trae todas (de a 100 por página) y
  filtra, ordena y pagina en el cliente. No exacto: más de un barrio, un barrio fuera del catálogo
  del front, más de un tipo, más de una cantidad de dormitorios o ambientes, "4 o más", más de una
  característica (el back devuelve las que tengan cualquiera) y los órdenes por precio
  (`orden=precio` no ordena). Tabla completa en `propiedad.adapter.ts#consultaDeDisponibles`.
- Provincia y ciudad no las filtra el back: el front las filtra sobre la página (hoy solo hay
  Córdoba Capital). "Más recientes" va sin `orden` (el back ordena por id descendente).
- El "Ver N propiedades" del Drawer pide `limit=1` y lee `total`.

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
