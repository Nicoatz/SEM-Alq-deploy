/**
 * /panel/propiedades — Mis propiedades (US-02 Consultar mis propiedades).
 *
 * Qué es: el listado de todas las propiedades del locador en sesión, con
 * filtros por estado, barrio, tipo y reclamos. La pantalla vive en
 * `components/mis-propiedades/MisPropiedades.tsx`; acá solo se monta.
 * Solo para el rol locador (`RequireRole`): un locatario vuelve a `/panel`.
 * Entra desde: el ítem "Propiedades" del menú del locador y "Ir a mis
 * propiedades" del alta.
 *
 * NOTA: el guard de rol está acá y no en un layout de `/panel/propiedades`,
 * porque el alta (`/panel/propiedades/nueva`) queda abierta para cualquier
 * usuario con sesión (regla del equipo, 27/09/2026).
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { RequireRole } from '@/components/auth/RequireRole'
import { MisPropiedades } from '@/components/mis-propiedades/MisPropiedades'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mis propiedades' }

/** Monta el listado de Mis propiedades (US-02), solo para locadores. */
export default function MisPropiedadesPage() {
  return (
    <RequireRole role="locador">
      {/* Suspense: Mis propiedades lee `?eliminada=<id>` (aviso de US-04) con useSearchParams. */}
      <Suspense>
        <MisPropiedades />
      </Suspense>
    </RequireRole>
  )
}
