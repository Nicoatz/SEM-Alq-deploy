/**
 * fechas.ts — las cuentas de fechas del contrato: fin, ajustes y próximo ajuste.
 *
 * Qué es: funciones puras (sin estado), separadas de la pantalla para
 * leerlas y probarlas solas.
 * Cubre: US-05 Registrar contrato de alquiler, paso 2 ("se debe calcular
 * automáticamente la fecha de fin…"; "se debe informar la cantidad de
 * ajustes que tendrá el contrato y la fecha del primero").
 * Quién lo usa: `components/contratos/*`, `lib/contratos/plantilla.ts`,
 * `lib/contratos/listado.ts` y la rama mock de `services/contratos.service.ts`.
 *
 * Las fechas viajan como texto ISO (`YYYY-MM-DD`), igual que en el resto del front.
 */
import dayjs from 'dayjs'
import type { IndiceContrato, PeriodicidadAjuste } from '@rentar/shared-types'

/** Meses entre un ajuste y el siguiente. */
export const MESES_POR_PERIODO: Record<PeriodicidadAjuste, number> = {
  trimestral: 3,
  semestral: 6,
  anual: 12,
}

/** Formato ISO de las fechas del contrato. */
const ISO = 'YYYY-MM-DD'

/**
 * Suma `meses` a una fecha. Si el día no existe en el mes de destino (31/01
 * + 1 mes), dayjs devuelve el último día de ese mes (28/02).
 */
function sumarMeses(fechaIso: string, meses: number): dayjs.Dayjs {
  return dayjs(fechaIso).add(meses, 'month')
}

/**
 * Fecha de fin del contrato (US-05: calculada, no editable). Regla del PO:
 * **fin = inicio + N meses − 1 día**. Si el día de inicio no existe en el
 * mes de destino, el contrato termina el último día de ese mes (no un día
 * antes): un contrato que arranca el 31/01 por un mes cubre todo febrero.
 *
 * Casos verificados:
 * - 01/10/2026 + 36 meses → 30/09/2029 (el contrato del diseño, CT-2026-0207).
 * - 01/04/2026 + 36 meses → 31/03/2029 (CT-2026-0148).
 * - 31/01/2027 + 1 mes → 28/02/2027 (febrero no tiene 31: termina el último día).
 * - 28/01/2027 + 1 mes → 27/02/2027.
 * - 29/02/2028 + 12 meses → 28/02/2029 (2029 no es bisiesto).
 *
 * @returns la fecha ISO de fin, o `null` si falta el inicio o la duración no es un entero mayor a 0.
 */
export function fechaFin(inicioIso: string | null, meses: number | null): string | null {
  if (!inicioIso || !meses || !Number.isInteger(meses) || meses <= 0) return null
  const inicio = dayjs(inicioIso)
  const destino = sumarMeses(inicioIso, meses)
  // Si dayjs tuvo que "achicar" el día (31 → 28), ese ya es el último día del período.
  const fin = destino.date() !== inicio.date() ? destino : destino.subtract(1, 'day')
  return fin.format(ISO)
}

/**
 * Cantidad de ajustes del contrato (US-05). Regla del PO:
 * **ajustes = floor((N − 1) / período)**: un ajuste cae cada `período`
 * meses y el que coincidiría con el fin no cuenta (el contrato ya terminó).
 *
 * Casos verificados:
 * - 24 meses, sin ajuste → 0.
 * - 36 meses, semestral → 5 (meses 6, 12, 18, 24 y 30).
 * - 24 meses, anual → 1 (mes 12).
 * - 24 meses, semestral → 3 (meses 6, 12 y 18).
 * - 12 meses, anual → 0.
 *
 * @returns 0 si no hay índice, falta la periodicidad o la duración no es válida.
 */
export function cantidadAjustes(meses: number | null, indice: IndiceContrato, periodo: PeriodicidadAjuste | null): number {
  if (indice === 'sin_ajuste' || !periodo || !meses || !Number.isInteger(meses) || meses <= 0) return 0
  return Math.floor((meses - 1) / MESES_POR_PERIODO[periodo])
}

/**
 * Fecha del primer ajuste (US-05): **inicio + período**. `null` si el
 * contrato no tiene ajustes (ver {@link cantidadAjustes}).
 * Caso verificado: 01/10/2026, semestral → 01/04/2027.
 */
export function fechaPrimerAjuste(inicioIso: string | null, meses: number | null, indice: IndiceContrato, periodo: PeriodicidadAjuste | null): string | null {
  if (!inicioIso || !periodo || cantidadAjustes(meses, indice, periodo) === 0) return null
  return sumarMeses(inicioIso, MESES_POR_PERIODO[periodo]).format(ISO)
}

/**
 * Próximo ajuste a partir de `hoyIso` (listado, US-05: "fecha del próximo
 * ajuste"): el primero de los ajustes del contrato que todavía no pasó.
 * `null` si no quedan ajustes o el contrato no tiene.
 */
export function proximoAjuste(inicioIso: string | null, meses: number | null, indice: IndiceContrato, periodo: PeriodicidadAjuste | null, hoyIso: string): string | null {
  const total = cantidadAjustes(meses, indice, periodo)
  if (!inicioIso || !periodo || total === 0) return null
  for (let numero = 1; numero <= total; numero++) {
    const fecha = sumarMeses(inicioIso, MESES_POR_PERIODO[periodo] * numero).format(ISO)
    if (fecha >= hoyIso) return fecha
  }
  return null
}

/** `true` si la fecha de inicio no es anterior a hoy (US-05: "no puede ser anterior a la fecha actual"). */
export function inicioValido(inicioIso: string, hoyIso: string): boolean {
  return dayjs(inicioIso).format(ISO) >= hoyIso
}

/** `2026-10-01` → `01/10/2026`. */
export function fechaCorta(fechaIso: string): string {
  return dayjs(fechaIso).format('DD/MM/YYYY')
}
