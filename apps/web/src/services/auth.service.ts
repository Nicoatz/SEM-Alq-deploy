/**
 * auth.service.ts — frontera con el backend para la cuenta: registro, login y logout.
 *
 * Qué es: crear la cuenta, validar credenciales y cerrar sesión. La sesión en
 * sí (quién está logueado, rol activo) la maneja `lib/auth/AuthProvider.tsx`.
 * Cubre: US-19 Registrar usuario y US-39 Iniciar y cerrar sesión.
 *
 * NOTA: login y logout NO pasan por `apps/api`: el back no tiene esas rutas
 * (lo definió backend). Con el back real, el front usa Supabase Auth
 * directamente (`signInWithPassword` / `signOut`) y después le pide el
 * perfil a la API (`GET /usuarios/me`). El registro sí va por la API.
 *
 * Quién lo usa: `lib/auth/AuthProvider.tsx` (login y logout) y
 * `components/auth/RegistroForm.tsx` (registro).
 */
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { Usuario, UsuarioSesion } from '@rentar/shared-types'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase/client'
import { registroInputToRequest, registroResponseToSesion } from './adapters/registro.adapter'
import { apiRequest } from './shared/apiClient'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { saveMockRecord } from './shared/mockStore'
import { getUsuarioActual, readUsuariosMock, toUsuarioSesion } from './usuarios.service'

// ─── Login y logout (US-39) ────────────────────────────────────────────────

/** Lo que se carga en el formulario de `/login` (US-39). */
export interface LoginCredentials {
  email: string
  password: string
}

/**
 * Mensaje único para cualquier falla de credenciales.
 *
 * NOTA: es genérico a propósito (US-39): no dice si el mail existe o si lo
 * que falló fue la contraseña, para no revelar qué mails están registrados.
 */
export const INVALID_CREDENTIALS_MESSAGE = 'El email o la contraseña no coinciden.'

/** Mensaje si Supabase Auth no responde (sin red, o el servicio caído). */
const AUTH_NETWORK_MESSAGE = 'No pudimos conectarnos con el servidor. Probá de nuevo en unos minutos.'

/**
 * Mensaje si las credenciales son válidas pero la cuenta no tiene perfil en
 * la tabla `usuario` (`/usuarios/me` responde 401). No debería pasar con
 * cuentas creadas desde `/registro`.
 */
const PERFIL_INEXISTENTE_MESSAGE = 'Tu cuenta no tiene un perfil cargado en RentAR. Escribinos para revisarla.'

/**
 * Traduce un error de Supabase Auth al `ServiceError` del front.
 * - 400 / 401 / 422 (credenciales inválidas, email mal formado, etc.) →
 *   `unauthorized` con el mensaje genérico (US-39).
 * - Sin respuesta → `network`.
 * - Cualquier otro (429 por demasiados intentos, 5xx) → `server`, con el
 *   mensaje de Supabase.
 */
function authErrorToServiceError(error: unknown): ServiceError {
  if (isAuthRetryableFetchError(error)) return new ServiceError('network', AUTH_NETWORK_MESSAGE)
  if (isAuthApiError(error) && (error.status === 400 || error.status === 401 || error.status === 422)) {
    return new ServiceError('unauthorized', INVALID_CREDENTIALS_MESSAGE)
  }
  const message = error instanceof Error && error.message ? error.message : 'Ocurrió un error inesperado. Probá de nuevo.'
  return new ServiceError('server', message)
}

/**
 * Cierra la sesión de Supabase. Primero intenta revocarla en el servidor
 * (alcance `global`: invalida el refresh token); si eso falla (por ejemplo,
 * sin red), igual la borra de este navegador (alcance `local`, sin red).
 *
 * NOTA: `signOut()` con alcance `global` NO borra la sesión local si el
 * pedido al servidor falla por red; por eso el segundo intento.
 */
async function cerrarSesionSupabase(): Promise<void> {
  const supabase = getSupabaseBrowserClient()
  try {
    const { error } = await supabase.auth.signOut()
    if (!error) return
  } catch {
    // sigue con el cierre local
  }
  await supabase.auth.signOut({ scope: 'local' })
}

/**
 * US-39 Iniciar y cerrar sesión — iniciar sesión.
 * @backend Supabase Auth `signInWithPassword` (no pasa por `apps/api`), y
 *          después GET /api/v1/usuarios/me (existe) para el nombre y los roles.
 * @returns UsuarioSesion
 * @throws {ServiceError} `unauthorized` con {@link INVALID_CREDENTIALS_MESSAGE}
 *   si las credenciales no coinciden; `network` / `server` si falla Auth o
 *   `/usuarios/me`.
 *
 * NOTA: si el login de Auth funciona pero `/usuarios/me` falla, se cierra la
 * sesión de Supabase antes de tirar el error: no queda una sesión a medias
 * (con token pero sin perfil ni roles).
 */
export async function login(credentials: LoginCredentials): Promise<UsuarioSesion> {
  if (USE_MOCKS) {
    await delay()
    const email = credentials.email.trim().toLowerCase()
    const usuario = readUsuariosMock().find((item) => item.email.toLowerCase() === email)
    if (!usuario || usuario.password !== credentials.password) {
      throw new ServiceError('unauthorized', INVALID_CREDENTIALS_MESSAGE)
    }
    return toUsuarioSesion(usuario)
  }

  let signInError: unknown = null
  try {
    const { error } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password,
    })
    signInError = error
  } catch (error) {
    signInError = error
  }
  if (signInError) throw authErrorToServiceError(signInError)

  let usuario: UsuarioSesion | null
  try {
    usuario = await getUsuarioActual()
  } catch (error) {
    await cerrarSesionSupabase()
    throw error
  }
  if (!usuario) {
    await cerrarSesionSupabase()
    throw new ServiceError('server', PERFIL_INEXISTENTE_MESSAGE)
  }
  return usuario
}

/**
 * US-39 Iniciar y cerrar sesión — cerrar sesión.
 * @backend Supabase Auth `signOut` (no pasa por `apps/api`: no hay ruta de logout)
 * @returns nada. No tira error por la red: la sesión de este navegador se
 *   cierra siempre (ver `cerrarSesionSupabase`).
 */
export async function logout(): Promise<void> {
  if (USE_MOCKS) {
    await delay(150)
    return
  }
  await cerrarSesionSupabase()
}

// ─── Registro (US-19) ──────────────────────────────────────────────────────

/**
 * Datos del registro (US-19). No lleva rol: toda cuenta nueva es locataria
 * (regla del equipo, 27/09/2026; el back la registra así).
 */
export interface RegistroInput {
  nombre: string
  apellido: string
  email: string
  password: string
  /** Solo dígitos, con característica y sin 0 ni 15 (ej. "3515123456"). */
  telefono: string
  /** Solo dígitos, 7 u 8. */
  dni: string
  /** Formato ISO `YYYY-MM-DD`. */
  fechaNacimiento: string
  aceptaTerminos: boolean
}

/** Mensaje de mail duplicado (diseño, "Validaciones del paso 2"). */
export const EMAIL_TAKEN_MESSAGE = 'Ya existe una cuenta con ese email.'

/** Mensaje de DNI duplicado (US-19: el documento identifica a la persona). */
export const DNI_TAKEN_MESSAGE = 'Ya existe una cuenta con ese DNI.'

/**
 * `true` si el 409 del registro es por el DNI (y no por el mail).
 * NOTA: el back responde 409 en los dos casos, con el texto crudo del error:
 * el de Supabase Auth (en inglés) para el mail, o el de Postgres para el DNI
 * ("duplicate key value violates unique constraint
 * \"uq_usuario_numero_documento\""). Se distingue por ese texto.
 * TODO(backend): responder un código por campo (ej. `email_duplicado`,
 * `dni_duplicado`) y el mensaje en español, así el front no depende del
 * texto de Postgres.
 */
function esDniDuplicado(mensaje: string): boolean {
  return /numero_documento/i.test(mensaje)
}

/**
 * US-19 Registrar usuario — crear la cuenta.
 * @backend POST /api/v1/registrar-usuario   (existe · sin token)
 * @body    RegistrarUsuarioRequest (lo arma `registroInputToRequest`)
 * @returns UsuarioSesion (la respuesta la traduce `registroResponseToSesion`)
 * El back registra a todos como locatario (el rol locador se suma al
 * publicar la primera propiedad).
 * @throws {ServiceError} `conflict` con {@link EMAIL_TAKEN_MESSAGE} si el mail ya existe;
 *   `validation` con {@link DNI_TAKEN_MESSAGE} si el DNI ya existe (índice
 *   único `uq_usuario_numero_documento`; el front no lo valida, lo decide la base).
 *
 * NOTA: esta función no inicia sesión. El login automático después del
 * registro lo hace la pantalla (`RegistroForm`) con `useAuth().login`, así
 * `AuthProvider` se entera de la sesión nueva. El back crea la cuenta ya
 * confirmada (`email_confirm: true`), por eso se puede entrar enseguida.
 */
export async function registrarUsuario(input: RegistroInput): Promise<UsuarioSesion> {
  if (USE_MOCKS) {
    await delay()
    const email = input.email.trim().toLowerCase()
    if (readUsuariosMock().some((usuario) => usuario.email.toLowerCase() === email)) {
      throw new ServiceError('conflict', EMAIL_TAKEN_MESSAGE)
    }
    const nuevo = {
      id: `usr-${Date.now()}`,
      nombre: input.nombre.trim(),
      apellido: input.apellido.trim(),
      email,
      // NOTA: solo en modo mock, y solo en este navegador: el back real guarda
      // un hash, nunca la contraseña.
      password: input.password,
      // Toda cuenta nueva es locataria (igual que en el back).
      roles: ['locatario' as const],
      status: 'activo' as const,
      telefono: input.telefono,
      dni: input.dni,
      fechaNacimiento: input.fechaNacimiento,
    }
    if (!saveMockRecord('usuarios', nuevo)) {
      throw new ServiceError('server', 'No pudimos guardar tu cuenta en este navegador. Probá de nuevo.')
    }
    return toUsuarioSesion(nuevo)
  }

  try {
    // `auth: false`: el registro es público; aunque haya una sesión abierta
    // en este navegador, su token no tiene nada que ver con la cuenta nueva.
    const response = await apiRequest<Usuario>('/registrar-usuario', {
      method: 'POST',
      body: registroInputToRequest(input),
      auth: false,
    })
    return registroResponseToSesion(response)
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'conflict') {
      // DNI repetido: va como error de datos (arriba del formulario, que
      // conserva lo escrito). Mail repetido: `conflict`, que la pantalla
      // muestra con su aviso y el campo marcado. En los dos casos, con un
      // mensaje en español (el del back viene crudo, ver `esDniDuplicado`).
      if (esDniDuplicado(error.message)) throw new ServiceError('validation', DNI_TAKEN_MESSAGE)
      throw new ServiceError('conflict', EMAIL_TAKEN_MESSAGE)
    }
    throw error
  }
}
