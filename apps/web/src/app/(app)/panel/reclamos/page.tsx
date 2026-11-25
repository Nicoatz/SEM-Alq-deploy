/**
 * /panel/reclamos — Reclamos (US-15 Consultar reclamos; registrar, US-14, en `/panel/reclamos/nuevo`).
 *
 * Qué es: los reclamos del usuario según su rol activo: el locador ve los de sus
 * propiedades, agrupados; el locatario, los que registró, con "Registrar
 * reclamo". La pantalla vive en `components/reclamos/Reclamos.tsx`; acá solo se monta.
 * Sin `RequireRole`: la vista sale del rol activo ("Viendo como").
 * Entra desde: el ítem "Reclamos" (locador) o "Mis reclamos" (locatario) del
 * menú, y "Ver todos" de los reclamos recientes del panel.
 */
import type { Metadata } from 'next'
import { Reclamos } from '@/components/reclamos/Reclamos'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Reclamos' }

/** Monta el listado de reclamos. */
export default function ReclamosPage() {
  return <Reclamos />
}
