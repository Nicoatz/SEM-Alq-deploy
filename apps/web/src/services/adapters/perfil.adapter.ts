/**
 * perfil.adapter.ts — traduce el perfil y el legajo del back al tipo de
 * vista, y los errores del back y de Supabase Auth a mensajes en español.
 *
 * Qué es: la frontera entre los DTO PROPUESTOS de `GET /usuarios/me/perfil`,
 * `PATCH /usuarios/me` y `PATCH /usuarios/me/legajo` (ver
 * `shared/backend-dtos.ts`) y `PerfilUsuario` / `LegajoUsuario`. Cuando el
 * back haga las rutas, lo que cambie de forma se ajusta acá, nunca en la
 * pantalla.
 * Cubre: US-20 Consultar usuario y US-21 Modificar usuario.
 * Quién lo usa: `services/perfil.service.ts` (las dos ramas: los mensajes
 * también los usa la rama mock, así responde igual que el back).
 */
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { DatosPersonalesCambios, LegajoUsuario, PerfilUsuario, UserRole } from '@rentar/shared-types'
import { telefonoAE164 } from '@/lib/perfil/formato'
import type { ActualizarLegajoRequest, ActualizarPerfilRequest, CodigoErrorPerfil, LegajoDto, PerfilResponse } from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'
import { SESSION_EXPIRED_MESSAGE } from '../shared/session'
import { rolDtoToUserRole } from './usuario.adapter'

// ─── Mensajes (en español, listos para mostrar) ─────────────────────────

export const PERFIL_DNI_EN_USO_MESSAGE = 'Ya existe una cuenta con ese DNI. Revisá el número.'
export const PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE =
  'No podés cambiar tu nombre, apellido ni DNI mientras seas parte de un contrato vigente o pendiente de firma: son los datos que figuran en el contrato.'
export const PERFIL_CORREO_EN_USO_MESSAGE = 'Ya existe una cuenta con ese correo.'
export const PERFIL_CORREO_IGUAL_MESSAGE = 'Ese ya es tu correo actual.'
export const PERFIL_PASSWORD_ACTUAL_INCORRECTA_MESSAGE = 'La contraseña actual no es correcta.'
export const PERFIL_PASSWORD_IGUAL_MESSAGE = 'La contraseña nueva tiene que ser distinta de la actual.'
export const PERFIL_PASSWORD_DEBIL_MESSAGE = 'La contraseña nueva no cumple los requisitos. Revisá la lista de abajo.'
export const PERFIL_DEMASIADOS_INTENTOS_MESSAGE = 'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.'
export const PERFIL_ERROR_GENERICO_MESSAGE = 'No pudimos guardar los cambios. Probá de nuevo en unos minutos.'
const PERFIL_SIN_RED_MESSAGE = 'No pudimos conectarnos con el servidor. Revisá tu conexión y probá de nuevo.'

// ─── DTO → vista ────────────────────────────────────────────────────────

/** El legajo del back → `LegajoUsuario`. Sin legajo, el vacío (US-20: "Sin cargar"). */
export function legajoDtoToLegajo(dto: LegajoDto | null): LegajoUsuario {
  if (!dto) return { occupation: 'sin_informar', monthlyIncome: null, guarantees: [] }
  return {
    occupation: dto.ocupacion,
    // Un 0 no debería llegar (US-21: mayor a 0 o vacío); si llega, es "no cargado".
    monthlyIncome: dto.ingresos && dto.ingresos > 0 ? dto.ingresos : null,
    guarantees: dto.garantias,
  }
}

/**
 * Respuesta de `GET /usuarios/me/perfil` (propuesto) → `PerfilUsuario`.
 *
 * Campo por campo:
 * - `id`: número → texto, igual que `usuarioMeToSesion`.
 * - `telefono`: el back guarda solo dígitos; acá pasa a E.164 (con "+").
 * - `roles`: traducidos con `rolDtoToUserRole`. US-20: "todo usuario es
 *   locatario", así que se agrega si el back no lo manda.
 * - `pendingEmail`: NO sale del back sino de Supabase Auth (`user.new_email`,
 *   US-21); lo pasa el service.
 * - `identityLock`: `contrato_bloqueante` (propuesto).
 */
export function perfilResponseToPerfil(dto: PerfilResponse, pendingEmail: string | null): PerfilUsuario {
  const roles = dto.roles.map(rolDtoToUserRole).filter((role): role is UserRole => role !== null)
  if (!roles.includes('locatario')) roles.push('locatario')
  return {
    id: String(dto.id),
    nombre: dto.nombre,
    apellido: dto.apellido ?? '',
    dni: dto.numero_documento || null,
    email: dto.email,
    pendingEmail: pendingEmail && pendingEmail !== dto.email ? pendingEmail : null,
    telefono: telefonoAE164(dto.telefono),
    fechaNacimiento: dto.fecha_nacimiento || null,
    roles,
    identityLock: dto.contrato_bloqueante ? { contractCode: dto.contrato_bloqueante.codigo, contractStatus: dto.contrato_bloqueante.estado } : null,
    legajo: legajoDtoToLegajo(dto.legajo),
  }
}

// ─── Vista → DTO ────────────────────────────────────────────────────────

/** Cambios de "Datos personales" → cuerpo de `PATCH /usuarios/me` (solo lo que cambió). */
export function cambiosToActualizarRequest(cambios: DatosPersonalesCambios): ActualizarPerfilRequest {
  const request: ActualizarPerfilRequest = {}
  if (cambios.nombre !== undefined) request.nombre = cambios.nombre.trim()
  if (cambios.apellido !== undefined) request.apellido = cambios.apellido.trim()
  if (cambios.dni !== undefined && cambios.dni !== null) request.numero_documento = cambios.dni
  // El back guarda el teléfono sin el "+" (igual que en las solicitudes).
  if (cambios.telefono !== undefined) request.telefono = cambios.telefono ? cambios.telefono.replace(/^\+/, '') : null
  if (cambios.fechaNacimiento !== undefined) request.fecha_nacimiento = cambios.fechaNacimiento
  return request
}

/** Legajo → cuerpo de `PATCH /usuarios/me/legajo`. */
export function legajoToActualizarRequest(legajo: LegajoUsuario): ActualizarLegajoRequest {
  return { ocupacion: legajo.occupation, ingresos: legajo.monthlyIncome, garantias: legajo.guarantees }
}

// ─── Errores del back (apps/api) ────────────────────────────────────────

/** Saca el texto crudo del back de un error de servidor: nunca se muestra un mensaje técnico. */
function sinTextoTecnico(error: ServiceError): ServiceError {
  if (error.code === 'server') return new ServiceError('server', PERFIL_ERROR_GENERICO_MESSAGE)
  if (error.code === 'network') return new ServiceError('network', PERFIL_SIN_RED_MESSAGE)
  return error
}

/**
 * Error de `PATCH /usuarios/me` (propuesto) → mensaje de la pantalla:
 * - 409 `DNI_DUPLICADO` → {@link PERFIL_DNI_EN_USO_MESSAGE} (US-21: "único en la plataforma").
 * - 409 `IDENTIDAD_BLOQUEADA_POR_CONTRATO` → {@link PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE}.
 * - 409 sin código: se asume el DNI (es el 409 más común); TODO(backend): mandar `codigo`.
 * - 400 → `validation` con el texto del back (sus validaciones repiten las del front).
 * - 401 → "Tu sesión venció" (ya lo arma `apiClient`).
 */
export function errorDeActualizarDatos(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'conflict') {
    const codigo = error.apiCode as CodigoErrorPerfil | undefined
    if (codigo === 'IDENTIDAD_BLOQUEADA_POR_CONTRATO') return new ServiceError('conflict', PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE, codigo)
    return new ServiceError('conflict', PERFIL_DNI_EN_USO_MESSAGE, 'DNI_DUPLICADO')
  }
  return sinTextoTecnico(error)
}

/** Error de `PATCH /usuarios/me/legajo` y de `GET /usuarios/me/perfil` → mensaje de la pantalla. */
export function errorDePerfil(error: unknown): unknown {
  return error instanceof ServiceError ? sinTextoTecnico(error) : error
}

// ─── Errores de Supabase Auth (correo y contraseña) ─────────────────────

/** El `code` de un error de Supabase Auth como texto, o `''`. */
function codigoAuth(error: unknown): string {
  return isAuthApiError(error) && error.code ? String(error.code) : ''
}

/**
 * Error de `supabase.auth.updateUser({ email })` → mensaje (US-21):
 * - 422 `email_exists` → {@link PERFIL_CORREO_EN_USO_MESSAGE} ("debe ser único en la plataforma").
 * - 400 `email_address_invalid` / `validation_failed` → formato inválido.
 * - 429 `over_email_send_rate_limit` → demasiados intentos.
 * - Sin red → `network`.
 */
export function errorDeCambioDeCorreo(error: unknown): ServiceError {
  if (isAuthRetryableFetchError(error)) return new ServiceError('network', PERFIL_SIN_RED_MESSAGE)
  const codigo = codigoAuth(error)
  if (codigo === 'email_exists') return new ServiceError('conflict', PERFIL_CORREO_EN_USO_MESSAGE)
  if (codigo === 'email_address_invalid' || codigo === 'validation_failed') {
    return new ServiceError('validation', 'Revisá el correo: tiene que ser del tipo nombre@dominio.com.')
  }
  if (codigo === 'over_email_send_rate_limit' || codigo === 'over_request_rate_limit') return new ServiceError('validation', PERFIL_DEMASIADOS_INTENTOS_MESSAGE)
  if (isAuthApiError(error) && error.status === 401) return new ServiceError('unauthorized', SESSION_EXPIRED_MESSAGE)
  return new ServiceError('server', PERFIL_ERROR_GENERICO_MESSAGE)
}

/**
 * Error de `supabase.auth.updateUser({ password, current_password })` →
 * mensaje (US-21). Códigos de Supabase Auth (verificados en
 * `supabase/auth`, `internal/api/user.go`):
 * - 400 `current_password_invalid` → {@link PERFIL_PASSWORD_ACTUAL_INCORRECTA_MESSAGE}.
 *   NOTA: el texto de Supabase dice "Current password required when setting
 *   new password." aunque la causa sea que no coincide: por eso se mira el
 *   `code`, nunca el texto.
 * - 400 `current_password_required` → mismo mensaje (no debería pasar: el
 *   front siempre la manda).
 * - 422 `same_password` → {@link PERFIL_PASSWORD_IGUAL_MESSAGE}.
 * - 422 `weak_password` → {@link PERFIL_PASSWORD_DEBIL_MESSAGE}.
 * - 400 `reauthentication_needed`: solo si alguien activa "Secure password
 *   change" en el dashboard. Se pide volver a entrar.
 * - 429 → demasiados intentos. Sin red → `network`.
 */
export function errorDeCambioDeContrasena(error: unknown): ServiceError {
  if (isAuthRetryableFetchError(error)) return new ServiceError('network', PERFIL_SIN_RED_MESSAGE)
  const codigo = codigoAuth(error)
  if (codigo === 'current_password_invalid' || codigo === 'current_password_required') {
    return new ServiceError('validation', PERFIL_PASSWORD_ACTUAL_INCORRECTA_MESSAGE, codigo)
  }
  if (codigo === 'same_password') return new ServiceError('validation', PERFIL_PASSWORD_IGUAL_MESSAGE, codigo)
  if (codigo === 'weak_password') return new ServiceError('validation', PERFIL_PASSWORD_DEBIL_MESSAGE, codigo)
  if (codigo === 'reauthentication_needed') {
    return new ServiceError('unauthorized', 'Por seguridad, cerrá sesión y volvé a entrar antes de cambiar la contraseña.', codigo)
  }
  if (codigo === 'over_request_rate_limit') return new ServiceError('validation', PERFIL_DEMASIADOS_INTENTOS_MESSAGE, codigo)
  if (isAuthApiError(error) && error.status === 401) return new ServiceError('unauthorized', SESSION_EXPIRED_MESSAGE)
  return new ServiceError('server', PERFIL_ERROR_GENERICO_MESSAGE)
}
