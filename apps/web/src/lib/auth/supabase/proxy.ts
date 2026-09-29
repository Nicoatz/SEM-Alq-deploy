/**
 * supabase/proxy.ts — renueva la sesión de Supabase en cada request que pasa
 * por `proxy.ts`.
 *
 * Qué es: el patrón `updateSession` de `@supabase/ssr` para Next.js 16
 * (donde `middleware.ts` pasó a llamarse `proxy.ts`). Crea un cliente atado
 * al request, verifica el token con `getClaims()` y, si Supabase lo renovó,
 * copia las cookies nuevas al request (para el servidor) y a la respuesta
 * (para el navegador).
 * Cubre: US-39 Iniciar y cerrar sesión ("la sesión dura hasta cerrarla").
 *
 * Quién lo usa: solo `src/proxy.ts`, y solo con `NEXT_PUBLIC_USE_MOCKS=false`.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/services/shared/config'

/** Resultado de {@link updateSession}. */
export interface UpdateSessionResult {
  /**
   * La respuesta que hay que devolver (o de la que hay que copiar las
   * cookies): puede traer el token renovado en `Set-Cookie`.
   */
  response: NextResponse
  /** `true` si hay una sesión válida (token con firma verificada y sin vencer). */
  hasSession: boolean
}

/**
 * Renueva la sesión de Supabase del request y dice si hay alguien logueado.
 *
 * NOTA: se usa `getClaims()` y no `getSession()`: `getClaims()` verifica la
 * firma del token contra las claves públicas del proyecto (JWKS), así una
 * cookie armada a mano no pasa. Si el token venció, lo renueva con el
 * refresh token antes de verificarlo.
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        // 1. Al request, para que lo que se renderice después ya vea el token nuevo.
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        // 2. A la respuesta, para que el navegador reemplace el token viejo.
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        // 3. Headers anti-caché que pide @supabase/ssr cuando cambian las cookies de sesión.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // NOTA: no poner código entre createServerClient y getClaims() (lo pide la
  // guía de @supabase/ssr): si no, la sesión se puede cortar sin motivo.
  const { data } = await supabase.auth.getClaims()

  return { response, hasSession: Boolean(data?.claims) }
}
