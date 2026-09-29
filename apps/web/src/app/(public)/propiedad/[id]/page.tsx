/**
 * /propiedad/[id] — Detalle de propiedad (sin US en Sprint 0 (mapa US-35)).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: la PropertyCard de /buscar.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Detalle de propiedad' }

/** Placeholder del detalle público de una propiedad. */
export default function PropiedadDetallePage() {
  return <PlaceholderScreen title="Detalle de propiedad" userStory="sin US en Sprint 0 (mapa US-35)" />
}
