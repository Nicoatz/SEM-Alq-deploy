/**
 * orden.ts — orden del listado de cobros.
 *
 * Qué es: la regla de US-09: vencidos, pendientes y pagados; dentro de cada
 * grupo, el período más viejo primero. El filtro por propiedad no cambia el orden.
 * Quién lo usa: `lib/cobros/listado.ts`.
 */
import type { EstadoPeriodo } from '@rentar/shared-types'

/** Posición de cada estado. */
const POSICION: Record<EstadoPeriodo, number> = { vencido: 0, pendiente: 1, pagado: 2 }

/**
 * Devuelve los períodos ordenados, sin tocar el array original.
 *
 * @example
 * ordenarPeriodos([
 *   { estado: 'pagado', periodo: '2026-08' },
 *   { estado: 'vencido', periodo: '2026-09' },
 *   { estado: 'pendiente', periodo: '2026-09' },
 *   { estado: 'vencido', periodo: '2026-08' },
 * ])
 * // → vencido 2026-08, vencido 2026-09, pendiente 2026-09, pagado 2026-08
 */
export function ordenarPeriodos<T extends { estado: EstadoPeriodo; periodo: string }>(periodos: readonly T[]): T[] {
  return [...periodos].sort(
    (a, b) => POSICION[a.estado] - POSICION[b.estado] || a.periodo.localeCompare(b.periodo),
  )
}
