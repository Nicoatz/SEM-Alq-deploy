/**
 * TipoReclamoTag.tsx — el tipo del reclamo, como una píldora celeste.
 *
 * Qué muestra (Claude Design, "Reclamos" · 02 y 03): "Reparación del inmueble"
 * sobre fondo celeste, en azul y negrita. No es un estado (esos van con
 * `StatusTag`), por eso no usa los colores de estado.
 * Cubre US-15 ("se debe mostrar … el tipo de reclamo").
 *
 * Quién lo usa: las filas del listado y el encabezado del detalle de un reclamo.
 */
import { labelTipoReclamo } from '@/lib/reclamos/catalogo'
import type { TipoReclamoNombre } from '@/lib/reclamos/tipos'
import styles from './Reclamos.module.css'

/** Props de {@link TipoReclamoTag}. */
interface TipoReclamoTagProps {
  tipo: TipoReclamoNombre
}

/** Píldora con el tipo del reclamo. */
export function TipoReclamoTag({ tipo }: TipoReclamoTagProps) {
  return (
    <span className={styles.tipoTag} data-testid="reclamo-tipo">
      {labelTipoReclamo(tipo)}
    </span>
  )
}
