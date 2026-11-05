/**
 * mora.ts — intereses por mora de un período.
 *
 * Qué es: la misma cuenta que `registrar_cobro_manual` en la base, para mostrar
 * el monto antes de registrar. Cubre US-08 (el monto incluye la mora a la fecha
 * del cobro) y US-12.
 * Quién lo usa: `services/adapters/cobro-mock.adapter.ts` y `RegistrarCobroModal`.
 */
import dayjs from 'dayjs'

/** Datos para calcular la mora. */
export interface DatosMora {
  alquiler: number
  /** Interés diario en %. */
  tasaDiariaPct: number
  diasGracia: number
  /** Fecha ISO de vencimiento. */
  vencimiento: string
  /** Fecha ISO del cobro. */
  fecha: string
}

/** Resultado de {@link calcularMora}. */
export interface Mora {
  diasAtraso: number
  /** Días de atraso menos los de gracia. */
  diasMora: number
  mora: number
  total: number
}

/**
 * Mora a una fecha. Se descuentan los días de gracia, como en el SQL (decisión
 * del PO, 05/11), y se redondea a dos decimales.
 *
 * @example
 * // Dentro de la gracia: sin mora.
 * calcularMora({ alquiler: 470000, tasaDiariaPct: 0.5, diasGracia: 5, vencimiento: '2026-09-10', fecha: '2026-09-15' })
 * // → { diasAtraso: 5, diasMora: 0, mora: 0, total: 470000 }
 * @example
 * // 9 días de atraso con gracia de 5: 4 días, $470.000 × 0,5 % × 4.
 * calcularMora({ alquiler: 470000, tasaDiariaPct: 0.5, diasGracia: 5, vencimiento: '2026-09-10', fecha: '2026-09-19' })
 * // → { diasAtraso: 9, diasMora: 4, mora: 9400, total: 479400 }
 * @example
 * // Antes del vencimiento no hay atraso.
 * calcularMora({ alquiler: 470000, tasaDiariaPct: 0.5, diasGracia: 5, vencimiento: '2026-09-10', fecha: '2026-09-03' })
 * // → { diasAtraso: 0, diasMora: 0, mora: 0, total: 470000 }
 */
export function calcularMora({ alquiler, tasaDiariaPct, diasGracia, vencimiento, fecha }: DatosMora): Mora {
  const diasAtraso = Math.max(0, dayjs(fecha).startOf('day').diff(dayjs(vencimiento).startOf('day'), 'day'))
  const diasMora = Math.max(0, diasAtraso - diasGracia)
  const mora = Math.round(alquiler * (tasaDiariaPct / 100) * diasMora * 100) / 100
  return { diasAtraso, diasMora, mora, total: alquiler + mora }
}
