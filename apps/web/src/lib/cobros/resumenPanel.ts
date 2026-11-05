/**
 * resumenPanel.ts — el bloque de cobros de `/panel` a partir de los períodos.
 *
 * Qué es: la misma fuente y la misma mora que `/panel/cobros`, para que las dos
 * pantallas nunca muestren números distintos (decisión del PO, 05/11).
 * Quién lo usa: `services/panel.service.ts`.
 */
import type { CobroPanel, PeriodoFila, ResumenCobros } from '@rentar/shared-types'
import { ordenarPeriodos } from './orden'

/**
 * Resumen del mes de `hoyIso`.
 *
 * - `collected` y `overdueAmount` usan el monto de cobros: lo vencido incluye mora.
 * - `total` es lo pactado para el mes: la suma de los alquileres, sin mora.
 *
 * @example
 * // Nicolás, 23/09/2026: Obispo pagado, Laprida y Belgrano vencidos, Colón pendiente.
 * resumenDelMes(filas, '2026-09-23')
 * // → collected 470000, total 1890000, overdueAmount 1021000, overdueCount 2
 */
export function resumenDelMes(filas: readonly PeriodoFila[], hoyIso: string): ResumenCobros {
  const month = hoyIso.slice(0, 7)
  const delMes = ordenarPeriodos(filas.filter((fila) => fila.periodo === month))
  const sumar = (estado: PeriodoFila['estado']) =>
    delMes.filter((fila) => fila.estado === estado).reduce((total, fila) => total + fila.monto, 0)

  const items = delMes.map(
    (fila): CobroPanel => ({
      id: fila.id,
      propertyId: fila.propiedadId,
      propertyAddress: fila.propiedad,
      tenantName: fila.locatario ?? 'Sin dato',
      amount: fila.monto,
      dueDate: fila.vencimiento,
      status: fila.estado,
      paidAt: fila.fechaPago,
    }),
  )

  return {
    month,
    collected: sumar('pagado'),
    total: delMes.reduce((total, fila) => total + fila.alquiler, 0),
    overdueAmount: sumar('vencido'),
    overdueCount: delMes.filter((fila) => fila.estado === 'vencido').length,
    items,
  }
}
