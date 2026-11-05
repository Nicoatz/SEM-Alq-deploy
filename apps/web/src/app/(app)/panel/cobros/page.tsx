/**
 * /panel/cobros — Cobros (US-08 Registrar cobro y US-09 Consultar cobro).
 *
 * Qué es: los períodos del locador, con sus filtros, y el registro de un cobro.
 * Solo para locadores: el locatario consulta en `/panel/pagos`.
 * Entra desde: el ítem "Cobros" del menú del locador.
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { RequireRole } from '@/components/auth/RequireRole'
import { Cobros } from '@/components/cobros/Cobros'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Cobros' }

/** Monta Cobros, solo para locadores. */
export default function CobrosPage() {
  return (
    <RequireRole role="locador">
      {/* Suspense: lee los filtros de la URL con useSearchParams. */}
      <Suspense>
        <Cobros />
      </Suspense>
    </RequireRole>
  )
}
