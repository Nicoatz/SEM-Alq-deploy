/**
 * FilaReclamo.tsx — un reclamo del listado, como link a su detalle.
 *
 * Qué muestra (Claude Design, "Reclamos" · 02, 02b y 04):
 * - Vista del locador (dentro del grupo de su propiedad): el tipo, un fragmento
 *   del mensaje, "RCL-2026-0041 · registrado el 13/09/2026 · 2 fotos" y el estado.
 * - Vista del locatario (sin agrupar): la foto y la dirección de la propiedad,
 *   el tipo, el fragmento, el locador y el estado.
 * En móvil la fila se apila (tipo y estado juntos, abajo el fragmento).
 * Cubre US-15 ("el estado del reclamo, el tipo de reclamo y un fragmento del
 * mensaje"; "si se es locatario se debe mostrar la foto de perfil y nombre del locador").
 *
 * Quién lo usa: `GrupoReclamos` (locador) y `Reclamos` (locatario).
 */
import Link from 'next/link'
import { formatDate, StatusTag } from '@rentar/ui'
import { fotosTexto, fragmentoMensaje } from '@/lib/reclamos/filtros'
import type { Reclamo } from '@/lib/reclamos/tipos'
import { AvatarPersona } from '@/components/personas/AvatarPersona'
import { FotoPropiedadReclamo } from './FotoPropiedadReclamo'
import { TipoReclamoTag } from './TipoReclamoTag'
import styles from './Reclamos.module.css'

/** Props de {@link FilaReclamo}. */
interface FilaReclamoProps {
  reclamo: Reclamo
  /** Desde qué rol se mira: cambia qué datos van en la fila. */
  vista: 'locador' | 'locatario'
}

/** Segunda línea: código, fecha y fotos; si se canceló o resolvió, cuándo. */
function lineaMeta(reclamo: Reclamo): string {
  const partes = [reclamo.codigo, `registrado el ${formatDate(reclamo.creadoEl)}`, fotosTexto(reclamo.fotos.length)]
  if (reclamo.cerradoEl && reclamo.estado === 'cancelado') partes.push(`cancelado por ${reclamo.locatario.nombre.split(' ')[0]} el ${formatDate(reclamo.cerradoEl)}`)
  if (reclamo.cerradoEl && reclamo.estado === 'resuelto') partes.push(`resuelto el ${formatDate(reclamo.cerradoEl)}`)
  return partes.join(' · ')
}

/** Una fila del listado de reclamos. */
export function FilaReclamo({ reclamo, vista }: FilaReclamoProps) {
  const href = `/panel/reclamos/${encodeURIComponent(reclamo.id)}`

  if (vista === 'locador') {
    return (
      <Link href={href} className={`${styles.fila} ${styles.filaLocador}`} data-testid={`reclamos-fila-${reclamo.id}`} data-estado={reclamo.estado}>
        <span className={styles.filaTipo}>
          <TipoReclamoTag tipo={reclamo.tipo} />
        </span>
        <span className={styles.filaTexto}>
          <span className={styles.fragmento}>{fragmentoMensaje(reclamo.mensaje)}</span>
          <span className={styles.meta}>{lineaMeta(reclamo)}</span>
        </span>
        <span className={styles.filaEstado}>
          <StatusTag domain="reclamo" status={reclamo.estado} />
        </span>
      </Link>
    )
  }

  return (
    <Link href={href} className={`${styles.fila} ${styles.filaLocatario}`} data-testid={`reclamos-fila-${reclamo.id}`} data-estado={reclamo.estado}>
      <span className={styles.areaFoto}>
        <FotoPropiedadReclamo src={reclamo.propiedad.fotoSrc} />
      </span>
      <span className={`${styles.direccion} ${styles.areaDireccion}`}>{reclamo.propiedad.direccion}</span>
      <span className={styles.areaTipo}>
        <TipoReclamoTag tipo={reclamo.tipo} />
      </span>
      <span className={`${styles.fragmento} ${styles.areaFragmento}`}>{fragmentoMensaje(reclamo.mensaje)}</span>
      <span className={`${styles.metaMovil} ${styles.areaMeta}`}>{reclamo.locador.nombre} · locador</span>
      <span className={styles.areaPersona}>
        <AvatarPersona nombre={reclamo.locador.nombre} fotoSrc={reclamo.locador.fotoSrc} rol="Locador" tono="fuerte" />
      </span>
      <span className={styles.areaEstado}>
        <StatusTag domain="reclamo" status={reclamo.estado} />
      </span>
    </Link>
  )
}
