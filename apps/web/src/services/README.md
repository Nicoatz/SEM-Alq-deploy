# `services/` — la frontera con el backend

Todo lo que una pantalla le pide al backend pasa por acá. **Ninguna página ni componente importa
mocks ni llama a `fetch` directo**: llaman a una función de un service y reciben un tipo de vista de
`@rentar/shared-types`.

## Los services

| Archivo | Funciones | US |
|---|---|---|
| `auth.service.ts` | `login`, `logout` (Supabase Auth, no pasan por la API), `registrarUsuario` | US-39, US-19 |
| `usuarios.service.ts` | `getUsuarioActual` (`GET /usuarios/me`: nombre y roles del usuario del token) | US-39 |
| `propiedades.service.ts` | `listarPropiedadesPublicadas`, `buscarPropiedades`, `contarPropiedades`, `listarUbicaciones` | US-34 |
| | `listarMisPropiedades` | US-02 |
| | `registrarPropiedad`, `subirFotoPropiedad` (Storage; espera el bucket) | US-01 |
| | `cambiarEstadoPublicacion` (lista pero sin usar: es del sprint del detalle) | — |
| `panel.service.ts` | `getResumenCobros`, `getResumenReclamos`, `getEventosContratos`, `getSolicitudesPendientes`, `getResumenRoles` | `/panel` (sin US en Sprint 0) |

## Cómo está armada cada función

```ts
/**
 * US-02 Consultar mis propiedades — …qué hace…
 * @backend GET /api/v1/mis-alquileres   (existe · …qué le falta…)
 * @returns PropiedadLocador[]
 * TODO(backend): …lo que falta en la API…
 */
export async function listarMisPropiedades(): Promise<PropiedadLocador[]> {
  if (USE_MOCKS) {
    await delay()                                   // latencia simulada
    return misPropiedadesMock(requireSessionUserId()) // rama mock: el elenco
  }
  const items = await apiRequest<MisAlquileresItem[]>('/mis-alquileres') // rama real
  return items.map(misAlquileresItemToPropiedadLocador)                   // adaptador
}
```

- El bloque `@backend` dice método, ruta y estado: `(existe)`, `(en curso en <rama>)` o
  `(no existe — propuesto)`. La lista completa está en `docs/api-endpoints.md`.
- La **firma** (nombre, parámetros y tipo de retorno) es el contrato con las pantallas: al conectar
  el back se cambia el cuerpo o el adaptador, nunca la firma.
- Las dos ramas tiran el mismo `ServiceError` (`shared/errors.ts`), así la pantalla no sabe de
  dónde vino el error.

## Carpetas

| Carpeta / archivo | Qué hay |
|---|---|
| `shared/config.ts` | `USE_MOCKS` (`NEXT_PUBLIC_USE_MOCKS`, por defecto `true`), `API_BASE_URL` (`NEXT_PUBLIC_API_URL`) y las dos de Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). |
| `shared/apiClient.ts` | El único cliente HTTP: URL + query, `Authorization: Bearer <token de Supabase>` (salvo `auth: false`), sobre `{ success, data, error }` y status → `ServiceError`. |
| `shared/errors.ts` | `ServiceError` y sus códigos (`validation`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `server`, `network`). |
| `shared/mockStore.ts` | Lo que se crea en modo mock, guardado en `localStorage` (`rentar:mock:*`) encima del elenco. |
| `shared/session.ts` | Quién está en sesión, para la rama mock. |
| `shared/delay.ts` | Latencia simulada de la rama mock. |
| `shared/backend-dtos.ts` | Copias de DTOs del back que `@rentar/shared-types` todavía no exporta. |
| `adapters/` | DTO del back ↔ tipo de vista, campo por campo, con `TODO(backend)` en lo que falta. `*-mock.adapter.ts` hace lo mismo desde el elenco. |

## Probar la rama real

`NEXT_PUBLIC_USE_MOCKS=false` y las dos variables de Supabase en `apps/web/.env.local` (ver
`.env.example`), `npm run dev:api` y reiniciar `npm run dev:web`. La sesión es la de Supabase Auth
(clientes en `lib/auth/supabase/`). Paso a paso y brechas conocidas: `docs/HANDOFF-BACKEND.md`.
