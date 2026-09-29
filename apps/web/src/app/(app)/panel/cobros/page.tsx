/**
 * /panel/cobros — Cobros (US-08 y US-09 Registrar y consultar cobros).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: el ítem "Cobros" del menú del locador.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Cobros' }

/** Placeholder de Cobros (otro sprint). */
export default function CobrosPage() {
  return <PlaceholderScreen title="Cobros" userStory="US-08 y US-09 Registrar y consultar cobros" />
}
