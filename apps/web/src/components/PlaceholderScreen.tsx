/**
 * PlaceholderScreen.tsx — pantalla "En construcción" para rutas de otros sprints.
 *
 * Qué es: `PageHeader` + `EmptyState`. Existe solo para que ningún botón del
 * Sprint 1 quede roto: las rutas a las que se llega desde el menú del
 * locador, el UserMenu o una tarjeta, pero cuya pantalla es de otro sprint.
 * No es una pieza de `@rentar/ui` (no es reutilizable a largo plazo): se
 * borra ruta por ruta a medida que cada pantalla se implementa.
 *
 * Quién lo usa: los `page.tsx` de las rutas placeholder (ver
 * `apps/web/README.md`, "Rutas").
 */
// Imports directos (no del barrel @rentar/ui): ese barrel también
// re-exporta statusMeta, que rompe el build en cualquier Server Component
// que lo importe (ver el comentario en app/layout.tsx). PlaceholderScreen
// se usa desde page.tsx que son Server Components.
import { EmptyState } from '@rentar/ui/src/components/data/EmptyState'
import { PageHeader } from '@rentar/ui/src/components/navigation/PageHeader'
import styles from './PlaceholderScreen.module.css'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PlaceholderScreenProps {
  title: string
  subtitle?: string
  breadcrumb?: BreadcrumbItem[]
  /**
   * User Story que va a implementar esta pantalla, con la numeración del
   * Sprint 0 (ej. "US-20 Consultar usuario"). Es para el equipo: no se
   * muestra (el usuario no conoce esos números); queda en `data-user-story`.
   */
  userStory: string
  /**
   * Cuándo llega la pantalla real. Por defecto "un próximo sprint"; las rutas
   * del Sprint 1 que todavía no se implementaron dicen en qué tanda llegan.
   */
  availableIn?: string
}

/**
 * Pantalla "En construcción" con el título de la ruta. La US que la va a
 * implementar queda en `data-user-story`, a la vista solo en el DOM.
 */
export function PlaceholderScreen({ title, subtitle, breadcrumb, userStory, availableIn = 'un próximo sprint' }: PlaceholderScreenProps) {
  return (
    <div className={styles.wrap} data-testid="placeholder-screen" data-user-story={userStory}>
      <PageHeader title={title} subtitle={subtitle} breadcrumb={breadcrumb} />
      <EmptyState title="En construcción" description={`Esta pantalla llega en ${availableIn}.`} />
    </div>
  )
}
