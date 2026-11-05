/**
 * /panel/cobros/[id] — detalle de un período (US-09 Consultar cobro).
 *
 * Qué es: datos, cargos, cobros e historial del período, con "Registrar un pago a
 * mano" (US-08) para el locador. Sin `RequireRole`: el locatario ve el mismo
 * detalle sin esa acción. Quien no es parte ve "No encontramos este cobro".
 * Entra desde: "Ver detalle" en Cobros.
 */
import type { Metadata } from 'next'
import { DetallePeriodo } from '@/components/cobros/DetallePeriodo'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Cobro' }

/** Monta el detalle del período `id`. */
export default async function DetallePeriodoPage({ params }: PageProps<'/panel/cobros/[id]'>) {
  const { id } = await params
  const periodoId = decodeURIComponent(id)
  return <DetallePeriodo key={periodoId} periodoId={periodoId} />
}
