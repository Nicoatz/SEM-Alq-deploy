/**
 * listado.ts — el orden de Mis alquileres.
 *
 * Qué es: función pura sobre los alquileres del locatario, separada de la pantalla.
 * Cubre: US-27 Consultar mis alquileres ({@link ordenarAlquileres}).
 * Quién lo usa: `components/contratos/ListadoAlquileres.tsx` y las dos ramas de
 * `contratos.service.ts`.
 */
import type { ContractStatus, ContratoResumen } from '@rentar/shared-types'

/** Orden de los estados en Mis alquileres (US-27). */
const ORDEN_ALQUILER: Partial<Record<ContractStatus, number>> = { pendiente_firma: 0, vigente: 1, finalizado: 2, rescindido: 3 }

/**
 * Orden de Mis alquileres (US-27: "pendientes de firma, después vigentes y
 * al final finalizados"). Dentro de cada estado, por fecha de fin (la más
 * cercana primero; en los finalizados, el más reciente primero).
 */
export function ordenarAlquileres<T extends Pick<ContratoResumen, 'status' | 'endDate' | 'propertyAddress'>>(alquileres: readonly T[]): T[] {
  return [...alquileres].sort((a, b) => {
    const estado = (ORDEN_ALQUILER[a.status] ?? 9) - (ORDEN_ALQUILER[b.status] ?? 9)
    if (estado !== 0) return estado
    const finA = a.endDate ?? ''
    const finB = b.endDate ?? ''
    if (finA === finB) return a.propertyAddress.localeCompare(b.propertyAddress, 'es')
    return a.status === 'finalizado' ? finB.localeCompare(finA) : finA.localeCompare(finB)
  })
}
