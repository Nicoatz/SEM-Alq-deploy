/**
 * /panel/pagos — Mis pagos (US-09 Consultar cobro, parte del locatario).
 *
 * Qué es: lo pendiente, los indicadores del año y el historial de pagos. Para
 * cualquier usuario con sesión (la pide `proxy.ts`): el service solo devuelve sus
 * pagos como locatario, como Mi alquiler.
 * Entra desde: el ítem "Mis pagos" del menú y "Ver historial" en el panel.
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { MisPagos } from '@/components/cobros/MisPagos'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mis pagos' }

/** Monta Mis pagos. */
export default function MisPagosPage() {
  return (
    // Suspense: lee los filtros de la URL con useSearchParams.
    <Suspense>
      <MisPagos />
    </Suspense>
  )
}
