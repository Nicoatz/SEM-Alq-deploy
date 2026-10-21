/**
 * fechas.ts — "hoy" y cuentas de días para los textos relativos del panel.
 *
 * Qué es: un solo lugar para "vence en 5 días", "19 días de atraso" o "hace 2
 * días". Nada de eso se escribe fijo en los mocks: se calcula contra
 * {@link hoy} (en modo mock, el 23/09/2026 del elenco; ver `lib/mocks/README.md`).
 *
 * Quién lo usa: la rama mock de `services/panel.service.ts`,
 * `services/propiedades.service.ts` y `services/solicitudes.service.ts`, las
 * pantallas del panel para los textos relativos y las solicitudes para el
 * tiempo en horas o días (US-36, {@link textoHaceHorasODias}).
 */
import dayjs, { type Dayjs } from 'dayjs'
import 'dayjs/locale/es'
import { USE_MOCKS } from '@/services/shared/config'

/**
 * "Hoy" del elenco en modo mock: los datos de prueba se armaron contra esta
 * fecha (Laprida 340 lleva 19 días de atraso, Belgrano 1120 lleva 7).
 */
export const HOY_ELENCO = '2026-09-23'

/**
 * EL reloj de la app: ahora, con la hora. Todo lo que necesita "ahora" u
 * "hoy" pasa por acá (decisión del PO, tanda 3 del Sprint 3: un solo reloj).
 * - Modo real (`NEXT_PUBLIC_USE_MOCKS=false`): la hora del sistema.
 * - Modo mock (el default): la FECHA es la del elenco ({@link HOY_ELENCO}) y
 *   la HORA es la real. Así los datos del elenco no se desacomodan día a
 *   día (los "19 días de atraso" siguen siendo 19 y los tests de Selenium,
 *   estables) y lo que pasa en la sesión (crear, enviar, firmar, rechazar,
 *   cancelar o reenviar un contrato; enviar o responder una solicitud) queda
 *   con una hora de verdad: el límite de "un reenvío por hora" (US-07) se
 *   cumple con el reloj real.
 * NOTA: los textos "hace N h" de las solicitudes del elenco (US-36) dependen
 * de la hora a la que se mire (antes eran contra un 12:00 fijo).
 */
export function ahora(): Dayjs {
  const reloj = dayjs()
  if (!USE_MOCKS) return reloj
  return dayjs(HOY_ELENCO).hour(reloj.hour()).minute(reloj.minute()).second(reloj.second()).millisecond(reloj.millisecond())
}

/**
 * Hoy, a las 00:00 (así las cuentas de días no dependen de la hora). Sale de
 * {@link ahora}: en mock es el {@link HOY_ELENCO}; en real, la fecha del sistema.
 */
export function hoy(): Dayjs {
  return ahora().startOf('day')
}

/** {@link ahora} en ISO con hora (`2026-09-23T16:14:05`), para guardar fechas de eventos. */
export function ahoraIso(): string {
  return ahora().format('YYYY-MM-DDTHH:mm:ss')
}

/** Días que faltan desde hoy hasta `fecha` (negativo si ya pasó). */
export function diasHasta(fecha: string): number {
  return dayjs(fecha).startOf('day').diff(hoy(), 'day')
}

/** Días que pasaron desde `fecha` hasta hoy (negativo si todavía no llegó). */
export function diasDesde(fecha: string): number {
  return -diasHasta(fecha)
}

/** `true` si `fecha` cae en el mes de hoy. */
export function esDelMesActual(fecha: string): boolean {
  return dayjs(fecha).isSame(hoy(), 'month')
}

/** Mes de hoy como "YYYY-MM" (el período de los cobros del panel). */
export function mesActual(): string {
  return hoy().format('YYYY-MM')
}

/** "en 5 días", "mañana", "hoy". Para fechas futuras o de hoy. */
export function textoEnDias(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'mañana'
  return `en ${dias} días`
}

/** "hace 2 días", "ayer", "hoy". Para fechas pasadas o de hoy. */
export function textoHaceDias(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
}

/**
 * Tiempo transcurrido desde `fecha` (fecha y hora ISO completa, con o sin
 * zona), en horas durante las primeras 23 y en días desde las 24.
 * US-36: "se debe visualizar el tiempo de creación para las solicitudes
 * pendientes, medido en cantidad de horas para las primeras 23 horas y en
 * cantidad de días a partir de las 24 horas".
 * - Menos de 1 h (o una fecha futura, por un reloj desfasado): "hace menos de 1 h".
 * - De 1 a 23 h: "hace 3 h".
 * - Desde 24 h: "hace 1 día", "hace 2 días" (días completos: 47 h son 1 día).
 * NOTA: a diferencia de {@link textoHaceDias}, cuenta horas reales y no días
 * de calendario: algo enviado ayer a las 23:00 es "hace 13 h", no "ayer".
 */
export function textoHaceHorasODias(fecha: string): string {
  const horas = ahora().diff(dayjs(fecha), 'hour')
  if (horas < 1) return 'hace menos de 1 h'
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

/** "1 día" / "19 días". */
export function textoDias(dias: number): string {
  return dias === 1 ? '1 día' : `${dias} días`
}

/** Fecha larga para el saludo: "Miércoles 23 de septiembre de 2026". */
export function fechaLarga(fecha: Dayjs = hoy()): string {
  const texto = fecha.locale('es').format('dddd D [de] MMMM [de] YYYY')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Nombre del mes de una fecha ISO o "YYYY-MM", en minúscula: "septiembre". */
export function nombreMes(fecha: string): string {
  return dayjs(fecha).locale('es').format('MMMM')
}
