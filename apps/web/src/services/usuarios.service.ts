/**
 * usuarios.service.ts — frontera con el backend para consultar cuentas.
 *
 * Qué es: resolver el perfil (nombre y roles) del usuario en sesión. Lo usa
 * `AuthProvider` al iniciar sesión y al recargar la página.
 * Cubre: US-39 Iniciar y cerrar sesión (mantener la sesión en el navegador).
 * Quién lo usa: `lib/auth/AuthProvider.tsx` y `services/auth.service.ts`.
 */
import type { UsuarioSesion } from '@rentar/shared-types'
import { usuarios as usuariosElenco, type UsuarioMock } from '@/lib/mocks'
import { readSessionFromDocument } from '@/lib/auth/session-cookie'
import { usuarioMeToSesion } from './adapters/usuario.adapter'
import { apiRequest } from './shared/apiClient'
import type { UsuarioMeResponse } from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { readMockCollection } from './shared/mockStore'

/**
 * Todas las cuentas mock: el elenco más las registradas en `/registro`
 * (guardadas en el navegador). Lo comparte `auth.service.ts`.
 */
export function readUsuariosMock(): UsuarioMock[] {
  return readMockCollection('usuarios', usuariosElenco)
}

/** Saca la contraseña de una cuenta mock: nunca sale de la rama mock. */
export function toUsuarioSesion(usuarioMock: UsuarioMock): UsuarioSesion {
  const { password, ...usuario } = usuarioMock
  void password // se descarta a propósito
  return usuario
}

/**
 * US-39 Iniciar y cerrar sesión — el perfil del usuario en sesión.
 * @backend GET /api/v1/usuarios/me   (existe · requiere token)
 * @returns UsuarioSesion, o `null` si no hay sesión (o el token ya no sirve).
 * @throws {ServiceError} `server` / `network` si el back falla: la sesión
 *   existe pero no se pudo leer el perfil.
 *
 * NOTA: los roles salen solo de esta respuesta. Si falla, NO se deducen de
 * otro lado (por ejemplo, probando qué endpoints responden): se muestra el
 * error y listo.
 * NOTA: `null` (y no un error) cuando no hay sesión, porque `AuthProvider` lo
 * trata como "sin sesión", no como un error a mostrar.
 */
export async function getUsuarioActual(): Promise<UsuarioSesion | null> {
  if (USE_MOCKS) {
    await delay(200)
    // En modo mock, "quién está en sesión" es la cookie simulada.
    const session = readSessionFromDocument()
    if (!session) return null
    const usuario = readUsuariosMock().find((item) => item.id === session.userId)
    return usuario ? toUsuarioSesion(usuario) : null
  }

  try {
    const me = await apiRequest<UsuarioMeResponse>('/usuarios/me')
    return usuarioMeToSesion(me)
  } catch (error) {
    // 401: sin token, token vencido que ya no se pudo renovar, o usuario de
    // Auth sin perfil en la tabla `usuario`. Para el front, "sin sesión".
    if (error instanceof ServiceError && error.code === 'unauthorized') return null
    throw error
  }
}
