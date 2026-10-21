/**
 * /panel/contratos/nuevo — Nuevo contrato (US-05 Registrar contrato de alquiler).
 *
 * Qué es:
 * - Con `?solicitud=<id>`: el alta en 4 pasos, con la propiedad y el
 *   locatario de esa solicitud aceptada (`AltaContrato`).
 * - Sin `?solicitud=`: el selector de solicitudes aceptadas sin contrato
 *   (`SelectorSolicitud`, decisión del PO).
 * Al guardar el primer borrador, la URL pasa a `/panel/contratos/[id]/editar`
 * (`router.replace`). El guard de locador está en `../layout.tsx`.
 * Entra desde: "Iniciar contrato" de una solicitud aceptada y "Nuevo
 * contrato" del listado (mapa: `/panel/contratos/nuevo`).
 */
import type { Metadata } from 'next'
import { AltaContrato } from '@/components/contratos/AltaContrato'
import { SelectorSolicitud } from '@/components/contratos/SelectorSolicitud'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Nuevo contrato' }

/** El alta (con solicitud) o el selector (sin solicitud). */
export default async function NuevoContratoPage({ searchParams }: PageProps<'/panel/contratos/nuevo'>) {
  const { solicitud } = await searchParams
  const solicitudId = typeof solicitud === 'string' && solicitud ? solicitud : null
  return solicitudId ? <AltaContrato key={solicitudId} solicitudId={solicitudId} /> : <SelectorSolicitud />
}
