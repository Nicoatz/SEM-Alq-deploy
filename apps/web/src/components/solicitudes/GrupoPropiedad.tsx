'use client'

/**
 * GrupoPropiedad.tsx — las solicitudes de una propiedad del locador, bajo un
 * encabezado con la propiedad.
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 02): foto, dirección
 * EXACTA (es su propia propiedad), barrio y cuántas solicitudes se ven; abajo,
 * una fila por solicitud. En móvil el encabezado queda pegado arriba al
 * hacer scroll (· 05).
 * NOTA: el diseño suma el estado de la publicación y "publicada hace 12
 * días"; la solicitud no trae esos datos, así que no van.
 * Cubre US-36 (numeración de Jira).
 *
 * Quién lo usa: `SolicitudesRecibidas`.
 */
import Image from 'next/image'
import type { Solicitud } from '@rentar/shared-types'
import type { GrupoSolicitudes } from '@/lib/solicitudes/filtros'
import { useFotoConRespaldo } from '@/lib/imagenes/fotoConRespaldo'
import type { AccionSolicitud } from '@/lib/validation/solicitud.rules'
import { FilaSolicitudRecibida } from './FilaSolicitudRecibida'
import styles from './SolicitudesRecibidas.module.css'

/** Props de {@link GrupoPropiedad}. */
interface GrupoPropiedadProps {
  grupo: GrupoSolicitudes
  /** La aceptada de esta propiedad (de la lista completa, no solo de la pestaña), si hay. */
  aceptada: Solicitud | undefined
  seleccionadaId: string | null
  onAbrir: (solicitud: Solicitud) => void
  onAccion: (accion: AccionSolicitud, solicitud: Solicitud) => void
}

/** "1 solicitud" / "3 solicitudes". */
function solicitudesTexto(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'solicitud' : 'solicitudes'}`
}

/** Una propiedad con sus solicitudes. */
export function GrupoPropiedad({ grupo, aceptada, seleccionadaId, onAbrir, onAccion }: GrupoPropiedadProps) {
  const foto = useFotoConRespaldo(grupo.property.imageSrc)

  return (
    <section className={styles.group} aria-label={`Solicitudes de ${grupo.property.address}`} data-testid="solicitudes-grupo">
      <header className={styles.groupHeader}>
        {/* Las fotos del alta son data URLs guardadas en el navegador: no pasan por el optimizador. */}
        <Image src={foto.src} onError={foto.onError} alt="" width={52} height={40} unoptimized className={styles.groupPhoto} />
        <div className={styles.groupTitle}>
          <span className={styles.groupAddress}>{grupo.property.address || 'Propiedad sin dirección'}</span>
          {grupo.property.neighborhoodName && <span className={styles.groupSub}>{grupo.property.neighborhoodName}</span>}
        </div>
        <span className={styles.groupCount}>{solicitudesTexto(grupo.solicitudes.length)}</span>
      </header>
      {grupo.solicitudes.map((solicitud) => (
        <FilaSolicitudRecibida
          key={solicitud.id}
          solicitud={solicitud}
          otraAceptada={aceptada && aceptada.id !== solicitud.id ? aceptada : undefined}
          seleccionada={solicitud.id === seleccionadaId}
          onAbrir={onAbrir}
          onAccion={onAccion}
        />
      ))}
    </section>
  )
}
