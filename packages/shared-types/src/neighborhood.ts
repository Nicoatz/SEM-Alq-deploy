/**
 * neighborhood.ts — barrios del piloto (Córdoba Capital).
 *
 * Qué es: TIPO DE VISTA DEL FRONT. El back guarda el barrio como texto libre
 * (`inmueble.barrio`); el front lo traduce a slug + nombre en
 * `propiedad.adapter.ts#barrioDe`.
 * TODO(db): un catálogo de barrios en la base (id + nombre), ver
 * `docs/HANDOFF-BACKEND.md`, "Brechas por US".
 *
 * Quién lo usa: los filtros de la landing y de `/buscar` (US-34), el filtro
 * por barrio de `/panel/propiedades` (US-02) y el alta (US-01).
 */

/** Nivel de demanda relativo del barrio; dato editorial, no afecta el filtrado. */
export type NeighborhoodTier = 'alta demanda' | 'alternativo'

/** Barrio de Córdoba Capital donde opera el piloto de RentAR. */
export interface Neighborhood {
  slug: string
  name: string
  tier: NeighborhoodTier
}
