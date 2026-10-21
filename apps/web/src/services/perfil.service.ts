/**
 * perfil.service.ts — frontera con el backend para "Mi perfil" (`/panel/perfil`).
 *
 * Qué es: consultar y modificar los datos personales, el legajo, el correo y
 * la contraseña del usuario en sesión. Siempre el propio: ninguna función
 * recibe un id de usuario (US-20: "no existe forma de ver el perfil de otro
 * usuario"; el back lo saca del token).
 * Cubre: US-20 Consultar usuario y US-21 Modificar usuario.
 * De dónde saca los datos:
 * - Modo mock: el elenco (`lib/mocks/usuarios.mock.ts` y `perfiles.mock.ts`)
 *   más lo que se modificó en este navegador (ver "Datos sensibles" abajo).
 * - Modo real: `apps/api` (rutas PROPUESTAS, todavía no existen) para los
 *   datos y el legajo; Supabase Auth para el correo y la contraseña.
 * Quién lo usa: `components/perfil/*` y la rama mock de
 * `services/solicitudes.service.ts` (precarga del legajo, US-21 + US-35).
 *
 * NOTA (datos sensibles, US-20: "el DNI y los ingresos solo se muestran en
 * esta pantalla"): en modo mock, el DNI y el ingreso que se editan acá viven
 * SOLO en memoria (`sensiblesEnMemoria`): sobreviven a la navegación dentro
 * del panel, no a una recarga. Nunca se escriben en `localStorage` ni en
 * `sessionStorage`, ni se loguean. El resto del perfil sí se guarda
 * (`rentar:mock:usuarios` y `rentar:mock:perfiles`). En modo real no se
 * guarda nada en el navegador: el perfil vive en el estado de la pantalla.
 */
import dayjs from 'dayjs'
import type { DatosPersonalesCambios, LegajoUsuario, PerfilUsuario } from '@rentar/shared-types'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase/client'
import { LEGAJO_VACIO, perfiles as perfilesElenco, usuarios as usuariosElenco, type UsuarioMock } from '@/lib/mocks'
import { telefonoAE164 } from '@/lib/perfil/formato'
import { emailValido, MENSAJES_SOLICITUD, TELEFONO_E164_REGEX } from '@/lib/validation/solicitud.rules'
import { DNI_REGEX, esMayorDeEdad, ingresoLegajoValido, MENSAJES, MENSAJES_PERFIL, nombrePerfilValido, PASSWORD_REGEX } from '@/lib/validation/usuario.rules'
import {
  cambiosToActualizarRequest,
  errorDeActualizarDatos,
  errorDeCambioDeContrasena,
  errorDeCambioDeCorreo,
  errorDePerfil,
  legajoDtoToLegajo,
  legajoToActualizarRequest,
  perfilResponseToPerfil,
  PERFIL_CORREO_EN_USO_MESSAGE,
  PERFIL_CORREO_IGUAL_MESSAGE,
  PERFIL_DNI_EN_USO_MESSAGE,
  PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE,
  PERFIL_PASSWORD_ACTUAL_INCORRECTA_MESSAGE,
  PERFIL_PASSWORD_IGUAL_MESSAGE,
} from './adapters/perfil.adapter'
import { contratoActivoDeUsuarioMock } from './adapters/contrato-mock.adapter'
import { apiRequest } from './shared/apiClient'
import type { LegajoDto, PerfilResponse } from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { readMockCollection, saveMockRecord } from './shared/mockStore'
import { requireSessionUserId, SESSION_EXPIRED_MESSAGE } from './shared/session'
import { readUsuariosMock } from './usuarios.service'

// ─── Rama mock: almacenamiento ──────────────────────────────────────────

/** Error de la rama mock si `localStorage` está lleno o bloqueado. */
const MOCK_STORAGE_FULL_MESSAGE = 'No pudimos guardar los cambios en este navegador. Tocá "Reiniciar datos de prueba" y probá de nuevo.'

/**
 * Lo que se guarda del perfil en `rentar:mock:perfiles`: el legajo SIN el
 * ingreso y el correo pendiente. El ingreso va a {@link sensiblesEnMemoria}.
 */
interface PerfilGuardadoMock {
  id: string
  occupation: LegajoUsuario['occupation']
  guarantees: LegajoUsuario['guarantees']
  pendingEmail: string | null
}

/** El elenco de perfiles, en la forma que se guarda (sin el ingreso). */
const perfilesGuardadosElenco: PerfilGuardadoMock[] = perfilesElenco.map((perfil) => ({
  id: perfil.id,
  occupation: perfil.legajo.occupation,
  guarantees: perfil.legajo.guarantees,
  pendingEmail: perfil.pendingEmail,
}))

/**
 * DNI e ingreso editados en esta pestaña (ver la NOTA del encabezado). Una
 * clave ausente = "no se editó": vale el del elenco (o el del registro).
 */
const sensiblesEnMemoria = new Map<string, { dni?: string; monthlyIncome?: number | null }>()

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

/** El legajo guardado de una cuenta (sin el ingreso) y su ingreso vigente. */
function legajoMock(userId: string): { guardado: PerfilGuardadoMock; legajo: LegajoUsuario } {
  const guardado = readMockCollection('perfiles', perfilesGuardadosElenco).find((item) => item.id === userId) ?? {
    id: userId,
    occupation: LEGAJO_VACIO.occupation,
    guarantees: LEGAJO_VACIO.guarantees,
    pendingEmail: null,
  }
  const enMemoria = sensiblesEnMemoria.get(userId)
  const ingresoElenco = perfilesElenco.find((item) => item.id === userId)?.legajo.monthlyIncome ?? null
  const monthlyIncome = enMemoria && 'monthlyIncome' in enMemoria ? (enMemoria.monthlyIncome ?? null) : ingresoElenco
  return { guardado, legajo: { occupation: guardado.occupation, monthlyIncome, guarantees: guardado.guarantees } }
}

/**
 * Arma el `PerfilUsuario` de una cuenta mock. La exporta para la rama mock
 * de `solicitudes.service.ts` (precarga del legajo y del DNI, US-21 + US-35).
 * @returns `null` si la cuenta no existe.
 */
export function perfilMockDe(userId: string): PerfilUsuario | null {
  const usuario = readUsuariosMock().find((item) => item.id === userId)
  if (!usuario) return null
  const { guardado, legajo } = legajoMock(userId)
  const roles = usuario.roles.includes('locatario') ? usuario.roles : [...usuario.roles, 'locatario' as const]
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    dni: dniMock(usuario),
    email: usuario.email,
    pendingEmail: guardado.pendingEmail,
    telefono: telefonoAE164(usuario.telefono),
    fechaNacimiento: usuario.fechaNacimiento ?? null,
    roles,
    identityLock: bloqueoMock(userId),
    legajo,
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

/** Guarda la parte no sensible del perfil en `rentar:mock:perfiles`. */
function guardarPerfilMock(perfil: PerfilGuardadoMock): void {
  if (!saveMockRecord('perfiles', perfil)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
}

// ─── Rama real: correo pendiente ────────────────────────────────────────

/**
 * El correo nuevo sin confirmar, de Supabase Auth (`user.new_email`, US-21).
 * `getUser()` va al servidor de Auth (no a la sesión guardada), así refleja
 * un cambio pedido desde otro dispositivo. Si falla, `null`: el perfil se
 * muestra igual, sin el aviso.
 */
async function correoPendienteReal(): Promise<string | null> {
  try {
    const { data } = await getSupabaseBrowserClient().auth.getUser()
    return data.user?.new_email ?? null
  } catch {
    return null
  }
}

// ─── Consulta (US-20) ───────────────────────────────────────────────────

/**
 * US-20 Consultar usuario — el perfil completo del usuario en sesión: datos
 * personales, correo pendiente, roles, contrato que bloquea la identidad y
 * legajo.
 * @backend GET /api/v1/usuarios/me/perfil   (no existe — propuesto) → PerfilResponse
 *          + Supabase Auth `getUser()` para el correo pendiente (`new_email`).
 * @returns PerfilUsuario
 * @throws {ServiceError} `unauthorized` sin sesión; `network` / `server`.
 *
 * NOTA: es una ruta aparte de `/usuarios/me` a propósito: `/me` lo pide el
 * `AuthProvider` en cada cambio de ruta, y el DNI y los ingresos no tienen
 * que viajar ahí (US-20).
 * TODO(backend): crear la ruta (contrato en `docs/api-endpoints.md`, "Perfil").
 */
export async function getMiPerfil(): Promise<PerfilUsuario> {
  if (USE_MOCKS) {
    await delay(300)
    const perfil = perfilMockDe(usuarioMockEnSesion().id)
    if (!perfil) throw new ServiceError('unauthorized', SESSION_EXPIRED_MESSAGE)
    return perfil
  }
  try {
    const [dto, pendiente] = await Promise.all([apiRequest<PerfilResponse>('/usuarios/me/perfil'), correoPendienteReal()])
    return perfilResponseToPerfil(dto, pendiente)
  } catch (error) {
    throw errorDePerfil(error)
  }
}

// ─── Datos personales (US-21) ───────────────────────────────────────────

/**
 * US-21 Modificar usuario — guarda el bloque "Datos personales": nombre,
 * apellido, DNI, teléfono y fecha de nacimiento (solo los que cambiaron).
 * @backend PATCH /api/v1/usuarios/me   (no existe — propuesto) body ActualizarPerfilRequest → 200 PerfilResponse
 * @returns el perfil actualizado.
 * @throws {ServiceError}
 *   - `conflict` con {@link PERFIL_DNI_EN_USO_MESSAGE}: el DNI ya es de otra
 *     cuenta (US-21: "único en la plataforma").
 *   - `conflict` con {@link PERFIL_IDENTIDAD_BLOQUEADA_MESSAGE}: cambia nombre,
 *     apellido o DNI siendo parte de un contrato vigente o pendiente de firma.
 *   - `validation`: un dato no cumple las reglas de US-21.
 *   - `unauthorized` sin sesión.
 * NOTA (US-21): "modificar el perfil no modifica las solicitudes ya enviadas
 * ni los contratos": las solicitudes guardan su propia copia del contacto.
 * TODO(backend): crear la ruta y repetir las validaciones (el front valida
 * para ayudar, no para proteger).
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
    if (cambios.telefono && !TELEFONO_E164_REGEX.test(cambios.telefono)) throw new ServiceError('validation', MENSAJES_SOLICITUD.telefonoLargo)
    if (cambios.fechaNacimiento && !esMayorDeEdad(dayjs(cambios.fechaNacimiento))) throw new ServiceError('validation', MENSAJES.menorDeEdad)

    guardarUsuarioMock({
      ...usuario,
      nombre: cambios.nombre?.trim() ?? usuario.nombre,
      apellido: cambios.apellido?.trim() ?? usuario.apellido,
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
  try {
    const dto = await apiRequest<PerfilResponse>('/usuarios/me', { method: 'PATCH', body: cambiosToActualizarRequest(cambios) })
    return perfilResponseToPerfil(dto, await correoPendienteReal())
  } catch (error) {
    throw errorDeActualizarDatos(error)
  }
}

// ─── Legajo (US-21) ─────────────────────────────────────────────────────

/**
 * US-21 Modificar usuario — guarda el bloque "Legajo" entero: situación
 * ocupacional, ingreso mensual (entero mayor a 0, o vacío) y garantías.
 * @backend PATCH /api/v1/usuarios/me/legajo   (no existe — propuesto) body ActualizarLegajoRequest → 200 LegajoDto
 * @returns el legajo guardado.
 * @throws {ServiceError} `validation` si el ingreso no es un entero mayor a 0;
 *   `unauthorized` sin sesión.
 * NOTA (US-21): el legajo se precarga en las solicitudes nuevas; lo que se
 * cambie dentro de una solicitud no vuelve acá.
 * TODO(backend): crear la ruta y la tabla del legajo (`TODO(db)` en HANDOFF §7).
 */
export async function actualizarLegajo(legajo: LegajoUsuario): Promise<LegajoUsuario> {
  if (USE_MOCKS) {
    await delay()
    const usuario = usuarioMockEnSesion()
    if (!ingresoLegajoValido(legajo.monthlyIncome)) throw new ServiceError('validation', MENSAJES_PERFIL.ingresoInvalido)
    const { guardado } = legajoMock(usuario.id)
    guardarPerfilMock({ ...guardado, occupation: legajo.occupation, guarantees: [...legajo.guarantees] })
    sensiblesEnMemoria.set(usuario.id, { ...sensiblesEnMemoria.get(usuario.id), monthlyIncome: legajo.monthlyIncome })
    return legajoMock(usuario.id).legajo
  }
  try {
    const dto = await apiRequest<LegajoDto>('/usuarios/me/legajo', { method: 'PATCH', body: legajoToActualizarRequest(legajo) })
    return legajoDtoToLegajo(dto)
  } catch (error) {
    throw errorDePerfil(error)
  }
}

// ─── Correo (US-21) ─────────────────────────────────────────────────────

/** Ruta a la que vuelve el enlace de confirmación del correo (ver `app/auth/confirmar/route.ts`). */
const RUTA_CONFIRMAR = '/auth/confirmar'

/**
 * US-21 Modificar usuario — pide el cambio de correo. NO lo aplica: el
 * correo nuevo queda pendiente hasta que el usuario lo confirma desde el
 * enlace (US-21: "hasta entonces sigue vigente el anterior").
 * @backend Supabase Auth `updateUser({ email }, { emailRedirectTo })` (no pasa por `apps/api`).
 *   Con "Secure email change" activo (decisión del PO) llegan DOS enlaces, al
 *   correo actual y al nuevo, y el cambio se aplica cuando se confirman los dos.
 * @returns el correo pendiente.
 * @throws {ServiceError} `conflict` con {@link PERFIL_CORREO_EN_USO_MESSAGE}
 *   si ya es de otra cuenta; `validation` si el formato no es el de US-35 o si
 *   es el mismo correo.
 * TODO(backend): al confirmarse, Supabase cambia `auth.users.email` pero no
 * `usuario.email`: hay que sincronizarlos (HANDOFF §7).
 */
export async function solicitarCambioDeCorreo(correoNuevo: string): Promise<string> {
  const email = correoNuevo.trim().toLowerCase()
  if (!emailValido(email)) throw new ServiceError('validation', MENSAJES_SOLICITUD.emailInvalido)
  if (USE_MOCKS) {
    await delay()
    const usuario = usuarioMockEnSesion()
    if (email === usuario.email.toLowerCase()) throw new ServiceError('validation', PERFIL_CORREO_IGUAL_MESSAGE)
    if (readUsuariosMock().some((otro) => otro.id !== usuario.id && otro.email.toLowerCase() === email)) {
      throw new ServiceError('conflict', PERFIL_CORREO_EN_USO_MESSAGE)
    }
    guardarPerfilMock({ ...legajoMock(usuario.id).guardado, pendingEmail: email })
    return email
  }
  let respuesta: Awaited<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['auth']['updateUser']>>
  try {
    respuesta = await getSupabaseBrowserClient().auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}${RUTA_CONFIRMAR}?next=/panel/perfil` },
    )
  } catch (error) {
    throw errorDeCambioDeCorreo(error)
  }
  if (respuesta.error) throw errorDeCambioDeCorreo(respuesta.error)
  return respuesta.data.user?.new_email ?? email
}

/** `true` si se puede simular la confirmación del correo (solo modo mock, US-21). */
export const PUEDE_SIMULAR_CONFIRMACION_DE_CORREO = USE_MOCKS

/**
 * Solo modo mock — simula que el usuario confirmó los dos enlaces: el correo
 * pendiente pasa a ser el vigente (y el de login).
 * @backend ninguno: en real lo hace el enlace del correo (`/auth/confirmar`).
 * @throws {ServiceError} `validation` si no hay un cambio pendiente o si se llama en modo real.
 */
export async function simularConfirmacionDeCorreo(): Promise<PerfilUsuario> {
  if (!USE_MOCKS) throw new ServiceError('validation', 'La confirmación se hace desde el enlace del correo.')
  await delay(300)
  const usuario = usuarioMockEnSesion()
  const { guardado } = legajoMock(usuario.id)
  if (!guardado.pendingEmail) throw new ServiceError('validation', 'No hay un cambio de correo pendiente.')
  guardarUsuarioMock({ ...usuario, email: guardado.pendingEmail })
  guardarPerfilMock({ ...guardado, pendingEmail: null })
  const perfil = perfilMockDe(usuario.id)
  if (!perfil) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
  return perfil
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
