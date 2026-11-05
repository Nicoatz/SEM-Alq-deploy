/**
 * proximoAlquiler.ts — el monto a pagar de cada contrato (US-12).
 *
 * Qué es: elige el período a pagar, la variante de la tarjeta "Tu próximo
 * alquiler" y el total del mes. Lógica pura: "hoy" lo pasa quien llama.
 * Quién lo usa: `services/cobros.service.ts`, sus adaptadores y `TarjetaProximoAlquiler`.
 *
 * NOTA: sin pago parcial (decisión del PO, 05/11), aunque la US-12 lo mencione.
 */
import type { ProximoAlquiler, ProximoItem, VarianteProximo } from '@rentar/shared-types'
import dayjs from 'dayjs'

/** Con estos días o menos, se destaca el vencimiento (US-12). */
const DIAS_POR_VENCER = 3

/** Datos para elegir la variante. */
interface DatosVariante {
  vencimiento: string
  hoyIso: string
  /** Días de mora a hoy, ya sin los de gracia. */
  diasMora: number
  /** `true` si no debe nada: es el período siguiente a uno pagado. */
  todoPago: boolean
}

/**
 * Variante de la tarjeta y sus días: los que faltan o, vencido, los de atraso.
 *
 * @example
 * // Faltan 3 días: se destaca. Faltan 4: al día.
 * varianteDe({ vencimiento: '2026-09-26', hoyIso: '2026-09-23', diasMora: 0, todoPago: false }) // → por_vencer, 3
 * varianteDe({ vencimiento: '2026-09-27', hoyIso: '2026-09-23', diasMora: 0, todoPago: false }) // → al_dia, 4
 * @example
 * varianteDe({ vencimiento: '2026-09-23', hoyIso: '2026-09-23', diasMora: 0, todoPago: false }) // → vence_hoy, 0
 * @example
 * // Vencido en la gracia, y pasada la gracia.
 * varianteDe({ vencimiento: '2026-09-20', hoyIso: '2026-09-23', diasMora: 0, todoPago: false }) // → vencido_gracia, 3
 * varianteDe({ vencimiento: '2026-09-14', hoyIso: '2026-09-23', diasMora: 4, todoPago: false }) // → vencido_mora, 9
 * @example
 * // Pagado: la tarjeta muestra el período siguiente.
 * varianteDe({ vencimiento: '2026-10-11', hoyIso: '2026-09-23', diasMora: 0, todoPago: true }) // → pagado, 18
 */
export function varianteDe({ vencimiento, hoyIso, diasMora, todoPago }: DatosVariante): { variante: VarianteProximo; dias: number } {
  const faltan = dayjs(vencimiento).startOf('day').diff(dayjs(hoyIso).startOf('day'), 'day')
  if (todoPago) return { variante: 'pagado', dias: faltan }
  if (faltan < 0) return { variante: diasMora > 0 ? 'vencido_mora' : 'vencido_gracia', dias: -faltan }
  if (faltan === 0) return { variante: 'vence_hoy', dias: 0 }
  return { variante: faltan <= DIAS_POR_VENCER ? 'por_vencer' : 'al_dia', dias: faltan }
}

/**
 * Elige el período a pagar: el pendiente o vencido más antiguo; si está todo
 * pago, el siguiente (US-12).
 *
 * @example
 * periodoAPagar([{ periodo: '2026-08', pagado: true }, { periodo: '2026-09', pagado: false }, { periodo: '2026-10', pagado: false }])
 * // → 2026-09
 * periodoAPagar([{ periodo: '2026-09', pagado: true }, { periodo: '2026-10', pagado: false }]) // → 2026-10
 * periodoAPagar([{ periodo: '2026-09', pagado: true }]) // → null
 */
export function periodoAPagar<T extends { periodo: string; pagado: boolean }>(periodos: readonly T[]): T | null {
  return [...periodos].sort((a, b) => a.periodo.localeCompare(b.periodo)).find((item) => !item.pagado) ?? null
}

/** Ítem de un contrato pendiente de firma: el monto inicial, sin período (US-12). */
export function pendienteDeFirma(contratoId: string, propiedad: string, monto: number): ProximoItem {
  return {
    contratoId,
    propiedad,
    periodoId: null,
    periodo: null,
    vencimiento: null,
    variante: 'pendiente_firma',
    dias: 0,
    alquiler: monto,
    mora: 0,
    diasMora: 0,
    total: monto,
    tasaDiariaPct: null,
    sinRecargoHasta: null,
    ultimoPagoPeriodoId: null,
  }
}

/**
 * Arma la tarjeta. Sin ítems no hay contrato. Con dos o más vigentes suma el
 * total del mes (US-12); los pendientes de firma no suman: todavía no se pagan.
 *
 * @example
 * armarProximo([]) // → { items: [], totalMes: null }: sin contrato
 * @example
 * // Dos contratos: $543.150 vencido y $420.000 pendiente.
 * armarProximo([moreno, ituzaingo]).totalMes // → 963150
 */
export function armarProximo(items: ProximoItem[]): ProximoAlquiler {
  const vigentes = items.filter((item) => item.variante !== 'pendiente_firma')
  return {
    items,
    totalMes: vigentes.length >= 2 ? vigentes.reduce((total, item) => total + item.total, 0) : null,
  }
}
