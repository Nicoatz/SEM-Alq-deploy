/**
 * lib/types/filters.ts — valores iniciales y límites de los filtros de la landing.
 *
 * Quién lo usa: la landing (`Landing.tsx`, que se los pasa al Hero y al buscador) y el
 * catálogo `/design-system`. `/buscar` tiene sus propios valores en `lib/search/`.
 */
import type { FilterState } from '@rentar/shared-types'

/** Techo del filtro "hasta" con el que arranca la landing en modo mock (diseño). */
export const MAX_PRICE_CEILING = 650000

/** Rango que cubre el slider de precio de la landing (mínimo y máximo, en pesos). */
export interface RangoPrecio {
  min: number
  max: number
}

/** Rango del slider en modo mock: el del diseño. */
export const RANGO_PRECIO_DISENO: RangoPrecio = { min: 400000, max: 1000000 }

/** Paso del slider y de los campos de precio. */
export const PASO_PRECIO = 5000

/** Redondeo hacia arriba del máximo real, para que el slider termine en un número "redondo". */
const REDONDEO_MAXIMO = 50000

/** Filtros con los que arranca la landing al cargar (modo mock: los del diseño). */
export const defaultFilters: FilterState = {
  neighborhoodSlug: 'nueva-cordoba',
  minPrice: 400000,
  maxPrice: MAX_PRICE_CEILING,
  type: 'todos',
  bedrooms: 'todos',
  characteristics: [],
}

/**
 * Rango del slider de precio de la landing según el modo.
 *
 * NOTA: en modo mock es el del diseño ($400.000 a $1.000.000). Con el back
 * real, los precios publicados pueden quedar fuera de ese rango (el 29/09
 * había uno de $360.000), así que el slider arranca en 0 y llega hasta el
 * precio más alto publicado, redondeado hacia arriba a $50.000. Así cualquier
 * propiedad publicada entra en el rango.
 */
export function rangoPrecioLanding(usarMocks: boolean, precios: number[]): RangoPrecio {
  if (usarMocks) return RANGO_PRECIO_DISENO
  const maximo = Math.max(0, ...precios)
  return { min: 0, max: Math.max(REDONDEO_MAXIMO, Math.ceil(maximo / REDONDEO_MAXIMO) * REDONDEO_MAXIMO) }
}

/**
 * Filtros iniciales de la landing según el modo.
 *
 * NOTA: en modo mock arranca con los filtros del diseño (Nueva Córdoba,
 * de $400.000 a $650.000): el elenco está armado para que ahí se vea la vista
 * previa. Con el back real los datos son otros y con esos filtros la landing
 * arrancaba vacía. Por eso, con el back real arranca sin filtros: todos los
 * barrios y el precio en todo el rango del slider, o sea, sin tope (decisión
 * del PO, QA del 30/09).
 */
export function filtrosInicialesLanding(usarMocks: boolean, rango: RangoPrecio): FilterState {
  return usarMocks ? defaultFilters : { ...defaultFilters, neighborhoodSlug: 'todos', minPrice: rango.min, maxPrice: rango.max }
}
