/**
 * catalogs/characteristics.ts — características opcionales de una propiedad.
 *
 * Qué es: las opciones de "tags" de US-01 (y del filtro de US-34), con su
 * texto visible. Es un catálogo, no datos de prueba.
 * TODO(backend): hoy el back tiene la tabla `tag_inmueble`; la equivalencia
 * id ↔ clave vive en `services/adapters/propiedad.adapter.ts`.
 *
 * Quién lo usa: el buscador de la landing (`lib/search/buscadorLanding.ts`), `/buscar`, el alta y la edición.
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
 * Las características que se pueden marcar al publicar (US-01) y al editar
 * (US-03): sin "Apto profesional".
 * NOTA: ese tag no existe en `tags_inmueble`; en modo real, el alta lo
 * descartaba sin avisar (`propiedad.adapter.ts#tagIdFromCharacteristic` da
 * `null`) y la edición no lo puede guardar. Se vuelve a ofrecer cuando la base
 * lo tenga. TODO(db): crear el tag "Apto profesional" (HANDOFF §10).
 * Las propiedades del elenco mock que ya lo tienen lo conservan (ver
 * `components/alta/CamposAlta.tsx#CaracteristicasField`).
 */
export const characteristicOptionsCarga: CharacteristicOption[] = characteristicOptions.filter((option) => option.key !== 'apto-profesional')

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
