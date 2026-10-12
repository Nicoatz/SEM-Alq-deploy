/**
 * textosPropiedad.ts — textos de la ficha de una propiedad del locador.
 *
 * Qué es: funciones puras que arman las filas de la ficha ("La propiedad" y
 * "Condiciones de alquiler") y las fechas del detalle, a partir de los datos
 * del alta (`PropiedadLocadorDetalle.values`). Separadas de la pantalla para
 * leerlas y probarlas solas. Cubre la ficha de US-03 y US-04 (numeración de
 * Jira; Claude Design, "Detalle de propiedad del locador" · 01).
 *
 * NOTA: un dato que no se cargó se muestra como "—" o "No se pide": nunca se
 * inventa.
 * Quién lo usa: `MiPropiedad`, `ResumenPropiedad` y `ModalEliminar`.
 */
import dayjs from 'dayjs'
import type { PropiedadNueva } from '@rentar/shared-types'
import { formatARS } from '@rentar/ui'
import { characteristicShortLabel } from '@/lib/catalogs/characteristics'
import { MEDIO_PAGO_CORTO, PROPERTY_TYPE_LABEL, periodicidad } from '@/lib/catalogs/propiedad'

/** Un renglón de la ficha (`DetailList`). */
export interface FilaFicha {
  label: string
  value: string
}

/** "31/03/2029". */
export function fecha(fechaIso: string): string {
  return dayjs(fechaIso).format('DD/MM/YYYY')
}

/** "1 mes" / "24 meses". */
function meses(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'mes' : 'meses'}`
}

/** "1 año" / "15 años" (antigüedad). */
function anios(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'año' : 'años'}`
}

/** "1 día" / "5 días" (días de gracia). */
function dias(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'día' : 'días'}`
}

/** "58 m²". */
function m2(valor: number): string {
  return `${valor} m²`
}

/** La ficha "La propiedad" (· 01): lo que cargó el alta en los pasos 1 y 2. */
export function filasPropiedad(values: PropiedadNueva): FilaFicha[] {
  return [
    { label: 'Tipo', value: PROPERTY_TYPE_LABEL[values.type] },
    { label: 'Ambientes', value: String(values.rooms) },
    { label: 'Dormitorios', value: String(values.bedrooms) },
    { label: 'Baños', value: String(values.bathrooms) },
    { label: 'Superficie total', value: m2(values.totalAreaM2) },
    { label: 'Superficie cubierta', value: m2(values.coveredAreaM2) },
    { label: 'Antigüedad', value: values.ageYears === null ? '—' : values.ageYears === 0 ? 'A estrenar' : anios(values.ageYears) },
    {
      label: 'Características',
      value: values.characteristics.length ? values.characteristics.map((key) => characteristicShortLabel[key]).join(' · ') : 'Ninguna',
    },
    { label: 'Disponible desde', value: values.availableFrom ? fecha(values.availableFrom) : 'Ya disponible' },
  ]
}

/** La ficha "Condiciones de alquiler" (· 01): el paso 4 del alta. */
export function filasCondiciones(values: PropiedadNueva): FilaFicha[] {
  const ajuste = values.adjustmentIndex
    ? `${values.adjustmentIndex}${values.adjustmentEveryMonths ? `, ${periodicidad(values.adjustmentEveryMonths)}` : ''}`
    : 'Sin ajuste por índice'
  const interes =
    values.dailyInterestPct && values.dailyInterestPct > 0
      ? `${values.dailyInterestPct} % por día${values.graceDays ? ` · ${dias(values.graceDays)} de gracia` : ''}`
      : 'No se cobra'
  return [
    { label: 'Precio mensual', value: formatARS(values.priceMonthly) },
    { label: 'Expensas', value: values.expenses > 0 ? formatARS(values.expenses) : 'Sin expensas' },
    { label: 'Ajuste', value: ajuste },
    { label: 'Duración del contrato', value: values.contractMonths ? meses(values.contractMonths) : '—' },
    { label: 'Depósito', value: values.depositMonths ? meses(values.depositMonths) : 'No se pide' },
    { label: 'Interés por atraso', value: interes },
    { label: 'Medios de pago', value: values.paymentMethods.length ? values.paymentMethods.map((medio) => MEDIO_PAGO_CORTO[medio.method]).join(' · ') : '—' },
  ]
}
