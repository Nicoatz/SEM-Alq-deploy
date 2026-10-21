'use client'

/**
 * SinCargar.tsx — el valor de un dato que el usuario no cargó.
 *
 * Qué es: "Sin cargar" más el acceso a completarlo (US-20: "los datos que el
 * usuario no cargó se deben mostrar como 'Sin cargar', con acceso a
 * completarlos"). "Completar" abre la edición del bloque.
 * Cubre: US-20 Consultar usuario.
 * Quién lo usa: `DatosPersonalesBloque.tsx` y `LegajoBloque.tsx`.
 */
import { Button } from 'antd'
import styles from './BloquesPerfil.module.css'

/** Props de {@link SinCargar}. */
interface SinCargarProps {
  /** Nombre del campo para el `data-testid` (`perfil-sin-cargar-<campo>`). */
  campo: string
  /** Abre la edición del bloque. Sin esto, solo se ve "Sin cargar". */
  onCompletar?: () => void
}

/** "Sin cargar · Completar". */
export function SinCargar({ campo, onCompletar }: SinCargarProps) {
  return (
    <span className={styles.sinCargar} data-testid={`perfil-sin-cargar-${campo}`}>
      Sin cargar
      {onCompletar && (
        <Button type="link" size="small" onClick={onCompletar} data-testid={`perfil-completar-${campo}`}>
          Completar
        </Button>
      )}
    </span>
  )
}
