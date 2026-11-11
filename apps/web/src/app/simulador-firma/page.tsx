/**
 * /simulador-firma — la pantalla de firma de DocuSign, simulada (solo modo mock).
 *
 * Qué es: en mock no hay DocuSign. `contratos.service#iniciarFirma` devuelve
 * esta URL (con los datos en el fragmento `#`) y acá la persona elige qué
 * hacer: firmar, declinar, cerrar sin firmar o dejar vencer la sesión. Después
 * vuelve a la URL de regreso con `?event=…`, igual que con DocuSign.
 * Cubre: US-07 Firmar contrato de alquiler (D5, PO 11/11: simulador en
 * `/simulador-firma`, solo con mocks).
 * En real no existe: `notFound()`.
 * Quién lo usa: nadie la enlaza; se llega desde "Ir a firmar" en modo mock.
 */
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SimuladorFirma } from '@/components/contratos/SimuladorFirma'
import { USE_MOCKS } from '@/services/shared/config'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). Sin datos del contrato. */
export const metadata: Metadata = { title: 'Simulador de firma', robots: { index: false }, referrer: 'no-referrer' }

/** Monta el simulador; en modo real, 404. */
export default function SimuladorFirmaPage() {
  if (!USE_MOCKS) notFound()
  return <SimuladorFirma />
}
