/**
 * ajustes.ts — el calendario de ajustes de un contrato.
 *
 * Qué es: función pura que arma las fechas del calendario, igual en modo mock
 * y en real.
 * Cubre: US-42 Consultar detalle del contrato, "Calendario de ajustes".
 * Quién lo usa: `components/contratos/CalendarioAjustes.tsx`.
 */
import dayjs from 'dayjs'

/** Una fecha del calendario. */
export interface FechaDeAjuste {
  /** Fecha ISO. */
  fecha: string
  tipo: 'inicio' | 'ajuste'
}

/**
 * US-42: "Se deben mostrar la fecha de inicio y las fechas de cada ajuste".
 * Cada fecha se cuenta desde el inicio, no desde el ajuste anterior: así un
 * contrato que arranca el 31 no se va corriendo después de un mes corto.
 *
 * Casos verificados:
 * - Inicio el 31: 31/01/2027 cada 3 meses → 30/04, 31/07 y 31/10/2027 (si el
 *   día no existe, el último del mes).
 * - Un ajuste que caería después del fin no va: 01/10/2026 al 30/09/2027 cada
 *   6 meses → solo 01/04/2027 (el 01/10/2027 queda afuera).
 * - Sin índice: `frecuenciaMeses` en `null` → `[]`, y la pantalla no muestra
 *   el calendario (US-42: "Si el contrato es 'Sin ajuste', no se muestra").
 *
 * @param inicio Fecha ISO de inicio.
 * @param fin Fecha ISO de fin.
 * @param frecuenciaMeses Cada cuántos meses ajusta; `null` si es "Sin ajuste".
 * @returns el inicio y los ajustes en orden, o `[]` si falta un dato.
 */
export function calendarioAjustes(inicio: string | null, fin: string | null, frecuenciaMeses: number | null): FechaDeAjuste[] {
  if (!inicio || !fin || !frecuenciaMeses || frecuenciaMeses < 1) return []
  const fechas: FechaDeAjuste[] = [{ fecha: inicio, tipo: 'inicio' }]
  for (let numero = 1; ; numero += 1) {
    const fecha = dayjs(inicio).add(numero * frecuenciaMeses, 'month').format('YYYY-MM-DD')
    if (fecha > fin) return fechas
    fechas.push({ fecha, tipo: 'ajuste' })
  }
}
