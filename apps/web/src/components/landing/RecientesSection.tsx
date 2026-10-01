/**
 * RecientesSection.tsx — "Recién publicadas" de la landing: las 6 propiedades
 * más recientes, con "Ver todas" a `/buscar`.
 *
 * Qué es: la prueba de que hay publicaciones reales. El encabezado sale en el
 * primer envío del HTML; las tarjetas llegan después, por streaming
 * (`Suspense`), así el resto de la página no espera al back.
 * Cubre: US-34 Consultar propiedades a alquilar (vista previa).
 * De dónde saca los datos: `propiedades.service#listarPropiedadesRecientes`
 * (en `Recientes.tsx`, del lado del servidor).
 * Quién lo usa: `app/(public)/page.tsx`.
 */
import { Suspense } from 'react'
import Link from 'next/link'
import { Recientes } from './Recientes'
import { RecientesCargando } from './RecientesCargando'
import styles from './Recientes.module.css'

/** Sección "Recién publicadas" (las tarjetas, con `Suspense`). */
export function RecientesSection() {
  return (
    <section className={styles.section} aria-labelledby="landing-recientes-titulo" data-testid="landing-recientes">
      <div className={styles.header} data-reveal>
        <h2 id="landing-recientes-titulo" className={styles.heading}>
          Recién publicadas
        </h2>
        <Link href="/buscar" className={styles.verTodas} data-testid="landing-ver-todas">
          Ver todas
        </Link>
      </div>
      <Suspense fallback={<RecientesCargando />}>
        <Recientes />
      </Suspense>
    </section>
  )
}
