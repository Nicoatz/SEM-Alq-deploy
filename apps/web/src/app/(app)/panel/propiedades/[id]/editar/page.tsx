/**
 * /panel/propiedades/[id]/editar — Editar una propiedad del locador (US-03
 * Modificar mis propiedades, numeración de Jira).
 *
 * Qué es: el formulario del alta en una sola página, con los datos
 * guardados. La pantalla vive en
 * `components/editar-propiedad/EditarPropiedad.tsx`; acá solo se monta.
 * Solo para el rol locador (`RequireRole`).
 * Entra desde: "Editar publicación" y "Editar fotos" del detalle, y
 * "Editar" del menú "⋯" de Mis propiedades (móvil).
 */
import type { Metadata } from 'next'
import { RequireRole } from '@/components/auth/RequireRole'
import { EditarPropiedad } from '@/components/editar-propiedad/EditarPropiedad'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Editar publicación' }

/** Monta la edición de una propiedad del locador, solo para locadores. */
export default async function EditarPropiedadPage({ params }: PageProps<'/panel/propiedades/[id]/editar'>) {
  const { id } = await params
  return (
    <RequireRole role="locador">
      <EditarPropiedad id={decodeURIComponent(id)} />
    </RequireRole>
  )
}
