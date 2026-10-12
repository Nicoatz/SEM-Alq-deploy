/**
 * busqueda.ts — filtrar, ordenar y paginar propiedades de `/buscar` (US-34).
 *
 * Qué es: la lógica de búsqueda, en funciones puras (sin React ni fetch).
 * La usan las dos ramas del service: la mock y, por ahora, también la real.
 * `GET /api/v1/inmuebles/disponibles` ya filtra, ordena y pagina desde ce677a4
 * (29/09), pero `/buscar` todavía no le manda la búsqueda (ver el TODO(backend)
 * de `propiedades.service.ts#buscarPropiedades`).
 * Este archivo documenta exactamente qué tiene que hacer el back con cada filtro.
 *
 * Quién lo usa: `services/propiedades.service.ts` y `/buscar` (para contar en
 * vivo "Ver N propiedades" y armar los chips).
 */
import type { BusquedaFiltros, OrdenBusqueda, Paginado, PropiedadResumen, UbicacionOpciones } from '@rentar/shared-types'

// ─── Constantes ─────────────────────────────────────────────────────────

/** US-34: "se debe paginar las propiedades cuando haya más de 10 resultados". */
export const PAGE_SIZE = 10

/**
 * Ubicación preseleccionada al entrar (diseño: "el piloto arranca con Córdoba
 * / Córdoba Capital preseleccionados").
 */
export const UBICACION_PILOTO = { province: 'Córdoba', city: 'Córdoba Capital' } as const

/** Filtros sin nada elegido, salvo la ubicación del piloto. */
export const FILTROS_INICIALES: BusquedaFiltros = {
  province: UBICACION_PILOTO.province,
  city: UBICACION_PILOTO.city,
  neighborhoodSlugs: [],
  minPrice: null,
  maxPrice: null,
  types: [],
  bedrooms: [],
  rooms: [],
  minAreaM2: null,
  maxAreaM2: null,
  characteristics: [],
  adjustmentIndex: null,
}

/** Opciones de orden, en el orden en que aparecen en el selector. */
export const ORDEN_OPCIONES: { value: OrdenBusqueda; label: string }[] = [
  // "Quitar el orden" (US-34) = volver a esta opción.
  { value: 'predeterminado', label: 'Sin orden' },
  { value: 'precio_asc', label: 'Menor precio' },
  { value: 'precio_desc', label: 'Mayor precio' },
  { value: 'dormitorios_desc', label: 'Más habitaciones' },
  { value: 'm2_desc', label: 'Más metros cuadrados' },
  { value: 'recientes', label: 'Más recientes' },
]

// ─── Filtrar ────────────────────────────────────────────────────────────

/**
 * `true` si `valor` cumple una selección múltiple de cantidades
 * (dormitorios o ambientes). Lista vacía = cualquiera; el 4 es "4 o más".
 */
function cumpleCantidad(valor: number, elegidas: number[]): boolean {
  if (elegidas.length === 0) return true
  return elegidas.some((cantidad) => (cantidad >= 4 ? valor >= 4 : valor === cantidad))
}

/**
 * `true` si la propiedad cumple TODOS los filtros (US-34: "solo se muestren
 * las propiedades que cumplan con todos los criterios seleccionados").
 * El tipo se compara con el campo `type`, nunca con el título.
 */
export function cumpleFiltros(propiedad: PropiedadResumen, filtros: BusquedaFiltros): boolean {
  if (filtros.province && propiedad.province !== filtros.province) return false
  if (filtros.city && propiedad.city !== filtros.city) return false
  if (filtros.neighborhoodSlugs.length > 0 && !filtros.neighborhoodSlugs.includes(propiedad.neighborhoodSlug)) return false
  if (filtros.minPrice !== null && propiedad.priceMonthly < filtros.minPrice) return false
  if (filtros.maxPrice !== null && propiedad.priceMonthly > filtros.maxPrice) return false
  if (filtros.types.length > 0 && !filtros.types.includes(propiedad.type)) return false
  if (!cumpleCantidad(propiedad.bedrooms, filtros.bedrooms)) return false
  if (!cumpleCantidad(propiedad.rooms, filtros.rooms)) return false
  if (filtros.minAreaM2 !== null && propiedad.areaM2 < filtros.minAreaM2) return false
  if (filtros.maxAreaM2 !== null && propiedad.areaM2 > filtros.maxAreaM2) return false
  if (!filtros.characteristics.every((caracteristica) => propiedad.characteristics.includes(caracteristica))) return false
  if (filtros.adjustmentIndex !== null && propiedad.adjustmentIndex !== filtros.adjustmentIndex) return false
  return true
}

// ─── Ordenar ────────────────────────────────────────────────────────────

/**
 * Devuelve una copia ordenada. `predeterminado` deja el orden original
 * (US-34: "quitar el ordenamiento y que vuelvan a mostrarse en el orden
 * correspondiente"). Los empates se desempatan por id, para que el orden sea
 * siempre el mismo entre una página y la siguiente.
 */
export function ordenar(propiedades: PropiedadResumen[], orden: OrdenBusqueda): PropiedadResumen[] {
  if (orden === 'predeterminado') return [...propiedades]
  const comparar: Record<Exclude<OrdenBusqueda, 'predeterminado'>, (a: PropiedadResumen, b: PropiedadResumen) => number> = {
    precio_asc: (a, b) => a.priceMonthly - b.priceMonthly,
    precio_desc: (a, b) => b.priceMonthly - a.priceMonthly,
    dormitorios_desc: (a, b) => b.bedrooms - a.bedrooms,
    m2_desc: (a, b) => b.areaM2 - a.areaM2,
    recientes: (a, b) => b.publishedAt.localeCompare(a.publishedAt),
  }
  return [...propiedades].sort((a, b) => comparar[orden](a, b) || a.id.localeCompare(b.id))
}

// ─── Paginar ────────────────────────────────────────────────────────────

/** Página `pagina` (desde 1). Si la página no existe (filtraron de más), devuelve la última. */
export function paginar<T>(items: T[], pagina: number, pageSize = PAGE_SIZE): Paginado<T> {
  const ultima = Math.max(1, Math.ceil(items.length / pageSize))
  const page = Math.min(Math.max(1, pagina), ultima)
  return { items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: items.length }
}

/** Filtra, ordena y pagina en un solo paso. */
export function buscarEnLista(
  propiedades: PropiedadResumen[],
  filtros: BusquedaFiltros,
  orden: OrdenBusqueda,
  pagina: number,
): Paginado<PropiedadResumen> {
  return paginar(ordenar(propiedades.filter((propiedad) => cumpleFiltros(propiedad, filtros)), orden), pagina)
}

// ─── Ubicaciones ────────────────────────────────────────────────────────

/**
 * Provincias → ciudades → barrios que aparecen en las propiedades, ordenados
 * alfabéticamente. Así los filtros de ubicación solo ofrecen lugares con
 * publicaciones.
 */
export function ubicacionesDe(propiedades: PropiedadResumen[]): UbicacionOpciones {
  const provinces = new Map<string, Map<string, Map<string, string>>>()
  for (const propiedad of propiedades) {
    const cities = provinces.get(propiedad.province) ?? new Map<string, Map<string, string>>()
    const neighborhoods = cities.get(propiedad.city) ?? new Map<string, string>()
    if (propiedad.neighborhoodSlug) neighborhoods.set(propiedad.neighborhoodSlug, propiedad.neighborhoodName)
    cities.set(propiedad.city, neighborhoods)
    provinces.set(propiedad.province, cities)
  }
  const porNombre = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'es')
  return {
    provinces: [...provinces.entries()]
      .map(([name, cities]) => ({
        name,
        cities: [...cities.entries()]
          .map(([cityName, neighborhoods]) => ({
            name: cityName,
            neighborhoods: [...neighborhoods.entries()].map(([slug, label]) => ({ slug, name: label })).sort(porNombre),
          }))
          .sort(porNombre),
      }))
      .sort(porNombre),
  }
}
