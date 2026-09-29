/**
 * shared/session.ts — quién está usando la app, para la rama mock.
 *
 * Qué es: la rama mock de los services necesita saber de quién son "mis
 * propiedades" o "mi panel". Lo lee de la misma cookie de sesión que usa el
 * resto del front (`lib/auth/session-cookie.ts`). La rama real no lo usa: ahí
 * el usuario viaja en el token de Supabase (`Authorization: Bearer`, ver
 * `apiClient.ts`) y el back sabe quién es.
 *
 * Quién lo usa: la rama mock de `propiedades.service.ts`, `panel.service.ts`
 * y `usuarios.service.ts`; `apiClient.ts` (solo el mensaje de sesión vencida).
 */
import { readSessionFromDocument } from '@/lib/auth/session-cookie'
import { ServiceError } from './errors'

/** Mensaje cuando se pide algo de "mi cuenta" sin sesión (US-01 y US-02: "se debe haber iniciado sesión"). */
export const SESSION_EXPIRED_MESSAGE = 'Tu sesión venció. Volvé a iniciar sesión para seguir.'

/**
 * Id (`UsuarioSesion.id`) del usuario en sesión.
 * @throws {ServiceError} `unauthorized` si no hay sesión.
 */
export function requireSessionUserId(): string {
  const session = readSessionFromDocument()
  if (!session) throw new ServiceError('unauthorized', SESSION_EXPIRED_MESSAGE)
  return session.userId
}
