/**
 * catalogs/barriosLanding.ts — los 6 barrios del piloto como los presenta la
 * franja "Buscá por barrio" de la landing: una línea de ubicación y una
 * ilustración por barrio.
 *
 * Qué es: contenido fijo (no datos de prueba). Cada línea es un dato
 * verificable de ubicación o una referencia conocida; a propósito no hay
 * precios ni frases sobre seguridad o "la mejor zona" (decisión del PO,
 * 01/10/2026). Las fuentes de cada línea están en el comentario de su barrio.
 * Cubre: sin US en Sprint 0 (contenido de la landing; cada barrio lleva a
 * `/buscar?barrio=<slug>`, US-34).
 * Quién lo usa: `components/landing/BarriosSection.tsx`.
 */
import { neighborhoods } from './neighborhoods'

/** Un barrio de la franja: el del catálogo más su línea y su ilustración. */
export interface BarrioLanding {
  slug: string
  name: string
  /** Una línea: dónde queda o qué referencia conocida tiene. */
  linea: string
  /**
   * Ilustración en `public/` (WebP 4:5; procedencia en `public/landing/IMAGES.md`).
   * `null` muestra un fondo celeste en su lugar.
   */
  imagen: string | null
}

/** La línea de cada barrio, por slug del catálogo. */
const LINEAS: Record<string, string> = {
  // Fuente: Billiken, "Nueva Córdoba: conocé la historia del barrio cordobés"
  // https://billiken.lat/mi-pais/nueva-cordoba-conoce-la-historia-del-barrio-cordobes/
  'nueva-cordoba': 'Al sur del Centro, junto al Parque Sarmiento y la Ciudad Universitaria.',

  // Fuentes: Cadena 3, "Revalorizaron el Paseo de las Artes de barrio Güemes"
  // https://www.cadena3.com/noticia/juntos/revalorizaron-el-paseo-de-las-artes-de-barrio-guemes_271103
  // e InfoNegocios, "Rearmando piezas: cómo viven y sobreviven los más de 150 artesanos de Güemes"
  // https://infonegocios.info/plus/rearmando-piezas-como-viven-y-sobreviven-los-mas-de-150-artesanos-de-gueemes
  guemes: 'Junto a La Cañada, con la feria del Paseo de las Artes los fines de semana.',

  // Fuentes: Expats Argentina, "Córdoba Centro" https://expatsargentina.com/en/neighborhoods/cordoba-centro/
  // y Roomix, "Barrio Centro" https://roomix.ai/barrios/centro-cordoba
  centro: 'El casco histórico, alrededor de la Plaza San Martín y la Catedral.',

  // Fuentes: La Voz, "450 años de Córdoba: la historia de General Paz"
  // https://grupoclarin-la-voz-prod.cdn.arcpublishing.com/cultura/450-anos-de-cordoba-la-historia-de-general-paz-el-barrio-al-que-la-inmigracion-le-dio-personalidad
  // y Cadena 3, "Llaryora inauguró las obras en la Plaza Alberdi de barrio General Paz"
  // https://www.cadena3.com/noticia/sociedad/llaryora-inauguro-las-obras-en-la-plaza-alberdi-de-barrio-general-paz_359191
  'general-paz': 'Al este del Centro, cruzando el Suquía, alrededor de la Plaza Alberdi.',

  // Fuente: Nuestra Ciudad, "Barrio Cofico" https://nuestraciudad.info/portal/Barrio_Cofico
  // ("ubicado al norte del área central de la ciudad de Córdoba" y, con los límites de la
  // Ordenanza Municipal 7874/83 de Nomenclatura de Barrios, "limita con Alta Córdoba e
  // Independencia"). Texto elegido por el PO (01/10/2026).
  cofico: 'Al norte del Centro, junto a Alta Córdoba.',

  // Fuentes: Argentina.travel, "Tren de las Sierras" https://www.argentina.travel/actividades/tren-de-las-sierras
  // y MDZ, "Cómo es el tren que recorre rincones ocultos de Córdoba"
  // https://www.mdzol.com/estilo/2023/8/30/como-es-el-tren-que-recorre-rincones-ocultos-de-cordoba-por-menos-de-100-364663.html
  'alta-cordoba': 'Al norte del Suquía; desde su estación sale el Tren de las Sierras.',
}

/**
 * Ilustración de cada barrio, por slug (aprobadas por el PO el 01/10/2026).
 * Son ilustraciones generadas, no fotos de propiedades: prompts, semilla y
 * modelo en `public/landing/IMAGES.md`.
 */
const IMAGENES: Partial<Record<string, string>> = {
  'nueva-cordoba': '/landing/barrios/nueva-cordoba.webp',
  guemes: '/landing/barrios/guemes.webp',
  centro: '/landing/barrios/centro.webp',
  'general-paz': '/landing/barrios/general-paz.webp',
  cofico: '/landing/barrios/cofico.webp',
  'alta-cordoba': '/landing/barrios/alta-cordoba.webp',
}

/** Los 6 barrios del piloto, en el orden del catálogo. */
export const BARRIOS_LANDING: readonly BarrioLanding[] = neighborhoods.map(({ slug, name }) => ({
  slug,
  name,
  linea: LINEAS[slug] ?? '',
  imagen: IMAGENES[slug] ?? null,
}))
