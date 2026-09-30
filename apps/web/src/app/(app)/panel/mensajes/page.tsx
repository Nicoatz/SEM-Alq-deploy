/**
 * /panel/mensajes — Mensajes (US-24 a US-26 Mensajes).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: el ítem "Mensajes" del menú del locador.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mensajes' }

/** Placeholder de Mensajes (otro sprint). */
export default function MensajesPage() {
  return <PlaceholderScreen title="Mensajes" userStory="US-24 a US-26 Mensajes" />
}
