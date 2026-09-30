/**
 * /panel/solicitudes — Solicitudes (US-36 y US-37 Consultar, aceptar o rechazar solicitudes).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: el ítem "Solicitudes" del menú del locador.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Solicitudes' }

/** Placeholder de Solicitudes (otro sprint). */
export default function SolicitudesPage() {
  return <PlaceholderScreen title="Solicitudes" userStory="US-36 y US-37 Consultar, aceptar o rechazar solicitudes" />
}
