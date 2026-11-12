/**
 * /firma-garante/[token] — layout mínimo de la página pública del garante (US-07).
 *
 * Qué es: solo el logo de RentAR, sin header ni menú: el garante no tiene cuenta
 * y no tiene que ir a ninguna otra parte del sitio.
 * NOTA: está fuera de `(app)` y `(public)`: el proxy solo protege `/panel/*`, así
 * que esta ruta no pide sesión.
 * Quién lo usa: `page.tsx` de esta carpeta.
 */
import type { ReactNode } from 'react'
import Image from 'next/image'
import { LOGO } from '@rentar/ui/src/assets/logo'
import styles from './layout.module.css'

/** Logo arriba y el contenido centrado. */
export default function FirmaGaranteLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.pagina}>
      <header className={styles.encabezado}>
        <Image src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="RentAR" className={styles.logo} unoptimized priority />
      </header>
      <main className={styles.contenido}>{children}</main>
    </div>
  )
}
