'use client'

/**
 * PropiedadesSimilares.tsx — "Propiedades similares": otras publicadas del
 * mismo barrio, al pie del detalle.
 *
 * Diseño: "Detalle de propiedad" · 01 ("Propiedades similares · Ver todas en
 * Güemes").
 * Cubre: US-41 Consultar detalle de propiedad (numeración de Jira).
 * Datos: `propiedades.service#listarSimilares`.
 * Quién lo usa: `DetallePropiedad`.
 *
 * NOTA: se cargan aparte y no frenan el detalle: con el back real
 * `/disponibles` tarda ~2,7 s. Mientras cargan, skeleton propio; si fallan o
 * vuelven vacías, la sección no se muestra (sin mensaje de error: no es lo
 * que la persona vino a ver).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Skeleton } from 'antd'
import type { PropiedadDetalle, PropiedadResumen } from '@rentar/shared-types'
import { PropertyCard } from '@rentar/ui'
import { characteristicShortLabel } from '@/lib/catalogs/characteristics'
import { hrefBuscarEnBarrio } from '@/lib/search/busquedaParams'
import { hoy } from '@/lib/utils/fechas'
import { listarSimilares } from '@/services/propiedades.service'
import styles from './DetallePropiedad.module.css'

/** Props de {@link PropiedadesSimilares}. */
interface PropiedadesSimilaresProps {
  propiedad: Pick<PropiedadDetalle, 'id' | 'neighborhoodSlug' | 'neighborhoodName'>
}

/** Cuántas tarjetas "esqueleto" se muestran mientras cargan. */
const SKELETON_COUNT = 3

/** "Propiedades similares" del mismo barrio, con su propia carga. */
export function PropiedadesSimilares({ propiedad }: PropiedadesSimilaresProps) {
  // ─── Estado local ───────────────────────────────────────────────────────
  // `undefined` = cargando; `[]` = no hay o falló (la sección no se muestra).
  const [similares, setSimilares] = useState<PropiedadResumen[] | undefined>(undefined)
  const { id, neighborhoodSlug } = propiedad

  useEffect(() => {
    let vigente = true
    listarSimilares({ id, neighborhoodSlug })
      .then((items) => {
        if (vigente) setSimilares(items)
      })
      .catch(() => {
        if (vigente) setSimilares([])
      })
    return () => {
      vigente = false
    }
  }, [id, neighborhoodSlug])

  // ─── Render ─────────────────────────────────────────────────────────────

  if (similares !== undefined && similares.length === 0) return null

  return (
    <section className={styles.section} aria-labelledby="detalle-similares" data-testid="detalle-propiedad-similares">
      <div className={styles.sectionHeader}>
        <h2 id="detalle-similares" className={styles.sectionTitle}>
          Propiedades similares
        </h2>
        {propiedad.neighborhoodName && (
          <Link href={hrefBuscarEnBarrio(neighborhoodSlug)} className={styles.sectionLink} data-testid="detalle-propiedad-similares-ver-todas">
            Ver todas en {propiedad.neighborhoodName}
          </Link>
        )}
      </div>

      <div className={styles.similaresGrid}>
        {similares === undefined
          ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
              <div key={index} className={styles.skeletonCard} data-testid="detalle-propiedad-similares-cargando">
                <Skeleton.Node active className={styles.skeletonCardImage}>
                  <span />
                </Skeleton.Node>
                <Skeleton active title={{ width: '60%' }} paragraph={{ rows: 1 }} />
              </div>
            ))
          : similares.map((item) => (
              <PropertyCard
                key={item.id}
                layout="busqueda"
                href={`/propiedad/${item.id}`}
                title={item.title}
                neighborhoodName={item.neighborhoodName}
                propertyType={item.type}
                priceMonthly={item.priceMonthly}
                expenses={item.expenses ?? undefined}
                bedrooms={item.bedrooms}
                areaM2={item.areaM2}
                adjustmentIndex={item.adjustmentIndex}
                imageSrc={item.imageSrc}
                photoSrcs={item.photoSrcs}
                address={item.address}
                description={item.description}
                availableFrom={item.availableFrom}
                characteristicLabel={item.characteristics[0] ? characteristicShortLabel[item.characteristics[0]] : undefined}
                referenceDate={hoy().toDate()}
                data-testid="detalle-propiedad-similar"
              />
            ))}
      </div>
    </section>
  )
}
