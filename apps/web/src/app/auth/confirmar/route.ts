/**
 * /auth/confirmar — redirige a "Mi perfil" (`/panel/perfil`). No hace nada más.
 *
 * Por qué existe: hasta el 06/11, el cambio de correo (US-21) mandaba enlaces
 * de confirmación de Supabase Auth que volvían a esta ruta. Desde 8d2a46c el
 * back aplica el correo en el momento, sin enlace, y el front ya no pide
 * confirmaciones. La ruta queda para que un enlace viejo que alguien abra
 * desde su correo no termine en un 404 (también figura en la lista de URLs
 * de redirección del proyecto de Supabase).
 * NOTA: no verifica nada: un enlace viejo, si todavía vale, lo procesa
 * Supabase antes de redirigir acá. Sin sesión, el proxy manda a `/login`.
 * Cubre: sin US en Sprint 0 (resto del flujo viejo de US-21).
 * Quién lo usa: solo los enlaces de los correos viejos.
 */
import { NextResponse, type NextRequest } from 'next/server'

/** A dónde va siempre. */
const DESTINO = '/panel/perfil'

/** Redirige a {@link DESTINO}, ignorando los parámetros del enlace. */
export function GET(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL(DESTINO, request.nextUrl.origin))
}
