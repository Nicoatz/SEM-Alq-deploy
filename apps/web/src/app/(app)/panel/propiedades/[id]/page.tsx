/**
 * /panel/propiedades/[id] — Detalle de una propiedad del locador (US-03
 * Modificar y US-04 Eliminar mis propiedades, numeración de Jira).
 *
 * Qué es: el encabezado, el Resumen y la Zona sensible de una propiedad
 * propia. La pantalla vive en `components/mi-propiedad/MiPropiedad.tsx`;
 * acá solo se monta. Solo para el rol locador (`RequireRole`).
 * Entra desde: "Ver detalle" de cada fila de /panel/propiedades.
 */
import type { Metadata } from 'next'
import { RequireRole } from '@/components/auth/RequireRole'
import { MiPropiedad } from '@/components/mi-propiedad/MiPropiedad'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Detalle de propiedad' }

/** Monta el detalle de una propiedad del locador, solo para locadores. */
export default async function PropiedadLocadorDetallePage({ params }: PageProps<'/panel/propiedades/[id]'>) {
  const { id } = await params
  return (
    <RequireRole role="locador">
      <MiPropiedad id={decodeURIComponent(id)} />
    </RequireRole>
  )
}
