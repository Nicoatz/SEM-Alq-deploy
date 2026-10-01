/**
 * filtrosActivos.ts — los chips de "Filtros activos" de `/buscar`.
 *
 * Qué es: convierte los filtros aplicados en una lista de chips con su texto
 * ("Hasta $ 600.000", "Departamento", "Índice ICL"...) y cómo sacar cada uno.
 * La ubicación (provincia · ciudad) va aparte: se muestra fija, sin ✕.
 * Quién lo usa: `components/buscar/BuscarPropiedades.tsx`.
 */
import type { BusquedaFiltros, CharacteristicOption } from '@rentar/shared-types'
import { PROPERTY_TYPE_LABEL } from '@/lib/catalogs/propiedad'
import { formatARS } from '@rentar/ui/src/utils/formatARS'

/** Un chip removible: su texto y los filtros que quedan si se lo saca. */
export interface ChipFiltro {
  key: string
  label: string
  quitar: (filtros: BusquedaFiltros) => BusquedaFiltros
}

/**
 * "1, 2 y 4+" para una selección de cantidades (llega ordenada).
 *
 * NOTA: 3 y 4+ juntos son "3 o más": así llegaban los links del buscador de
 * la landing anterior (`dorm=3&dorm=4`), que pueden seguir guardados o compartidos.
 */
function listaCantidades(cantidades: number[]): string {
  const tresOMas = cantidades.includes(3) && cantidades.some((n) => n >= 4)
  const textos = tresOMas
    ? [...cantidades.filter((n) => n < 3).map(String), '3 o más']
    : cantidades.map((n) => (n >= 4 ? '4+' : String(n)))
  return textos.length > 1 ? `${textos.slice(0, -1).join(', ')} y ${textos[textos.length - 1]}` : textos[0]
}

/** Arma los chips de los filtros aplicados, en el orden de la barra de filtros. */
export function chipsFiltros(
  filtros: BusquedaFiltros,
  nombreBarrio: (slug: string) => string,
  caracteristicas: CharacteristicOption[],
): ChipFiltro[] {
  const chips: ChipFiltro[] = []

  for (const slug of filtros.neighborhoodSlugs) {
    chips.push({
      key: `barrio-${slug}`,
      label: nombreBarrio(slug),
      quitar: (f) => ({ ...f, neighborhoodSlugs: f.neighborhoodSlugs.filter((s) => s !== slug) }),
    })
  }
  if (filtros.minPrice !== null) {
    chips.push({ key: 'precio-min', label: `Desde ${formatARS(filtros.minPrice)}`, quitar: (f) => ({ ...f, minPrice: null }) })
  }
  if (filtros.maxPrice !== null) {
    chips.push({ key: 'precio-max', label: `Hasta ${formatARS(filtros.maxPrice)}`, quitar: (f) => ({ ...f, maxPrice: null }) })
  }
  for (const tipo of filtros.types) {
    chips.push({ key: `tipo-${tipo}`, label: PROPERTY_TYPE_LABEL[tipo], quitar: (f) => ({ ...f, types: f.types.filter((t) => t !== tipo) }) })
  }
  if (filtros.bedrooms.length > 0) {
    chips.push({ key: 'dorm', label: `${listaCantidades(filtros.bedrooms)} dorm.`, quitar: (f) => ({ ...f, bedrooms: [] }) })
  }
  if (filtros.rooms.length > 0) {
    chips.push({ key: 'amb', label: `${listaCantidades(filtros.rooms)} amb.`, quitar: (f) => ({ ...f, rooms: [] }) })
  }
  if (filtros.minAreaM2 !== null) {
    chips.push({ key: 'm2-min', label: `Desde ${filtros.minAreaM2} m²`, quitar: (f) => ({ ...f, minAreaM2: null }) })
  }
  if (filtros.maxAreaM2 !== null) {
    chips.push({ key: 'm2-max', label: `Hasta ${filtros.maxAreaM2} m²`, quitar: (f) => ({ ...f, maxAreaM2: null }) })
  }
  for (const key of filtros.characteristics) {
    const label = caracteristicas.find((option) => option.key === key)?.label ?? key
    chips.push({ key: `tag-${key}`, label, quitar: (f) => ({ ...f, characteristics: f.characteristics.filter((c) => c !== key) }) })
  }
  if (filtros.adjustmentIndex) {
    chips.push({ key: 'indice', label: `Índice ${filtros.adjustmentIndex}`, quitar: (f) => ({ ...f, adjustmentIndex: null }) })
  }
  return chips
}
