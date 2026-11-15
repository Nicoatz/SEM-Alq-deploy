/**
 * UbicacionMapa.tsx — el mapa de la sección "Ubicación" del detalle de
 * propiedad (`/propiedad/[id]`): un Google Maps embebido (iframe, sin API
 * key) y el link "Ver ubicación en Google Maps" que abre la misma búsqueda.
 *
 * Cubre: US-41 Consultar detalle de propiedad (numeración de Jira) y la
 * privacidad de la US-35 actualizada (decisión del PO): con sesión, la
 * dirección exacta; sin sesión, la aproximada ("Rondeau al 400").
 * Datos: los recibe por props de `PropiedadDetalle` (`address`,
 * `addressPrecision`, `neighborhoodName`, `city`, `province`).
 * Quién lo usa: `DetallePropiedad.tsx`.
 *
 * NOTA: el mapa nunca muestra más que el texto de la pantalla. La búsqueda
 * se arma solo con `address` tal cual llega del adaptador (que ya es la
 * aproximada sin sesión), sin piso ni depto, más ciudad y provincia.
 * NOTA: con dirección, el barrio NO entra en la búsqueda: Google lo toma
 * como un lugar más y se aleja de la cuadra ("General Paz" lo lleva a la
 * avenida de Buenos Aires; un barrio mal cargado, a otra zona). El barrio
 * solo se usa cuando no hay dirección (barrio + ciudad). La ciudad se
 * normaliza solo para buscar ("Córdoba Capital" → "Córdoba"): la pantalla
 * la sigue mostrando como llega.
 * NOTA: es el embed público de Google (`?output=embed`), sin API key ni
 * dependencias. Si algún día se define una Content-Security-Policy, tiene que
 * permitir `frame-src https://www.google.com`.
 */
import { EnvironmentOutlined } from '@ant-design/icons'
import type { PropiedadDetalle } from '@rentar/shared-types'
import styles from './UbicacionMapa.module.css'

/** Props de {@link UbicacionMapa}. */
export interface UbicacionMapaProps {
  /** Dirección que muestra la pantalla: exacta ("Rondeau 480, PB") o aproximada ("Rondeau al 400"). */
  address: string
  addressPrecision: PropiedadDetalle['addressPrecision']
  neighborhoodName: string
  city: string
  province: string
}

// ─── Texto de búsqueda ───

/**
 * La calle y altura que se le pasa a Google, según la precisión.
 * - Exacta: sin piso ni depto ("Obispo Trejo 1250, 7° B" → "Obispo Trejo
 *   1250"): Google no los entiende y no suman ubicación.
 * - Aproximada: "Rondeau al 400" → "Rondeau 400" (la cuadra que ya dice la
 *   pantalla, en un formato que Google encuentra) y "Calle (primera
 *   cuadra)" → "Calle". Nunca se agrega la altura real.
 */
function calleParaBusqueda(address: string, precision: UbicacionMapaProps['addressPrecision']): string {
  const texto = address.trim()
  if (!texto) return ''
  if (precision === 'exacta') return texto.split(',')[0]?.trim() ?? ''
  return texto
    .replace(/\s*\(primera cuadra\)\s*$/i, '')
    .replace(/\s+al\s+(\d+)\s*$/i, ' $1')
    .trim()
}

/**
 * Ciudad para el texto de búsqueda: "Córdoba Capital" → "Córdoba" (Google no
 * conoce "Capital" como parte del nombre). Lo que se muestra no cambia.
 */
function ciudadParaBusqueda(city: string): string {
  return city.trim().replace(/\s+Capital$/i, '')
}

/**
 * "Rondeau 400, Córdoba, Córdoba, Argentina". Sin dirección, barrio + ciudad
 * ("Güemes, Córdoba, Córdoba, Argentina"). El barrio no entra junto a la
 * dirección: ver la NOTA del encabezado.
 */
export function textoBusquedaMapa({ address, addressPrecision, neighborhoodName, city, province }: UbicacionMapaProps): string {
  const calle = calleParaBusqueda(address, addressPrecision)
  return [calle || neighborhoodName, ciudadParaBusqueda(city), province, 'Argentina']
    .map((parte) => parte?.trim())
    .filter(Boolean)
    .join(', ')
}

// ─── Render ───

/** Mapa embebido de Google con el link para abrirlo en una pestaña nueva (US-41). */
export function UbicacionMapa(props: UbicacionMapaProps) {
  const busqueda = textoBusquedaMapa(props)
  const q = encodeURIComponent(busqueda)
  const zona = [calleParaBusqueda(props.address, props.addressPrecision), props.neighborhoodName, props.city]
    .filter(Boolean)
    .join(', ')
  const titulo = props.addressPrecision === 'exacta' ? `Ubicación: ${zona}` : `Ubicación aproximada: ${zona}`

  return (
    <div className={styles.root}>
      <div className={styles.frame}>
        <iframe
          className={styles.iframe}
          src={`https://www.google.com/maps?q=${q}&output=embed`}
          title={titulo}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          style={{ border: 0 }}
          width="100%"
          height="100%"
          data-testid="detalle-propiedad-mapa"
        />
      </div>
      <a
        className={styles.link}
        href={`https://www.google.com/maps/search/?api=1&query=${q}`}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="detalle-propiedad-mapa-link"
      >
        <EnvironmentOutlined aria-hidden />
        Ver ubicación en Google Maps
      </a>
    </div>
  )
}
