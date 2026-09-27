/**
 * filters.ts — filtros, orden y paginación de los listados del frontend.
 *
 * Qué es: TIPOS DE VISTA DEL FRONT. Los services los traducen a los query
 * params del back (ver `docs/api-endpoints.md`); lo que el back todavía no
 * puede filtrar se resuelve del lado del cliente.
 *
 * Quién lo usa: la landing (`FilterState`), `/buscar` (US-34) y
 * `/panel/propiedades` (US-02).
 */
import type { AdjustmentIndex, CharacteristicKey, PropertyType } from './propiedad'

/** Cantidad de dormitorios filtrable; `3` se interpreta como "3 o más". */
export type BedroomsFilter = number | 'todos'

/** Estado de los filtros de búsqueda de la landing (barrio, precio, tipología, dormitorios, características). */
export interface FilterState {
  neighborhoodSlug: string
  minPrice: number
  maxPrice: number
  type: PropertyType | 'todos'
  bedrooms: BedroomsFilter
  characteristics: CharacteristicKey[]
}

/**
 * Filtros de `/buscar` (US-34: barrio, precio mensual, tipo, dormitorios,
 * ambientes, superficie, tags e índice de ajuste), tal como los arma la
 * barra lateral del diseño ("Búsqueda de propiedades" · 01).
 *
 * Criterio de las listas: vacía = "todos" (no filtra). Dormitorios y
 * ambientes son de selección múltiple en el diseño; el `4` significa "4 o más".
 * `null` en un número = sin límite.
 *
 * En la URL se guardan como query params (ver `apps/web/src/lib/search/busquedaParams.ts`).
 */
export interface BusquedaFiltros {
  /** Provincia (selección única). `null` = cualquiera. */
  province: string | null
  /** Ciudad de esa provincia (selección única). `null` = cualquiera. */
  city: string | null
  /** Barrios de la ciudad elegida (selección múltiple). */
  neighborhoodSlugs: string[]
  minPrice: number | null
  maxPrice: number | null
  types: PropertyType[]
  bedrooms: number[]
  rooms: number[]
  /** Superficie total en m². */
  minAreaM2: number | null
  maxAreaM2: number | null
  /** Hay que cumplir todas las elegidas. */
  characteristics: CharacteristicKey[]
  /** `null` = cualquiera. */
  adjustmentIndex: AdjustmentIndex | null
}

/**
 * Opciones de ubicación para los filtros, sacadas de las propiedades
 * publicadas (así el filtro nunca ofrece un lugar sin resultados).
 */
export interface UbicacionOpciones {
  provinces: Array<{
    name: string
    cities: Array<{ name: string; neighborhoods: Array<{ slug: string; name: string }> }>
  }>
}

/**
 * Orden de `/buscar` (US-34: precio, cantidad de habitaciones, m²; más
 * recientes lo pide el diseño). `predeterminado` = sin orden aplicado
 * ("quitar el orden" vuelve a este valor).
 */
export type OrdenBusqueda =
  | 'predeterminado'
  | 'precio_asc'
  | 'precio_desc'
  | 'dormitorios_desc'
  | 'm2_desc'
  | 'recientes'

/** Una página de resultados (US-34: paginar cuando hay más de 10). */
export interface Paginado<T> {
  items: T[]
  /** Página actual, empezando en 1. */
  page: number
  pageSize: number
  /** Total de resultados en todas las páginas. */
  total: number
}

/**
 * Pestaña de estado de `/panel/propiedades` (US-02: "filtrar por estado de
 * publicación"). `alquilada` incluye las alquiladas con fecha de
 * disponibilidad (`alquilada_publicada`): siguen alquiladas.
 */
export type EstadoFiltroMisPropiedades = 'todas' | 'publicada' | 'alquilada' | 'pausada'

/** Filtro de reclamos de `/panel/propiedades` (US-02: "si posee reclamos"). */
export type ReclamosFiltro = 'todas' | 'con_reclamos' | 'sin_reclamos'

/** Orden de `/panel/propiedades` ("Ordenar: Más recientes" del diseño). */
export type OrdenMisPropiedades = 'recientes' | 'precio_desc' | 'precio_asc' | 'direccion'

/**
 * Filtros de `/panel/propiedades` (US-02): barrio (solo los de las
 * propiedades del locador), tipo, estado de publicación y reclamos, más la
 * búsqueda por dirección o locatario del diseño.
 */
export interface MisPropiedadesFiltros {
  /** Texto libre: busca en la dirección y en el nombre del locatario. */
  text: string
  neighborhoodSlug: string | 'todos'
  type: PropertyType | 'todos'
  status: EstadoFiltroMisPropiedades
  claims: ReclamosFiltro
}
