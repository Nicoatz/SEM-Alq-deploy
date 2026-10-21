/**
 * /panel/contratos — Contratos (US-05 Registrar contrato de alquiler, "Listado de contratos").
 *
 * Qué es: los contratos del locador. La pantalla vive en
 * `components/contratos/ListadoContratos.tsx`; acá solo se monta. El guard
 * de locador está en `layout.tsx`.
 * Entra desde: el ítem "Contratos" del menú del locador y "Ir a Contratos"
 * del resultado del alta.
 */
import type { Metadata } from 'next'
import { ListadoContratos } from '@/components/contratos/ListadoContratos'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Contratos' }

/** Monta el listado de contratos. */
export default function ContratosPage() {
  return <ListadoContratos />
}
