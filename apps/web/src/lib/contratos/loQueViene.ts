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
 * En modo real las fechas del pago y del ajuste las calcula el back: la
 * ficha solo cuenta los días con {@link fechaDesdeHoy}.
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
  /** Plazo de vencimiento del pago, en días (1 a 28 en RentAR); `null` si no se sabe. */
  plazoDias: number | null
  indice: IndiceContrato
  /** Cada cuántos meses se ajusta; `null` sin ajuste. */
  cadaMeses: number | null
}

/** Días desde `hoyIso` hasta `fecha` (negativo si ya pasó). */
function diasEntre(hoyIso: string, fecha: string): number {
  return dayjs(fecha).diff(dayjs(hoyIso), 'day')
}

/**
 * Próximo vencimiento de pago: el plazo se cuenta desde que el monto está
 * disponible en cada período (el primero del mes o, en el primer período, el
 * inicio del contrato). Es la misma regla que el back
 * (`calcularFechaProximoVencimiento`), así mock y real dicen lo mismo.
 * Si el de este mes ya pasó, va el del período siguiente.
 *
 * Casos verificados:
 * - Hoy 23/09/2026, plazo 10 (el 11/09 ya pasó) → 11/10/2026, faltan 18.
 * - Hoy 23/09/2026, plazo 28 → 29/09/2026, faltan 6.
 * - Hoy 11/09/2026, plazo 10 → 11/09/2026, faltan 0 (vence hoy).
 * - Hoy 23/09/2026, inicio 01/10/2026, plazo 10 → 11/10/2026 (el primero del contrato).
 * - Hoy 23/09/2026, inicio 15/10/2026, plazo 10 → 25/10/2026.
 * - Hoy 23/09/2026, fin 30/09/2026, plazo 10 → `null` (no quedan pagos).
 * @returns `null` si falta el plazo o no quedan vencimientos.
 */
export function proximoPago(datos: Pick<DatosLoQueViene, 'hoyIso' | 'inicio' | 'fin' | 'plazoDias'>): FechaQueViene | null {
  const { hoyIso, inicio, fin, plazoDias } = datos
  if (!plazoDias) return null
  const desde = dayjs(inicio && inicio > hoyIso ? inicio : hoyIso).date(1)
  const vencimientoDe = (primeroDelMes: dayjs.Dayjs) => {
    const disponible = inicio && dayjs(inicio).isAfter(primeroDelMes) ? dayjs(inicio) : primeroDelMes
    return disponible.add(plazoDias, 'day')
  }
  const esteMes = vencimientoDe(desde)
  const fecha = (esteMes.isBefore(dayjs(hoyIso), 'day') ? vencimientoDe(desde.add(1, 'month')) : esteMes).format(ISO)
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
  return fechaDesdeHoy(datos.hoyIso, datos.fin)
}

/**
 * Una fecha ya calculada (por el back, en modo real: `fecha_proximo_vencimiento_pago`
 * y `fecha_proximo_ajuste`) con los días que faltan desde hoy.
 * Caso verificado: hoy 27/10/2026, fecha 05/11/2026 → faltan 9.
 * @returns `null` si no hay fecha o ya pasó.
 */
export function fechaDesdeHoy(hoyIso: string, fecha: string | null): FechaQueViene | null {
  if (!fecha || fecha < hoyIso) return null
  return { fecha, dias: diasEntre(hoyIso, fecha) }
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
