'use client'

/**
 * PropertyCard.tsx — tarjeta de propiedad de la landing ("Ver detalle" → `/propiedad/[id]`).
 *
 * NOTA: `/buscar` y el alta usan la `PropertyCard` de `@rentar/ui` con
 * `layout="busqueda"`; esta es la de la landing, que se mantiene igual al
 * origen para no romper la paridad visual.
 * Quién lo usa: `PropertyGrid.tsx`.
 */
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button, Card } from 'antd'
import type { PropertyType, PropiedadResumen } from '@rentar/shared-types'
import { useFotoConRespaldo } from '@/lib/imagenes/fotoConRespaldo'
import { formatMonthlyPrice } from '@/lib/utils/format'
import styles from './PropertyCard.module.css'

const typeLabels: Record<PropertyType, string> = {
  departamento: 'Departamento',
  casa: 'Casa',
  ph: 'PH',
  monoambiente: 'Monoambiente',
}

/** Props de {@link PropertyCard}. */
interface PropertyCardProps {
  /** Propiedad a mostrar (viene de `services/propiedades.service.ts`). */
  property: PropiedadResumen
}

/**
 * Tarjeta de una propiedad. Se usa en el grid de resultados de la landing
 * (`PropertyGrid`) y como ejemplo en vivo en la sección "Tarjetas" de
 * `/design-system`. "Ver detalle" lleva a `/propiedad/[id]`.
 *
 * NOTA: `src` es una URL (string), no una imagen importada: los datos pasan
 * por el service, que devuelve JSON. `fill` + `sizes` hacen que `next/image`
 * la sirva igual que antes.
 */
export default function PropertyCard({ property }: PropertyCardProps) {
  const router = useRouter()
  // Si la foto no carga, el placeholder (no el ícono de imagen rota).
  const foto = useFotoConRespaldo(property.imageSrc)

  return (
    <Card
      hoverable
      cover={
        <div className={styles.imageWrap}>
          <Image
            src={foto.src}
            onError={foto.onError}
            alt={`${typeLabels[property.type]} en ${property.neighborhoodName}`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className={styles.image}
          />
          <span className={styles.badge}>Trato directo con el dueño</span>
        </div>
      }
    >
      <h3 className={styles.title}>{property.title}</h3>
      <p className={styles.subtitle}>
        {property.neighborhoodName} · {typeLabels[property.type]}
      </p>

      <div className={styles.metaRow}>
        <span>
          {property.bedrooms} {property.bedrooms === 1 ? 'dormitorio' : 'dormitorios'}
        </span>
        <span>{property.areaM2} m²</span>
        {/* NOTA: `null` = el índice no vino (con el back real, `/disponibles` no
            trae el contrato), no "no tiene índice": no se muestra nada, igual
            que en la tarjeta de /buscar. El elenco del modo mock siempre lo tiene. */}
        {property.adjustmentIndex && <span>Ajuste por {property.adjustmentIndex}</span>}
      </div>

      <div className={styles.footerRow}>
        <p className={styles.price}>{formatMonthlyPrice(property.priceMonthly)}</p>
        <Button
          size="small"
          // NOTA: se navega con el router (y no con `href`) para que siga
          // siendo un <button>: con `href` antd dibuja un <a> y el texto se
          // corre un subpíxel, y la landing tiene que verse idéntica.
          onClick={() => router.push(`/propiedad/${property.id}`)}
          style={{ background: '#E3F2FB', color: '#004D98', border: 'none' }}
          data-testid="property-card-detail-button"
        >
          Ver detalle
        </Button>
      </div>
    </Card>
  )
}
