/**
 * /panel/alquileres — Mis alquileres (US-27, con dos o más contratos).
 *
 * Qué es: el listado de los contratos del locatario (pendientes de firma,
 * vigentes y finalizados). Con uno o ninguno, la pantalla redirige a
 * `/panel/alquiler`. Vive en `components/contratos/ListadoAlquileres.tsx`.
 * Para cualquier usuario con sesión (la pide `proxy.ts`), sin `RequireRole`,
 * como Mi alquiler: el servicio solo devuelve contratos donde es locatario.
 * Entra desde: el ítem "Mis alquileres" del menú y la redirección de Mi alquiler.
 */
import type { Metadata } from 'next'
import { ListadoAlquileres } from '@/components/contratos/ListadoAlquileres'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mis alquileres' }

/** Monta Mis alquileres. */
export default function MisAlquileresPage() {
  return <ListadoAlquileres />
}
