/**
 * mensajes.service.ts — frontera con el backend para los mensajes de una
 * conversación (US-24; el chat del reclamo, US-18, usa las mismas funciones).
 *
 * Qué es: leer, enviar y eliminar mensajes. Cada función tiene dos ramas: la mock
 * (elenco de `lib/mocks/mensajes.mock.ts` más lo guardado en el navegador) y la
 * real contra `apps/api` (`mensajes.routes.ts`, existe desde el 24/11 y pasó la
 * prueba de humo en real).
 * Cubre: US-24 Enviar mensajes (la bandeja, iniciar una conversación, enviar y
 * eliminar) y el chat del reclamo (US-18).
 *
 * NOTA: las reglas de los mensajes (vacíos, propios, 100 por conversación) están
 * en `lib/mensajes/reglas.ts`; las de quién escribe en el chat de un reclamo, en
 * `lib/reclamos/reglas.ts` (`puedeEscribirEnChat`). La rama mock las aplica tal cual.
 *
 * Quién lo usa: `components/reclamos/ChatReclamo.tsx` y `components/mensajes/*`.
 */
import { conversacionDeReclamo, SIN_CUENTA_PREFIJO, type ConversacionMock, type MensajeMock, type ReclamoMock } from '@/lib/mocks'
import type { MisAlquileresItem } from '@rentar/shared-types'
import { asuntoDeConversacion, conversacionExistente, ordenarConversaciones } from '@/lib/mensajes/bandeja'
import { MENSAJE_VACIO_MESSAGE, textoEnviable } from '@/lib/mensajes/reglas'
import type { ConversacionNueva, ConversacionVista, DestinatarioConversacion, MensajeChat } from '@/lib/mensajes/tipos'
import { estadoTrasRespuestaDelLocador, esLocadorDelReclamo, puedeEscribirEnChat, puedeVerReclamo } from '@/lib/reclamos/reglas'
import type { Reclamo } from '@/lib/reclamos/tipos'
import { ahora } from '@/lib/utils/fechas'
import {
  CHAT_CERRADO_MESSAGE,
  CONVERSACION_NO_ENCONTRADA_MESSAGE,
  conversacionDeDto,
  destinatariosDeAlquileresLocatario,
  destinatariosDeMisAlquileres,
  errorDeCrearConversacion,
  errorDeEliminarMensaje,
  errorDeListarConversaciones,
  esConversacionDeReclamo,
  errorDeEnviarMensaje,
  errorDeListarMensajes,
  MENSAJE_AJENO_MESSAGE,
  mensajeDeDto,
  textoSinContratoVigente,
} from './adapters/mensaje.adapter'
import {
  conversacionMockToVista,
  mensajeMockToChat,
  mensajesDeConversacionMock,
  participaDe,
  readConversacionesMock,
  readMensajesMock,
} from './adapters/mensaje-mock.adapter'
import { formatAddress } from './adapters/propiedad-mock.adapter'
import { readReclamosMock, reclamoMockToReclamo } from './adapters/reclamo-mock.adapter'
import { readPropiedadesMock, readPropiedadesMockConBorradas } from './propiedades.service'
import { apiRequest } from './shared/apiClient'
import type { AlquilerLocatarioItemResponse, MensajeResponse } from './shared/backend-dtos'
import type { ConversacionDetalle, ConversacionResumen } from '@rentar/shared-types'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { saveMockRecord } from './shared/mockStore'
import { requireSessionUserId } from './shared/session'
import { readUsuariosMock } from './usuarios.service'

export { CHAT_CERRADO_MESSAGE, MENSAJE_NO_ENVIADO_MESSAGE } from './adapters/mensaje.adapter'

/** Si el navegador no pudo guardar el mensaje (modo mock). */
const MOCK_STORAGE_FULL_MESSAGE = 'No pudimos guardar el mensaje en este navegador: tocá "Reiniciar datos de prueba".'

// ─── Rama mock: de quién es cada conversación ───────────────────────────

/** El reclamo de una conversación: como vista (para las reglas) y como está guardado (para actualizarlo). */
interface ReclamoDeConversacion {
  reclamo: Reclamo
  guardado: ReclamoMock
}

/**
 * El reclamo de una conversación de reclamo (`CNV-RCL-…`), como vista, o `null`
 * si la conversación no es de un reclamo. Las conversaciones generales llegan con la Tanda C.
 */
function reclamoDeConversacionMock(conversacionId: string): ReclamoDeConversacion | null {
  const guardado = readReclamosMock().find((item) => conversacionDeReclamo(item.id) === conversacionId)
  if (!guardado) return null
  const reclamo = reclamoMockToReclamo(guardado, readPropiedadesMockConBorradas(), readUsuariosMock())
  return reclamo ? { reclamo, guardado } : null
}

/** Una conversación del mock: la de un reclamo (con sus reglas) o una general de Mensajes. */
type ConversacionDelMock = ({ tipo: 'reclamo' } & ReclamoDeConversacion) | { tipo: 'general'; conversacion: ConversacionMock }

/** Valida que el usuario sea parte de la conversación; si no, el mismo "no encontrada" que una que no existe. */
function conversacionVisibleMock(conversacionId: string, userId: string): ConversacionDelMock {
  const delReclamo = reclamoDeConversacionMock(conversacionId)
  if (delReclamo) {
    if (!puedeVerReclamo(delReclamo.reclamo, userId)) throw new ServiceError('not_found', CONVERSACION_NO_ENCONTRADA_MESSAGE)
    return { tipo: 'reclamo', ...delReclamo }
  }
  const general = readConversacionesMock().find((item) => item.id === conversacionId)
  if (!general || !participaDe(general, userId)) throw new ServiceError('not_found', CONVERSACION_NO_ENCONTRADA_MESSAGE)
  return { tipo: 'general', conversacion: general }
}

// ─── Mensajes de una conversación ───────────────────────────────────────

/**
 * US-24 y US-18 — los mensajes de una conversación (hasta los últimos 100), del
 * más viejo al más nuevo.
 * @backend GET /api/v1/mensajes/conversaciones/:id/mensajes   (existe; probado en real el 24/11) → MensajeResponse[]
 * @throws {ServiceError} `not_found` (no existe o no participa); `unauthorized`; `network` / `server`.
 */
export async function getMensajes(conversacionId: string): Promise<MensajeChat[]> {
  if (USE_MOCKS) {
    await delay(350)
    const userId = requireSessionUserId()
    conversacionVisibleMock(conversacionId, userId)
    const usuarios = readUsuariosMock()
    return mensajesDeConversacionMock(conversacionId).map((mensaje) => mensajeMockToChat(mensaje, userId, usuarios))
  }
  try {
    const dtos = await apiRequest<MensajeResponse[]>(`/mensajes/conversaciones/${encodeURIComponent(conversacionId)}/mensajes`)
    return dtos.map(mensajeDeDto).sort((a, b) => a.enviadoEl.localeCompare(b.enviadoEl))
  } catch (error) {
    throw errorDeListarMensajes(error)
  }
}

/**
 * US-24 — manda un mensaje. En el chat de un reclamo (US-18), si lo manda el
 * locador con el reclamo abierto, el reclamo pasa a "en proceso" (lo hace el back).
 * @backend POST /api/v1/mensajes/conversaciones/:id/mensajes   (existe; probado en real el 24/11)
 * @body    `{ contenido }`
 * @returns MensajeChat (el enviado)
 * @throws {ServiceError} `validation` con {@link MENSAJE_VACIO_MESSAGE} si está vacío
 *   o solo tiene espacios; `conflict` con {@link CHAT_CERRADO_MESSAGE} si el reclamo
 *   ya no admite mensajes (cambió en otra pestaña); `not_found`; `network` / `server`.
 *
 * NOTA: el back deja escribir al locatario con el reclamo abierto, resuelto o
 * cancelado (brecha R-5). El front no lo permite: la rama mock aplica
 * `puedeEscribirEnChat` y la pantalla no muestra la caja en esos casos.
 */
export async function enviarMensaje(conversacionId: string, texto: string): Promise<MensajeChat> {
  if (!textoEnviable(texto)) throw new ServiceError('validation', MENSAJE_VACIO_MESSAGE)
  if (USE_MOCKS) {
    await delay(400)
    const userId = requireSessionUserId()
    const conversacion = conversacionVisibleMock(conversacionId, userId)
    // En el chat de un reclamo valen sus reglas (US-18); en una general, escriben los dos siempre (US-24).
    if (conversacion.tipo === 'reclamo' && !puedeEscribirEnChat(conversacion.reclamo, userId).permitido) {
      throw new ServiceError('conflict', CHAT_CERRADO_MESSAGE, 'ESTADO_INVALIDO')
    }

    const enviadoEl = ahora().format()
    const nuevo: MensajeMock = {
      id: `${conversacionId}-M${Date.now()}`,
      conversationId: conversacionId,
      senderId: userId,
      content: texto.trim(),
      sentAt: enviadoEl,
      deletedAt: null,
    }
    if (!saveMockRecord('mensajes', nuevo)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    // US-18: la primera respuesta del locador pasa el reclamo de abierto a en proceso.
    if (conversacion.tipo === 'reclamo' && esLocadorDelReclamo(conversacion.reclamo, userId) && conversacion.reclamo.estado === 'abierto') {
      saveMockRecord('reclamos', { ...conversacion.guardado, status: estadoTrasRespuestaDelLocador(conversacion.guardado.status), inProgressAt: enviadoEl })
    }
    return mensajeMockToChat(nuevo, userId, readUsuariosMock())
  }
  try {
    return mensajeDeDto(
      await apiRequest<MensajeResponse>(`/mensajes/conversaciones/${encodeURIComponent(conversacionId)}/mensajes`, {
        method: 'POST',
        body: { contenido: texto.trim() },
      }),
    )
  } catch (error) {
    throw errorDeEnviarMensaje(error)
  }
}

/**
 * US-24 — elimina un mensaje propio. Queda la marca "Mensaje eliminado" con la hora.
 * @backend DELETE /api/v1/mensajes/:id   (existe; probado en real el 24/11) → `{ id }`
 * @throws {ServiceError} `forbidden` con {@link MENSAJE_AJENO_MESSAGE} si no es
 *   propio; `not_found`; `network` / `server`.
 */
export async function eliminarMensaje(mensajeId: string): Promise<void> {
  if (USE_MOCKS) {
    await delay(300)
    const userId = requireSessionUserId()
    const mensaje = readMensajesMock().find((item) => item.id === mensajeId)
    if (!mensaje) throw new ServiceError('not_found', 'Ese mensaje ya no está en la conversación.')
    conversacionVisibleMock(mensaje.conversationId, userId)
    if (mensaje.senderId !== userId) throw new ServiceError('forbidden', MENSAJE_AJENO_MESSAGE)
    if (mensaje.deletedAt) return
    if (!saveMockRecord('mensajes', { ...mensaje, deletedAt: ahora().format() })) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return
  }
  try {
    await apiRequest<{ id: number }>(`/mensajes/${encodeURIComponent(mensajeId)}`, { method: 'DELETE' })
  } catch (error) {
    throw errorDeEliminarMensaje(error)
  }
}

// ─── Conversaciones de Mensajes (US-24) ─────────────────────────────────

/** Las conversaciones generales del usuario en el mock, como vista. */
function conversacionesVistaMock(userId: string): ConversacionVista[] {
  const propiedades = readPropiedadesMockConBorradas()
  const usuarios = readUsuariosMock()
  return readConversacionesMock()
    .filter((item) => participaDe(item, userId))
    .map((item) => conversacionMockToVista(item, userId, propiedades, usuarios))
}

/**
 * US-24 — la bandeja: las conversaciones del usuario, la más reciente arriba.
 * Las de reclamos no van (decisión del PO, 24/11: el chat del reclamo vive en su detalle).
 * @backend GET /api/v1/mensajes/conversaciones   (existe; probado en real el 24/11) → ConversacionResumen[]
 * NOTA: el back devuelve también las de reclamos (brecha R-3): las filtra el adaptador.
 * NOTA: el listado no trae el inmueble (R-6): la línea de la propiedad queda vacía. No se pide
 * el detalle de cada una para completarla (decisión del PO, 25/11).
 * @param usuarioId id del usuario en sesión (para "Vos:" en el último mensaje, en real).
 * @throws {ServiceError} `unauthorized`; `network` / `server`.
 */
export async function listarConversaciones(usuarioId: string): Promise<ConversacionVista[]> {
  if (USE_MOCKS) {
    await delay(450)
    return ordenarConversaciones(conversacionesVistaMock(requireSessionUserId()))
  }
  try {
    const dtos = await apiRequest<ConversacionResumen[]>('/mensajes/conversaciones')
    return ordenarConversaciones(dtos.filter((dto) => !esConversacionDeReclamo(dto)).map((dto) => conversacionDeDto(dto, usuarioId)))
  } catch (error) {
    throw errorDeListarConversaciones(error)
  }
}

/**
 * US-24 — una conversación, con la propiedad y la otra persona (para el
 * encabezado). Una conversación de reclamo da "no encontrada": se ve en el reclamo.
 * @backend GET /api/v1/mensajes/conversaciones/:id   (existe) → ConversacionDetalle (con la dirección, sin foto)
 * @throws {ServiceError} `not_found` (no existe, no participa o es de un reclamo); `network` / `server`.
 */
export async function getConversacion(id: string, usuarioId: string): Promise<ConversacionVista> {
  if (USE_MOCKS) {
    await delay(250)
    const userId = requireSessionUserId()
    const conversacion = conversacionVisibleMock(id, userId)
    if (conversacion.tipo !== 'general') throw new ServiceError('not_found', CONVERSACION_NO_ENCONTRADA_MESSAGE)
    return conversacionMockToVista(conversacion.conversacion, userId, readPropiedadesMockConBorradas(), readUsuariosMock())
  }
  try {
    const dto = await apiRequest<ConversacionDetalle>(`/mensajes/conversaciones/${encodeURIComponent(id)}`)
    if (esConversacionDeReclamo(dto)) throw new ServiceError('not_found', CONVERSACION_NO_ENCONTRADA_MESSAGE)
    return conversacionDeDto(dto, usuarioId)
  } catch (error) {
    throw errorDeListarMensajes(error)
  }
}

/**
 * Rama mock de US-24: ¿el usuario puede iniciar una conversación con esa persona
 * por esa propiedad? Si es el dueño, solo con un contrato vigente entre los dos
 * ("Un locador no puede iniciar una conversación con un locatario, a menos que
 * exista un contrato de alquiler vigente entre ambos"); si no, el destinatario
 * tiene que ser el dueño ("Un locatario puede iniciar una conversación con un locador").
 */
function validarInicioMock(userId: string, destinatarioId: string, propiedadId: string | null): { landlordId: string; tenantId: string | null; tenantName: string } {
  const propiedades = readPropiedadesMock()
  const propiedad = propiedadId ? propiedades.find((item) => item.id === propiedadId) : undefined
  const soyDuenio = propiedad?.ownerId === userId
  if (soyDuenio) {
    const conContrato = propiedades.some(
      (item) =>
        item.ownerId === userId &&
        item.rental?.contractStatus === 'vigente' &&
        (item.rental.tenantUserId === destinatarioId || `${SIN_CUENTA_PREFIJO}${item.rental.tenantName}` === destinatarioId),
    )
    if (!conContrato) throw new ServiceError('forbidden', 'Sin contrato vigente', 'REQUIERE_CONTRATO_VIGENTE')
    const nombreSinCuenta = destinatarioId.startsWith(SIN_CUENTA_PREFIJO) ? destinatarioId.slice(SIN_CUENTA_PREFIJO.length) : ''
    const usuario = readUsuariosMock().find((item) => item.id === destinatarioId)
    return {
      landlordId: userId,
      tenantId: nombreSinCuenta ? null : destinatarioId,
      tenantName: nombreSinCuenta || (usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Locatario'),
    }
  }
  if (!propiedad || propiedad.ownerId !== destinatarioId) throw new ServiceError('not_found', CONVERSACION_NO_ENCONTRADA_MESSAGE)
  const yo = readUsuariosMock().find((item) => item.id === userId)
  return { landlordId: destinatarioId, tenantId: userId, tenantName: yo ? `${yo.nombre} ${yo.apellido}` : 'Locatario' }
}

/**
 * US-24 — inicia una conversación con su primer mensaje. Si ya hay una con esa
 * persona por esa propiedad (en `existentes`, la bandeja ya cargada), manda el
 * mensaje ahí y devuelve esa (decisión del PO: una por persona y propiedad).
 * @backend POST /api/v1/mensajes/conversaciones   (existe; probado en real el 24/11)
 * @body    `{ id_destinatario, asunto, tipo_tema: 'inmueble', id_inmueble, primer_mensaje }`.
 *          `asunto` es obligatorio en el back y no se muestra: "Consulta por <dirección>".
 * @returns el id de la conversación (nueva o existente)
 * @throws {ServiceError} `forbidden` con "No podés iniciar una conversación con <nombre>
 *   porque no tienen un contrato vigente…" (403 `REQUIERE_CONTRATO_VIGENTE`);
 *   `validation` si el mensaje está vacío; `network` / `server`.
 * NOTA: el back no tiene UNIQUE por persona y propiedad (R-8) y cada `POST` crea una
 * nueva: por eso se busca antes en la bandeja.
 */
export async function iniciarConversacion(nueva: ConversacionNueva, texto: string, existentes: readonly ConversacionVista[]): Promise<string> {
  if (!textoEnviable(texto)) throw new ServiceError('validation', MENSAJE_VACIO_MESSAGE)
  const existente = conversacionExistente(existentes, nueva.destinatario.personaId, nueva.propiedad?.id ?? null)
  if (existente) {
    await enviarMensaje(existente.id, texto)
    return existente.id
  }
  if (USE_MOCKS) {
    await delay(500)
    const userId = requireSessionUserId()
    let partes: ReturnType<typeof validarInicioMock>
    try {
      partes = validarInicioMock(userId, nueva.destinatario.personaId, nueva.propiedad?.id ?? null)
    } catch (error) {
      throw errorDeCrearConversacion(error, nueva.destinatario.nombre)
    }
    const creadaEl = ahora().format()
    const conversacion: ConversacionMock = { id: `CNV-${Date.now()}`, ...partes, startedBy: userId, propertyId: nueva.propiedad?.id ?? '', createdAt: creadaEl }
    const primero: MensajeMock = { id: `${conversacion.id}-M001`, conversationId: conversacion.id, senderId: userId, content: texto.trim(), sentAt: creadaEl, deletedAt: null }
    if (!saveMockRecord('conversaciones', conversacion) || !saveMockRecord('mensajes', primero)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return conversacion.id
  }
  try {
    const creada = await apiRequest<ConversacionResumen>('/mensajes/conversaciones', {
      method: 'POST',
      body: {
        id_destinatario: Number(nueva.destinatario.personaId),
        asunto: asuntoDeConversacion(nueva.propiedad?.direccion ?? null),
        tipo_tema: 'inmueble',
        id_inmueble: nueva.propiedad ? Number(nueva.propiedad.id) : undefined,
        primer_mensaje: texto.trim(),
      },
    })
    return String(creada.id)
  } catch (error) {
    throw errorDeCrearConversacion(error, nueva.destinatario.nombre)
  }
}

/** Las personas a las que el locador le alquila con contrato vigente (mock). */
function destinatariosLocadorMock(userId: string): DestinatarioConversacion[] {
  const usuarios = readUsuariosMock()
  return readPropiedadesMock()
    .filter((item) => item.ownerId === userId && item.rental?.contractStatus === 'vigente')
    .map((item) => {
      const rental = item.rental as NonNullable<typeof item.rental>
      const usuario = usuarios.find((cuenta) => cuenta.id === rental.tenantUserId)
      return {
        personaId: rental.tenantUserId ?? `${SIN_CUENTA_PREFIJO}${rental.tenantName}`,
        nombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : rental.tenantName,
        rol: 'locatario' as const,
        propiedad: { id: item.id, direccion: formatAddress(item) },
        detalle: 'contrato vigente',
      }
    })
}

/** Los locadores de las propiedades que el usuario alquila con contrato vigente (mock). */
function destinatariosLocatarioMock(userId: string): DestinatarioConversacion[] {
  const usuarios = readUsuariosMock()
  return readPropiedadesMock()
    .filter((item) => item.rental?.tenantUserId === userId && item.rental.contractStatus === 'vigente')
    .flatMap((item) => {
      const duenio = usuarios.find((cuenta) => cuenta.id === item.ownerId)
      if (!duenio) return []
      return [{ personaId: duenio.id, nombre: `${duenio.nombre} ${duenio.apellido}`, rol: 'locador' as const, propiedad: { id: item.id, direccion: formatAddress(item) }, detalle: 'contrato vigente' }]
    })
}

/**
 * US-24 — a quién le puede escribir el usuario desde "Nueva conversación":
 * - como locador, sus locatarios con contrato vigente (US-24);
 * - como locatario, los locadores de lo que alquila (a cualquier otro locador
 *   se le escribe desde su propiedad publicada, "Escribirle al locador").
 * @backend locador: GET /api/v1/mis-alquileres   (existe; lento, 13 a 15 s: la pantalla lo pide
 *          recién al abrir el modal y guarda la respuesta mientras esté abierta)
 *          locatario: GET /api/v1/alquileres-locatario   (existe)
 * @throws {ServiceError} `network` / `server`.
 */
export async function getDestinatarios(rol: 'locador' | 'locatario'): Promise<DestinatarioConversacion[]> {
  if (USE_MOCKS) {
    await delay(rol === 'locador' ? 1200 : 400)
    const userId = requireSessionUserId()
    return rol === 'locador' ? destinatariosLocadorMock(userId) : destinatariosLocatarioMock(userId)
  }
  try {
    if (rol === 'locador') return destinatariosDeMisAlquileres(await apiRequest<MisAlquileresItem[]>('/mis-alquileres'))
    return destinatariosDeAlquileresLocatario(await apiRequest<AlquilerLocatarioItemResponse[]>('/alquileres-locatario'))
  } catch (error) {
    throw errorDeListarConversaciones(error)
  }
}

export { textoSinContratoVigente }
