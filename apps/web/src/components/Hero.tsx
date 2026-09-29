/**
 * Hero.tsx — primer bloque de la landing: titular, CTAs y buscador.
 *
 * Diseño: landing del origen, con paridad visual verificada.
 * Quién lo usa: `Landing.tsx`.
 */
import { Button } from 'antd'
import type { FilterState } from '@rentar/shared-types'
import type { OpcionBarrio } from '@/lib/catalogs/neighborhoods'
import ProcessLoopMotif from './ProcessLoopMotif'
import SearchBar from './SearchBar'
import styles from './Hero.module.css'

/** Props de {@link Hero}. */
interface HeroProps {
  /** Estado actual de los filtros de búsqueda, delegado a `SearchBar`. */
  filters: FilterState
  /** Notifica un cambio de filtros hacia el estado de `Landing`. */
  onChange: (filters: FilterState) => void
  /** Cantidad de propiedades que matchean los filtros actuales. */
  resultCount: number
  /** Opciones del filtro de zona (ver `SearchBar`); por defecto, el catálogo. */
  neighborhoodOptions?: readonly OpcionBarrio[]
}

/**
 * Sección de apertura de la landing: headline, CTAs principales, el motivo
 * animado del proceso (`ProcessLoopMotif`) y el buscador (`SearchBar`),
 * que se superpone al borde inferior del hero con margen negativo para leerse
 * como una sola pieza con la sección siguiente.
 */
export default function Hero({ filters, onChange, resultCount, neighborhoodOptions }: HeroProps) {
  return (
    <section id="inicio" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div>
            <h1 className={styles.title}>Alquilá directo con el dueño, sin inmobiliaria</h1>
            <p className={styles.subtitle}>
              Buscá propiedades publicadas por sus propios dueños en Córdoba, contratá a
              distancia con firma electrónica y llevá un registro claro de pagos y ajustes.
            </p>
            <p className={styles.pilot}>Piloto en Córdoba Capital</p>
            <div className={styles.ctaRow}>
              <Button type="primary" size="large" href="#buscar" data-testid="hero-search-cta">
                Buscar propiedades
              </Button>
              <Button
                size="large"
                href="#como-funciona"
                className={styles.ghostButton}
                data-testid="hero-how-it-works-cta"
              >
                Ver cómo funciona
              </Button>
            </div>
          </div>

          <ProcessLoopMotif className={styles.motif} />
        </div>
      </div>

      <div className={styles.searchWrap}>
        <SearchBar filters={filters} onChange={onChange} resultCount={resultCount} neighborhoodOptions={neighborhoodOptions} />
      </div>
    </section>
  )
}
