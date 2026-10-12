'use client'

/**
 * PestaniasSolicitudes.tsx — las pestañas de estado de las listas de
 * solicitudes, con su contador.
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 02 y 04): chips
 * redondeados, el activo en azul con el contador adentro ("Pendientes 4") y
 * los demás con "Aceptadas · 1". Mientras carga, un guion en vez de un 0
 * falso (· 06: "Los filtros se muestran enseguida, no esperan a los datos").
 * Cubre US-36 (numeración de Jira).
 *
 * Quién lo usa: `SolicitudesRecibidas` y `MisSolicitudes`.
 */
import type { OpcionPestania, PestaniaSolicitudes } from '@/lib/solicitudes/filtros'
import styles from './PestaniasSolicitudes.module.css'

/** Props de {@link PestaniasSolicitudes}. */
interface PestaniasSolicitudesProps {
  opciones: readonly OpcionPestania[]
  value: PestaniaSolicitudes
  onChange: (value: PestaniaSolicitudes) => void
  /** `null` mientras carga. */
  contadores: Record<PestaniaSolicitudes, number> | null
  /** Prefijo de los `data-testid` (`solicitudes` o `mis-solicitudes`): `<prefijo>-tab-<pestaña>`. */
  testIdPrefix: string
}

/** Fila de pestañas de estado. */
export function PestaniasSolicitudes({ opciones, value, onChange, contadores, testIdPrefix }: PestaniasSolicitudesProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Estado de la solicitud">
      {opciones.map((opcion) => {
        const activa = opcion.value === value
        const cantidad = contadores ? contadores[opcion.value] : '—'
        return (
          <button
            key={opcion.value}
            type="button"
            role="tab"
            aria-selected={activa}
            className={`${styles.tab} ${activa ? styles.tabActive : ''}`}
            onClick={() => onChange(opcion.value)}
            data-testid={`${testIdPrefix}-tab-${opcion.value}`}
          >
            {opcion.label}
            {activa ? <span className={styles.count}>{cantidad}</span> : <span className={styles.countInline}>· {cantidad}</span>}
          </button>
        )
      })}
    </div>
  )
}
