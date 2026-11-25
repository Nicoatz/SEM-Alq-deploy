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
import type { ConversacionDetalle, ConversacionResumen, MisAlquileresItem } from '@rentar/shared-types'
import type { ConversacionVista, DestinatarioConversacion, MensajeChat } from '@/lib/mensajes/tipos'
import { MENSAJE_VACIO_MESSAGE } from '@/lib/mensajes/reglas'
import type { AlquilerLocatarioItemResponse, MensajeResponse } from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'
import { formatExactAddress } from './direccion'

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

// ─── Conversaciones (US-24) ─────────────────────────────────────────────

/** No se pudieron cargar las conversaciones. */
export const CONVERSACIONES_NO_CARGADAS_MESSAGE = 'No pudimos cargar tus mensajes. Probá de nuevo.'

/** El locador sin contrato vigente con esa persona (403 `REQUIERE_CONTRATO_VIGENTE`, US-24). */
export function textoSinContratoVigente(nombre: string): string {
  const primero = nombre.split(' ')[0] ?? nombre
  return `No podés iniciar una conversación con ${nombre} porque no tienen un contrato vigente. Si ${primero} te escribe, vas a poder responderle.`
}

/** `true` si la conversación es el chat de un reclamo (no va en Mensajes, decisión del PO del 24/11). */
export function esConversacionDeReclamo(dto: Pick<ConversacionResumen, 'tipo_tema' | 'id_reclamo'>): boolean {
  return dto.tipo_tema === 'reclamo' || (dto.id_reclamo ?? null) !== null
}

/**
 * `ConversacionResumen` (listado) o `ConversacionDetalle` → `ConversacionVista`.
 * - El listado no trae el inmueble (brecha R-6): la propiedad va con el id y la
 *   dirección en `null` (la línea queda vacía). No se pide el detalle de cada
 *   una para completarla (decisión del PO, 25/11).
 * - El detalle trae la dirección, sin foto.
 * - `esPropio` del último mensaje se calcula con el id del usuario en sesión.
 */
export function conversacionDeDto(dto: ConversacionResumen | ConversacionDetalle, usuarioId: string): ConversacionVista {
  const otra = dto.otro_participante
  const otraEsLocador = otra.id === dto.id_locador
  const inmueble = 'inmueble' in dto ? dto.inmueble : null
  const ultimo = dto.ultimo_mensaje ?? null
  return {
    id: String(dto.id),
    otraPersona: { id: String(otra.id), nombre: [otra.nombre, otra.apellido].filter(Boolean).join(' '), fotoSrc: null, rol: otraEsLocador ? 'locador' : 'locatario' },
    propiedad:
      dto.id_inmueble === null || dto.id_inmueble === undefined
        ? null
        : { id: String(dto.id_inmueble), direccion: inmueble ? formatExactAddress(inmueble.direccion, inmueble.numero, inmueble.piso) : null, fotoSrc: null },
    ultimoMensaje: ultimo
      ? { contenido: ultimo.eliminado ? '' : ultimo.contenido, enviadoEl: ultimo.fecha_envio, esPropio: String(ultimo.id_emisor) === usuarioId, eliminado: ultimo.eliminado }
      : null,
    actualizadaEl: ultimo?.fecha_envio ?? dto.fecha_actualizacion ?? dto.fecha_creacion,
  }
}

/**
 * Los locatarios del locador con contrato (`GET /mis-alquileres`): los
 * destinatarios de "Nueva conversación" (US-24: "el locador puede iniciar una
 * conversación con el locatario" si hay contrato vigente). Solo las alquiladas
 * con locatario.
 */
export function destinatariosDeMisAlquileres(items: readonly MisAlquileresItem[]): DestinatarioConversacion[] {
  return items
    .filter((item) => (item.estado_alquiler === 'alquilado' || item.estado_alquiler === 'publicado/alquilado') && item.contrato?.locatario)
    .map((item) => {
      const locatario = item.contrato.locatario as NonNullable<MisAlquileresItem['contrato']['locatario']>
      return {
        personaId: String(locatario.id),
        nombre: [locatario.nombre, locatario.apellido].filter(Boolean).join(' '),
        rol: 'locatario' as const,
        propiedad: { id: String(item.id_inmueble), direccion: formatExactAddress(item.direccion, item.numero, item.piso) },
        detalle: 'contrato vigente',
      }
    })
}

/** Los locadores del locatario (`GET /alquileres-locatario`), sin los contratos finalizados. */
export function destinatariosDeAlquileresLocatario(items: readonly AlquilerLocatarioItemResponse[]): DestinatarioConversacion[] {
  return items
    .filter((item) => item.estado !== 'finalizado')
    .map((item) => ({
      personaId: String(item.locador.id),
      nombre: [item.locador.nombre, item.locador.apellido].filter(Boolean).join(' '),
      rol: 'locador' as const,
      propiedad: { id: String(item.inmueble.id), direccion: formatExactAddress(item.inmueble.direccion, item.inmueble.numero, item.inmueble.piso) },
      detalle: item.estado === 'vigente' ? 'contrato vigente' : 'contrato pendiente de firma',
    }))
}

/** Error de `GET /mensajes/conversaciones` y de los destinatarios. */
export function errorDeListarConversaciones(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'forbidden' || error.code === 'validation') return new ServiceError('server', CONVERSACIONES_NO_CARGADAS_MESSAGE)
  return sinTextoTecnico(error, CONVERSACIONES_NO_CARGADAS_MESSAGE)
}

/**
 * Error de `POST /mensajes/conversaciones` (US-24).
 * - 403 `REQUIERE_CONTRATO_VIGENTE` → `forbidden` con {@link textoSinContratoVigente}.
 * - 404 (el destinatario no existe) → `not_found`.
 * - 400 (mensaje vacío) → `validation`.
 */
export function errorDeCrearConversacion(error: unknown, nombre: string): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'forbidden') return new ServiceError('forbidden', textoSinContratoVigente(nombre), error.apiCode)
  if (error.code === 'not_found') return new ServiceError('not_found', `No encontramos a ${nombre}.`)
  if (error.code === 'validation') return new ServiceError('validation', MENSAJE_VACIO_MESSAGE)
  return sinTextoTecnico(error, MENSAJE_NO_ENVIADO_MESSAGE)
}
