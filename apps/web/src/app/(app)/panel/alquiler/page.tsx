/**
 * /panel/alquiler — Mi alquiler (ficha del contrato del locatario).
 *
 * Qué es: el contrato pendiente de firma o vigente del locatario, con la
 * firma y el rechazo (US-07). Base de la ficha de US-27 Consultar mis
 * alquileres (tanda 4). La pantalla vive en `components/contratos/MiAlquiler.tsx`.
 * Para cualquier usuario con sesión (la pide `proxy.ts`), sin `RequireRole`,
 * como Mis solicitudes: el servicio solo devuelve contratos donde es locatario.
 * `?contrato=<id>` abre uno puntual (lo va a usar el listado de US-27).
 * Entra desde: el ítem "Mi alquiler" del menú del locatario.
 */
import type { Metadata } from 'next'
import { MiAlquiler } from '@/components/contratos/MiAlquiler'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mi alquiler' }

/** Monta Mi alquiler. */
export default async function MiAlquilerPage({ searchParams }: PageProps<'/panel/alquiler'>) {
  const { contrato } = await searchParams
  const contratoId = typeof contrato === 'string' && contrato ? contrato : undefined
  return <MiAlquiler key={contratoId ?? 'actual'} contratoId={contratoId} />
}
