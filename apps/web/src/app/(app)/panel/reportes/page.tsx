/**
 * /panel/reportes — Reportes (US-28 Histograma de cobros).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Solo para el rol locador (`RequireRole`): un locatario vuelve a `/panel`.
 * Entra desde: el ítem "Reportes" del menú del locador.
 */
import type { Metadata } from 'next'
import { RequireRole } from '@/components/auth/RequireRole'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Reportes' }

/** Placeholder de Reportes (otro sprint). */
export default function ReportesPage() {
  return (
    <RequireRole role="locador">
      <PlaceholderScreen title="Reportes" userStory="US-28 Histograma de cobros" />
    </RequireRole>
  )
}
