/**
 * /panel/suscripcion — Suscripción (US-30 a US-33 Suscripción).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: el ítem "Suscripción" del menú del locador.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Suscripción' }

/** Placeholder de Suscripción (otro sprint). */
export default function SuscripcionPage() {
  return <PlaceholderScreen title="Suscripción" userStory="US-30 a US-33 Suscripción" />
}
