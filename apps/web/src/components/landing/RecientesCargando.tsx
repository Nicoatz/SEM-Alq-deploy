/**
 * RecientesCargando.tsx — esqueleto de "Recién publicadas" mientras el back responde.
 *
 * Qué es: seis tarjetas vacías con la silueta de la tarjeta de `/buscar`
 * (foto 4:3 + texto), para que la página no salte cuando llegan las reales.
 * Late con opacidad (no con el brillo de antd, que anima el fondo).
 * Cubre: US-34 Consultar propiedades a alquilar (vista previa).
 * Quién lo usa: el `Suspense` de `RecientesSection.tsx`.
 */
import styles from './Recientes.module.css'

const CANTIDAD = 6

/** Esqueleto de las tarjetas. */
export function RecientesCargando() {
  return (
    <ul className={styles.grid} aria-busy="true" aria-label="Cargando propiedades" data-testid="landing-cargando">
      {Array.from({ length: CANTIDAD }, (_, index) => (
        <li key={index} className={styles.skeletonCard} aria-hidden="true">
          <div className={styles.skeletonImage} />
          <div className={styles.skeletonBody}>
            <span className={`${styles.skeletonLine} ${styles.skeletonPrice}`} />
            <span className={`${styles.skeletonLine} ${styles.skeletonWide}`} />
            <span className={styles.skeletonLine} />
            <span className={`${styles.skeletonLine} ${styles.skeletonWide}`} />
            <span className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
          </div>
        </li>
      ))}
    </ul>
  )
}
