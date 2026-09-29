/**
 * proxy.ts — protege `/panel/*`: sin sesión, manda a `/login` (US-39).
 *
 * Qué es: en Next.js 16, `middleware.ts` pasó a llamarse `proxy.ts` (y la
 * función exportada, `proxy`) — misma funcionalidad, nombre nuevo. Va dentro
 * de `src/` porque el proyecto usa `src/`. Corre en el servidor (runtime de
 * Node.js), antes de renderizar cada ruta del panel.
 *
 * Dos ramas, según `NEXT_PUBLIC_USE_MOCKS`:
 * - Modo mock: alcanza con que exista la cookie de sesión simulada
 *   (`rentar_session`, ver `lib/auth/session-cookie.ts`).
 * - Modo real: la sesión es la de Supabase Auth (cookies `sb-…`). El proxy
 *   la verifica y, si el token venció, lo renueva (`lib/auth/supabase/proxy.ts`).
 *
 * Solo verifica que haya sesión, no el rol: qué ve cada rol adentro del
 * panel lo decide el layout del panel.
 *
 * `?next=` guarda adónde quería ir el usuario, para volver ahí después del
 * login (US-39: "redirigir a la página en la que se encontraba").
 */
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie'
import { updateSession } from '@/lib/auth/supabase/proxy'
import { USE_MOCKS } from '@/services/shared/config'

/**
 * Rutas que pasan por el proxy: solo el panel.
 *
 * NOTA: la guía de Supabase sugiere pasar TODAS las rutas por el proxy para
 * renovar el token en cada request. Acá no hace falta: ninguna pantalla lee
 * la sesión del lado del servidor (todas son Client Components), y en el
 * navegador el cliente de Supabase renueva el token solo. El proxy solo
 * tiene que cuidar la puerta del panel.
 */
export const config = {
  matcher: ['/panel/:path*'],
}

/** Redirección a `/login?next=<ruta pedida>`. */
function redirectToLogin(request: NextRequest): NextResponse {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(loginUrl)
}

/** Deja pasar si hay sesión; si no, redirige a `/login?next=<ruta pedida>`. */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (USE_MOCKS) {
    return request.cookies.has(SESSION_COOKIE_NAME) ? NextResponse.next() : redirectToLogin(request)
  }

  const { response, hasSession } = await updateSession(request)
  if (hasSession) return response

  // Sin sesión (o con una que ya no se puede renovar). Se copian las cookies
  // que haya escrito Supabase (por ejemplo, las que borra una sesión
  // inválida), así el navegador no se queda con un token roto.
  const redirect = redirectToLogin(request)
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}
