/**
 * mensaje-mock.adapter.ts — los mensajes del elenco, leídos del navegador y
 * traducidos a la vista del chat (US-18 y US-24, modo mock).
 *
 * Qué hace: combina el elenco (`lib/mocks/mensajes.mock.ts`) con lo mandado o
 * eliminado en el navegador (`rentar:mock:mensajes`) y deja los últimos 100 de
 * cada conversación (US-24).
 * NOTA: los mensajes del elenco no se pueden borrar del código, así que "descartar
 * el más viejo" se aplica al leer (`aplicarLimite`): el resultado que se ve es el
 * mismo que en el back, que sí los borra.
 *
 * Quién lo usa: la rama mock de `mensajes.service.ts`.
 */
import {
  conversaciones as conversacionesElenco,
  mensajes as mensajesElenco,
  SIN_CUENTA_PREFIJO,
  type ConversacionMock,
  type MensajeMock,
  type PropiedadMock,
  type UsuarioMock,
} from '@/lib/mocks'
import { aplicarLimite } from '@/lib/mensajes/reglas'
import type { ConversacionVista, MensajeChat } from '@/lib/mensajes/tipos'
import { readMockCollection } from '../shared/mockStore'
import { formatAddress, mainPhotoSrc } from './propiedad-mock.adapter'

/** Todos los mensajes del modo mock: el elenco más lo guardado en el navegador. */
export function readMensajesMock(): MensajeMock[] {
  return readMockCollection('mensajes', mensajesElenco)
}

/** Los mensajes de una conversación, del más viejo al más nuevo, ya con el límite de 100. */
export function mensajesDeConversacionMock(conversacionId: string): MensajeMock[] {
  const deLaConversacion = readMensajesMock()
    .filter((mensaje) => mensaje.conversationId === conversacionId)
    .map((mensaje) => ({ ...mensaje, enviadoEl: mensaje.sentAt }))
  return aplicarLimite(deLaConversacion)
}

/** Nombre de una cuenta del elenco o de alguien sin cuenta (`sin-cuenta:Tomás Bianchi`). */
function nombreDe(id: string, usuarios: readonly UsuarioMock[]): string {
  if (id.startsWith(SIN_CUENTA_PREFIJO)) return id.slice(SIN_CUENTA_PREFIJO.length)
  const usuario = usuarios.find((item) => item.id === id)
  return usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Usuario'
}

/** `MensajeMock` → `MensajeChat`, mirado por `sesionId`. */
export function mensajeMockToChat(mensaje: MensajeMock, sesionId: string, usuarios: readonly UsuarioMock[]): MensajeChat {
  return {
    id: mensaje.id,
    conversacionId: mensaje.conversationId,
    emisorId: mensaje.senderId,
    emisorNombre: nombreDe(mensaje.senderId, usuarios),
    contenido: mensaje.deletedAt ? '' : mensaje.content,
    enviadoEl: mensaje.sentAt,
    eliminadoEl: mensaje.deletedAt,
    esPropio: mensaje.senderId === sesionId,
  }
}

// ─── Conversaciones generales (US-24) ───────────────────────────────────

/** Todas las conversaciones generales: el elenco más las creadas en el navegador. */
export function readConversacionesMock(): ConversacionMock[] {
  return readMockCollection('conversaciones', conversacionesElenco)
}

/** Id del locatario de una conversación (el de la cuenta o `sin-cuenta:<nombre>`). */
export function locatarioDeConversacion(conversacion: Pick<ConversacionMock, 'tenantId' | 'tenantName'>): string {
  return conversacion.tenantId ?? `${SIN_CUENTA_PREFIJO}${conversacion.tenantName}`
}

/** `true` si el usuario es una de las dos puntas de la conversación. */
export function participaDe(conversacion: ConversacionMock, usuarioId: string): boolean {
  return conversacion.landlordId === usuarioId || conversacion.tenantId === usuarioId
}

/** `ConversacionMock` → `ConversacionVista`, mirada por `sesionId`, con su último mensaje. */
export function conversacionMockToVista(conversacion: ConversacionMock, sesionId: string, propiedades: readonly PropiedadMock[], usuarios: readonly UsuarioMock[]): ConversacionVista {
  const soyLocador = conversacion.landlordId === sesionId
  const otraId = soyLocador ? locatarioDeConversacion(conversacion) : conversacion.landlordId
  const propiedad = propiedades.find((item) => item.id === conversacion.propertyId)
  const ultimo = mensajesDeConversacionMock(conversacion.id).at(-1)
  return {
    id: conversacion.id,
    otraPersona: { id: otraId, nombre: nombreDe(otraId, usuarios), fotoSrc: null, rol: soyLocador ? 'locatario' : 'locador' },
    propiedad: propiedad ? { id: propiedad.id, direccion: formatAddress(propiedad), fotoSrc: mainPhotoSrc(propiedad) || null } : null,
    ultimoMensaje: ultimo
      ? { contenido: ultimo.deletedAt ? '' : ultimo.content, enviadoEl: ultimo.sentAt, esPropio: ultimo.senderId === sesionId, eliminado: ultimo.deletedAt !== null }
      : null,
    actualizadaEl: ultimo?.sentAt ?? conversacion.createdAt,
  }
}
