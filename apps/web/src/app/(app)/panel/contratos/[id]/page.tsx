/**
 * /panel/contratos/[id] — detalle de un contrato (ruta A5 del mapa).
 *
 * Qué es: estado de cada firmante (locador, locatario y garantes), datos
 * principales, documento y las acciones del locador (firmar en DocuSign,
 * "Modificar" y "Rechazar firma"). Cubre US-07 Firmar contrato de alquiler. Un
 * borrador abierto por acá va a `/[id]/editar` (US-05).
 * También es la URL de regreso de DocuSign para el locador
 * (`/panel/contratos/{id}?event=…`): el detalle lee `event` y espera el aviso.
 * El guard de locador está en `../layout.tsx`. El locatario firma desde Mi
 * alquiler (`/panel/alquiler`), con el mismo `FirmaContrato`.
 * Entra desde: la pestaña Contratos de la propiedad ("Ver contrato completo") y el
 * resultado del envío a firmar.
 */
import type { Metadata } from 'next'
import { DetalleContrato } from '@/components/contratos/DetalleContrato'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Contrato' }

/** Monta el detalle del contrato `id`. */
export default async function DetalleContratoPage({ params }: PageProps<'/panel/contratos/[id]'>) {
  const { id } = await params
  const contratoId = decodeURIComponent(id)
  return <DetalleContrato key={contratoId} contratoId={contratoId} />
}
