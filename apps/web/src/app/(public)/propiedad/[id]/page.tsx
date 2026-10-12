/**
 * /propiedad/[id] — Detalle de propiedad (US-41 Consultar detalle de
 * propiedad, numeración de Jira; en el mapa de diseño, US-35). Arquetipo A1.
 *
 * Diseño: Claude Design, "Detalle de propiedad" · 01 a 04.
 * Entra desde: la tarjeta de `/buscar` y de la landing, "Propiedades
 * similares" y la vuelta del login con `?solicitar=1` (US-35). Accesible con
 * y sin sesión.
 *
 * La pantalla entera es un Client Component (`DetallePropiedad`): pide la
 * propiedad desde el navegador y lee `?solicitar=` de la URL. `Suspense` es
 * obligatorio en Next.js 16 para usar `useSearchParams`; mientras tanto se ve
 * el skeleton del detalle.
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { DetallePropiedad } from '@/components/detalle-propiedad/DetallePropiedad'
import { DetalleCargando } from '@/components/detalle-propiedad/EstadosDetalle'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Detalle de propiedad' }

/** Monta el detalle (US-41). En Next.js 16, `params` es una Promise. */
export default async function PropiedadDetallePage({ params }: PageProps<'/propiedad/[id]'>) {
  const { id } = await params
  return (
    <Suspense fallback={<DetalleCargando />}>
      <DetallePropiedad id={decodeURIComponent(id)} />
    </Suspense>
  )
}
