/**
 * sesion-probable.ts — ¿el pedido trae una cookie de sesión? (solo servidor).
 *
 * Qué es: una pista barata, leída en el servidor, para que las pantallas
 * públicas y de login no parpadeen mientras el `AuthProvider` confirma la
 * sesión en el navegador. Solo mira que la cookie EXISTA; no la valida.
 * - Modo mock: `rentar_session`.
 * - Modo real: la de Supabase Auth, `sb-<proyecto>-auth-token` (a veces
 *   partida en `.0`, `.1`…).
 * Cubre: US-39 Iniciar y cerrar sesión.
 *
 * NOTA: no sirve para decidir un redirect del lado del servidor: con una
 * cookie vencida, `/login` mandaría a `/panel` y el panel de vuelta a
 * `/login` (loop). Los redirects los decide el cliente, con la sesión ya
 * confirmada.
 *
 * Quién lo usa: `app/(public)/layout.tsx`, `app/(auth)/login/page.tsx` y
 * `app/(auth)/registro/page.tsx` (Server Components).
 */
import { cookies } from 'next/headers'
import { USE_MOCKS } from '@/services/shared/config'
import { SESSION_COOKIE_NAME } from './session-cookie'

/** Cookies de sesión de Supabase: `sb-<proyecto>-auth-token`, a veces partida en `.0`, `.1`… */
const SUPABASE_SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

/**
 * `true` si el pedido trae una cookie de sesión (ver el encabezado).
 * NOTA: usa `cookies()`, así que la ruta que lo llame se renderiza en cada
 * pedido (dinámica).
 */
export async function haySesionProbable(): Promise<boolean> {
  const cookieStore = await cookies()
  if (USE_MOCKS) return cookieStore.has(SESSION_COOKIE_NAME)
  return cookieStore.getAll().some((cookie) => SUPABASE_SESSION_COOKIE.test(cookie.name))
}
