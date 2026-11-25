/**
 * mensaje.adapter.ts — traduce los mensajes de `/api/v1/mensajes` a la vista del
 * chat, y sus errores al español de la pantalla (US-18 y US-24).
 *
 * Qué hace, campo por campo (verificado en real el 24/11, prueba de humo):
 * - `contenido`: si el mensaje se eliminó, el back manda "Este mensaje fue
 *   eliminado"; la vista lo deja vacío y muestra "Mensaje eliminado · hh:mm" con
 *   `fecha_eliminacion` (decisión del PO, 24/11).
 * - `es_propio`: lo calcula el back con el token; solo esos se pueden eliminar.
 * - `emisor`: nombre y apellido.
 *
 * Quién lo usa: `services/mensajes.service.ts` (rama real).
 */
import type { MensajeChat } from '@/lib/mensajes/tipos'
import { MENSAJE_VACIO_MESSAGE } from '@/lib/mensajes/reglas'
import type { MensajeResponse } from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'

// ─── Mensajes ───────────────────────────────────────────────────────────

/** No se pudo enviar (red o servidor). La caja ofrece Reintentar y Descartar. */
export const MENSAJE_NO_ENVIADO_MESSAGE = 'No se pudo enviar. El mensaje quedó escrito: tocá Reintentar cuando vuelva la conexión.'
/** No se pudieron cargar los mensajes. */
export const MENSAJES_NO_CARGADOS_MESSAGE = 'No pudimos cargar los mensajes. Probá de nuevo.'
/** No se pudo eliminar. */
export const MENSAJE_NO_ELIMINADO_MESSAGE = 'No pudimos eliminar el mensaje. Probá de nuevo.'
/** Un mensaje ajeno (US-24: "no puede eliminar mensajes enviados por el otro participante"). */
export const MENSAJE_AJENO_MESSAGE = 'Solo podés eliminar los mensajes que mandaste vos.'
/** Una conversación ajena o que no existe. */
export const CONVERSACION_NO_ENCONTRADA_MESSAGE = 'No encontramos esta conversación.'
/** El reclamo cambió de estado y ya no admite respuestas (400 `ESTADO_INVALIDO` del back). */
export const CHAT_CERRADO_MESSAGE = 'El estado del reclamo cambió y ya no se puede responder. Actualizamos la vista.'

/** `MensajeResponse` → `MensajeChat`. */
export function mensajeDeDto(dto: MensajeResponse): MensajeChat {
  return {
    id: String(dto.id),
    conversacionId: String(dto.id_conversacion),
    emisorId: String(dto.id_emisor),
    emisorNombre: [dto.emisor?.nombre, dto.emisor?.apellido].filter(Boolean).join(' '),
    contenido: dto.eliminado ? '' : dto.contenido,
    enviadoEl: dto.fecha_envio,
    // Si el back no manda la fecha de eliminación, la marca va igual, con la hora del envío.
    eliminadoEl: dto.eliminado ? (dto.fecha_eliminacion ?? dto.fecha_envio) : null,
    esPropio: dto.es_propio,
  }
}

// ─── Errores del back ───────────────────────────────────────────────────

/** Sin red o 5xx → texto propio. */
function sinTextoTecnico(error: ServiceError, generico: string): ServiceError {
  if (error.code === 'network' || error.code === 'server') return new ServiceError(error.code, generico)
  return error
}

/**
 * Error de `GET /mensajes/conversaciones/:id/mensajes`.
 * - 400 (id inválido), 403 (no participa) y 404 → `not_found`: una conversación
 *   ajena no se distingue de una que no existe.
 */
export function errorDeListarMensajes(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'validation' || error.code === 'forbidden' || error.code === 'not_found') {
    return new ServiceError('not_found', CONVERSACION_NO_ENCONTRADA_MESSAGE)
  }
  return sinTextoTecnico(error, MENSAJES_NO_CARGADOS_MESSAGE)
}

/**
 * Error de `POST /mensajes/conversaciones/:id/mensajes` (US-18 responder, US-24 enviar).
 * - 400 `ESTADO_INVALIDO` (el reclamo ya no está abierto ni en proceso; cambió en
 *   otra pestaña) → `conflict` con {@link CHAT_CERRADO_MESSAGE}: la pantalla
 *   refresca el reclamo. NOTA: el back responde 400 y no 409 (brecha R-5).
 * - Otro 400 (mensaje vacío) → `validation`.
 * - 403 (no participa, o `SOLO_LOCADOR_PROPIETARIO`) y 404 → `not_found`.
 * - Sin red o 5xx → {@link MENSAJE_NO_ENVIADO_MESSAGE} (la caja ofrece Reintentar).
 */
export function errorDeEnviarMensaje(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.apiCode === 'ESTADO_INVALIDO') return new ServiceError('conflict', CHAT_CERRADO_MESSAGE, error.apiCode)
  if (error.code === 'validation') return new ServiceError('validation', MENSAJE_VACIO_MESSAGE)
  if (error.code === 'forbidden' || error.code === 'not_found') return new ServiceError('not_found', CONVERSACION_NO_ENCONTRADA_MESSAGE)
  return sinTextoTecnico(error, MENSAJE_NO_ENVIADO_MESSAGE)
}

/**
 * Error de `DELETE /mensajes/:id` (US-24).
 * - 403 → `forbidden` con {@link MENSAJE_AJENO_MESSAGE}.
 * - 400 y 404 → `not_found` (ya no existe: lo podó la regla de los 100).
 */
export function errorDeEliminarMensaje(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'forbidden') return new ServiceError('forbidden', MENSAJE_AJENO_MESSAGE)
  if (error.code === 'validation' || error.code === 'not_found') return new ServiceError('not_found', 'Ese mensaje ya no está en la conversación.')
  return sinTextoTecnico(error, MENSAJE_NO_ELIMINADO_MESSAGE)
}
