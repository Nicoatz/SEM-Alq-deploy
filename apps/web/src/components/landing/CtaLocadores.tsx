/**
 * CtaLocadores.tsx — cierre de la landing para quien tiene una propiedad.
 *
 * Qué es: un único llamado a publicar, en un panel azul. El botón dice
 * "Publicar propiedad", igual que el del Header, para que la misma acción no
 * tenga dos textos.
 * Cubre: lleva al alta de propiedad (US-01). Cualquier usuario con sesión
 * puede publicar (regla del equipo, 27/09/2026); sin sesión, el proxy manda
 * a `/login?next=/panel/propiedades/nueva`.
 * De dónde saca los datos: textos fijos, aprobados por el PO (01/10/2026).
 * NOTA: habla del trato directo, sin mencionar el precio: "Publicar es
 * gratis" no va (decisión del PO, 01/10/2026).
 * Quién lo usa: `app/(public)/page.tsx`.
 */
import Link from 'next/link'
import styles from './CtaLocadores.module.css'

/** Panel "¿Tenés una propiedad para alquilar?" con el botón "Publicar propiedad". */
export function CtaLocadores() {
  return (
    <section className={styles.section} aria-labelledby="landing-publicar-titulo">
      <div className={styles.panel} data-reveal>
        <div className={styles.text}>
          <h2 id="landing-publicar-titulo" className={styles.heading}>
            ¿Tenés una propiedad para alquilar?
          </h2>
          <p className={styles.lead}>Publicala y tratá directo con quien la va a alquilar.</p>
        </div>
        <Link href="/panel/propiedades/nueva" className={styles.button} data-testid="landing-publicar">
          Publicar propiedad
        </Link>
      </div>
    </section>
  )
}
