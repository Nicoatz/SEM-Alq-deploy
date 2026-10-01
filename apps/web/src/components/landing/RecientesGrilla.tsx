'use client'

/**
 * RecientesGrilla.tsx — las tarjetas de "Recién publicadas".
 *
 * Qué es: la misma tarjeta de `/buscar` (`PropertyCard` con
 * `layout="busqueda"`, con los datos que pide US-34), en un carril que se
 * desliza en móvil y en grilla desde 768 px.
 * Cubre: US-34 Consultar propiedades a alquilar (vista previa).
 * De dónde saca los datos: las recibe de `Recientes.tsx` (servidor).
 * Quién lo usa: `Recientes.tsx`.
 */
import type { PropiedadResumen } from '@rentar/shared-types'
import { PropertyCard } from '@rentar/ui'
import { characteristicShortLabel } from '@/lib/catalogs/characteristics'
import { hoy } from '@/lib/utils/fechas'
import styles from './Recientes.module.css'

/** Props de {@link RecientesGrilla}. */
interface RecientesGrillaProps {
  /** Publicaciones a mostrar, ya en el orden "más recientes primero". */
  propiedades: PropiedadResumen[]
}

/** Carril (móvil) o grilla de tarjetas de propiedad. */
export function RecientesGrilla({ propiedades }: RecientesGrillaProps) {
  // El "hoy" de la app (fijo en modo mock), para "Disponible ahora / desde".
  const referencia = hoy().toDate()

  return (
    <ul className={styles.grid}>
      {propiedades.map((propiedad) => (
        <li key={propiedad.id} className={styles.item}>
          <PropertyCard
            layout="busqueda"
            href={`/propiedad/${propiedad.id}`}
            title={propiedad.title}
            neighborhoodName={propiedad.neighborhoodName}
            propertyType={propiedad.type}
            priceMonthly={propiedad.priceMonthly}
            expenses={propiedad.expenses ?? undefined}
            bedrooms={propiedad.bedrooms}
            areaM2={propiedad.areaM2}
            adjustmentIndex={propiedad.adjustmentIndex}
            imageSrc={propiedad.imageSrc}
            photoSrcs={propiedad.photoSrcs}
            address={propiedad.address}
            description={propiedad.description}
            availableFrom={propiedad.availableFrom}
            characteristicLabel={propiedad.characteristics[0] ? characteristicShortLabel[propiedad.characteristics[0]] : undefined}
            referenceDate={referencia}
            data-testid="landing-tarjeta"
          />
        </li>
      ))}
    </ul>
  )
}
