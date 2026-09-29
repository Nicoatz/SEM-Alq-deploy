'use client'

/**
 * Landing.tsx — la página `/`: Hero con buscador, vista previa de propiedades y "Cómo funciona".
 *
 * De dónde saca los datos: `app/(public)/page.tsx` le pasa las propiedades
 * publicadas (`propiedades.service#listarPropiedadesPublicadas`); los filtros
 * se aplican acá, en el cliente.
 * Quién lo usa: `app/(public)/page.tsx`.
 */
import { useMemo, useState } from 'react'
import { Button } from 'antd'
import type { FilterState, PropiedadResumen } from '@rentar/shared-types'
import Hero from './Hero'
import HowItWorks from './HowItWorks'
import PropertyGrid from './PropertyGrid'
import { barriosConDatos } from '@/lib/catalogs/neighborhoods'
import { filtrosInicialesLanding } from '@/lib/types/filters'
import { USE_MOCKS } from '@/services/shared/config'
import styles from './Landing.module.css'

const PREVIEW_LIMIT = 8

/** Props de {@link Landing}. */
interface LandingProps {
  /** Propiedades buscables (US-34), ya traducidas al tipo de vista. */
  properties: PropiedadResumen[]
}

/** Evalúa si una propiedad matchea el estado de filtros actual. */
function matchesFilters(property: PropiedadResumen, filters: FilterState): boolean {
  if (filters.neighborhoodSlug !== 'todos' && property.neighborhoodSlug !== filters.neighborhoodSlug) {
    return false
  }
  if (property.priceMonthly > filters.maxPrice) {
    return false
  }
  if (filters.minPrice != null && property.priceMonthly < filters.minPrice) {
    return false
  }
  if (filters.type !== 'todos' && property.type !== filters.type) {
    return false
  }
  if (filters.bedrooms !== 'todos') {
    if (filters.bedrooms === 3) {
      if (property.bedrooms < 3) return false
    } else if (property.bedrooms !== filters.bedrooms) {
      return false
    }
  }
  if (filters.characteristics.length > 0) {
    const hasAll = filters.characteristics.every((c) => property.characteristics.includes(c))
    if (!hasAll) return false
  }
  return true
}

/**
 * Contenido de la landing (`/`).
 *
 * Recibe las propiedades publicadas (las carga `app/(public)/page.tsx` desde
 * `services/propiedades.service.ts`), arma el estado de filtros en el
 * cliente y orquesta Hero (con el buscador), el grid de propiedades
 * filtradas (recortado a `PREVIEW_LIMIT`) y HowItWorks. "Buscar más
 * propiedades" lleva a `/buscar` (US-34).
 *
 * NOTA: no envuelve en `PublicLayout` — eso lo hace `app/(public)/layout.tsx`,
 * compartido con `/buscar` y `/propiedad/[id]`.
 */
export default function Landing({ properties }: LandingProps) {
  // Modo mock: los filtros del diseño; back real: sin filtros (ver la NOTA
  // de `filtrosInicialesLanding`).
  const [filters, setFilters] = useState<FilterState>(() => filtrosInicialesLanding(USE_MOCKS))

  // Zona: el catálogo más los barrios que traigan los datos (ej. "Alberdi").
  const barrios = useMemo(
    () => barriosConDatos(properties.map((property) => ({ slug: property.neighborhoodSlug, name: property.neighborhoodName }))),
    [properties],
  )

  const filteredProperties = useMemo(
    () => properties.filter((property) => matchesFilters(property, filters)),
    [properties, filters],
  )

  return (
    <>
      <Hero filters={filters} onChange={setFilters} resultCount={filteredProperties.length} neighborhoodOptions={barrios} />

      <section className={styles.section}>
        <h2 className={styles.heading}>Propiedades disponibles cerca tuyo en Córdoba</h2>
        <PropertyGrid properties={filteredProperties.slice(0, PREVIEW_LIMIT)} />
        <div className={styles.moreWrap}>
          <Button type="primary" size="large" href="/buscar" data-testid="landing-more-properties-button">
            Buscar más propiedades
          </Button>
        </div>
      </section>

      <HowItWorks />
    </>
  )
}
