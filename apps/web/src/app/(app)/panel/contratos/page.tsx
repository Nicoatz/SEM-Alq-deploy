/**
 * /panel/contratos — Contratos (US-05 Registrar contrato de alquiler).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: el ítem "Contratos" del menú del locador.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Contratos' }

/** Placeholder de Contratos (otro sprint). */
export default function ContratosPage() {
  return <PlaceholderScreen title="Contratos" userStory="US-05 Registrar contrato de alquiler" />
}
