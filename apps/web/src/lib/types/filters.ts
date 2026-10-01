/**
 * lib/types/filters.ts — valores iniciales y límites del buscador anterior de la landing (`SearchBar`).
 *
 * Quién lo usa: el catálogo `/design-system` (ejemplos de `SearchBar` y de
 * `SearchFilters`). La landing nueva usa `lib/search/buscadorLanding.ts` y
 * `/buscar` tiene sus propios valores en `lib/search/`.
 */
import type { FilterState } from '@rentar/shared-types'

/** Techo del filtro "hasta" con el que arranca el ejemplo del catálogo (diseño). */
export const MAX_PRICE_CEILING = 650000

/** Rango que cubre el slider de precio de `SearchBar` (mínimo y máximo, en pesos). */
export interface RangoPrecio {
  min: number
  max: number
}

/** Rango del slider: el del diseño. */
export const RANGO_PRECIO_DISENO: RangoPrecio = { min: 400000, max: 1000000 }

/** Paso del slider y de los campos de precio. */
export const PASO_PRECIO = 5000

/** Filtros con los que arranca el ejemplo del catálogo (los del diseño). */
export const defaultFilters: FilterState = {
  neighborhoodSlug: 'nueva-cordoba',
  minPrice: 400000,
  maxPrice: MAX_PRICE_CEILING,
  type: 'todos',
  bedrooms: 'todos',
  characteristics: [],
}
