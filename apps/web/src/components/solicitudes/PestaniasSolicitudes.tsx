'use client'

/**
 * PestaniasSolicitudes.tsx — las pestañas de estado de las listas de
 * solicitudes, con su contador.
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 02 y 04): chips
 * redondeados, el activo en azul con el contador adentro ("Pendientes 4") y
 * los demás con "Aceptadas · 1". Mientras carga, un guion en vez de un 0
 * falso (· 06: "Los filtros se muestran enseguida, no esperan a los datos").
 * Cubre US-36 (numeración de Jira) y, desde el Sprint 3, el filtro por
 * estado del listado de contratos (US-05): es genérico en la clave de la
 * pestaña, así lo comparten las dos pantallas sin duplicarlo.
 *
 * Quién lo usa: `SolicitudesRecibidas`, `MisSolicitudes` y `ListadoContratos`.
 */
import styles from './PestaniasSolicitudes.module.css'

/** Props de {@link PestaniasSolicitudes}. */
interface PestaniasSolicitudesProps<P extends string> {
  opciones: readonly { value: P; label: string }[]
  value: P
  onChange: (value: P) => void
  /** `null` mientras carga. */
  contadores: Record<P, number> | null
  /** Prefijo de los `data-testid` (`solicitudes`, `mis-solicitudes` o `contratos`): `<prefijo>-tab-<pestaña>`. */
  testIdPrefix: string
  /** Texto accesible del grupo. Por defecto, el de las solicitudes. */
  ariaLabel?: string
}

/** Pestañas de estado con su contador (la clave de la pestaña es genérica). */
export function PestaniasSolicitudes<P extends string>({ opciones, value, onChange, contadores, testIdPrefix, ariaLabel = 'Estado de la solicitud' }: PestaniasSolicitudesProps<P>) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={ariaLabel}>
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
