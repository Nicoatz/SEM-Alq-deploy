/**
 * titulo.ts — título de una publicación cuando el back no manda uno.
 *
 * Qué es: el back no guarda un título de la publicación, así que el front lo
 * arma con tipo + dormitorios + barrio ("Departamento de 1 dormitorio en
 * Nueva Córdoba"). Vive en un solo lugar para que la tarjeta de `/buscar`
 * (US-34) y el detalle (US-41) digan lo mismo de la misma propiedad (la
 * tarjeta, sin el barrio: ver `OpcionesTitulo.conBarrio`).
 *
 * NOTA de privacidad: el título nunca lleva la dirección. Se ve en la
 * tarjeta, en las migas y en el subtítulo del detalle, y la zona pública no
 * muestra la altura ni el piso (ver `direccion.ts`).
 * TODO(backend): el back no guarda un título de la publicación.
 *
 * Quién lo usa: `propiedad.adapter.ts` (rama real de `/inmuebles/disponibles`
 * y de `/inmuebles/disponibles/:id`).
 */
import type { PropertyType } from '@rentar/shared-types'
import { PROPERTY_TYPE_LABEL } from '@/lib/catalogs/propiedad'

/** Lo que hace falta para armar el título. */
interface DatosTitulo {
  type: PropertyType
  bedrooms: number
  /** Nombre del barrio; vacío si no se conoce (el título va sin "en …"). */
  neighborhoodName: string
}

/** Opciones de {@link tituloDePublicacion}. */
interface OpcionesTitulo {
  /**
   * Si el título termina con "en <barrio>". Por defecto `true`.
   *
   * NOTA: existe por la tarjeta de `/buscar` (US-34), que ya muestra
   * "barrio · título": con el barrio dentro del título diría "Nueva Córdoba ·
   * Departamento de 1 dormitorio en Nueva Córdoba". La tarjeta lo pide con
   * `conBarrio: false` y el detalle (US-41), que no muestra el barrio al
   * lado, con el valor por defecto. Las dos variantes salen de la misma base
   * (tipo + dormitorios), así que la tarjeta y el detalle no se separan.
   */
  conBarrio?: boolean
}

/**
 * Título de una publicación: tipo + dormitorios + barrio.
 * Ej.: "Departamento de 1 dormitorio en Nueva Córdoba", "Casa de 2
 * dormitorios en Güemes", "Monoambiente en Centro" (un monoambiente no
 * nombra dormitorios), "PH de 2 dormitorios" (sin barrio conocido o con
 * `conBarrio: false`).
 */
export function tituloDePublicacion({ type, bedrooms, neighborhoodName }: DatosTitulo, { conBarrio = true }: OpcionesTitulo = {}): string {
  const tipo = PROPERTY_TYPE_LABEL[type]
  const base = type === 'monoambiente' ? tipo : `${tipo} de ${bedrooms} ${bedrooms === 1 ? 'dormitorio' : 'dormitorios'}`
  return conBarrio && neighborhoodName ? `${base} en ${neighborhoodName}` : base
}
