'use client'

/**
 * MensajeOriginalReclamo.tsx — el mensaje del reclamo, completo, con sus fotos.
 *
 * Qué muestra (Claude Design, "Reclamos" · 03 y 05): quién lo registró ("Vos ·
 * Sofía Ledesma" si es el usuario en sesión), cuándo, la etiqueta "Mensaje del
 * reclamo", el texto completo y las fotos en miniatura; al tocar una, se abre el
 * visor a pantalla completa (con flechas entre las fotos).
 * Cubre US-15 ("al consultar el detalle … el mensaje asociado en su totalidad y las
 * fotos asociadas") y US-18 ("al inicio de la conversación del reclamo se debe
 * mostrar de forma fija o destacada el mensaje original … junto con todas las
 * fotografías"): va siempre arriba del chat y no cuenta en los 100 mensajes.
 *
 * Quién lo usa: `DetalleReclamo`.
 */
import { Image } from 'antd'
import { formatDate } from '@rentar/ui'
import type { Reclamo } from '@/lib/reclamos/tipos'
import { AvatarPersona } from '@/components/personas/AvatarPersona'
import styles from './DetalleReclamo.module.css'

/** Props de {@link MensajeOriginalReclamo}. */
interface MensajeOriginalReclamoProps {
  reclamo: Reclamo
  /** `true` si el usuario en sesión es el locatario que lo registró. */
  esPropio: boolean
}

/** El mensaje original del reclamo y sus fotos. */
export function MensajeOriginalReclamo({ reclamo, esPropio }: MensajeOriginalReclamoProps) {
  const { locatario } = reclamo
  return (
    <section className={styles.tarjeta} aria-label="Mensaje del reclamo" data-testid="reclamo-mensaje-original">
      <header className={styles.originalCabecera}>
        <AvatarPersona nombre={locatario.nombre} fotoSrc={locatario.fotoSrc} conNombre={false} decorativo />
        <span className={styles.originalQuien}>
          <strong>{esPropio ? `Vos · ${locatario.nombre}` : locatario.nombre}</strong>
          <span>
            Locatario · {formatDate(reclamo.creadoEl)} · {formatDate(reclamo.creadoEl, 'HH:mm')}
          </span>
        </span>
        <span className={styles.etiqueta}>Mensaje del reclamo</span>
      </header>
      <p className={styles.originalTexto} data-testid="reclamo-mensaje-texto">
        {reclamo.mensaje}
      </p>
      {reclamo.fotos.length > 0 && (
        <Image.PreviewGroup>
          <ul className={styles.fotos} data-testid="reclamo-fotos">
            {reclamo.fotos.map((foto) => (
              <li key={foto.id} className={styles.foto} data-testid="reclamo-foto">
                <Image src={foto.src} alt={foto.nombre} rootClassName={styles.fotoRaiz} />
                <span className={styles.fotoNombre}>{foto.nombre}</span>
              </li>
            ))}
          </ul>
        </Image.PreviewGroup>
      )}
    </section>
  )
}
