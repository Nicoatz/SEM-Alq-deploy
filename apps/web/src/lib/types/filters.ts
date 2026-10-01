/**
 * lib/types/filters.ts — valores de ejemplo del catálogo `/design-system`.
 *
 * Quién lo usa: el catálogo (ejemplos del slider de precio y de
 * `SearchFilters`). La landing usa `lib/search/buscadorLanding.ts` y
 * `/buscar` tiene sus propios valores en `lib/search/`.
 */
import type { FilterState } from '@rentar/shared-types'

/** Techo del filtro "hasta" con el que arranca el ejemplo del catálogo (diseño). */
export const MAX_PRICE_CEILING = 650000

/** Filtros con los que arranca el ejemplo del catálogo (los del diseño). */
export const defaultFilters: FilterState = {
  neighborhoodSlug: 'nueva-cordoba',
  minPrice: 400000,
  maxPrice: MAX_PRICE_CEILING,
  type: 'todos',
  bedrooms: 'todos',
  characteristics: [],
}
