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
 * "Ahora" del elenco en modo mock: el mismo día que {@link HOY_ELENCO}, a
 * las 12:00. Lo usan los textos en horas ("hace 3 h", US-36), que con
 * {@link hoy} (a las 00:00) no tendrían horas para contar.
 */
export const AHORA_ELENCO = '2026-09-23T12:00:00'

/**
 * Hoy, a las 00:00 (así las cuentas de días no dependen de la hora).
 *
 * NOTA: en modo mock (`NEXT_PUBLIC_USE_MOCKS`, el default) es FIJO:
 * {@link HOY_ELENCO}. Con la fecha real, los datos del elenco se
 * desacomodarían solos día a día (un cobro pendiente pasaría a vencido, los
 * "19 días de atraso" pasarían a 20) y los tests de Selenium, que comparan
 * esos textos, dejarían de ser estables. Con el backend real
 * (`NEXT_PUBLIC_USE_MOCKS=false`) es la fecha del sistema.
 */
export function hoy(): Dayjs {
  return (USE_MOCKS ? dayjs(HOY_ELENCO) : dayjs()).startOf('day')
}

/**
 * Ahora, con la hora. En modo mock es FIJO: {@link AHORA_ELENCO} (por lo
 * mismo que {@link hoy}); con el backend real, la hora del sistema.
 * NOTA: para cuentas de días se sigue usando {@link hoy}; esto es solo para
 * los textos en horas.
 */
export function ahora(): Dayjs {
  return USE_MOCKS ? dayjs(AHORA_ELENCO) : dayjs()
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
