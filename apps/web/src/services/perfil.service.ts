/**
 * perfil.service.ts — frontera con el backend para "Mi perfil" (`/panel/perfil`).
 *
 * Qué es: consultar y modificar los datos personales (con el correo) y la
 * contraseña del usuario en sesión. Siempre el propio: ninguna función
 * recibe un id de usuario (US-20: "no existe forma de ver el perfil de otro
 * usuario"; el back lo saca del token).
 * Cubre: US-20 Consultar usuario y US-21 Modificar usuario.
 * De dónde saca los datos:
 * - Modo mock: el elenco (`lib/mocks/usuarios.mock.ts`) más lo que se
 *   modificó en este navegador (ver "Datos sensibles" abajo).
 * - Modo real: `apps/api` para los datos personales y el correo (`GET` y
 *   `PATCH /usuarios/me`, existen); Supabase Auth para la contraseña.
 * NOTA: el legajo (situación, ingresos y garantías) salió de US-20 y US-21
 * el 06/11 (8d2a46c): se carga en cada solicitud (US-35).
 * Quién lo usa: `components/perfil/*` y las ramas mock de
 * `services/solicitudes.service.ts` y `contratos.service.ts` (`perfilMockDe`).
 *
 * NOTA (datos sensibles, US-20: "el DNI solo se muestra en esta pantalla"):
 * en modo mock, el DNI que se edita acá vive SOLO en memoria
 * (`sensiblesEnMemoria`): sobrevive a la navegación dentro del panel, no a
 * una recarga. Nunca se escribe en `localStorage` ni en `sessionStorage`, ni
 * se loguea. El resto del perfil sí se guarda (`rentar:mock:usuarios`). En
 * modo real no se guarda nada en el navegador: el perfil vive en el estado
 * de la pantalla.
 */
import dayjs from 'dayjs'
import type { DatosPersonalesCambios, PerfilUsuario } from '@rentar/shared-types'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase/client'
import { usuarios as usuariosElenco, type UsuarioMock } from '@/lib/mocks'
import { telefonoAE164 } from '@/lib/perfil/formato'
import { emailValido, MENSAJES_SOLICITUD, TELEFONO_E164_REGEX } from '@/lib/validation/solicitud.rules'
import { DNI_REGEX, esMayorDeEdad, MENSAJES, MENSAJES_PERFIL, nombrePerfilValido, PASSWORD_REGEX } from '@/lib/validation/usuario.rules'
import {
  cambiosToActualizarRequest,
  errorDeActualizarDatos,
  errorDeCambioDeContrasena,
  errorDePerfil,
  perfilResponseToPerfil,
  PERFIL_CORREO_EN_USO_MESSAGE,
  PERFIL_DNI_EN_USO_MESSAGE,
  PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE,
  PERFIL_NO_SE_BORRA_FECHA_MESSAGE,
  PERFIL_NO_SE_BORRA_TELEFONO_MESSAGE,
  PERFIL_PASSWORD_ACTUAL_INCORRECTA_MESSAGE,
  PERFIL_PASSWORD_IGUAL_MESSAGE,
} from './adapters/perfil.adapter'
import { contratoActivoDeUsuarioMock } from './adapters/contrato-mock.adapter'
import { apiRequest } from './shared/apiClient'
import type { PerfilResponse } from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { saveMockRecord } from './shared/mockStore'
import { requireSessionUserId, SESSION_EXPIRED_MESSAGE } from './shared/session'
import { readUsuariosMock } from './usuarios.service'

// ─── Rama mock: almacenamiento ──────────────────────────────────────────

/** Error de la rama mock si `localStorage` está lleno o bloqueado. */
const MOCK_STORAGE_FULL_MESSAGE = 'No pudimos guardar los cambios en este navegador. Tocá "Reiniciar datos de prueba" y probá de nuevo.'

/**
 * DNI editado en esta pestaña (ver la NOTA del encabezado). Una clave
 * ausente = "no se editó": vale el del elenco (o el del registro).
 */
const sensiblesEnMemoria = new Map<string, { dni?: string }>()

/** El usuario en sesión (modo mock), con la contraseña: nunca sale de este archivo. */
function usuarioMockEnSesion(): UsuarioMock {
  const userId = requireSessionUserId()
  const usuario = readUsuariosMock().find((item) => item.id === userId)
  if (!usuario) throw new ServiceError('unauthorized', SESSION_EXPIRED_MESSAGE)
  return usuario
}

/** El DNI vigente de una cuenta mock: el editado en memoria o el guardado (elenco o registro). */
function dniMock(usuario: UsuarioMock): string | null {
  return sensiblesEnMemoria.get(usuario.id)?.dni ?? usuario.dni ?? null
}

/**
 * Contrato que bloquea nombre, apellido y DNI (US-21): uno vigente o
 * pendiente de firma del que es parte, como locador o como locatario. Mira
 * los vigentes del elenco (`propiedades.mock.ts`) y los de
 * `contratos.mock.ts` + los del navegador (desde la tanda 2: por ejemplo,
 * CT-2026-0207 bloquea a Julieta mientras está pendiente de firma).
 */
function bloqueoMock(userId: string): PerfilUsuario['identityLock'] {
  const contrato = contratoActivoDeUsuarioMock(userId)
  return contrato ? { contractCode: contrato.code, contractStatus: contrato.status } : null
}

/**
 * Arma el `PerfilUsuario` de una cuenta mock. La exporta para las ramas mock
 * de `solicitudes.service.ts` (precarga del DNI y del contacto, US-35) y de
 * `contratos.service.ts` (las partes del contrato).
 * @returns `null` si la cuenta no existe.
 */
export function perfilMockDe(userId: string): PerfilUsuario | null {
  const usuario = readUsuariosMock().find((item) => item.id === userId)
  if (!usuario) return null
  const roles = usuario.roles.includes('locatario') ? usuario.roles : [...usuario.roles, 'locatario' as const]
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    dni: dniMock(usuario),
    email: usuario.email,
    telefono: telefonoAE164(usuario.telefono),
    fechaNacimiento: usuario.fechaNacimiento ?? null,
    roles,
    identityLock: bloqueoMock(userId),
  }
}

/**
 * Guarda una cuenta mock en `rentar:mock:usuarios` SIN el DNI editado: se
 * conserva el DNI que ya tenía (el del elenco, que está en el código, o el
 * del registro). El editado queda en {@link sensiblesEnMemoria}.
 */
function guardarUsuarioMock(usuario: UsuarioMock): void {
  const original = readUsuariosMock().find((item) => item.id === usuario.id) ?? usuariosElenco.find((item) => item.id === usuario.id)
  if (!saveMockRecord('usuarios', { ...usuario, dni: original?.dni })) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
}

// ─── Consulta (US-20) ───────────────────────────────────────────────────

/**
 * US-20 Consultar usuario — el perfil completo del usuario en sesión: datos
 * personales, roles y contrato que bloquea la identidad.
 * @backend GET /api/v1/usuarios/me   (existe) → PerfilResponse
 * @returns PerfilUsuario
 * @throws {ServiceError} `unauthorized` sin sesión; `network` / `server`.
 *
 * NOTA: el front había propuesto una ruta aparte (`/usuarios/me/perfil`)
 * para que el DNI no viajara en el `/me` que pide el `AuthProvider` (US-20);
 * el back eligió ampliar `/me`. La sesión ignora esos campos.
 */
export async function getMiPerfil(): Promise<PerfilUsuario> {
  if (USE_MOCKS) {
    await delay(300)
    const perfil = perfilMockDe(usuarioMockEnSesion().id)
    if (!perfil) throw new ServiceError('unauthorized', SESSION_EXPIRED_MESSAGE)
    return perfil
  }
  try {
    return perfilResponseToPerfil(await apiRequest<PerfilResponse>('/usuarios/me'))
  } catch (error) {
    throw errorDePerfil(error)
  }
}

// ─── Datos personales (US-21) ───────────────────────────────────────────

/**
 * `apiCode` de los errores que frena el front en modo real al vaciar un campo
 * (no son del back): la pantalla los usa para marcar el campo.
 */
export const CAMPO_NO_BORRABLE = { telefono: 'TELEFONO_NO_BORRABLE', fechaNacimiento: 'FECHA_NO_BORRABLE' } as const

/**
 * US-21 Modificar usuario — guarda el bloque "Datos personales": nombre,
 * apellido, DNI, correo, teléfono y fecha de nacimiento. `cambios` trae solo
 * lo que cambió respecto de lo guardado (lo compara `DatosPersonalesBloque`),
 * y solo eso viaja.
 *
 * El correo se aplica en el momento, igual que el resto (US-21 actualizada el
 * 06/11: sin enlace de confirmación). El back cambia `usuario.email` y el
 * correo de login de Supabase Auth; desde ahí se entra con el nuevo.
 * @backend PATCH /api/v1/usuarios/me   (existe) body ActualizarPerfilRequest → 200 PerfilResponse
 * @returns el perfil actualizado.
 * @throws {ServiceError}
 *   - `conflict` con {@link PERFIL_DNI_EN_USO_MESSAGE}: el DNI ya es de otra
 *     cuenta (US-21: "único en la plataforma").
 *   - `conflict` con {@link PERFIL_CORREO_EN_USO_MESSAGE}: el correo ya es de
 *     otra cuenta (US-21: "debe ser único en la plataforma").
 *   - `conflict` con {@link PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE}: cambia nombre,
 *     apellido o DNI siendo parte de un contrato vigente o pendiente de firma.
 *   - `validation`: un dato no cumple las reglas de US-21; en modo real,
 *     también si se vacía el teléfono o la fecha (ver abajo).
 *   - `unauthorized` sin sesión.
 * NOTA (US-21): "modificar el perfil no modifica las solicitudes ya enviadas
 * ni los contratos": las solicitudes guardan su propia copia del contacto.
 * NOTA (modo real): el back no deja borrar un dato (un valor vacío o `null`
 * es un 400). Si el usuario vacía el teléfono o la fecha que ya tenía, se
 * frena acá con un mensaje claro y no se llama al back.
 * NOTA (sesión, modo real): el token que ya tiene el navegador sigue sirviendo
 * después de cambiar el correo (la API identifica al usuario por el `sub`, no
 * por el correo), pero guarda el correo viejo hasta renovarse (1 hora). Por
 * eso, si cambió el correo, se renueva la sesión enseguida
 * (`refreshSession`); el `AuthProvider` lo relee con `refrescarUsuario`.
 * TODO(backend): permitir borrar el teléfono y la fecha (US-20 los muestra
 * como "Sin cargar"), por ejemplo aceptando `null`.
 */
export async function actualizarDatosPersonales(cambios: DatosPersonalesCambios): Promise<PerfilUsuario> {
  if (USE_MOCKS) {
    await delay()
    const usuario = usuarioMockEnSesion()
    const actual = perfilMockDe(usuario.id)
    if (!actual) throw new ServiceError('unauthorized', SESSION_EXPIRED_MESSAGE)
    const cambiaIdentidad =
      (cambios.nombre !== undefined && cambios.nombre.trim() !== actual.nombre) ||
      (cambios.apellido !== undefined && cambios.apellido.trim() !== actual.apellido) ||
      (cambios.dni !== undefined && cambios.dni !== actual.dni)
    if (cambiaIdentidad && actual.identityLock) {
      throw new ServiceError('conflict', PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE, 'IDENTIDAD_BLOQUEADA_POR_CONTRATO')
    }
    if (cambios.nombre !== undefined && !nombrePerfilValido(cambios.nombre)) throw new ServiceError('validation', MENSAJES_PERFIL.nombreInvalido)
    if (cambios.apellido !== undefined && !nombrePerfilValido(cambios.apellido)) throw new ServiceError('validation', MENSAJES_PERFIL.nombreInvalido)
    if (cambios.dni !== undefined && cambios.dni !== null) {
      if (!DNI_REGEX.test(cambios.dni)) throw new ServiceError('validation', MENSAJES.dniInvalido)
      const dni = cambios.dni
      if (readUsuariosMock().some((otro) => otro.id !== usuario.id && dniMock(otro) === dni)) {
        throw new ServiceError('conflict', PERFIL_DNI_EN_USO_MESSAGE, 'DNI_DUPLICADO')
      }
    }
    const email = cambios.email?.trim().toLowerCase()
    if (email !== undefined) {
      if (!emailValido(email)) throw new ServiceError('validation', MENSAJES_SOLICITUD.emailInvalido)
      if (readUsuariosMock().some((otro) => otro.id !== usuario.id && otro.email.toLowerCase() === email)) {
        throw new ServiceError('conflict', PERFIL_CORREO_EN_USO_MESSAGE, 'EMAIL_DUPLICADO')
      }
    }
    if (cambios.telefono && !TELEFONO_E164_REGEX.test(cambios.telefono)) throw new ServiceError('validation', MENSAJES_SOLICITUD.telefonoLargo)
    if (cambios.fechaNacimiento && !esMayorDeEdad(dayjs(cambios.fechaNacimiento))) throw new ServiceError('validation', MENSAJES.menorDeEdad)

    guardarUsuarioMock({
      ...usuario,
      nombre: cambios.nombre?.trim() ?? usuario.nombre,
      apellido: cambios.apellido?.trim() ?? usuario.apellido,
      // Igual que el back: el correo nuevo vale desde ya, también para entrar.
      email: email ?? usuario.email,
      telefono: cambios.telefono !== undefined ? (cambios.telefono ?? undefined) : usuario.telefono,
      fechaNacimiento: cambios.fechaNacimiento !== undefined ? (cambios.fechaNacimiento ?? undefined) : usuario.fechaNacimiento,
    })
    if (cambios.dni !== undefined && cambios.dni !== null) {
      sensiblesEnMemoria.set(usuario.id, { ...sensiblesEnMemoria.get(usuario.id), dni: cambios.dni })
    }
    const actualizado = perfilMockDe(usuario.id)
    if (!actualizado) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return actualizado
  }
  // `null` = el campo tenía valor y quedó vacío (el bloque solo manda lo que cambió).
  if (cambios.telefono === null) throw new ServiceError('validation', PERFIL_NO_SE_BORRA_TELEFONO_MESSAGE, CAMPO_NO_BORRABLE.telefono)
  if (cambios.fechaNacimiento === null) throw new ServiceError('validation', PERFIL_NO_SE_BORRA_FECHA_MESSAGE, CAMPO_NO_BORRABLE.fechaNacimiento)
  try {
    const dto = await apiRequest<PerfilResponse>('/usuarios/me', { method: 'PATCH', body: cambiosToActualizarRequest(cambios) })
    if (cambios.email) await renovarSesion()
    return perfilResponseToPerfil(dto)
  } catch (error) {
    throw errorDeActualizarDatos(error)
  }
}

/**
 * Renueva la sesión de Supabase para que el token tenga el correo nuevo (ver
 * la NOTA de {@link actualizarDatosPersonales}). Si falla, no pasa nada: el
 * correo ya cambió y el token se renueva solo antes de la hora.
 */
async function renovarSesion(): Promise<void> {
  try {
    await getSupabaseBrowserClient().auth.refreshSession()
  } catch {
    // Ver el JSDoc: no es un error del guardado.
  }
}

// ─── Contraseña (US-21) ─────────────────────────────────────────────────

/**
 * US-21 Modificar usuario — cambia la contraseña verificando la actual.
 * @backend Supabase Auth `updateUser({ password, current_password })` (no pasa por `apps/api`).
 *   BLOQUEANTE para pasar a real (HANDOFF §7): activar "Require current
 *   password when changing password" en el dashboard. Sin esa opción,
 *   Supabase IGNORA `current_password` y cambia la contraseña aunque la
 *   actual esté mal.
 * @throws {ServiceError} `validation` con
 *   {@link PERFIL_PASSWORD_ACTUAL_INCORRECTA_MESSAGE} (400
 *   `current_password_invalid`), {@link PERFIL_PASSWORD_IGUAL_MESSAGE} (422
 *   `same_password`) o el de contraseña débil (422 `weak_password`).
 */
export async function cambiarContrasena(datos: { actual: string; nueva: string }): Promise<void> {
  if (datos.actual === datos.nueva) throw new ServiceError('validation', PERFIL_PASSWORD_IGUAL_MESSAGE, 'same_password')
  if (!PASSWORD_REGEX.test(datos.nueva)) throw new ServiceError('validation', MENSAJES.passwordInvalida, 'weak_password')
  if (USE_MOCKS) {
    await delay()
    const usuario = usuarioMockEnSesion()
    if (usuario.password !== datos.actual) {
      throw new ServiceError('validation', PERFIL_PASSWORD_ACTUAL_INCORRECTA_MESSAGE, 'current_password_invalid')
    }
    // NOTA: en mock la contraseña se guarda en `rentar:mock:usuarios`, igual
    // que en el registro (pendiente anotado en HANDOFF). El back real nunca la ve.
    guardarUsuarioMock({ ...usuario, password: datos.nueva })
    return
  }
  let error: unknown = null
  try {
    const respuesta = await getSupabaseBrowserClient().auth.updateUser({ password: datos.nueva, current_password: datos.actual })
    error = respuesta.error
  } catch (excepcion) {
    error = excepcion
  }
  if (error) throw errorDeCambioDeContrasena(error)
}
