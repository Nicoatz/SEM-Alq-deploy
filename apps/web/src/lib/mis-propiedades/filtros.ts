/**
 * mis-propiedades/filtros.ts — filtros, orden y conteos de `/panel/propiedades`.
 *
 * Qué es: funciones puras (sin React ni services) que aplican los filtros de
 * US-02 sobre la lista completa de propiedades del locador: estado de
 * publicación (las pestañas), barrio, tipo, reclamos y la búsqueda por
 * dirección o locatario del diseño.
 *
 * Por qué en el cliente: ver la NOTA de
 * `services/propiedades.service.ts#listarMisPropiedades`.
 * Quién lo usa: `components/mis-propiedades/MisPropiedades.tsx`.
 */
import type {
  EstadoFiltroMisPropiedades,
  MisPropiedadesFiltros,
  OrdenMisPropiedades,
  PropiedadLocador,
  ReclamosFiltro,
} from '@rentar/shared-types'

/** Filas por página: el diseño pagina recién a partir de 20 ("No hay paginación con 7 filas"). */
export const MIS_PROPIEDADES_PAGE_SIZE = 20

/** Sin filtros: todas las propiedades, las más recientes primero. */
export const FILTROS_INICIALES: MisPropiedadesFiltros = {
  text: '',
  neighborhoodSlug: 'todos',
  type: 'todos',
  status: 'todas',
  claims: 'todas',
}

/** Pestañas de estado, en el orden del diseño. */
export const PESTANIAS_ESTADO: { value: EstadoFiltroMisPropiedades; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'publicada', label: 'Publicadas' },
  { value: 'alquilada', label: 'Alquiladas' },
  { value: 'pausada', label: 'Pausadas' },
]

/** Opciones del filtro de reclamos (US-02: "si posee reclamos"). */
export const RECLAMOS_OPTIONS: { value: ReclamosFiltro; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'con_reclamos', label: 'Con reclamos' },
  { value: 'sin_reclamos', label: 'Sin reclamos' },
]

/** Opciones de "Ordenar". */
export const ORDEN_OPTIONS: { value: OrdenMisPropiedades; label: string }[] = [
  { value: 'recientes', label: 'Más recientes' },
  { value: 'precio_desc', label: 'Mayor precio' },
  { value: 'precio_asc', label: 'Menor precio' },
  { value: 'direccion', label: 'Dirección (A-Z)' },
]

/** Pasa a minúsculas y saca tildes, para buscar "cordoba" y encontrar "Córdoba". */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** `true` si la propiedad está en la pestaña. "Alquiladas" incluye las alquiladas con fecha de disponibilidad. */
function enPestania(propiedad: PropiedadLocador, estado: EstadoFiltroMisPropiedades): boolean {
  if (estado === 'todas') return true
  if (estado === 'alquilada') return propiedad.status === 'alquilada' || propiedad.status === 'alquilada_publicada'
  return propiedad.status === estado
}

/** `true` si la propiedad pasa todos los filtros MENOS la pestaña de estado. */
function cumpleFiltrosSinEstado(propiedad: PropiedadLocador, filtros: MisPropiedadesFiltros): boolean {
  if (filtros.neighborhoodSlug !== 'todos' && propiedad.neighborhoodSlug !== filtros.neighborhoodSlug) return false
  if (filtros.type !== 'todos' && propiedad.type !== filtros.type) return false
  if (filtros.claims === 'con_reclamos' && !propiedad.hasOpenClaims) return false
  if (filtros.claims === 'sin_reclamos' && propiedad.hasOpenClaims) return false
  const texto = normalizar(filtros.text)
  if (texto && !normalizar(`${propiedad.address} ${propiedad.tenantName ?? ''}`).includes(texto)) return false
  return true
}

/** Ordena una copia de la lista. */
function ordenar(lista: PropiedadLocador[], orden: OrdenMisPropiedades): PropiedadLocador[] {
  const copia = [...lista]
  switch (orden) {
    case 'precio_desc':
      return copia.sort((a, b) => b.priceMonthly - a.priceMonthly)
    case 'precio_asc':
      return copia.sort((a, b) => a.priceMonthly - b.priceMonthly)
    case 'direccion':
      return copia.sort((a, b) => a.address.localeCompare(b.address, 'es'))
    case 'recientes':
    default:
      return copia.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  }
}

/** Aplica pestaña, filtros y orden. */
export function filtrarMisPropiedades(lista: PropiedadLocador[], filtros: MisPropiedadesFiltros, orden: OrdenMisPropiedades): PropiedadLocador[] {
  return ordenar(
    lista.filter((propiedad) => enPestania(propiedad, filtros.status) && cumpleFiltrosSinEstado(propiedad, filtros)),
    orden,
  )
}

/**
 * Contador de cada pestaña: cuántas quedan en esa pestaña con el resto de
 * los filtros aplicados.
 */
export function contarPorPestania(lista: PropiedadLocador[], filtros: MisPropiedadesFiltros): Record<EstadoFiltroMisPropiedades, number> {
  const base = lista.filter((propiedad) => cumpleFiltrosSinEstado(propiedad, filtros))
  return {
    todas: base.length,
    publicada: base.filter((propiedad) => enPestania(propiedad, 'publicada')).length,
    alquilada: base.filter((propiedad) => enPestania(propiedad, 'alquilada')).length,
    pausada: base.filter((propiedad) => enPestania(propiedad, 'pausada')).length,
  }
}

/**
 * Barrios para el filtro: SOLO los de las propiedades del locador (US-02:
 * "solo se deben poder seleccionar barrios que coincidan con las propiedades
 * del locador"), ordenados alfabéticamente.
 */
export function barriosDe(lista: PropiedadLocador[]): { value: string; label: string }[] {
  const porSlug = new Map<string, string>()
  for (const propiedad of lista) {
    if (propiedad.neighborhoodSlug) porSlug.set(propiedad.neighborhoodSlug, propiedad.neighborhoodName)
  }
  return [...porSlug.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

/** Cuántos filtros hay aplicados, sin contar la pestaña (el número del botón "Filtros" en móvil). */
export function cantidadFiltros(filtros: MisPropiedadesFiltros): number {
  return [filtros.neighborhoodSlug !== 'todos', filtros.type !== 'todos', filtros.claims !== 'todas'].filter(Boolean).length
}

/** `true` si hay algo para "Limpiar filtros" (incluida la pestaña y la búsqueda). */
export function hayFiltros(filtros: MisPropiedadesFiltros): boolean {
  return cantidadFiltros(filtros) > 0 || filtros.status !== 'todas' || filtros.text.trim() !== ''
}
