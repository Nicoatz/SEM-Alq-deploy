/**
 * /auth/confirmar — a donde vuelven los enlaces de los correos de Supabase Auth.
 *
 * Qué es: un Route Handler (GET) que verifica el enlace del correo y manda al
 * usuario a la pantalla que corresponde. Hoy lo usa el cambio de correo
 * (US-21 Modificar usuario: "el cambio solo se aplica cuando el usuario
 * confirma el nuevo correo desde el enlace"). El registro no tiene una ruta
 * de confirmación (el back crea la cuenta ya confirmada, US-19); esta ruta
 * es general a propósito, así sirve para cualquier enlace de Auth que se
 * sume después (por ejemplo, recuperar la contraseña).
 *
 * Acepta las dos formas de enlace de Supabase:
 * - `?token_hash=…&type=email_change&next=/panel/perfil` — la recomendada con
 *   `@supabase/ssr`: se verifica acá con `verifyOtp`, sirve aunque el enlace
 *   se abra en otro dispositivo. Requiere cambiar la plantilla "Change email
 *   address" del dashboard (pasos en `docs/HANDOFF-BACKEND.md` §7).
 * - `?code=…` — la de la plantilla por defecto (flujo PKCE): Supabase ya
 *   verificó el enlace y acá se canjea el código por la sesión. Solo funciona
 *   en el navegador donde se pidió el cambio.
 * - `?message=…` — con "Secure email change", el PRIMER enlace confirmado
 *   vuelve con un aviso de Supabase ("falta confirmar el otro"): se informa
 *   como confirmación parcial.
 *
 * Siempre termina en una redirección: a `next` (solo rutas internas) con
 * `?correo=confirmado|parcial|error`, que lee `PerfilScreen`.
 * Quién lo usa: los enlaces de los correos (`perfil.service#solicitarCambioDeCorreo`
 * pasa esta ruta en `emailRedirectTo`).
 */
import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/auth/supabase/server'
import { USE_MOCKS } from '@/services/shared/config'

/** A dónde va si `next` no viene o no es una ruta interna. */
const DESTINO_POR_DEFECTO = '/panel/perfil'

/** Tipos de enlace que se aceptan (los de correo de Supabase Auth). */
const TIPOS_VALIDOS: readonly EmailOtpType[] = ['email_change', 'signup', 'email', 'recovery', 'invite', 'magiclink']

/**
 * `next` solo si es una ruta interna (`/algo`, nunca `//otro-sitio` ni una
 * URL completa): evita que el enlace sirva para mandar a alguien afuera.
 */
function destinoSeguro(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : DESTINO_POR_DEFECTO
}

/** Redirige a `destino` con `?correo=<resultado>`. */
function redirigir(request: NextRequest, destino: string, resultado: 'confirmado' | 'parcial' | 'error'): NextResponse {
  const url = new URL(destino, request.nextUrl.origin)
  url.searchParams.set('correo', resultado)
  return NextResponse.redirect(url)
}

/** Verifica el enlace del correo y redirige (ver el encabezado). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams
  const destino = destinoSeguro(params.get('next'))

  // En modo mock no hay correos: la confirmación se simula desde el perfil.
  if (USE_MOCKS) return redirigir(request, destino, 'error')

  const tokenHash = params.get('token_hash')
  const tipo = params.get('type')
  const codigo = params.get('code')

  try {
    const supabase = await createSupabaseServerClient()
    if (tokenHash && tipo && TIPOS_VALIDOS.includes(tipo)) {
      const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })
      return redirigir(request, destino, error ? 'error' : 'confirmado')
    }
    if (codigo) {
      const { error } = await supabase.auth.exchangeCodeForSession(codigo)
      return redirigir(request, destino, error ? 'error' : 'confirmado')
    }
  } catch {
    return redirigir(request, destino, 'error')
  }

  // Con "Secure email change", el primer enlace vuelve solo con un aviso.
  if (params.get('message')) return redirigir(request, destino, 'parcial')
  return redirigir(request, destino, 'error')
}
