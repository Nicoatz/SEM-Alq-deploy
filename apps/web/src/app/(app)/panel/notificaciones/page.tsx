/**
 * /panel/notificaciones — Notificaciones (US-22 y US-23 Notificaciones).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: "Notificaciones" del UserMenu.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Notificaciones' }

/** Placeholder de Notificaciones (otro sprint). */
export default function NotificacionesPage() {
  return <PlaceholderScreen title="Notificaciones" userStory="US-22 y US-23 Notificaciones" />
}
