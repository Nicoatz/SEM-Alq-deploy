'use client'

/**
 * FilaMiSolicitud.tsx — una solicitud enviada, en Mis solicitudes.
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 04): foto principal
 * de la propiedad (US-36), dirección APROXIMADA y barrio (US-36: "la
 * dirección de la propiedad"; decisión del PO: el postulante nunca ve la
 * exacta), `StatusTag` y la línea que dice qué pasó y qué sigue. Acciones
 * según el estado:
 * - Pendiente: "Cancelar solicitud" (sin US en Sprint 0, mapa US-39) y "Ver".
 * - Aceptada: "Ver". No la puede cancelar: se lo pide al dueño (US-38).
 * - Rechazada o cancelada: "Ver propiedades en <barrio>".
 * NOTA: el diseño suma el precio y "Escribirle a <dueño>"; la solicitud no
 * trae el precio y Mensajes es de otro sprint, así que no van.
 *
 * Quién lo usa: `MisSolicitudes`.
 */
import Image from 'next/image'
import Link from 'next/link'
import { Button } from 'antd'
import { StopOutlined } from '@ant-design/icons'
import type { Solicitud } from '@rentar/shared-types'
import { StatusTag } from '@rentar/ui'
import { useFotoConRespaldo } from '@/lib/imagenes/fotoConRespaldo'
import { hrefBuscarEnBarrio } from '@/lib/search/busquedaParams'
import { lineaMiSolicitud } from '@/lib/solicitudes/textos'
import { puedeCancelar } from '@/lib/validation/solicitud.rules'
import styles from './MisSolicitudes.module.css'

/** Props de {@link FilaMiSolicitud}. */
interface FilaMiSolicitudProps {
  solicitud: Solicitud
  onCancelar: (solicitud: Solicitud) => void
}

/** Una solicitud enviada por el usuario en sesión. */
export function FilaMiSolicitud({ solicitud, onCancelar }: FilaMiSolicitudProps) {
  const foto = useFotoConRespaldo(solicitud.property.imageSrc)
  const { id, address, neighborhoodName, neighborhoodSlug } = solicitud.property
  const titulo = [address, neighborhoodName].filter(Boolean).join(' · ') || 'Propiedad sin dirección'
  const hrefPropiedad = `/propiedad/${encodeURIComponent(id)}`
  const cerrada = solicitud.status === 'rechazada' || solicitud.status === 'cancelada'

  return (
    <article className={`${styles.row} ${solicitud.status === 'aceptada' ? styles.rowAccepted : ''}`} data-testid="mis-solicitudes-fila">
      {/* Las fotos del alta son data URLs guardadas en el navegador: no pasan por el optimizador. */}
      <Image src={foto.src} onError={foto.onError} alt="" width={64} height={50} unoptimized className={styles.photo} />
      <div className={styles.rowBody}>
        <div className={styles.rowHead}>
          <Link href={hrefPropiedad} className={styles.address}>
            {titulo}
          </Link>
          <StatusTag domain="solicitud" status={solicitud.status} />
        </div>
        <span className={styles.rowLine} data-testid="mis-solicitudes-estado-texto">
          {lineaMiSolicitud(solicitud)}
        </span>
      </div>
      <div className={styles.actions}>
        {puedeCancelar(solicitud.status, 'postulante') && (
          <Button
            icon={<StopOutlined />}
            onClick={() => onCancelar(solicitud)}
            className={styles.actionButton}
            aria-label={`Cancelar tu solicitud de ${titulo}`}
            data-testid="mis-solicitudes-cancelar-button"
          >
            Cancelar solicitud
          </Button>
        )}
        {cerrada ? (
          <Button href={hrefBuscarEnBarrio(neighborhoodSlug)} className={styles.actionButton} data-testid="mis-solicitudes-ver-similares-button">
            {neighborhoodName ? `Ver propiedades en ${neighborhoodName}` : 'Ver otras propiedades'}
          </Button>
        ) : (
          <Link href={hrefPropiedad} className={styles.linkAction} aria-label={`Ver la propiedad ${titulo}`} data-testid="mis-solicitudes-ver-button">
            Ver
          </Link>
        )}
      </div>
    </article>
  )
}
