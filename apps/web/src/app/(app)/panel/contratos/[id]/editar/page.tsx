/**
 * /panel/contratos/[id]/editar — retomar un borrador de contrato (US-05:
 * "un borrador se puede retomar desde el paso en que quedó").
 *
 * Qué es: el mismo alta en 4 pasos (`AltaContrato`), con el borrador
 * guardado. Si el contrato ya no es borrador, avisa que no se puede editar.
 * NOTA: esta ruta NO está en `docs/MapaDePantallas.pdf` (el mapa solo tiene
 * `/nuevo` y `/[id]`). Decisión del PO, Sprint 3: `/[id]` queda para el
 * detalle de US-07 y el borrador se edita acá (como
 * `/panel/propiedades/[id]/editar`). Anotado en HANDOFF §7.
 * El guard de locador está en `../../layout.tsx`.
 * Entra desde: "Continuar" del listado, "Continuar contrato" de la solicitud
 * y el primer "Guardar borrador" del alta.
 */
import type { Metadata } from 'next'
import { AltaContrato } from '@/components/contratos/AltaContrato'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Continuar contrato' }

/** Monta el alta con el borrador `id`. */
export default async function EditarContratoPage({ params }: PageProps<'/panel/contratos/[id]/editar'>) {
  const { id } = await params
  const contratoId = decodeURIComponent(id)
  return <AltaContrato key={contratoId} contratoId={contratoId} />
}
