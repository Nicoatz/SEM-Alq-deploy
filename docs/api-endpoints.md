# Endpoints que usa el frontend — Sprint 1

Lista de **todas** las rutas de `apps/api` que llama `apps/web` en el Sprint 1, sacada de los bloques
`@backend` de `apps/web/src/services/*.service.ts`. Sirve para armar o completar el Swagger
(`http://localhost:3000/api/v1/docs`).

- Base: `NEXT_PUBLIC_API_URL`, por defecto `http://localhost:3000/api/v1`.
- Sobre de respuesta: siempre `{ success, message?, data?, error? }` (`ApiResponse<T>`). El front lee
  `data`; si `success` es `false` o el status no es 2xx, muestra `error` (tiene que estar en
  español y decir qué hacer).
- Usuario: header `x-user-id` (lo arma `services/shared/apiClient.ts`).
- Estado: **existe** = ya está en `develop`; **en curso** = está en otra rama del equipo;
  **propuesto** = no existe, es lo que el front espera.

Cómo conectar cada una y qué le falta a cada ruta que ya existe: ver
[`HANDOFF-BACKEND.md`](HANDOFF-BACKEND.md).

## Autenticación y usuarios

| Método y ruta | Estado | US | Service | Body / query | Respuesta (`data`) |
|---|---|---|---|---|---|
| `POST /auth/login` | propuesto | US-39 | `auth.service#login` | `{ email, contraseña }` | `{ usuario: Usuario, roles: Rol[] }` → `usuarioDtoToSesion` |
| `POST /auth/logout` | propuesto | US-39 | `auth.service#logout` | — | — |
| `POST /registrar-usuario` | en curso (`feature/registrar-usuario`) | US-19 | `auth.service#registrarUsuario` | `RegistrarUsuarioRequest` (con `rol`, propuesto) | `RegistrarUsuarioResponse` → `registroResponseToSesion` |
| `GET /usuarios/:id` | propuesto | US-39 | `usuarios.service#getUsuarioSesion` | — | `{ usuario: Usuario, roles: Rol[] }` |
| `GET /usuarios/me/contextos` | propuesto | US-39 (cambio de rol) | `panel.service#getResumenRoles` | — | `ResumenContextoRol[]` |

Status que espera el front en el login y el registro: 400/401 con credenciales inválidas (mensaje
genérico, US-39), 409 si el mail ya existe (US-19). Un 404 se muestra como error del servidor, nunca
como "credenciales incorrectas".

## Propiedades

| Método y ruta | Estado | US | Service | Body / query | Respuesta (`data`) |
|---|---|---|---|---|---|
| `GET /inmuebles/disponibles` | existe (completo desde el 26/09: filtros, orden y paginación; falta que el front lo use) | US-34 | `propiedades.service#listarPropiedadesPublicadas`, `#buscarPropiedades`, `#contarPropiedades` | back: `barrio, precioMin, precioMax, tipo, dormitorios, ambientes, superficieMin, superficieMax, tags (csv de ids), indiceAjuste, page, limit, orden (precio\|dormitorios\|m2), direccion (asc\|desc)`. **Distinto** de lo que arma hoy el front (`provincia, ciudad, barrio[], tipo[], dorm[], amb[], m2Min, m2Max, tag[], indice, pagina, tamanioPagina`) y todavía no filtra por `provincia`/`ciudad` | `{ items: InmuebleDisponibleDTO[], total, page, limit, totalPages }`. Cada item ya trae `tipo`, `tags` y `indice_ajuste` como objeto `{id, descripcion}`, `precio`, `expensas`, `foto_principal` y `fecha_disponible` — no hace falta pedir el detalle aparte |
| `GET /publicaciones/activas` | existe (desde el 24/09, todavía sin usar en el front) | US-34 | — (alternativa a la de arriba: cada publicación activa con su inmueble) | — | `PublicacionDisponibleDTO[]` |
| `GET /inmuebles/:id` | existe | US-34 | (lo usa la búsqueda para traer título y precio de cada inmueble) | — | `InmuebleDetalleResponse` |
| `GET /catalogos/ubicaciones` | propuesto | US-34 | `propiedades.service#listarUbicaciones` | — | `UbicacionOpciones` (provincias → ciudades → barrios con propiedades publicadas) |
| `GET /mis-alquileres` | existe (solo las publicadas, faltan campos) | US-02 | `propiedades.service#listarMisPropiedades` | query opcional a futuro: `barrio, tipo, estado, reclamos, q` | `MisAlquileresItem[]` → `misAlquileresItemToPropiedadLocador` |
| `POST /inmuebles` | existe (faltan casi todos los campos) | US-01 | `propiedades.service#registrarPropiedad` (1.º pedido) | `CrearInmuebleRequest` | `Inmueble` |
| `POST /publicaciones` | existe (exige contrato previo) | US-01 | `propiedades.service#registrarPropiedad` (2.º pedido) | `CrearPublicacionRequest` | `Publicacion` |
| `PATCH /inmuebles/:id/publicacion` | propuesto | publicar/pausar (sin US en Sprint 0, mapa US-40) | `propiedades.service#cambiarEstadoPublicacion` (sin usar) | `{ activa: boolean }` | `Publicacion` |

Propuesta para US-01: un solo `POST /propiedades` que reciba `PropiedadNueva` completa (fotos
incluidas) y cree inmueble y publicación juntos. El cuerpo exacto está en
`packages/shared-types/src/propiedad.ts#PropiedadNueva`.

## Panel del locador (`/panel`)

Datos de módulos de sprints futuros. Cada bloque es un pedido aparte: si uno falla, la pantalla
muestra el error solo en ese bloque.

| Método y ruta | Estado | US del módulo | Service | Respuesta (`data`) |
|---|---|---|---|---|
| `GET /panel/cobros` | propuesto | US-08, US-09 | `panel.service#getResumenCobros` | `ResumenCobros` |
| `GET /panel/reclamos` | propuesto | US-14 a US-18 | `panel.service#getResumenReclamos` | `ResumenReclamos` |
| `GET /panel/contratos?dias=60` | propuesto | US-05 a US-07 | `panel.service#getEventosContratos` | `EventoContratoPanel[]` |
| `GET /solicitudes?estado=pendiente` | propuesto | US-36 | `panel.service#getSolicitudesPendientes` | `SolicitudPanel[]` |

Cómo se calcula cada cifra (cobrado del mes, vencidos, días de atraso, reclamos sin responder,
eventos de 60 días): encabezado de `apps/web/src/lib/mocks/panel.mock.ts`. El back puede devolver
las cifras ya calculadas con esas mismas reglas.

Todos los tipos de respuesta propuestos están en `packages/shared-types/src/` (`propiedad.ts`,
`filters.ts`, `panel.ts`, `usuario-sesion.ts`).
