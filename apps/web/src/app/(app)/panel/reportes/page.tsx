/**
 * /panel/reportes — Reportes (US-28 Histograma de cobros).
 *
 * Placeholder: la pantalla es de otro sprint. Existe para que el botón que
 * lleva acá no quede roto.
 * Entra desde: el ítem "Reportes" del menú del locador.
 */
import type { Metadata } from 'next'
import { PlaceholderScreen } from '@/components/PlaceholderScreen'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Reportes' }

/** Placeholder de Reportes (otro sprint). */
export default function ReportesPage() {
  return <PlaceholderScreen title="Reportes" userStory="US-28 Histograma de cobros" />
}
