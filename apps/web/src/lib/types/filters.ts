/**
 * lib/types/filters.ts — valores iniciales y límites de los filtros de la landing.
 *
 * Quién lo usa: la landing (`Landing.tsx`, que se los pasa al Hero y al buscador) y el
 * catálogo `/design-system`. `/buscar` tiene sus propios valores en `lib/search/`.
 */
import type { FilterState } from '@rentar/shared-types'

/** Techo superior del filtro de precio (slider y campo "hasta"). */
export const MAX_PRICE_CEILING = 650000

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
 * Filtros iniciales de la landing según el modo.
 *
 * NOTA: en modo mock arranca con los filtros del diseño (Nueva Córdoba,
 * desde $400.000): el elenco está armado para que ahí se vea la vista
 * previa. Con el back real los datos son otros (hoy, una sola propiedad
 * publicada, en Alberdi, a $360.000) y con esos filtros la landing arrancaba
 * vacía. Por eso, con el back real arranca sin filtros (todos los barrios,
 * sin precio mínimo) y muestra lo que esté publicado (decisión del PO).
 */
export function filtrosInicialesLanding(usarMocks: boolean): FilterState {
  return usarMocks ? defaultFilters : { ...defaultFilters, neighborhoodSlug: 'todos', minPrice: 0 }
}
