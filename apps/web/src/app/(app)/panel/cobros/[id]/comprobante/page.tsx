/**
 * /panel/cobros/[id]/comprobante — comprobante de pago (US-10).
 *
 * Qué es: la hoja imprimible del cobro del período `id`. La ruta usa el id del
 * período y el service resuelve el del cobro: hay un cobro por período.
 * Entra desde: el detalle del período y el aviso de un cobro registrado.
 */
import type { Metadata } from 'next'
import { HojaComprobante } from '@/components/cobros/HojaComprobante'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Comprobante' }

/** Monta el comprobante del período `id`. */
export default async function ComprobantePage({ params }: PageProps<'/panel/cobros/[id]/comprobante'>) {
  const { id } = await params
  const periodoId = decodeURIComponent(id)
  return <HojaComprobante key={periodoId} periodoId={periodoId} />
}
