'use client'

/**
 * FotoPropiedadReclamo.tsx — la imagen principal de la propiedad, en miniatura.
 *
 * Qué muestra (Claude Design, "Reclamos" · 02): 64 × 48 px con bordes
 * redondeados. Si la propiedad no tiene foto o la URL falla, el placeholder de
 * siempre (`useFotoConRespaldo`).
 * Cubre US-15 ("la propiedad del reclamo con su imagen principal").
 *
 * Quién lo usa: `GrupoReclamos`, `FilaReclamo` y el selector de propiedad del registro.
 */
import Image from 'next/image'
import { PLACEHOLDER_PHOTO_SRC, useFotoConRespaldo } from '@/lib/imagenes/fotoConRespaldo'
import styles from './Reclamos.module.css'

/** Props de {@link FotoPropiedadReclamo}. */
interface FotoPropiedadReclamoProps {
  src: string | null
  /** `md` = 64 × 48 (listado), `sm` = 44 × 34 (móvil y selector). */
  tamanio?: 'md' | 'sm'
}

/** Miniatura de la propiedad. */
export function FotoPropiedadReclamo({ src, tamanio = 'md' }: FotoPropiedadReclamoProps) {
  const foto = useFotoConRespaldo(src ?? PLACEHOLDER_PHOTO_SRC)
  const [ancho, alto] = tamanio === 'md' ? [64, 48] : [44, 34]
  return (
    // Las fotos del bucket y las del navegador no pasan por el optimizador.
    <Image src={foto.src} onError={foto.onError} alt="" width={ancho} height={alto} unoptimized className={styles.fotoPropiedad} />
  )
}
