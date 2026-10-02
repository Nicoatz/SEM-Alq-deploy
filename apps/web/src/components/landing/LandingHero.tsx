/**
 * LandingHero.tsx — el hero de la landing: titular, subtítulo, buscador y
 * búsquedas rápidas por barrio.
 *
 * Qué es: lo primero que se ve en `/`. El buscador entra completo en el
 * primer viewport (375, 390, 768 y 1440 px de ancho) y se puede usar desde
 * el primer frame: sin JS es un formulario nativo.
 * Cubre: US-34 Consultar propiedades a alquilar (entrada a `/buscar`).
 * Diseño: dirección "A · La consola" (la landing no tiene vista de Claude Design).
 * De dónde saca los datos: el catálogo de barrios del piloto (`lib/catalogs/neighborhoods.ts`).
 * Quién lo usa: `app/(public)/page.tsx`.
 *
 * NOTA: es un Server Component: el titular y la ilustración salen en el
 * primer envío del HTML, sin esperar al back ni al JS. La única parte con JS
 * es el buscador (`BuscadorLanding`).
 * NOTA: el fondo es azul con una ciudad ilustrada en la base (procedencia en
 * `public/landing/IMAGES.md`). Desde 768 px y en móviles altos, la ilustración
 * es el LCP: por eso va con `fetchPriority="high"` y primera en el HTML.
 */
import Link from 'next/link'
import { neighborhoods } from '@/lib/catalogs/neighborhoods'
import { BuscadorLanding } from './BuscadorLanding'
import styles from './LandingHero.module.css'

/** Hero de la landing. */
export function LandingHero() {
  return (
    <section className={styles.hero} aria-labelledby="landing-titulo">
      {/*
        Ciudad ilustrada, decorativa (alt vacío). Va primera en el DOM y sin
        z-index: el contenido, posicionado después, queda encima. Dos recortes:
        el panorama entero desde 768 px y el tramo derecho en móvil.
      */}
      <picture className={styles.city}>
        <source
          media="(min-width: 768px)"
          srcSet="/landing/hero/ciudad-1200.webp 1200w, /landing/hero/ciudad-1600.webp 1600w"
          sizes="100vw"
          width={1600}
          height={257}
        />
        <img
          src="/landing/hero/ciudad-750.webp"
          srcSet="/landing/hero/ciudad-480.webp 480w, /landing/hero/ciudad-750.webp 750w"
          sizes="100vw"
          alt=""
          width={750}
          height={263}
          fetchPriority="high"
          className={styles.cityImg}
        />
      </picture>
      <div className={styles.inner}>
        {/* NOTA: el titular no tiene animación de entrada: es el LCP en móviles bajos y tiene que estar sólido desde el primer pintado. */}
        <h1 id="landing-titulo" className={styles.title}>
          Alquilá directo con el dueño
        </h1>
        <p className={`${styles.subtitle} ${styles.enter}`}>Departamentos, casas y PH publicados por sus dueños en Córdoba.</p>

        <div className={`${styles.search} ${styles.enter} ${styles.enterSecond}`}>
          <BuscadorLanding />
        </div>

        {/* Links directos (andan sin JS): no toman lo elegido en el buscador. */}
        <nav className={`${styles.quick} ${styles.enter} ${styles.enterThird}`} aria-label="Búsquedas rápidas por barrio">
          <span className={styles.quickLabel}>Buscar en</span>
          <ul className={styles.chips}>
            {neighborhoods.map((barrio) => (
              <li key={barrio.slug}>
                <Link href={`/buscar?barrio=${barrio.slug}`} className={styles.chip} data-testid={`landing-buscador-chip-${barrio.slug}`}>
                  {barrio.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  )
}
