/**
 * catalogs/characteristics.ts — características opcionales de una propiedad.
 *
 * Qué es: las opciones de "tags" de US-01 (y del filtro de US-34), con su
 * texto visible. Es un catálogo, no datos de prueba.
 * TODO(backend): hoy el back tiene la tabla `tag_inmueble`; la equivalencia
 * id ↔ clave vive en `services/adapters/propiedad.adapter.ts`.
 *
 * Quién lo usa: el buscador de la landing (`lib/search/buscadorLanding.ts`), `/buscar` y el alta.
 */
import type { CharacteristicKey, CharacteristicOption } from '@rentar/shared-types'

/** Las 5 características, en el orden en que se muestran en filtros y en el alta. */
export const characteristicOptions: CharacteristicOption[] = [
  { key: 'amoblado', label: 'Amoblado' },
  { key: 'mascotas', label: 'Acepta mascotas' },
  { key: 'cochera', label: 'Cochera' },
  { key: 'balcon', label: 'Balcón' },
  { key: 'apto-profesional', label: 'Apto profesional' },
]

/**
 * Texto corto de cada característica, para los chips de la tarjeta de
 * `/buscar` (el diseño muestra "Mascotas", no "Acepta mascotas").
 */
export const characteristicShortLabel: Record<CharacteristicKey, string> = {
  amoblado: 'Amoblado',
  mascotas: 'Mascotas',
  cochera: 'Cochera',
  balcon: 'Balcón',
  'apto-profesional': 'Apto profesional',
}
