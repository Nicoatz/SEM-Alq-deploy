/**
 * /panel/mensajes/[id] — una conversación abierta (US-24 Enviar mensajes).
 *
 * La pantalla la monta el layout (`../layout.tsx`), que lee el `id` de la URL:
 * en escritorio, la bandeja con esta conversación a la derecha; en móvil, solo la
 * conversación. Una conversación ajena, que no existe o de un reclamo muestra
 * "No encontramos esta conversación".
 */
import type { Metadata } from 'next'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mensajes' }

/** No dibuja nada: la conversación la dibuja la bandeja del layout. */
export default function ConversacionPage() {
  return null
}
