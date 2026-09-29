/**
 * session-cookie.ts — forma única de la cookie `rentar_session` (US-39).
 *
 * Qué es: el shape que comparten `AuthProvider` (cliente), `proxy.ts`
 * (servidor, protege `/panel/*`), el layout del panel y la rama mock de los
 * services. Se define acá una sola vez para que todos lean y escriban
 * exactamente lo mismo.
 *
 * Qué significa según el modo:
 * - Modo mock: ES la sesión (simulada). `proxy.ts` deja pasar si existe.
 * - Modo real: la sesión es la de Supabase Auth (cookies `sb-…`, ver
 *   `lib/auth/supabase/`). Esta cookie solo recuerda el rol activo y le
 *   avisa al layout del panel que había una sesión; no autentica nada.
 *
 * NOTA: no es httpOnly a propósito — `AuthProvider` necesita leerla desde el
 * cliente al hidratar la sesión. Solo guarda `{ userId, activeRole }`; el
 * perfil completo se resuelve con `services/usuarios.service.ts#getUsuarioActual`.
 */
import type { UserRole } from '@rentar/shared-types'

/** Nombre de la cookie de sesión. Lo comparten `proxy.ts` y `AuthProvider`. */
export const SESSION_COOKIE_NAME = 'rentar_session'

/**
 * Duración de la cookie: 30 días.
 * NOTA: ya no hay "Recordarme". Con Supabase Auth la sesión dura hasta que
 * la persona la cierra, así que esta cookie (que en modo real solo guarda el
 * rol activo, y en modo mock simula la sesión) dura lo mismo en los dos modos.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/** Lo que guarda la cookie de sesión (JSON, URI-encodeado). */
export interface SessionCookiePayload {
  /** `UsuarioSesion.id` del usuario en sesión (texto, ver `usuario-sesion.ts`). */
  userId: string
  activeRole: UserRole
}

/** Arma el valor (ya URI-encodeado) que se guarda en la cookie. */
export function serializeSessionCookie(payload: SessionCookiePayload): string {
  return encodeURIComponent(JSON.stringify(payload))
}

/**
 * Parsea el valor crudo de la cookie. Devuelve `null` ante cualquier valor
 * ausente o corrupto — tanto `proxy.ts` como `AuthProvider` tratan eso
 * igual que "sin sesión", nunca como un error a mostrar.
 */
export function parseSessionCookie(raw: string | undefined): SessionCookiePayload | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as SessionCookiePayload).userId === 'string' &&
      typeof (parsed as SessionCookiePayload).activeRole === 'string'
    ) {
      return parsed as SessionCookiePayload
    }
    return null
  } catch {
    return null
  }
}

// ─── Lectura y escritura desde el navegador (document.cookie) ─────────────
// Del lado del servidor no hay `document`: ahí la cookie la lee `proxy.ts`
// con `request.cookies`, y estas funciones devuelven "sin sesión".

/** Lee la sesión actual desde `document.cookie`. `null` si no hay sesión (o si corre en el servidor). */
export function readSessionFromDocument(): SessionCookiePayload | null {
  if (typeof document === 'undefined') return null
  const row = document.cookie.split('; ').find((cookie) => cookie.startsWith(`${SESSION_COOKIE_NAME}=`))
  return parseSessionCookie(row?.slice(SESSION_COOKIE_NAME.length + 1))
}

/**
 * Guarda la sesión en `document.cookie` (visible para `proxy.ts` en el
 * próximo request). Dura {@link SESSION_MAX_AGE_SECONDS}.
 */
export function writeSessionToDocument(payload: SessionCookiePayload): void {
  document.cookie = `${SESSION_COOKIE_NAME}=${serializeSessionCookie(payload)}; path=/; max-age=${SESSION_MAX_AGE_SECONDS}; samesite=lax`
}

/** Borra la sesión de `document.cookie` (US-39: "desvincular la sesión del navegador"). */
export function clearSessionFromDocument(): void {
  document.cookie = `${SESSION_COOKIE_NAME}=; path=/; max-age=0`
}
