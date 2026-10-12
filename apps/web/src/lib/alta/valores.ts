/**
 * valores.ts — los valores del formulario del alta (US-01) y su traducción
 * al tipo que reciben los services, en los dos sentidos.
 *
 * Qué es: funciones puras que comparten el alta (`/panel/propiedades/nueva`)
 * y la edición (`/panel/propiedades/[id]/editar`, US-03): el formulario es
 * el mismo, así que lo que entra y sale de él también.
 * - `altaValuesToPropiedadNueva`: lo que se valida → lo que recibe el service.
 * - `propiedadNuevaToAltaValues`: lo guardado → los valores con que arranca
 *   la edición.
 * - `contarCambios`: cuántos campos cambió la edición ("Cambios sin guardar: N").
 * - `erroresDeFormulario`: los errores de antd → el resumen "Faltan N datos".
 *
 * Quién lo usa: `components/alta/AltaPropiedad.tsx` y
 * `components/editar-propiedad/EditarPropiedad.tsx`.
 */
import type { PropiedadNueva } from '@rentar/shared-types'
import { ETIQUETA_CAMPO, type AltaValues } from '@/lib/validation/propiedad.rules'

/** Un error del formulario para el resumen de arriba ("Faltan N datos para seguir"). */
export interface ErrorDeCampo {
  name: keyof AltaValues
  label: string
  message: string
}

/** Valores ya validados del formulario → `PropiedadNueva` (lo que recibe el service). */
export function altaValuesToPropiedadNueva(valores: AltaValues): PropiedadNueva {
  const principal = Math.max(
    0,
    valores.photos.findIndex((foto) => foto.id === valores.mainPhotoId),
  )
  return {
    type: valores.type ?? 'departamento',
    street: valores.street ?? '',
    streetNumber: valores.streetNumber ?? 0,
    floor: valores.floor?.trim() || null,
    unit: valores.unit?.trim() || null,
    neighborhoodSlug: valores.neighborhoodSlug ?? '',
    city: valores.city,
    province: valores.province,
    rooms: valores.rooms,
    bedrooms: valores.bedrooms,
    bathrooms: valores.bathrooms,
    ageYears: valores.ageYears ?? null,
    totalAreaM2: valores.totalAreaM2 ?? 0,
    coveredAreaM2: valores.coveredAreaM2 ?? 0,
    characteristics: valores.characteristics,
    description: valores.description ?? '',
    status: valores.status ?? 'pausada',
    availableFrom: valores.availableFrom ?? null,
    photos: valores.photos,
    mainPhotoIndex: principal,
    priceMonthly: valores.priceMonthly ?? 0,
    expenses: valores.expenses ?? 0,
    dailyInterestPct: valores.dailyInterestPct || null,
    graceDays: valores.dailyInterestPct ? (valores.graceDays ?? 0) : null,
    paymentMethods: valores.paymentMethods,
    adjustmentIndex: valores.adjustmentIndex ?? null,
    adjustmentEveryMonths: valores.adjustmentEveryMonths ?? null,
    depositMonths: valores.depositMonths ?? null,
    contractMonths: valores.contractMonths ?? null,
  }
}

/**
 * Inversa de {@link altaValuesToPropiedadNueva}: lo guardado → los valores
 * con que arranca el formulario de edición (US-03). La foto principal pasa
 * de índice a id (así la maneja `FotosField`).
 */
export function propiedadNuevaToAltaValues(propiedad: PropiedadNueva): AltaValues {
  return {
    type: propiedad.type,
    street: propiedad.street,
    streetNumber: propiedad.streetNumber,
    floor: propiedad.floor ?? undefined,
    unit: propiedad.unit ?? undefined,
    neighborhoodSlug: propiedad.neighborhoodSlug,
    city: propiedad.city,
    province: propiedad.province,
    rooms: propiedad.rooms,
    bedrooms: propiedad.bedrooms,
    bathrooms: propiedad.bathrooms,
    ageYears: propiedad.ageYears,
    totalAreaM2: propiedad.totalAreaM2,
    coveredAreaM2: propiedad.coveredAreaM2,
    characteristics: propiedad.characteristics,
    description: propiedad.description,
    status: propiedad.status,
    availableFrom: propiedad.availableFrom,
    photos: propiedad.photos,
    mainPhotoId: propiedad.photos[propiedad.mainPhotoIndex]?.id ?? propiedad.photos[0]?.id ?? null,
    priceMonthly: propiedad.priceMonthly,
    expenses: propiedad.expenses,
    dailyInterestPct: propiedad.dailyInterestPct,
    graceDays: propiedad.graceDays,
    paymentMethods: propiedad.paymentMethods,
    adjustmentEveryMonths: propiedad.adjustmentEveryMonths,
    adjustmentIndex: propiedad.adjustmentIndex,
    depositMonths: propiedad.depositMonths,
    contractMonths: propiedad.contractMonths,
  }
}

/** Valor comparable de un campo: vacío (`undefined`, `null`, `''`) cuenta igual. */
function comparable(valor: unknown): string {
  return valor === undefined || valor === null || valor === '' ? '' : JSON.stringify(valor)
}

/**
 * Cuántos campos del formulario cambiaron respecto de lo guardado
 * (Detalle de propiedad del locador · 06: "Cambios sin guardar: N"). Las
 * fotos cuentan como un campo, y la portada como otro.
 */
export function contarCambios(original: AltaValues, actual: AltaValues): number {
  const campos = new Set([...Object.keys(original), ...Object.keys(actual)]) as Set<keyof AltaValues>
  let cambios = 0
  campos.forEach((campo) => {
    if (comparable(original[campo]) !== comparable(actual[campo])) cambios += 1
  })
  return cambios
}

/** Errores de antd → resumen del formulario. */
export function erroresDeFormulario(errorFields: { name: (string | number)[]; errors: string[] }[]): ErrorDeCampo[] {
  return errorFields
    .filter((campo) => campo.errors.length > 0)
    .map((campo) => {
      const name = campo.name[0] as keyof AltaValues
      return { name, label: ETIQUETA_CAMPO[name] ?? String(name), message: campo.errors[0] ?? '' }
    })
}

/** `true` si lo que tiró `validateFields` es el error de validación de antd. */
export function esErrorDeValidacion(error: unknown): error is { errorFields: { name: (string | number)[]; errors: string[] }[] } {
  return typeof error === 'object' && error !== null && 'errorFields' in error
}
