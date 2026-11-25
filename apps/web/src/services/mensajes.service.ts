/**
 * mensajes.service.ts — frontera con el backend para los mensajes de una
 * conversación (US-24; el chat del reclamo, US-18, usa las mismas funciones).
 *
 * Qué es: leer, enviar y eliminar mensajes. Cada función tiene dos ramas: la mock
 * (elenco de `lib/mocks/mensajes.mock.ts` más lo guardado en el navegador) y la
 * real contra `apps/api` (`mensajes.routes.ts`, existe desde el 24/11 y pasó la
 * prueba de humo en real).
 * Cubre, en esta tanda (B): el chat del reclamo. El listado de conversaciones,
 * iniciar una y la pantalla de Mensajes llegan con la Tanda C.
 *
 * NOTA: las reglas de los mensajes (vacíos, propios, 100 por conversación) están
 * en `lib/mensajes/reglas.ts`; las de quién escribe en el chat de un reclamo, en
 * `lib/reclamos/reglas.ts` (`puedeEscribirEnChat`). La rama mock las aplica tal cual.
 *
 * Quién lo usa: `components/reclamos/ChatReclamo.tsx` (y Mensajes, en la Tanda C).
 */
import { conversacionDeReclamo, type MensajeMock, type ReclamoMock } from '@/lib/mocks'
import { MENSAJE_VACIO_MESSAGE, textoEnviable } from '@/lib/mensajes/reglas'
import type { MensajeChat } from '@/lib/mensajes/tipos'
import { estadoTrasRespuestaDelLocador, esLocadorDelReclamo, puedeEscribirEnChat, puedeVerReclamo } from '@/lib/reclamos/reglas'
import type { Reclamo } from '@/lib/reclamos/tipos'
import { ahora } from '@/lib/utils/fechas'
import {
  CHAT_CERRADO_MESSAGE,
  CONVERSACION_NO_ENCONTRADA_MESSAGE,
  errorDeEliminarMensaje,
  errorDeEnviarMensaje,
  errorDeListarMensajes,
  MENSAJE_AJENO_MESSAGE,
  mensajeDeDto,
} from './adapters/mensaje.adapter'
import { mensajeMockToChat, mensajesDeConversacionMock, readMensajesMock } from './adapters/mensaje-mock.adapter'
import { readReclamosMock, reclamoMockToReclamo } from './adapters/reclamo-mock.adapter'
import { readPropiedadesMockConBorradas } from './propiedades.service'
import { apiRequest } from './shared/apiClient'
import type { MensajeResponse } from './shared/backend-dtos'
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

/** Valida que el usuario sea parte de la conversación; si no, el mismo "no encontrada" que una que no existe. */
function conversacionVisibleMock(conversacionId: string, userId: string): ReclamoDeConversacion {
  const delReclamo = reclamoDeConversacionMock(conversacionId)
  if (!delReclamo || !puedeVerReclamo(delReclamo.reclamo, userId)) throw new ServiceError('not_found', CONVERSACION_NO_ENCONTRADA_MESSAGE)
  return delReclamo
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
    const { reclamo, guardado } = conversacionVisibleMock(conversacionId, userId)
    if (!puedeEscribirEnChat(reclamo, userId).permitido) throw new ServiceError('conflict', CHAT_CERRADO_MESSAGE, 'ESTADO_INVALIDO')

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
    if (esLocadorDelReclamo(reclamo, userId) && reclamo.estado === 'abierto') {
      saveMockRecord('reclamos', { ...guardado, status: estadoTrasRespuestaDelLocador(guardado.status), inProgressAt: enviadoEl })
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
