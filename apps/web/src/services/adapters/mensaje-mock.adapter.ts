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
import { mensajes as mensajesElenco, type MensajeMock, type UsuarioMock } from '@/lib/mocks'
import { aplicarLimite } from '@/lib/mensajes/reglas'
import type { MensajeChat } from '@/lib/mensajes/tipos'
import { readMockCollection } from '../shared/mockStore'

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

/** `MensajeMock` → `MensajeChat`, mirado por `sesionId`. */
export function mensajeMockToChat(mensaje: MensajeMock, sesionId: string, usuarios: readonly UsuarioMock[]): MensajeChat {
  const emisor = usuarios.find((usuario) => usuario.id === mensaje.senderId)
  return {
    id: mensaje.id,
    conversacionId: mensaje.conversationId,
    emisorId: mensaje.senderId,
    emisorNombre: emisor ? `${emisor.nombre} ${emisor.apellido}` : 'Usuario',
    contenido: mensaje.deletedAt ? '' : mensaje.content,
    enviadoEl: mensaje.sentAt,
    eliminadoEl: mensaje.deletedAt,
    esPropio: mensaje.senderId === sesionId,
  }
}
