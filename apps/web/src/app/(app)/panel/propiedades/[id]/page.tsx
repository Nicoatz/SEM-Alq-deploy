/**
 * /panel/propiedades/[id] — Detalle de propiedad (US-02 Consultar mis propiedades · detalle).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto. Solo para el rol locador (`RequireRole`).
 * Entra desde: "Ver detalle" de cada fila de /panel/propiedades.
 */
import type { Metadata } from 'next'
import { RequireRole } from '@/components/auth/RequireRole'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Detalle de propiedad' }

/** Placeholder del detalle de una propiedad del locador (US-03, US-04). */
export default function PropiedadLocadorDetallePage() {
  return (
    <RequireRole role="locador">
      <PlaceholderScreen title="Detalle de propiedad" userStory="US-02 Consultar mis propiedades · detalle" />
    </RequireRole>
  )
}
