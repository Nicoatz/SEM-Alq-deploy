/**
 * BarriosSection.tsx — franja "Buscá por barrio" de la landing.
 *
 * Qué es: los 6 barrios del piloto, cada uno con su ilustración y una línea
 * de ubicación, como accesos directos a `/buscar?barrio=<slug>`. Pensada
 * para quien llega de otra ciudad y todavía no conoce los barrios.
 * Cubre: US-34 Consultar propiedades a alquilar (acceso por barrio).
 * De dónde saca los datos: `lib/catalogs/barriosLanding.ts` (contenido fijo).
 * NOTA: las ilustraciones son decorativas (`alt=""`): el nombre del barrio ya
 * es el texto del link y la escena es genérica, sin edificios reales.
 * Quién lo usa: `app/(public)/page.tsx`.
 */
import Image from 'next/image'
import Link from 'next/link'
import { BARRIOS_LANDING } from '@/lib/catalogs/barriosLanding'
import styles from './Barrios.module.css'

/**
 * Ancho con que se muestra cada ilustración (ver Barrios.module.css): un
 * sexto del contenedor desde 992 px, un tercio desde 768 y una miniatura de
 * 6 rem en móvil.
 */
const TAMANIOS_IMAGEN = '(min-width: 992px) 180px, (min-width: 768px) 240px, 96px'

/** Franja de barrios: lista con miniatura en móvil, 3×2 desde 768 px y una fila de 6 desde 992 px. */
export function BarriosSection() {
  return (
    <section className={styles.section} aria-labelledby="landing-barrios-titulo" data-testid="landing-barrios">
      <h2 id="landing-barrios-titulo" className={styles.heading} data-reveal>
        Buscá por barrio
      </h2>
      <ul className={styles.grid}>
        {BARRIOS_LANDING.map((barrio) => (
          <li key={barrio.slug} className={styles.item} data-reveal>
            <Link href={`/buscar?barrio=${barrio.slug}`} className={styles.card} data-testid={`landing-barrio-${barrio.slug}`}>
              {/* Sin ilustración, queda el fondo celeste del recuadro. */}
              <span className={styles.media}>
                {barrio.imagen ? (
                  <Image src={barrio.imagen} alt="" width={480} height={600} sizes={TAMANIOS_IMAGEN} className={styles.image} />
                ) : null}
              </span>
              <span className={styles.text}>
                <h3 className={styles.name}>{barrio.name}</h3>
                <p className={styles.line}>{barrio.linea}</p>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
