/**
 * /panel/reclamos/nuevo — Registrar reclamo (US-14).
 *
 * Qué es: el formulario para que el locatario registre un reclamo sobre una
 * propiedad que alquila con contrato vigente. La pantalla vive en
 * `components/reclamos/NuevoReclamo.tsx`; acá solo se monta.
 * Solo para el rol locatario (`RequireRole`, US-14: "Se debe haber iniciado
 * sesión como locatario"): con "Viendo como Locador", vuelve a `/panel`.
 * Entra desde: "Registrar reclamo" de Mis reclamos y de Mi alquiler (con
 * `?propiedad=<id>`).
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { RequireRole } from '@/components/auth/RequireRole'
import { NuevoReclamo } from '@/components/reclamos/NuevoReclamo'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Registrar reclamo' }

/** Monta el registro de un reclamo, solo para locatarios. */
export default function NuevoReclamoPage() {
  return (
    <RequireRole role="locatario">
      {/* Suspense: lee `?propiedad=` con useSearchParams. */}
      <Suspense>
        <NuevoReclamo />
      </Suspense>
    </RequireRole>
  )
}
