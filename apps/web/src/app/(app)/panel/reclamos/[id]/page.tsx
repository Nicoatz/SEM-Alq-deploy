/**
 * /panel/reclamos/[id] — detalle de un reclamo (US-15 Consultar, US-16 Resolver,
 * US-17 Cancelar y US-18 Responder).
 *
 * Qué es: el reclamo completo con sus fotos, "Datos del reclamo", las acciones
 * del locatario que lo registró y el chat del reclamo. La pantalla vive en
 * `components/reclamos/DetalleReclamo.tsx`; acá solo se monta.
 * Sin `RequireRole`: lo ven las dos partes, cada una con lo suyo. Cualquier otro
 * usuario recibe "No encontramos este reclamo".
 * Entra desde: las filas de `/panel/reclamos`, los reclamos recientes del panel
 * y el registro (con `?registrado=1`).
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DetalleReclamo } from '@/components/reclamos/DetalleReclamo'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Reclamo' }

/** Monta el detalle del reclamo `id`. */
export default async function DetalleReclamoPage({ params }: PageProps<'/panel/reclamos/[id]'>) {
  const { id } = await params
  const reclamoId = decodeURIComponent(id)
  return (
    // Suspense: lee `?registrado=` con useSearchParams.
    <Suspense>
      <DetalleReclamo key={reclamoId} reclamoId={reclamoId} />
    </Suspense>
  )
}
