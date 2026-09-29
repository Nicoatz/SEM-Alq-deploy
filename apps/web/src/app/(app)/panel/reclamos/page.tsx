/**
 * /panel/reclamos — Reclamos (US-14 a US-18 Reclamos).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: el ítem "Reclamos" del menú del locador.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Reclamos' }

/** Placeholder de Reclamos (otro sprint). */
export default function ReclamosPage() {
  return <PlaceholderScreen title="Reclamos" userStory="US-14 a US-18 Reclamos" />
}
