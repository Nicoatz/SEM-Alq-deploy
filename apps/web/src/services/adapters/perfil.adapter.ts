/**
 * perfil.adapter.ts — traduce el perfil y el legajo del back al tipo de
 * vista, y los errores del back y de Supabase Auth a mensajes en español.
 *
 * Qué es: la frontera entre los DTO de `GET /usuarios/me` y
 * `PATCH /usuarios/me` (existen desde el Sprint 3) y de
 * `PATCH /usuarios/me/legajo` (propuesto), ver `shared/backend-dtos.ts`, y
 * `PerfilUsuario` / `LegajoUsuario`. Si el back cambia la forma, se ajusta
 * acá, nunca en la pantalla.
 * Cubre: US-20 Consultar usuario y US-21 Modificar usuario.
 * Quién lo usa: `services/perfil.service.ts` (las dos ramas: los mensajes
 * también los usa la rama mock, así responde igual que el back).
 */
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { DatosPersonalesCambios, LegajoUsuario, PerfilUsuario, UserRole } from '@rentar/shared-types'
import { telefonoDelBack } from '@/lib/perfil/formato'
import { MENSAJES_SOLICITUD } from '@/lib/validation/solicitud.rules'
import { MENSAJES, MENSAJES_PERFIL } from '@/lib/validation/usuario.rules'
import type { ActualizarLegajoRequest, ActualizarPerfilRequest, CodigoErrorPerfil, LegajoDto, PerfilResponse } from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'
import { SESSION_EXPIRED_MESSAGE } from '../shared/session'
import { rolDtoToUserRole } from './usuario.adapter'

// ─── Mensajes (en español, listos para mostrar) ─────────────────────────

export const PERFIL_DNI_EN_USO_MESSAGE = 'Ese DNI ya está registrado en otra cuenta. Revisá el número.'
export const PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE =
  'No podés cambiar tu nombre, apellido ni DNI mientras seas parte de un contrato vigente o pendiente de firma: son los datos que figuran en el contrato.'
export const PERFIL_CORREO_EN_USO_MESSAGE = 'Ya existe una cuenta con ese correo.'
export const PERFIL_CORREO_IGUAL_MESSAGE = 'Ese ya es tu correo actual.'
export const PERFIL_PASSWORD_ACTUAL_INCORRECTA_MESSAGE = 'La contraseña actual no es correcta.'
export const PERFIL_PASSWORD_IGUAL_MESSAGE = 'La contraseña nueva tiene que ser distinta de la actual.'
export const PERFIL_PASSWORD_DEBIL_MESSAGE = 'La contraseña nueva no cumple los requisitos. Revisá la lista de abajo.'
export const PERFIL_DEMASIADOS_INTENTOS_MESSAGE = 'Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.'
export const PERFIL_ERROR_GENERICO_MESSAGE = 'No pudimos guardar los cambios. Probá de nuevo en unos minutos.'
/** Un 400 o un 409 del back que no se puede traducir a un mensaje concreto. */
export const PERFIL_REVISAR_DATOS_MESSAGE = 'Revisá los datos e intentá de nuevo.'
/**
 * El back no deja borrar un dato (un valor vacío es un 400): por ahora, en
 * modo real, el front frena antes (brecha en HANDOFF §7).
 */
export const PERFIL_NO_SE_BORRA_TELEFONO_MESSAGE = 'Por ahora no se puede borrar el teléfono, solo cambiarlo.'
export const PERFIL_NO_SE_BORRA_FECHA_MESSAGE = 'Por ahora no se puede borrar la fecha de nacimiento, solo cambiarla.'
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
 * Respuesta de `GET /usuarios/me` o de `PATCH /usuarios/me` → `PerfilUsuario`.
 *
 * Campo por campo:
 * - `id`: número → texto, igual que `usuarioMeToSesion`.
 * - `telefono`: el back guarda solo dígitos. Con código de país pasa a E.164;
 *   sin código (los 10 dígitos del seed) queda tal cual, sin inventar el 54
 *   (`telefonoDelBack`; brecha de datos en HANDOFF §7).
 * - `roles`: los del back, traducidos con `rolDtoToUserRole`. US-20: "todo
 *   usuario es locatario", así que se agrega si el back no lo manda.
 * - `pendingEmail`: NO sale del back sino de Supabase Auth (`user.new_email`,
 *   US-21); lo pasa el service.
 * - `identityLock`: siempre `null`. TODO(backend): el GET no dice si hay un
 *   contrato que bloquea nombre, apellido y DNI (US-21 pide mostrarlo antes
 *   de editar). Mientras tanto, el bloqueo se descubre con el 409 del PATCH
 *   (ver `DatosPersonalesBloque`).
 * - `legajo`: vacío ("Sin cargar"). TODO(backend): el back no tiene legajo.
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
    telefono: telefonoDelBack(dto.telefono),
    fechaNacimiento: dto.fecha_nacimiento || null,
    roles,
    identityLock: null,
    legajo: legajoDtoToLegajo(null),
  }
}

// ─── Vista → DTO ────────────────────────────────────────────────────────

/**
 * Cambios de "Datos personales" → cuerpo de `PATCH /usuarios/me`: solo los
 * campos que cambiaron (los compara el bloque con lo guardado). Un valor
 * vacío no viaja: el back responde 400 (el service frena antes el borrado).
 */
export function cambiosToActualizarRequest(cambios: DatosPersonalesCambios): ActualizarPerfilRequest {
  const request: ActualizarPerfilRequest = {}
  if (cambios.nombre !== undefined) request.nombre = cambios.nombre.trim()
  if (cambios.apellido !== undefined) request.apellido = cambios.apellido.trim()
  if (cambios.dni) request.numero_documento = cambios.dni
  // NOTA: el back valida `^[1-9]\d{9,14}$`, o sea SIN el "+", aunque el
  // ejemplo de Swagger lo muestre con "+".
  if (cambios.telefono) request.telefono = cambios.telefono.replace(/^\+/, '')
  if (cambios.fechaNacimiento) request.fecha_nacimiento = cambios.fechaNacimiento
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
 * Qué 409 de `PATCH /usuarios/me` es. Si el back manda `codigo`, ese manda;
 * si no, se mira el texto.
 * TODO(backend): mandar `codigo` en el sobre (`DNI_DUPLICADO` /
 * `IDENTIDAD_BLOQUEADA_POR_CONTRATO`, HANDOFF §7): hoy los dos 409 llegan sin
 * código y el texto puede cambiar. El del DNI es el mensaje crudo de Postgres
 * (23505, "duplicate key value violates unique constraint …"); el del bloqueo
 * dice "…participa en un contrato vigente o pendiente de firma".
 */
function codigoDelConflicto(error: ServiceError): CodigoErrorPerfil | null {
  if (error.apiCode === 'DNI_DUPLICADO' || error.apiCode === 'IDENTIDAD_BLOQUEADA_POR_CONTRATO') return error.apiCode
  const texto = error.message.toLowerCase()
  if (texto.includes('contrato')) return 'IDENTIDAD_BLOQUEADA_POR_CONTRATO'
  if (texto.includes('23505') || texto.includes('duplicate key')) return 'DNI_DUPLICADO'
  return null
}

/**
 * Un 400 de `PATCH /usuarios/me` → el mensaje del front para ese campo. El
 * back repite las validaciones del front (US-21), así que no debería llegar;
 * si llega, se reconoce por el comienzo de su texto
 * (`apps/api/src/services/usuario.service.ts`). Cualquier otro 400 (por
 * ejemplo, un error crudo de Supabase) → {@link PERFIL_REVISAR_DATOS_MESSAGE}.
 */
function mensajeDeValidacion(textoDelBack: string): string {
  const texto = textoDelBack.trim()
  if (texto.startsWith('El nombre') || texto.startsWith('El apellido')) return MENSAJES_PERFIL.nombreInvalido
  if (texto.startsWith('El DNI')) return MENSAJES.dniInvalido
  if (texto.startsWith('El teléfono')) return MENSAJES_SOLICITUD.telefonoLargo
  if (texto.startsWith('Para actualizar la fecha')) return MENSAJES.menorDeEdad
  return PERFIL_REVISAR_DATOS_MESSAGE
}

/**
 * Error de `PATCH /usuarios/me` → mensaje de la pantalla. Nunca se muestra el
 * texto crudo del back ni el de Postgres:
 * - 409 de DNI repetido → {@link PERFIL_DNI_EN_USO_MESSAGE} (US-21: "único en la plataforma").
 * - 409 de contrato → {@link PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE}, con `apiCode`
 *   `IDENTIDAD_BLOQUEADA_POR_CONTRATO` (la pantalla bloquea los campos).
 * - Otro 409 → {@link PERFIL_REVISAR_DATOS_MESSAGE}.
 * - 400 → ver {@link mensajeDeValidacion}.
 * - 401 → "Tu sesión venció" (ya lo arma `apiClient`).
 */
export function errorDeActualizarDatos(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'conflict') {
    const codigo = codigoDelConflicto(error)
    if (codigo === 'IDENTIDAD_BLOQUEADA_POR_CONTRATO') return new ServiceError('conflict', PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE, codigo)
    if (codigo === 'DNI_DUPLICADO') return new ServiceError('conflict', PERFIL_DNI_EN_USO_MESSAGE, codigo)
    return new ServiceError('conflict', PERFIL_REVISAR_DATOS_MESSAGE)
  }
  if (error.code === 'validation') return new ServiceError('validation', mensajeDeValidacion(error.message))
  return sinTextoTecnico(error)
}

/** Error de `GET /usuarios/me` (y del futuro `PATCH /usuarios/me/legajo`) → mensaje de la pantalla. */
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
