# `@rentar/shared-types`

Tipos TypeScript compartidos del monorepo. Conviven dos familias, que **no se mezclan**:

| Familia | Dónde | Qué representa | Quién la escribe |
|---|---|---|---|
| **Modelos del back** | `src/index.ts` (la parte de arriba) | Una fila de una tabla de Supabase, o una respuesta de `apps/api`. Nombres en español con `snake_case` (`id_inmueble`, `created_at`). | Backend |
| **Tipos de vista del front** | `src/propiedad.ts`, `src/usuario-sesion.ts`, `src/status.ts`, `src/filters.ts`, `src/neighborhood.ts`, `src/panel.ts`, `src/solicitud.ts` | Lo que una pantalla necesita mostrar, ya armado. Campos en inglés con `camelCase`. | Frontend |

Las pantallas de `apps/web` **solo** usan tipos de vista. El puente entre las dos familias son los
adaptadores de `apps/web/src/services/adapters/` (ver `docs/HANDOFF-BACKEND.md`).

## Modelos del back → tipo de vista → adaptador

| Modelo del back (tabla) | Tipo de vista | Adaptador (`apps/web/src/services/adapters/`) |
|---|---|---|
| Respuesta de `GET /api/v1/usuarios/me` (`usuario` + sus roles) | `UsuarioSesion` | `usuario.adapter.ts#usuarioMeToSesion` |
| `Usuario` (respuesta de `POST /api/v1/registrar-usuario`) | `UsuarioSesion` | `registro.adapter.ts#registroResponseToSesion` |
| `Rol` (`rol.descripcion`) | `UserRole` | `usuario.adapter.ts#rolDtoToUserRole` (`'administrador'` ↔ `'admin'`) |
| Item de `GET /inmuebles/disponibles` (`InmuebleDisponibleResponse`, copiado en `backend-dtos.ts`) | `PropiedadResumen` | `propiedad.adapter.ts#inmuebleDisponibleToPropiedadResumen` |
| Respuesta de `GET /inmuebles/disponibles/:id` (`InmuebleDetalleResponse`, copiado en `backend-dtos.ts`) | `PropiedadDetalle` | `propiedad.adapter.ts#inmuebleDetalleToPropiedadDetalle` (sin dueño, estado, condiciones ni medios de pago: `TODO(backend)`) |
| `MisAlquileresItem` (respuesta de `GET /api/v1/mis-alquileres`) | `PropiedadLocador` | `propiedad.adapter.ts#misAlquileresItemToPropiedadLocador` |
| `CreateInmuebleCompletoPayload` (cuerpo de `POST /api/v1/inmuebles`) | `PropiedadNueva` | `propiedad.adapter.ts#propiedadNuevaToCreateInmueble` |
| Solicitud (tabla y rutas propuestas en `docs/api-endpoints.md`, "Solicitudes") | `Solicitud`, `SolicitudNueva`, `EstadoSolicitud` | `solicitud.adapter.ts` (contra el DTO propuesto `SolicitudResponse`) |
| Cobros, reclamos, solicitudes (tablas de sprints futuros) | `ResumenCobros`, `ResumenReclamos`, `EventoContratoPanel`, `SolicitudPanel` | Ninguno todavía: en modo real `/panel` los muestra vacíos (ver `apps/web/src/services/panel.service.ts`). |
| `TipoInmueble` (`tipo_inmueble`) | `PropertyType` | `propiedad.adapter.ts#propertyTypeFromTipoId` |
| `TagInmueble` (`tags_inmueble`) | `CharacteristicKey` | `propiedad.adapter.ts#characteristicFromTagDescripcion` (lectura) y `#tagIdFromCharacteristic` (alta) |
| `ContratoXUsuario`, `UsuarioXRol`, `Servicio` | — | Todavía no los usa ninguna pantalla del Sprint 1. |
| `ApiResponse<T>` | — | Lo desarma `apps/web/src/services/shared/apiClient.ts`. |

## Choques de nombre resueltos

- **`Usuario`**: el del back se queda como está. El del front se llama `UsuarioSesion`.
- **`Contrato`**: el front no trae su propio `Contrato` en el Sprint 1.
- **`Rol`**: no hay choque. El front usa `UserRole` (una unión de strings) y el back usa `Rol` (la
  tabla).

## Reglas

- **No renombrar ni mover** los modelos del back: los importa `apps/api`.
- Un tipo de vista nuevo va en el archivo de su dominio y se exporta al final de `index.ts`, en el
  bloque "Tipos de vista del front". Así el merge con los cambios del back se limita a esas líneas.
- Cada tipo de vista dice en su JSDoc qué adaptador lo produce.

## Cómo lo consume cada app

- `apps/api`: vía `main`/`types` → `dist/` (`npm run build --workspace=@rentar/shared-types`).
- `apps/web` y `packages/ui`: leen `src/` directo (alias `paths` en su `tsconfig.json` +
  `transpilePackages` en `next.config.mjs`), así no hace falta compilar el paquete para levantar el
  frontend.

## Scripts

```bash
npm run build --workspace=@rentar/shared-types      # tsc → dist/
npm run typecheck --workspace=@rentar/shared-types  # tsc --noEmit
```
