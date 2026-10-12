/**
 * busquedaParams.ts — filtros, orden y página de `/buscar` en la URL.
 *
 * Qué es: la traducción entre el estado de la búsqueda y los query params.
 * Así "atrás" del navegador, recargar o compartir el link mantienen la
 * búsqueda. Los nombres de los params son los mismos que se proponen para
 * `GET /api/v1/inmuebles/disponibles` (ver `docs/api-endpoints.md`).
 *
 * | Param | Ejemplo | Filtro |
 * |---|---|---|
 * | `provincia`, `ciudad` | `Córdoba`, `Córdoba Capital` | ubicación (`todas` = cualquiera) |
 * | `barrio` (se repite) | `guemes` | barrios |
 * | `precioMin`, `precioMax` | `400000` | precio mensual |
 * | `tipo` (se repite) | `departamento` | tipología |
 * | `dorm`, `amb` (se repiten) | `2`, `4` (= 4 o más) | dormitorios, ambientes |
 * | `m2Min`, `m2Max` | `40` | superficie total |
 * | `tag` (se repite) | `mascotas` | características |
 * | `indice` | `ICL` | índice de ajuste |
 * | `orden` | `precio_asc` | orden |
 * | `pagina` | `2` | página (desde 1) |
 *
 * Quién lo usa: `components/buscar/BuscarPropiedades.tsx`,
 * `services/propiedades.service.ts` (rama real, para mandar los filtros al back),
 * el buscador de la landing (`lib/search/buscadorLanding.ts`) y el detalle
 * de la propiedad (`components/detalle-propiedad/`, links a `/buscar?barrio=`).
 */
import type { AdjustmentIndex, BusquedaFiltros, CharacteristicKey, OrdenBusqueda, PropertyType } from '@rentar/shared-types'
import { FILTROS_INICIALES, ORDEN_OPCIONES } from './busqueda'

const TIPOS: PropertyType[] = ['departamento', 'casa', 'ph', 'monoambiente']
const INDICES: AdjustmentIndex[] = ['IPC', 'ICL']
const CARACTERISTICAS: CharacteristicKey[] = ['amoblado', 'mascotas', 'cochera', 'balcon', 'apto-profesional']

/** Valor de `provincia`/`ciudad` que significa "cualquiera" (sin el param, vale la del piloto). */
const TODAS = 'todas'

/** Estado completo de la búsqueda, tal como vive en la URL. */
export interface EstadoBusqueda {
  filtros: BusquedaFiltros
  orden: OrdenBusqueda
  pagina: number
}

// ─── Lectura ────────────────────────────────────────────────────────────

/** Número positivo del param, o `null` si no está o no es un número válido. */
function numero(params: URLSearchParams, key: string): number | null {
  const valor = Number(params.get(key))
  return params.has(key) && Number.isFinite(valor) && valor > 0 ? valor : null
}

/** Lista de enteros de 1 a 4 (dormitorios, ambientes). */
function cantidades(params: URLSearchParams, key: string): number[] {
  return [...new Set(params.getAll(key).map(Number))].filter((n) => Number.isInteger(n) && n >= 1 && n <= 4).sort()
}

/** Lista de valores permitidos; ignora cualquier otro (un link editado a mano no rompe la página). */
function permitidos<T extends string>(params: URLSearchParams, key: string, validos: readonly T[]): T[] {
  return [...new Set(params.getAll(key))].filter((valor): valor is T => (validos as readonly string[]).includes(valor))
}

/**
 * Lee la búsqueda de los query params. Lo que falte o no sea válido queda en su valor inicial.
 *
 * NOTA: un param vacío (`barrio=`, `provincia=`) cuenta como si no estuviera.
 * Lo manda el buscador de la landing cuando se usa sin JS: un `<form>` nativo
 * envía todos sus campos, también los que quedaron en "Todos". Sin este
 * filtro, `barrio=` buscaba el barrio "" y no encontraba nada.
 */
export function leerBusqueda(params: URLSearchParams): EstadoBusqueda {
  const provincia = params.get('provincia') || null
  const ciudad = params.get('ciudad') || null
  const orden = params.get('orden')
  const indice = params.get('indice')
  return {
    filtros: {
      province: provincia === TODAS ? null : (provincia ?? FILTROS_INICIALES.province),
      city: ciudad === TODAS ? null : (ciudad ?? (provincia && provincia !== FILTROS_INICIALES.province ? null : FILTROS_INICIALES.city)),
      neighborhoodSlugs: [...new Set(params.getAll('barrio'))].filter(Boolean),
      minPrice: numero(params, 'precioMin'),
      maxPrice: numero(params, 'precioMax'),
      types: permitidos(params, 'tipo', TIPOS),
      bedrooms: cantidades(params, 'dorm'),
      rooms: cantidades(params, 'amb'),
      minAreaM2: numero(params, 'm2Min'),
      maxAreaM2: numero(params, 'm2Max'),
      characteristics: permitidos(params, 'tag', CARACTERISTICAS),
      adjustmentIndex: INDICES.includes(indice as AdjustmentIndex) ? (indice as AdjustmentIndex) : null,
    },
    orden: ORDEN_OPCIONES.some((opcion) => opcion.value === orden) ? (orden as OrdenBusqueda) : 'predeterminado',
    pagina: Math.max(1, Math.floor(numero(params, 'pagina') ?? 1)),
  }
}

// ─── Escritura ──────────────────────────────────────────────────────────

/**
 * Arma los query params. Solo escribe lo que difiere del estado inicial,
 * así la URL de la búsqueda "vacía" es simplemente `/buscar`.
 */
export function escribirBusqueda({ filtros, orden, pagina }: EstadoBusqueda): URLSearchParams {
  const params = new URLSearchParams()
  if (filtros.province !== FILTROS_INICIALES.province) params.set('provincia', filtros.province ?? TODAS)
  if (filtros.city !== FILTROS_INICIALES.city) params.set('ciudad', filtros.city ?? TODAS)
  filtros.neighborhoodSlugs.forEach((slug) => params.append('barrio', slug))
  if (filtros.minPrice !== null) params.set('precioMin', String(filtros.minPrice))
  if (filtros.maxPrice !== null) params.set('precioMax', String(filtros.maxPrice))
  filtros.types.forEach((tipo) => params.append('tipo', tipo))
  filtros.bedrooms.forEach((cantidad) => params.append('dorm', String(cantidad)))
  filtros.rooms.forEach((cantidad) => params.append('amb', String(cantidad)))
  if (filtros.minAreaM2 !== null) params.set('m2Min', String(filtros.minAreaM2))
  if (filtros.maxAreaM2 !== null) params.set('m2Max', String(filtros.maxAreaM2))
  filtros.characteristics.forEach((tag) => params.append('tag', tag))
  if (filtros.adjustmentIndex) params.set('indice', filtros.adjustmentIndex)
  if (orden !== 'predeterminado') params.set('orden', orden)
  if (pagina > 1) params.set('pagina', String(pagina))
  return params
}

/**
 * `/buscar` filtrado por un barrio (`/buscar?barrio=guemes`), o `/buscar` si
 * no hay barrio. Lo usan el detalle de la propiedad (US-41: "Ver propiedades
 * en Güemes", migas) y la pantalla de éxito de la solicitud (US-35: "Seguir
 * buscando").
 */
export function hrefBuscarEnBarrio(neighborhoodSlug: string | null | undefined): string {
  if (!neighborhoodSlug) return '/buscar'
  const params = escribirBusqueda({
    filtros: { ...FILTROS_INICIALES, neighborhoodSlugs: [neighborhoodSlug] },
    orden: 'predeterminado',
    pagina: 1,
  })
  return `/buscar?${params.toString()}`
}
