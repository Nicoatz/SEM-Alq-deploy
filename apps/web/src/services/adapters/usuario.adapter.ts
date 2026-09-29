/**
 * usuario.adapter.ts — traduce el usuario y los roles del back al tipo de
 * vista del front.
 *
 * Qué es: la frontera entre la respuesta de `GET /api/v1/usuarios/me` (y la
 * tabla `rol`) y `UsuarioSesion`/`UserRole` (tipos de vista). Las pantallas
 * nunca ven un usuario del back.
 * Cubre: US-19 (registro) y US-39 (sesión).
 * Quién lo usa: `services/usuarios.service.ts` y `adapters/registro.adapter.ts`.
 */
import type { UserRole, UsuarioSesion } from '@rentar/shared-types'
import type { UsuarioMeResponse } from '../shared/backend-dtos'

// ─── Roles ──────────────────────────────────────────────────────────────

/**
 * Traduce un rol del back (`rol.descripcion`) al `UserRole` del front.
 *
 * NOTA: el back llama `'administrador'` a lo que el front llama `'admin'`.
 * Esta es la única línea del frontend que conoce esa diferencia.
 * `'garante'` no existe como rol del back: el garante firma sin cuenta.
 * Devuelve `null` para un rol desconocido (se descarta, no rompe la sesión).
 */
export function rolDtoToUserRole(descripcion: string): UserRole | null {
  switch (descripcion.trim().toLowerCase()) {
    case 'locador':
      return 'locador'
    case 'locatario':
      return 'locatario'
    case 'administrador':
      return 'admin'
    default:
      return null
  }
}

// ─── Usuario ────────────────────────────────────────────────────────────

/**
 * Respuesta de `GET /api/v1/usuarios/me` → `UsuarioSesion`.
 *
 * Campo por campo:
 * - `id`: el back usa un número; el front lo guarda como texto.
 * - `roles`: las descripciones de la tabla `rol`, traducidas con
 *   {@link rolDtoToUserRole}. Los roles salen SIEMPRE del back: el front no
 *   los deduce de ningún otro lado.
 * - `status`: TODO(backend): el back no tiene estado de cuenta; se asume
 *   `'activo'` (un usuario que no puede usar la app no pasaría el token).
 * - `telefono`, `dni`, `fechaNacimiento`: `/me` no los devuelve (solo los usa
 *   el perfil, que es de otro sprint). TODO(backend): sumarlos cuando haga
 *   falta.
 */
export function usuarioMeToSesion(me: UsuarioMeResponse): UsuarioSesion {
  return {
    id: String(me.id),
    nombre: me.nombre,
    apellido: me.apellido ?? '',
    email: me.email,
    roles: me.roles.map(rolDtoToUserRole).filter((role): role is UserRole => role !== null),
    status: 'activo',
  }
}
