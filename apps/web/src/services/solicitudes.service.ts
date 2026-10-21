/**
 * solicitudes.service.ts — frontera con el backend para las solicitudes de
 * alquiler.
 *
 * Qué es: todo lo que las pantallas piden sobre solicitudes pasa por acá.
 * Cada función tiene dos ramas: la mock (activa hoy, elenco de
 * `lib/mocks/solicitudes.mock.ts` más lo enviado en el navegador) y la real
 * contra `apps/api`; el interruptor es `NEXT_PUBLIC_USE_MOCKS`.
 * Cubre: US-35 Enviar solicitud de alquiler, US-36 Consultar solicitudes,
 * US-37 Aceptar o rechazar y US-38 Cancelar (numeración de Jira).
 *
 * NOTA: todas las rutas existen en el back desde el 12/10 (`develop`,
 * `apps/api/src/routes/v1/solicitudes.routes.ts`). Las diferencias con lo que
 * había propuesto el front se resuelven en el adaptador
 * (`adapters/solicitud.adapter.ts`), que además traduce los errores del back;
 * las brechas que quedan, en `docs/HANDOFF-BACKEND.md` §7.
 * NOTA: qué cambio de estado puede hacer cada uno está en la tabla
 * `TRANSICIONES_SOLICITUD` de `lib/validation/solicitud.rules.ts`; la rama
 * mock la aplica tal cual, y el back tiene que aplicar la misma.
 *
 * Quién lo usa: el detalle público de la propiedad (`/propiedad/[id]`),
 * `/panel/mis-solicitudes`, `/panel/solicitudes`, `panel.service.ts`
 * (solicitudes pendientes del locador) y el modal de eliminar del detalle del
 * locador (US-04, `contarSolicitudesQueSeCancelan`).
 */
import type { EstadoSolicitud, PreparacionSolicitud, Solicitud, SolicitudNueva } from '@rentar/shared-types'
import { solicitudes as solicitudesElenco, type PropiedadMock, type SolicitudMock } from '@/lib/mocks'
import { readSessionFromDocument } from '@/lib/auth/session-cookie'
import { ahora } from '@/lib/utils/fechas'
import {
  aceptadaDeLaPropiedad,
  errorDeSolicitudNueva,
  esSolicitudActiva,
  normalizarMensajeRechazo,
  normalizarMensajeSolicitud,
  SOLICITUD_MENSAJE_RECHAZO_LARGO_MESSAGE,
  SOLICITUD_MENSAJE_RECHAZO_MAX,
  textoYaAceptaste,
  transicionSolicitud,
  type AccionSolicitud,
  type ActorSolicitud,
} from '@/lib/validation/solicitud.rules'
import { solicitudMockToSolicitud } from './adapters/solicitud-mock.adapter'
import {
  errorDeAccionSolicitud,
  errorDeEnviarSolicitud,
  errorDeListarSolicitudes,
  errorDePrepararSolicitud,
  preparacionResponseToPreparacion,
  PROPIEDAD_NO_SOLICITABLE_MESSAGE,
  PUBLICACION_NO_DISPONIBLE_MESSAGE,
  SOLICITUD_DUPLICADA_MESSAGE,
  SOLICITUD_NO_ENCONTRADA_MESSAGE,
  SOLICITUD_PROPIA_MESSAGE,
  SOLICITUD_YA_NO_ACEPTADA_MESSAGE,
  SOLICITUD_YA_NO_PENDIENTE_MESSAGE,
  solicitudesResponseToSolicitudes,
  solicitudNuevaToCrearRequest,
  solicitudResponseToSolicitud,
  type VistaSolicitud,
} from './adapters/solicitud.adapter'
import { readPropiedadesMock, readPropiedadesMockConBorradas } from './propiedades.service'
import { apiRequest } from './shared/apiClient'
import type { FiltrosSolicitudesQuery, RechazarSolicitudRequest, SolicitudPreparacionResponse, SolicitudResponse } from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { readMockCollection, saveMockRecord } from './shared/mockStore'
import { contratoDeSolicitudMock, propiedadConContratoActivoMock } from './adapters/contrato-mock.adapter'
import { perfilMockDe } from './perfil.service'
import { requireSessionUserId } from './shared/session'
import { readUsuariosMock } from './usuarios.service'

// ─── Mensajes ───────────────────────────────────────────────────────────
// NOTA: los mensajes que comparten las dos ramas viven en el adaptador (ahí se
// traducen los errores del back) y se reexportan acá para las pantallas.

export {
  PROPIEDAD_NO_SOLICITABLE_MESSAGE,
  SOLICITUD_DUPLICADA_MESSAGE,
  SOLICITUD_PROPIA_MESSAGE,
  SOLICITUD_YA_NO_ACEPTADA_MESSAGE,
  SOLICITUD_YA_NO_PENDIENTE_MESSAGE,
} from './adapters/solicitud.adapter'

// ─── Qué hace el back hoy (según el modo) ───────────────────────────────
// NOTA: las pantallas leen estas constantes, nunca `USE_MOCKS`. En mock se
// comporta como se acordó con el PO; en real, como el back de hoy (brechas en
// `docs/HANDOFF-BACKEND.md` §7). Cuando el back las cierre, pasan a `true`.

/**
 * `true` si se avisa "Le avisamos por mail…" al enviar, aceptar o cancelar.
 * TODO(backend): el back no manda los mails de US-35 (al locador), US-37 (al
 * aceptar) ni US-38 (al cancelar): en real no se promete un mail que nadie manda.
 */
export const avisaPorMail: boolean = USE_MOCKS

/**
 * `true` si las listas traen las solicitudes canceladas (pestaña "Cerradas").
 * TODO(backend): `/mias` y `/recibidas` las excluyen siempre (`neq estado 4`),
 * también con `?estado=cancelada` (HANDOFF §7, brecha 3).
 */
export const muestraCanceladas: boolean = USE_MOCKS

/**
 * `true` si el locador puede dar de baja una solicitud aceptada (US-38).
 * TODO(backend): `PATCH /:id/cancelar` solo deja cancelar al postulante una
 * pendiente; el locador recibe 404 (HANDOFF §7, brecha 1). En real se oculta
 * el botón y se avisa (decisión del PO, tanda 5).
 */
export const puedeCancelarAceptada: boolean = USE_MOCKS

/** El detalle de una aceptada, mientras {@link puedeCancelarAceptada} sea `false`. */
export const AVISO_ACEPTADA_SIN_BAJA_MESSAGE = 'Por ahora no se puede dar de baja una solicitud aceptada.'

/**
 * El modal de aceptar, mientras {@link puedeCancelarAceptada} sea `false`:
 * cubre las brechas 1 y 2 de HANDOFF §7 (no se puede dar de baja y el front
 * sostiene "una sola aceptada por propiedad").
 */
export const AVISO_ACEPTAR_SIN_BAJA_MESSAGE = 'Una vez aceptada, por ahora no vas a poder darla de baja ni aceptar a otro postulante para esta propiedad.'

/** Lo que se avisa en "Cerradas" mientras el back no devuelva las canceladas. */
export const AVISO_CANCELADAS_OCULTAS_MESSAGE = 'Las solicitudes canceladas todavía no se muestran.'

/** No se pudo guardar en `localStorage` (modo mock). */
const MOCK_STORAGE_FULL_MESSAGE = 'No pudimos guardar la solicitud en este navegador. Tocá "Reiniciar datos de prueba" y probá de nuevo.'

// ─── Helpers de la rama mock ────────────────────────────────────────────

/**
 * Todas las solicitudes mock: el elenco más las enviadas en el navegador.
 * La comparte `panel.service.ts` (solicitudes nuevas del locador).
 */
export function readSolicitudesMock(): SolicitudMock[] {
  return readMockCollection('solicitudes', solicitudesElenco)
}

/**
 * `SolicitudMock` → `Solicitud`, buscando su propiedad en el elenco. `vista`
 * dice cuánto se ve, como en la rama real (`VistaSolicitud`): DNI, contacto y
 * legajo solo en el detalle del postulante (`'locador-detalle'`).
 */
function aVista(solicitud: SolicitudMock, vista: VistaSolicitud): Solicitud {
  // Con las eliminadas (US-04, borrado lógico): la solicitud cancelada sigue mostrando la dirección.
  const propiedad = readPropiedadesMockConBorradas().find((item) => item.id === solicitud.propertyId) ?? null
  // La cuenta del postulante, para el DNI que ve el locador (US-35 actualizada).
  const postulante = vista === 'locador-detalle' ? (readUsuariosMock().find((item) => item.id === solicitud.applicantUserId) ?? null) : null
  const vistaBase = solicitudMockToSolicitud(solicitud, propiedad, vista, postulante)
  if (vista === 'locador-lista' || vista === 'locador-detalle') {
    // US-05: para "Iniciar contrato" / "Continuar contrato", el locador
    // necesita saber si esta solicitud ya originó un contrato y si la
    // propiedad tiene otro vigente o pendiente de firma.
    const contrato = contratoDeSolicitudMock(solicitud.id)
    return { ...vistaBase, contrato, propiedadConContrato: !contrato && propiedadConContratoActivoMock(solicitud.propertyId) }
  }
  return vistaBase
}

/**
 * "Ahora" en el elenco: el reloj único (`ahora()`, el 23/09/2026 con la hora real), así una
 * solicitud recién enviada dice "hace menos de 1 h" (US-36). NOTA: si se envía
 * antes de las 11:35 (hora real), queda más vieja que la 0040 del elenco.
 */
function ahoraMock(): string {
  return ahora().format('YYYY-MM-DDTHH:mm:ss')
}

/** De la más nueva a la más vieja. */
function masNuevasPrimero(a: { createdAt: string }, b: { createdAt: string }): number {
  return b.createdAt.localeCompare(a.createdAt)
}

/** Próximo id `SOL-2026-XXXX` (prefijo del elenco, ver `lib/mocks/README.md`). */
function siguienteIdMock(existentes: SolicitudMock[]): string {
  const numeros = existentes.map((item) => Number(item.id.match(/^SOL-2026-(\d+)$/)?.[1] ?? 0))
  const siguiente = Math.max(0, ...numeros) + 1
  return `SOL-2026-${String(siguiente).padStart(4, '0')}`
}

/**
 * Aplica un cambio de estado a una solicitud mock, siguiendo la tabla
 * `TRANSICIONES_SOLICITUD` (`lib/validation/solicitud.rules.ts`): si esa
 * acción no se permite a ese actor en el estado actual, `conflict` (409),
 * como respondería el back. Guarda `respondedAt` con "ahora" y, si vienen,
 * los `extras` de la acción (el motivo del rechazo, US-37).
 * Quién es parte de la solicitud (dueño o postulante) lo valida antes cada
 * función: acá llega solo lo que ya es suyo.
 */
function cambiarEstadoMock(
  solicitud: SolicitudMock,
  accion: AccionSolicitud,
  actor: ActorSolicitud,
  extras: Pick<SolicitudMock, 'rejectionMessage'> = {},
): Solicitud {
  const transicion = transicionSolicitud(accion, actor, solicitud.status)
  if (!transicion) {
    // La única que parte de `aceptada` es la cancelación del locador (US-38).
    const message = accion === 'cancelar' && actor === 'locador' ? SOLICITUD_YA_NO_ACEPTADA_MESSAGE : SOLICITUD_YA_NO_PENDIENTE_MESSAGE
    throw new ServiceError('conflict', message)
  }
  const actualizada: SolicitudMock = { ...solicitud, ...extras, status: transicion.hacia, respondedAt: ahoraMock() }
  if (!saveMockRecord('solicitudes', actualizada)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
  // Como la rama real: la fila de la lista, sin datos sensibles (el detalle se vuelve a pedir).
  return aVista(actualizada, actor === 'locador' ? 'locador-lista' : 'postulante')
}

/**
 * Rama mock: la propiedad que el usuario en sesión quiere solicitar, con las
 * mismas respuestas que el back (`/preparar` y `POST`): `not_found` si no
 * existe, `forbidden` si es suya y `validation` si ya no recibe solicitudes.
 */
function propiedadSolicitableMock(propertyId: string, userId: string): PropiedadMock {
  const propiedad = readPropiedadesMock().find((item) => item.id === propertyId)
  if (!propiedad) throw new ServiceError('not_found', PUBLICACION_NO_DISPONIBLE_MESSAGE)
  if (propiedad.ownerId === userId) throw new ServiceError('forbidden', SOLICITUD_PROPIA_MESSAGE)
  // Se solicita lo que aparece en /buscar: publicada o alquilada con fecha de disponibilidad.
  if (propiedad.status !== 'publicada' && propiedad.status !== 'alquilada_publicada') {
    throw new ServiceError('validation', PROPIEDAD_NO_SOLICITABLE_MESSAGE)
  }
  return propiedad
}

// ─── Helpers de la rama real ────────────────────────────────────────────

/**
 * `GET /solicitudes/mias` o `/solicitudes/recibidas` con sus filtros, con los
 * errores ya traducidos (`errorDeListarSolicitudes`).
 */
async function listarSolicitudesReales(ruta: '/solicitudes/mias' | '/solicitudes/recibidas', filtros: FiltrosSolicitudesQuery = {}): Promise<SolicitudResponse[]> {
  try {
    return await apiRequest<SolicitudResponse[]>(ruta, { query: { ...filtros } })
  } catch (error) {
    throw errorDeListarSolicitudes(error)
  }
}

/**
 * `PATCH /solicitudes/:id/<accion>`, con la respuesta adaptada a `vista` y
 * los errores ya traducidos (`errorDeAccionSolicitud`). Sin `body`, el
 * `PATCH` va sin cuerpo (aceptar, cancelar y rechazar sin motivo).
 */
async function cambiarEstadoReal(solicitudId: string, accion: AccionSolicitud, vista: VistaSolicitud, body?: RechazarSolicitudRequest): Promise<Solicitud> {
  try {
    const dto = await apiRequest<SolicitudResponse>(`/solicitudes/${encodeURIComponent(solicitudId)}/${accion}`, { method: 'PATCH', body })
    return solicitudResponseToSolicitud(dto, vista)
  } catch (error) {
    throw errorDeAccionSolicitud(error)
  }
}

// ─── Enviar (US-35) ───────────────────────────────────────────────────────

/**
 * US-35 Enviar solicitud de alquiler (actualizada) — los datos con que se
 * abre el modal: el perfil de quien solicita (nombre, apellido y DNI de solo
 * lectura; teléfono y email para precargar) y las garantías que exige la
 * propiedad. También dice, antes de completar nada, si la propiedad se puede
 * solicitar.
 * @backend GET /api/v1/solicitudes/preparar?id_inmueble=:id   (existe) → SolicitudPreparacionResponse
 * @returns PreparacionSolicitud
 * @throws {ServiceError}
 *   - `forbidden`: es su propia publicación ({@link SOLICITUD_PROPIA_MESSAGE}).
 *   - `not_found`: la propiedad no existe.
 *   - `validation`: la propiedad ya no recibe solicitudes ({@link PROPIEDAD_NO_SOLICITABLE_MESSAGE}).
 *   - `unauthorized`: sin sesión.
 * NOTA: no detecta una solicitud duplicada (el back no lo hace en `/preparar`):
 * eso lo dice el botón del detalle y, si se escapa, el 409 del envío.
 * TODO(db): `garantiasExigidas` llega vacío en real (el esquema no las guarda).
 * TODO(backend): sumar el legajo del usuario a la respuesta (US-21: "los
 * datos del legajo se precargan en las solicitudes nuevas"); hasta entonces,
 * en real `legajo` es `null`.
 */
export async function prepararSolicitud(propertyId: string): Promise<PreparacionSolicitud> {
  if (USE_MOCKS) {
    await delay(300)
    const userId = requireSessionUserId()
    const propiedad = propiedadSolicitableMock(propertyId, userId)
    // El perfil completo (con el DNI y el legajo vigentes, incluso los
    // editados en "Mi perfil" que viven solo en memoria: ver `perfil.service`).
    const perfil = perfilMockDe(userId)
    return {
      perfil: {
        nombre: perfil?.nombre ?? '',
        apellido: perfil?.apellido ?? '',
        dni: perfil?.dni ?? null,
        telefono: perfil?.telefono ?? null,
        email: perfil?.email ?? '',
      },
      garantiasExigidas: propiedad.requiredGuarantees ?? [],
      // US-21: el legajo del perfil se precarga en la solicitud nueva.
      legajo: perfil?.legajo ?? null,
    }
  }
  try {
    const dto = await apiRequest<SolicitudPreparacionResponse>('/solicitudes/preparar', { query: { id_inmueble: propertyId } })
    return preparacionResponseToPreparacion(dto)
  } catch (error) {
    throw errorDePrepararSolicitud(error)
  }
}

/**
 * US-35 Enviar solicitud de alquiler (actualizada) — el usuario en sesión
 * solicita una propiedad publicada, con su contacto, su legajo (ocupación,
 * ingresos, convivientes, mascotas y garantías), la aceptación y un mensaje
 * opcional al locador.
 * @backend POST /api/v1/solicitudes   (existe) body `CrearSolicitudRequest` → 201 SolicitudResponse
 * @returns Solicitud (la recién creada, `pendiente`)
 * @throws {ServiceError}
 *   - `unauthorized`: sin sesión (US-35: "se debe haber iniciado sesión").
 *   - `validation`: un dato no cumple las reglas de la US-35 actualizada
 *     (mensaje de más de 600, teléfono que no es E.164, email, ingresos,
 *     convivientes, garantías exigidas, aceptación; ver
 *     `errorDeSolicitudNueva`) o la propiedad ya no se puede solicitar.
 *   - `forbidden`: es su propia publicación.
 *   - `conflict`: ya tiene una solicitud pendiente o aceptada para esa propiedad.
 *   - `not_found`: la propiedad no existe.
 *
 * NOTA: el 409 del back es por propiedad: "Ya tenés una solicitud activa
 * para esta propiedad" (pendiente o aceptada). Lo traduce `errorDeEnviarSolicitud`.
 * TODO(backend): al crear la solicitud, mandar un mail al locador con el
 * nombre del postulante y el mensaje, si lo hay (US-35, cuarto criterio).
 * El back no lo manda todavía.
 * TODO(backend): el `POST` no valida que la propiedad siga publicada (solo
 * lo hace `/preparar`) ni las garantías exigidas (HANDOFF §7).
 */
export async function enviarSolicitud(nueva: SolicitudNueva): Promise<Solicitud> {
  const normalizada: SolicitudNueva = {
    ...nueva,
    message: normalizarMensajeSolicitud(nueva.message),
    legajo: { ...nueva.legajo, petsDetail: nueva.legajo.hasPets ? nueva.legajo.petsDetail?.trim() || null : null },
  }
  const { message } = normalizada
  // Se valida en las dos ramas (el formulario ya lo hace, pero las reglas son de la US).
  // Las garantías exigidas se conocen solo en mock: en real, las valida el back.
  const errorSinGarantias = errorDeSolicitudNueva(normalizada, [])
  if (errorSinGarantias) throw new ServiceError('validation', errorSinGarantias)

  if (USE_MOCKS) {
    await delay(800)
    const userId = requireSessionUserId()
    const propiedad = propiedadSolicitableMock(nueva.propertyId, userId)
    const errorGarantias = errorDeSolicitudNueva(normalizada, propiedad.requiredGuarantees ?? [])
    if (errorGarantias) throw new ServiceError('validation', errorGarantias)
    const existentes = readSolicitudesMock()
    const repetida = existentes.some(
      (item) => item.propertyId === nueva.propertyId && item.applicantUserId === userId && esSolicitudActiva(item.status),
    )
    if (repetida) throw new ServiceError('conflict', SOLICITUD_DUPLICADA_MESSAGE)

    const usuario = readUsuariosMock().find((item) => item.id === userId)
    const solicitud: SolicitudMock = {
      id: siguienteIdMock(existentes),
      propertyId: nueva.propertyId,
      applicantUserId: userId,
      applicantName: usuario ? `${usuario.nombre} ${usuario.apellido}` : '',
      message,
      status: 'pendiente',
      createdAt: ahoraMock(),
      respondedAt: null,
      contact: normalizada.contact,
      legajo: normalizada.legajo,
    }
    if (!saveMockRecord('solicitudes', solicitud)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return aVista(solicitud, 'postulante')
  }

  try {
    const dto = await apiRequest<SolicitudResponse>('/solicitudes', {
      method: 'POST',
      body: solicitudNuevaToCrearRequest(normalizada),
    })
    return solicitudResponseToSolicitud(dto, 'postulante')
  } catch (error) {
    throw errorDeEnviarSolicitud(error)
  }
}

/**
 * US-35 y US-36 — la solicitud más reciente del usuario en sesión para una
 * propiedad, o `null` si nunca la solicitó. El detalle la usa para elegir el
 * estado del botón "Solicitar alquiler" (Detalle de propiedad · 02).
 * @backend GET /api/v1/solicitudes/mias?inmueble=:id   (existe) → SolicitudResponse[]
 * @returns Solicitud | null
 *
 * NOTA: devuelve la más reciente en cualquier estado; quien llama decide con
 * `esSolicitudActiva` si bloquea una nueva (una rechazada o cancelada no bloquea).
 * NOTA: sin sesión devuelve `null` (no hay "mi solicitud"), no un error.
 * NOTA: en real, `/mias` no trae las canceladas (HANDOFF §7, brecha 3): si la
 * última fue cancelada, devuelve la anterior o `null`. Da lo mismo para el
 * botón, porque una cancelada no bloquea una nueva solicitud.
 * TODO(backend): alternativa más barata, que `GET /inmuebles/disponibles/:id`
 * devuelva `mi_solicitud` cuando llega con token (ver `HANDOFF-BACKEND.md` §7, US-41).
 */
export async function getMiSolicitudParaPropiedad(propertyId: string): Promise<Solicitud | null> {
  if (USE_MOCKS) {
    await delay(300)
    const session = readSessionFromDocument()
    if (!session) return null
    const mia = readSolicitudesMock()
      .filter((item) => item.propertyId === propertyId && item.applicantUserId === session.userId)
      .sort(masNuevasPrimero)[0]
    return mia ? aVista(mia, 'postulante') : null
  }
  const items = await listarSolicitudesReales('/solicitudes/mias', { inmueble: propertyId })
  const mia = solicitudesResponseToSolicitudes(items, 'postulante').sort(masNuevasPrimero)[0]
  return mia ?? null
}

// ─── Consultar (US-36) ──────────────────────────────────────────────────

/**
 * US-36 Consultar solicitudes — las que envió el usuario en sesión
 * (`/panel/mis-solicitudes`), de la más nueva a la más vieja.
 * @backend GET /api/v1/solicitudes/mias   (existe) → SolicitudResponse[]
 * @returns Solicitud[] con la dirección EXACTA (con sesión; decisión del PO con la US-35 actualizada).
 * @throws {ServiceError} `unauthorized` sin sesión (US-36: "se debe haber iniciado sesión").
 */
export async function listarMisSolicitudes(): Promise<Solicitud[]> {
  if (USE_MOCKS) {
    await delay()
    const userId = requireSessionUserId()
    return readSolicitudesMock()
      .filter((item) => item.applicantUserId === userId)
      .sort(masNuevasPrimero)
      .map((item) => aVista(item, 'postulante'))
  }
  const items = await listarSolicitudesReales('/solicitudes/mias')
  return solicitudesResponseToSolicitudes(items, 'postulante')
}

/**
 * US-36 Consultar solicitudes — las que recibió el locador en sesión sobre
 * sus propiedades (`/panel/solicitudes`), de la más nueva a la más vieja.
 * @backend GET /api/v1/solicitudes/recibidas   (existe · rol locador) → SolicitudResponse[]
 *          Con `estado`, `?estado=<estado>` (el panel pide las pendientes,
 *          `panel.service#getSolicitudesPendientes`).
 * @param filtros.estado solo las de ese estado. NOTA: `cancelada` devuelve
 *   vacío en real (HANDOFF §7, brecha 3).
 * @returns Solicitud[] con la dirección EXACTA (son sus propias propiedades),
 *   SIN DNI, contacto ni legajo: esos datos los trae {@link getSolicitudRecibida}.
 *   Sí trae `summary` (US-36: convivientes, mascotas, garantías y si declaró
 *   ingresos, sin el monto), armado del legajo que `/recibidas` ya manda.
 * @throws {ServiceError} `unauthorized` sin sesión; `forbidden` si la cuenta no es locadora.
 */
export async function listarSolicitudesRecibidas(filtros: { estado?: EstadoSolicitud } = {}): Promise<Solicitud[]> {
  if (USE_MOCKS) {
    await delay()
    const userId = requireSessionUserId()
    // Con las eliminadas: el locador conserva el historial (canceladas al eliminar, US-04).
    const propias = new Set(readPropiedadesMockConBorradas().filter((item) => item.ownerId === userId).map((item) => item.id))
    return readSolicitudesMock()
      .filter((item) => propias.has(item.propertyId) && (!filtros.estado || item.status === filtros.estado))
      .sort(masNuevasPrimero)
      .map((item) => aVista(item, 'locador-lista'))
  }
  const items = await listarSolicitudesReales('/solicitudes/recibidas', { estado: filtros.estado })
  return solicitudesResponseToSolicitudes(items, 'locador-lista')
}

/**
 * US-36 Consultar solicitudes — una solicitud recibida por el locador en
 * sesión, CON los datos del postulante (DNI, contacto y legajo, US-35
 * actualizada), para el detalle del postulante. La lista no los trae: los
 * datos sensibles van solo en el detalle (regla del PO, tanda 5).
 * @backend GET /api/v1/solicitudes/recibidas?inmueble=:propertyId   (existe · rol locador)
 *          Se usa como PUENTE: trae las solicitudes de esa propiedad y se busca
 *          la pedida, como `getMiPropiedad` con `/mis-alquileres`. La ruta
 *          definitiva es GET /api/v1/solicitudes/:id (no existe — propuesto).
 * @param propertyId la propiedad de la solicitud (la fila ya la tiene): achica el puente.
 * @returns Solicitud con `applicant.dni`, `contact` y `legajo`.
 * @throws {ServiceError} `not_found` si no está entre las recibidas de esa
 *   propiedad; `unauthorized` sin sesión; `forbidden` sin rol locador.
 * TODO(backend): crear `GET /solicitudes/:id` (404 si no es del locador ni
 * del postulante) y pedir solo esa.
 */
export async function getSolicitudRecibida(id: string, propertyId: string): Promise<Solicitud> {
  if (USE_MOCKS) {
    await delay(300)
    const solicitud = solicitudRecibidaMock(id)
    if (solicitud.propertyId !== propertyId) throw new ServiceError('not_found', SOLICITUD_NO_ENCONTRADA_MESSAGE)
    return aVista(solicitud, 'locador-detalle')
  }
  const items = await listarSolicitudesReales('/solicitudes/recibidas', { inmueble: propertyId })
  const item = items.find((solicitud) => String(solicitud.id) === id)
  if (!item) throw new ServiceError('not_found', SOLICITUD_NO_ENCONTRADA_MESSAGE)
  return solicitudResponseToSolicitud(item, 'locador-detalle')
}

/**
 * US-35 actualizada — "Se debe indicar cuántas solicitudes pendientes tiene
 * el locatario en otras propiedades, si es que la cantidad es superior a
 * cero". Cuenta las `pendiente` del usuario en sesión, sin la propiedad que
 * está solicitando.
 * @backend GET /api/v1/solicitudes/mias?estado=pendiente   (existe) → SolicitudResponse[]
 * @returns cantidad (0 sin sesión)
 * NOTA: el front cuenta y excluye la propiedad actual (decisión del PO), así
 * no hace falta una ruta solo para el número.
 * NOTA: lo que se descarta de `/mias` (datos sensibles propios) no se usa:
 * de cada item solo se lee `inmueble.id`.
 */
export async function contarMisSolicitudesPendientes(excluirPropiedadId?: string): Promise<number> {
  if (USE_MOCKS) {
    await delay(300)
    const session = readSessionFromDocument()
    if (!session) return 0
    return readSolicitudesMock().filter(
      (item) => item.applicantUserId === session.userId && item.status === 'pendiente' && item.propertyId !== excluirPropiedadId,
    ).length
  }
  const items = await listarSolicitudesReales('/solicitudes/mias', { estado: 'pendiente' })
  return items.filter((item) => String(item.inmueble.id) !== excluirPropiedadId).length
}

// ─── Eliminar la propiedad (US-04) ──────────────────────────────────────

/**
 * US-04 Eliminar mis propiedades — cuántas solicitudes `pendiente` o
 * `aceptada` de una propiedad del locador se cancelarían al eliminarla. El
 * modal de eliminar avisa "Las N solicitudes … se van a cancelar" (decisión
 * del PO) solo si hay alguna.
 * @backend ninguno: lo resuelve la rama mock. En real devuelve 0.
 * @returns la cantidad (0 si no hay)
 *
 * NOTA: en real es 0 porque `DELETE /inmuebles/:id` no cancela las
 * solicitudes de la propiedad (decisión del PO, tanda 5: queda así hasta que
 * el back lo haga). Así el modal no promete una cancelación ni un mail que
 * nadie hace.
 * TODO(backend): que el `DELETE` cancele las activas y avise a cada
 * postulante; esto pasa a pedirlas con `GET /solicitudes/recibidas?inmueble=:id`.
 */
export async function contarSolicitudesQueSeCancelan(propiedadId: string): Promise<number> {
  if (USE_MOCKS) {
    const recibidas = await listarSolicitudesRecibidas()
    return recibidas.filter((item) => item.property.id === propiedadId && esSolicitudActiva(item.status)).length
  }
  return 0
}

// ─── Aceptar o rechazar (US-37) ─────────────────────────────────────────

/** Rama mock: la solicitud y quién es el usuario en sesión para ella (dueño de la propiedad o postulante), o `not_found`. */
function solicitudPropiaMock(solicitudId: string): { solicitud: SolicitudMock; actor: ActorSolicitud } {
  const userId = requireSessionUserId()
  const solicitud = readSolicitudesMock().find((item) => item.id === solicitudId)
  if (!solicitud) throw new ServiceError('not_found', SOLICITUD_NO_ENCONTRADA_MESSAGE)
  const propiedad = readPropiedadesMockConBorradas().find((item) => item.id === solicitud.propertyId)
  if (propiedad?.ownerId === userId) return { solicitud, actor: 'locador' }
  if (solicitud.applicantUserId === userId) return { solicitud, actor: 'postulante' }
  throw new ServiceError('not_found', SOLICITUD_NO_ENCONTRADA_MESSAGE)
}

/** Rama mock: una solicitud recibida por el locador en sesión, o `not_found`. */
function solicitudRecibidaMock(solicitudId: string): SolicitudMock {
  const { solicitud, actor } = solicitudPropiaMock(solicitudId)
  if (actor !== 'locador') throw new ServiceError('not_found', SOLICITUD_NO_ENCONTRADA_MESSAGE)
  return solicitud
}

/**
 * US-37 Aceptar o rechazar solicitud — el locador acepta una solicitud
 * pendiente sobre una propiedad suya.
 * @backend PATCH /api/v1/solicitudes/:id/aceptar   (existe) → SolicitudResponse
 * @returns Solicitud (`aceptada`)
 * @throws {ServiceError} `not_found` si no es una solicitud suya; `conflict`
 *   si ya no está pendiente (la cancelaron mientras miraba) o si la
 *   propiedad ya tiene otra aceptada.
 * TODO(backend): mandar un mail al locatario avisando que se aceptó (US-37).
 * TODO(backend): el back no controla que la propiedad ya tenga otra aceptada
 * ni cambia el estado del inmueble (HANDOFF §7): la regla la sostiene el front.
 * NOTA: una sola aceptada por propiedad (regla del PO, tanda 2 del Sprint 2,
 * `aceptadaDeLaPropiedad`): para aceptar a otro postulante, el locador
 * primero cancela la aceptada (US-38). Aceptar no rechaza las otras
 * solicitudes de la propiedad: siguen pendientes (Flujo de solicitudes · 02).
 */
export async function aceptarSolicitud(solicitudId: string): Promise<Solicitud> {
  if (USE_MOCKS) {
    await delay()
    const solicitud = solicitudRecibidaMock(solicitudId)
    const otras = readSolicitudesMock().filter((item) => item.propertyId === solicitud.propertyId && item.id !== solicitud.id)
    const aceptada = aceptadaDeLaPropiedad(otras)
    if (aceptada && solicitud.status === 'pendiente') throw new ServiceError('conflict', textoYaAceptaste(aceptada.applicantName))
    return cambiarEstadoMock(solicitud, 'aceptar', 'locador')
  }
  return cambiarEstadoReal(solicitudId, 'aceptar', 'locador-lista')
}

/**
 * US-37 Aceptar o rechazar solicitud — el locador rechaza una solicitud
 * pendiente sobre una propiedad suya.
 * @backend PATCH /api/v1/solicitudes/:id/rechazar   (existe) → SolicitudResponse
 *   Body opcional: `{ mensaje_rechazo }` (≤ 200; 400 si se pasa).
 * @param mensaje motivo opcional (US-37: "se puede incluir un mensaje de
 *   hasta 200 caracteres para aclarar el motivo del rechazo"). Se manda sin
 *   espacios en los bordes y solo si queda texto: vacío, el `PATCH` va sin
 *   cuerpo, como antes. Lo ven el locador y el postulante (US-36).
 * @returns Solicitud (`rechazada`, con `rejectionMessage`)
 * @throws {ServiceError} `validation` si el motivo supera los 200
 *   caracteres; `not_found` si no es una solicitud suya; `conflict` si ya no
 *   está pendiente.
 * NOTA: en la tanda 5 se mandaba sin motivo porque se leyó que US-37 no lo
 * pedía; el testing del Sprint 2 (US-37 P3 y P4, US-36 P7) mostró que sí.
 */
export async function rechazarSolicitud(solicitudId: string, mensaje?: string | null): Promise<Solicitud> {
  const motivo = normalizarMensajeRechazo(mensaje)
  if (USE_MOCKS) {
    await delay()
    // Como el back: el largo se valida antes de buscar la solicitud.
    if (motivo && motivo.length > SOLICITUD_MENSAJE_RECHAZO_MAX) throw new ServiceError('validation', SOLICITUD_MENSAJE_RECHAZO_LARGO_MESSAGE)
    return cambiarEstadoMock(solicitudRecibidaMock(solicitudId), 'rechazar', 'locador', { rejectionMessage: motivo })
  }
  return cambiarEstadoReal(solicitudId, 'rechazar', 'locador-lista', motivo ? { mensaje_rechazo: motivo } : undefined)
}

// ─── Cancelar (US-38 y sin US en Sprint 0) ──────────────────────────────

/**
 * US-38 Cancelar solicitud de alquiler — pasa una solicitud a `cancelada`.
 * Una sola ruta para los dos casos; el back decide según quién llama y el
 * estado (`TRANSICIONES_SOLICITUD`):
 * - **Locador + aceptada** (US-38, Jira: "dar de baja una solicitud tras
 *   haberla aceptado inicialmente para considerar otros posibles
 *   locatarios"). Desde Solicitudes recibidas. Después puede aceptar a otro
 *   postulante (una sola aceptada por propiedad).
 * - **Postulante + pendiente**: sin US en Sprint 0 (mapa US-39). El
 *   locatario retira una solicitud que todavía no se respondió, desde Mis
 *   solicitudes (Flujo de solicitudes · 04).
 * Cualquier otra combinación: `conflict` (409) si es parte de la solicitud
 * pero el estado no corresponde; `not_found` si no es parte.
 * @backend PATCH /api/v1/solicitudes/:id/cancelar   (existe) → SolicitudResponse
 * @returns Solicitud (`cancelada`)
 * @throws {ServiceError} `not_found` si no es suya; `conflict` si ya no se puede cancelar.
 *
 * NOTA: la rama real adapta la respuesta con la vista del postulante (sin
 * datos sensibles), porque la firma no dice quién llama: las pantallas toman
 * de la respuesta solo el estado y la fecha.
 * TODO(backend): el back solo deja cancelar al postulante una pendiente; el
 * locador que cancela una aceptada (US-38) recibe 404 (HANDOFF §7, brecha 1).
 * TODO(backend): si cancela el locador, mandar un mail al locatario avisando
 * la cancelación (US-38).
 */
export async function cancelarSolicitud(solicitudId: string): Promise<Solicitud> {
  if (USE_MOCKS) {
    await delay()
    const { solicitud, actor } = solicitudPropiaMock(solicitudId)
    return cambiarEstadoMock(solicitud, 'cancelar', actor)
  }
  return cambiarEstadoReal(solicitudId, 'cancelar', 'postulante')
}
