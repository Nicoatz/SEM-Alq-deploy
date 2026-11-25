/**
 * AvatarPersona.tsx — la foto (o las iniciales) y el nombre de la otra parte.
 *
 * Qué muestra (Claude Design, "Reclamos" · 02 y "Mensajes" · 01): un círculo con
 * la foto de perfil o, si no hay, las iniciales; al lado, opcional, el nombre y
 * el rol ("Sofía Ledesma · Locataria").
 * Cubre US-15 ("se debe mostrar la foto de perfil y nombre del locador /
 * locatario"). TODO(db): la tabla `usuario` no tiene foto de perfil, así que hoy
 * siempre se ven las iniciales.
 *
 * Quién lo usa: `components/reclamos/*` (y Mensajes, en la Tanda C).
 */
import { iniciales } from '@/lib/utils/iniciales'
import styles from './AvatarPersona.module.css'

/** Props de {@link AvatarPersona}. */
interface AvatarPersonaProps {
  nombre: string
  fotoSrc?: string | null
  /** "Locataria", "Locador"; si falta, solo el nombre. */
  rol?: string
  /** `false` = solo el círculo (el nombre queda como texto accesible). */
  conNombre?: boolean
  /** `true` = solo el círculo, sin texto accesible: el nombre ya se lee al lado (filas de listas). */
  decorativo?: boolean
  /** `sm` = 28 px (listas), `md` = 34 px (encabezados). */
  tamanio?: 'sm' | 'md'
  /** Variante del círculo: `fuerte` (azul) para la persona destacada, `suave` para el resto. */
  tono?: 'fuerte' | 'suave'
  'data-testid'?: string
}

/** Avatar con iniciales y, opcional, nombre y rol. */
export function AvatarPersona({ nombre, fotoSrc = null, rol, conNombre = true, decorativo = false, tamanio = 'md', tono = 'fuerte', ...rest }: AvatarPersonaProps) {
  const circulo = `${styles.circulo} ${styles[tamanio]} ${tono === 'fuerte' ? styles.fuerte : styles.suave}`
  return (
    <span className={styles.wrap} data-testid={rest['data-testid']}>
      {fotoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto de perfil externa, sin tamaño conocido (cuando el back la tenga).
        <img src={fotoSrc} alt="" className={circulo} />
      ) : (
        <span className={circulo} aria-hidden="true">
          {iniciales(nombre)}
        </span>
      )}
      {conNombre ? (
        <span className={styles.textos}>
          <span className={styles.nombre}>{nombre}</span>
          {rol && <span className={styles.rol}>{rol}</span>}
        </span>
      ) : decorativo ? null : (
        <span className={styles.oculto}>{rol ? `${nombre}, ${rol.toLowerCase()}` : nombre}</span>
      )}
    </span>
  )
}
