/**
 * /panel/perfil — Mi perfil (US-20 y US-21 Consultar y modificar usuario).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: "Mi perfil" del UserMenu.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mi perfil' }

/** Placeholder de Mi perfil (otro sprint). */
export default function PerfilPage() {
  return <PlaceholderScreen title="Mi perfil" userStory="US-20 y US-21 Consultar y modificar usuario" />
}
