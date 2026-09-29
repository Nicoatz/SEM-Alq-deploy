/**
 * supabase/server.ts — el cliente de Supabase para Server Components,
 * Server Actions y Route Handlers.
 *
 * Qué es: lee (y, cuando puede, escribe) la sesión desde las cookies del
 * request. Hoy ninguna pantalla lo usa: todas las pantallas del Sprint 1 son
 * Client Components y la sesión se lee en el navegador
 * (`supabase/client.ts`). Queda listo para cuando una página necesite saber
 * quién está en sesión del lado del servidor.
 * Cubre: US-39 Iniciar y cerrar sesión.
 *
 * Quién lo usa: nadie todavía (ver arriba). `proxy.ts` usa su propio cliente
 * (`supabase/proxy.ts`), porque ahí las cookies se leen del `NextRequest`.
 */
import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/services/shared/config'

/**
 * Crea un cliente de Supabase atado a las cookies del request actual. Hay
 * que crear uno por request (no guardarlo en una variable global).
 *
 * NOTA: para saber quién es el usuario del lado del servidor, usar
 * `supabase.auth.getClaims()` (verifica la firma del token), no
 * `getSession()` (solo lee la cookie, sin verificar nada).
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // NOTA: un Server Component no puede escribir cookies. No pasa nada:
          // la sesión la renueva `proxy.ts` antes de llegar acá.
        }
      },
    },
  })
}
