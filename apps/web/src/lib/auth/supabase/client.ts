/**
 * supabase/client.ts — el cliente de Supabase del navegador.
 *
 * Qué es: el único `SupabaseClient` de los Client Components. Se usa SOLO
 * para Auth (iniciar y cerrar sesión, leer el token vigente). Los datos
 * nunca se leen con este cliente: todas las tablas tienen RLS sin políticas
 * y todo dato pasa por `apps/api` (ver `services/shared/apiClient.ts`).
 * Cubre: US-39 Iniciar y cerrar sesión (y, por arrastre, el token de todas
 * las llamadas a la API).
 *
 * De dónde saca los datos: Supabase Auth. `@supabase/ssr` guarda la sesión
 * en cookies (no en `localStorage`), así `proxy.ts` la puede leer y renovar
 * del lado del servidor.
 *
 * Quién lo usa: `lib/auth/AuthProvider.tsx`, `services/auth.service.ts` y
 * `services/shared/apiClient.ts`. Solo con `NEXT_PUBLIC_USE_MOCKS=false`.
 */
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/services/shared/config'

// NOTA: una sola instancia por pestaña. `createBrowserClient` ya reutiliza la
// instancia, pero guardarla acá deja explícito que no se crean clientes por
// componente (cada uno arrancaría su propio temporizador de renovación del token).
let browserClient: SupabaseClient | null = null

/**
 * Devuelve el cliente de Supabase del navegador (lo crea la primera vez).
 *
 * @throws {Error} si faltan `NEXT_PUBLIC_SUPABASE_URL` o
 *   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (ver `apps/web/.env.example`).
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en apps/web/.env.local (ver .env.example).',
    )
  }
  browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  return browserClient
}
