/**
 * loQueViene.ts — "Lo que viene" de un alquiler: próximo pago, próximo
 * ajuste y fin del contrato, con los días que faltan.
 *
 * Qué es: lógica pura (sin React ni services). Cubre US-27 Consultar mis
 * alquileres: "se debe mostrar 'Lo que viene': la fecha del próximo
 * vencimiento de pago, la fecha del próximo ajuste con su índice y la fecha
 * de fin del contrato. Cada fecha indica cuántos días faltan". "Hoy" lo pasa
 * quien llama (en la app, `hoy()` del reloj único de `lib/utils/fechas.ts`).
 *
 * Quién lo usa: la ficha del locatario (`components/contratos/DetalleContrato.tsx`)
 * y `ListadoAlquileres.tsx` (próximo ajuste).
 */
import type { IndiceContrato } from '@rentar/shared-types'
import dayjs from 'dayjs'

const ISO = 'YYYY-MM-DD'

/** Una fecha de "Lo que viene" con los días que faltan desde hoy (0 = hoy). */
export interface FechaQueViene {
  fecha: string
  dias: number
}

/** Lo que necesita "Lo que viene". */
export interface DatosLoQueViene {
  /** Hoy, ISO (`YYYY-MM-DD`). */
  hoyIso: string
  /** Inicio y fin del contrato, ISO; `null` si faltan. */
  inicio: string | null
  fin: string | null
  /** Día de vencimiento del pago (1 a 28 en RentAR); `null` si no se sabe. */
  diaPago: number | null
  indice: IndiceContrato
  /** Cada cuántos meses se ajusta; `null` sin ajuste. */
  cadaMeses: number | null
}

/** Días desde `hoyIso` hasta `fecha` (negativo si ya pasó). */
function diasEntre(hoyIso: string, fecha: string): number {
  return dayjs(fecha).diff(dayjs(hoyIso), 'day')
}

/** El día `dia` del mes de `base` (si el mes es más corto, su último día). */
function enDia(base: dayjs.Dayjs, dia: number): dayjs.Dayjs {
  return base.date(Math.min(dia, base.daysInMonth()))
}

/**
 * Próximo vencimiento de pago: el primer día de pago desde hoy (o desde el
 * inicio, si el contrato todavía no empezó) y hasta el fin.
 *
 * Casos verificados (con `tsx`, tanda 4 del Sprint 3):
 * - Hoy 23/09/2026, día 10 (ya pasó este mes) → 10/10/2026, faltan 17.
 * - Hoy 23/09/2026, día 28 → 28/09/2026, faltan 5.
 * - Hoy 10/09/2026, día 10 → 10/09/2026, faltan 0 (vence hoy).
 * - Hoy 15/02/2027, día 28 → 28/02/2027, faltan 13 (febrero tiene día 28).
 * - Hoy 23/09/2026, inicio 01/10/2026, día 10 → 10/10/2026 (el primero del contrato).
 * - Hoy 23/09/2026, fin 30/09/2026, día 10 → `null` (no quedan pagos).
 * @returns `null` si falta el día de pago o no quedan vencimientos.
 */
export function proximoPago(datos: Pick<DatosLoQueViene, 'hoyIso' | 'inicio' | 'fin' | 'diaPago'>): FechaQueViene | null {
  const { hoyIso, inicio, fin, diaPago } = datos
  if (!diaPago) return null
  const desde = inicio && inicio > hoyIso ? dayjs(inicio) : dayjs(hoyIso)
  let candidato = enDia(desde, diaPago)
  if (candidato.isBefore(desde, 'day')) candidato = enDia(desde.add(1, 'month').date(1), diaPago)
  const fecha = candidato.format(ISO)
  if (fin && fecha > fin) return null
  return { fecha, dias: diasEntre(hoyIso, fecha) }
}

/**
 * Próximo ajuste: el primero de inicio + k × `cadaMeses` (k = 1, 2…) que
 * cae desde hoy y no después del fin (el que coincidiría con el fin no
 * cuenta, como en US-05).
 *
 * Casos verificados (con `tsx`):
 * - Inicio 01/07/2025, cada 4 meses, hoy 23/09/2026 → 01/11/2026 (ya
 *   pasaron 01/11/2025, 01/03/2026 y 01/07/2026), faltan 39. Es CT-2026-0115.
 * - Inicio 01/10/2026, cada 6 meses, hoy 15/10/2027 (ya pasaron dos:
 *   01/04/2027 y 01/10/2027) → 01/04/2028, faltan 169. Es CT-2026-0207.
 * - Inicio 01/01/2026, cada 3 meses, hoy 15/07/2026 (pasaron 01/04 y 01/07)
 *   → 01/10/2026, faltan 78.
 * - Sin ajuste → `null` (la ficha no muestra la fecha).
 * - Inicio 01/12/2025, fin 30/11/2026, cada 12 meses → `null` (el contrato
 *   termina antes del primer ajuste, 01/12/2026).
 * @returns `null` sin ajuste, sin datos o si no quedan ajustes antes del fin.
 */
export function proximoAjusteQueViene(datos: Pick<DatosLoQueViene, 'hoyIso' | 'inicio' | 'fin' | 'indice' | 'cadaMeses'>): FechaQueViene | null {
  const { hoyIso, inicio, fin, indice, cadaMeses } = datos
  if (indice === 'sin_ajuste' || !cadaMeses || cadaMeses <= 0 || !inicio) return null
  for (let k = 1; k < 1200; k++) {
    const fecha = dayjs(inicio).add(cadaMeses * k, 'month').format(ISO)
    if (fin && fecha > fin) return null
    if (fecha >= hoyIso) return { fecha, dias: diasEntre(hoyIso, fecha) }
  }
  return null
}

/**
 * Fin del contrato con los días que faltan.
 * Caso verificado: hoy 23/09/2026, fin 31/03/2029 → faltan 920.
 * @returns `null` si no hay fecha de fin o ya pasó.
 */
export function finQueViene(datos: Pick<DatosLoQueViene, 'hoyIso' | 'fin'>): FechaQueViene | null {
  if (!datos.fin || datos.fin < datos.hoyIso) return null
  return { fecha: datos.fin, dias: diasEntre(datos.hoyIso, datos.fin) }
}

/** Las tres fechas de "Lo que viene" (US-27). */
export function loQueViene(datos: DatosLoQueViene): { pago: FechaQueViene | null; ajuste: FechaQueViene | null; fin: FechaQueViene | null } {
  return { pago: proximoPago(datos), ajuste: proximoAjusteQueViene(datos), fin: finQueViene(datos) }
}

/** Los días que faltan, en texto: "es hoy", "falta 1 día", "faltan 17 días". */
export function textoFaltan(dias: number): string {
  if (dias === 0) return 'es hoy'
  if (dias === 1) return 'falta 1 día'
  return `faltan ${dias} días`
}
