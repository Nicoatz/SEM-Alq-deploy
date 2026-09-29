/**
 * catalogs/neighborhoods.ts — barrios de Córdoba Capital del piloto.
 *
 * Qué es: la lista fija de barrios válidos. Es un catálogo (opciones de un
 * filtro o de un select), no datos de prueba: el elenco (`lib/mocks/`) solo
 * usa estos barrios.
 * TODO(db): el back guarda el barrio como texto libre (`inmueble.barrio`).
 * Con un catálogo de barrios en la base, este archivo podría venir de un
 * endpoint (propuesto: `GET /api/v1/catalogos`). Mientras tanto, los filtros
 * suman los barrios que traen los datos (`barriosConDatos`, más abajo).
 *
 * Quién lo usa: el `SearchBar` de la landing, `/buscar` (US-34), el filtro
 * de `/panel/propiedades` (US-02) y el alta (US-01).
 */
import type { Neighborhood } from '@rentar/shared-types'

/** Barrios de Córdoba Capital cubiertos por el piloto. */
export const neighborhoods: Neighborhood[] = [
  { slug: 'nueva-cordoba', name: 'Nueva Córdoba', tier: 'alta demanda' },
  { slug: 'guemes', name: 'Güemes', tier: 'alternativo' },
  { slug: 'centro', name: 'Centro', tier: 'alternativo' },
  { slug: 'general-paz', name: 'General Paz', tier: 'alternativo' },
  { slug: 'cofico', name: 'Cofico', tier: 'alternativo' },
  { slug: 'alta-cordoba', name: 'Alta Córdoba', tier: 'alternativo' },
]

/** Un barrio como opción de filtro (slug + nombre visible). */
export interface OpcionBarrio {
  slug: string
  name: string
}

/**
 * Opciones de barrio para un filtro: el catálogo del piloto más los barrios
 * que aparecen en los datos (con el back real, `inmueble.barrio` es texto
 * libre y puede traer barrios que el catálogo no tiene, como "Alberdi").
 * Sin duplicados (por slug): primero el catálogo, en su orden, y después los
 * de los datos, en orden alfabético. Los que vienen sin slug se ignoran.
 * TODO(db): un catálogo de barrios en la base (id + nombre), para no
 * depender del texto libre ni de esta mezcla.
 */
export function barriosConDatos(desdeDatos: readonly OpcionBarrio[]): OpcionBarrio[] {
  const opciones: OpcionBarrio[] = neighborhoods.map(({ slug, name }) => ({ slug, name }))
  const vistos = new Set(opciones.map((opcion) => opcion.slug))

  const extra: OpcionBarrio[] = []
  for (const barrio of desdeDatos) {
    if (!barrio.slug || vistos.has(barrio.slug)) continue
    vistos.add(barrio.slug)
    extra.push({ slug: barrio.slug, name: barrio.name })
  }
  extra.sort((a, b) => a.name.localeCompare(b.name, 'es'))

  return [...opciones, ...extra]
}
