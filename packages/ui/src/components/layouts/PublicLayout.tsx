/**
 * PublicLayout.tsx — layout de la zona pública (arquetipo A1): `Header` + contenido + `Footer`.
 *
 * Quién lo usa: `app/(public)/layout.tsx`.
 */
import type { ReactNode } from 'react'
import { Header } from '../Header'
import { Footer } from '../Footer'

/** Props de {@link PublicLayout}. */
interface PublicLayoutProps {
  children: ReactNode
  /**
   * Header ya armado, en lugar del `<Header />` sin props. Opcional. Lo usa
   * `apps/web` para pasar la sesión: este layout es un Server Component y no
   * puede pasarle funciones (el "Cerrar sesión") al Header.
   */
  header?: ReactNode
}

/**
 * Layout de las páginas públicas (landing, y cualquier página pública
 * futura): `Header` + `<main>` + `Footer`, siempre los mismos en todo el
 * sitio público. `Landing` lo usa para armar la página de inicio.
 */
export function PublicLayout({ children, header }: PublicLayoutProps) {
  return (
    <>
      {header ?? <Header />}
      <main>{children}</main>
      <Footer />
    </>
  )
}
