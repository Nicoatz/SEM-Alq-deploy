/**
 * buscadorLanding.ts — opciones del buscador de la landing y el link a `/buscar`.
 *
 * Qué es: lo que `HeroSearch` (de `@rentar/ui`) necesita de `apps/web`: los
 * barrios, los montos de "Desde"/"Hasta", las características, la ayuda de
 * cada índice y cómo convertir lo elegido en la URL de `/buscar`.
 * Cubre: US-34 Consultar propiedades a alquilar (la landing lleva a `/buscar`
 * con los filtros aplicados).
 * Quién lo usa: `components/landing/BuscadorLanding.tsx` y el catálogo `/design-system`.
 */
import type { AdjustmentIndex, CharacteristicOption } from '@rentar/shared-types'
import type { HeroSearchValues } from '@rentar/ui'
import { characteristicOptions } from '@/lib/catalogs/characteristics'
import { neighborhoods } from '@/lib/catalogs/neighborhoods'
import { INDICE_INFO } from '@/lib/catalogs/propiedad'
import { FILTROS_INICIALES } from './busqueda'
import { escribirBusqueda } from './busquedaParams'

/**
 * Barrios del select "Zona": los 6 del piloto.
 * NOTA: no se suman los barrios que traen los datos (`barriosConDatos`): la
 * landing ya no trae todas las propiedades (solo las 6 recientes). Los
 * barrios cargados como texto libre (ej. "Alberdi") se encuentran en `/buscar`.
 */
export const BARRIOS_BUSCADOR: readonly { slug: string; name: string }[] = neighborhoods.map(({ slug, name }) => ({ slug, name }))

/**
 * Montos de "Desde" y "Hasta", en pesos (decisión del PO, 01/10/2026): de
 * $ 200.000 a $ 600.000 de a $ 50.000, que es donde está casi todo el piloto,
 * y después $ 700.000, $ 800.000, $ 1.000.000 y $ 1.500.000. "Sin máximo"
 * (no manda `precioMax`) cubre "$ 1.500.000 o más".
 */
export const PRECIOS_BUSCADOR: readonly number[] = [
  200_000, 250_000, 300_000, 350_000, 400_000, 450_000, 500_000, 550_000, 600_000, 700_000, 800_000, 1_000_000, 1_500_000,
]

/**
 * Características de "Más filtros".
 * NOTA: sin "Apto profesional": el tag no existe en `tags_inmueble` y en
 * modo real siempre daba 0 resultados (decisión del PO, 01/10/2026). En
 * `/buscar` sigue estando.
 */
export const CARACTERISTICAS_BUSCADOR: readonly CharacteristicOption[] = characteristicOptions.filter((option) => option.key !== 'apto-profesional')

/** Primera oración de un texto ("Lo publica el BCRA. Suele…" → "Lo publica el BCRA."). */
function primeraOracion(texto: string): string {
  const fin = texto.indexOf('. ')
  return fin === -1 ? texto : texto.slice(0, fin + 1)
}

/**
 * Ayuda corta de cada índice, para las tarjetas de "Más filtros": la primera
 * oración de la explicación que ya usa el alta (`INDICE_INFO`), así los dos
 * lugares dicen lo mismo.
 */
export const AYUDA_INDICES: Record<AdjustmentIndex, string> = {
  IPC: primeraOracion(INDICE_INFO.IPC.ayuda),
  ICL: primeraOracion(INDICE_INFO.ICL.ayuda),
}

/**
 * Link a `/buscar` con lo elegido en el buscador, con el mismo formato que
 * lee `leerBusqueda`. Lo que quedó en "Todos" no se escribe (la URL de una
 * búsqueda sin filtros es simplemente `/buscar`). Un solo valor por campo:
 * la selección múltiple se hace en `/buscar`. Dormitorios y ambientes "4 o
 * más" van como `4`, que en `/buscar` es justamente "4 o más".
 */
export function hrefBuscarDesdeBuscador(valores: HeroSearchValues): string {
  const query = escribirBusqueda({
    filtros: {
      ...FILTROS_INICIALES,
      neighborhoodSlugs: valores.barrio ? [valores.barrio] : [],
      minPrice: valores.precioMin,
      maxPrice: valores.precioMax,
      types: valores.tipo ? [valores.tipo] : [],
      bedrooms: valores.dormitorios ? [valores.dormitorios] : [],
      rooms: valores.ambientes ? [valores.ambientes] : [],
      minAreaM2: valores.m2Min,
      maxAreaM2: valores.m2Max,
      characteristics: valores.caracteristicas,
      adjustmentIndex: valores.indice,
    },
    orden: 'predeterminado',
    pagina: 1,
  }).toString()
  return query ? `/buscar?${query}` : '/buscar'
}
