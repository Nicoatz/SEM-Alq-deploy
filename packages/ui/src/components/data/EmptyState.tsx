'use client'

/**
 * EmptyState.tsx — estado vacío: título, explicación y una acción.
 *
 * Quién lo usa: `/buscar`, `/panel`, `/panel/propiedades`, `PlaceholderScreen`, `/recuperar` y el
 * catálogo.
 */
// NOTA: `@ant-design/icons` crea un Context de React a nivel de módulo
// (para el theming/tamaño heredado de los íconos) — eso rompe cualquier
// Server Component que importe este archivo sin `'use client'` (el mismo
// motivo documentado en `packages/ui/src/tokens/status-meta.ts`). Bug
// preexistente: este componente lo importaba sin este directive.
import type { ReactNode } from 'react'
import { InboxOutlined } from '@ant-design/icons'
import styles from './EmptyState.module.css'

/** Props de {@link EmptyState}. */
interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  /** Acción sugerida, ej. un `<Button>` para crear el primer recurso. */
  action?: ReactNode
  /**
   * Debajo de 640px, la acción ocupa todo el ancho del estado vacío (Claude
   * Design, "Panel de inicio" · 05b móvil). Por defecto `false`: la acción
   * queda centrada con su ancho natural, en todos los tamaños.
   */
  actionBlock?: boolean
  'data-testid'?: string
}

/**
 * Estado vacío genérico (sin propiedades, sin contratos, sin resultados de
 * búsqueda). Envuelve el mismo patrón visual en todo el panel en vez de que
 * cada pantalla arme el suyo a mano.
 */
export function EmptyState({ icon, title, description, action, actionBlock = false, ...rest }: EmptyStateProps) {
  return (
    <div className={styles.wrap} {...rest}>
      <span className={styles.icon}>{icon ?? <InboxOutlined />}</span>
      <p className={styles.title}>{title}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={`${styles.action} ${actionBlock ? styles.actionBlock : ''}`}>{action}</div>}
    </div>
  )
}
