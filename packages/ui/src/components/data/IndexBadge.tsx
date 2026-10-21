'use client'

/**
 * IndexBadge.tsx — insignia del índice de ajuste (ICL, IPC o CAC, o "Sin ajuste"), con la
 * explicación en un tooltip.
 *
 * Quién lo usa: `PropertyCard`, `SearchSidebarFilters`, `/panel/propiedades`, el alta de
 * propiedad, los contratos (alta, listado, detalle y Mi alquiler; US-05, US-07 y US-27) y el
 * catálogo.
 * NOTA (Sprint 3): suma CAC y "Sin ajuste", que ofrece el alta de contrato (US-05). La
 * publicación (`AdjustmentIndex`) sigue con ICL e IPC: el tipo de la prop los abarca a los dos.
 */
// NOTA: `@ant-design/icons` crea un Context de React a nivel de módulo —
// rompe cualquier Server Component que importe este archivo sin
// `'use client'` (ver el mismo comentario en `tokens/status-meta.ts`).
import { Tooltip } from 'antd'
import { InfoCircleOutlined } from '@ant-design/icons'
import type { IndiceContrato } from '@rentar/shared-types'
import styles from './IndexBadge.module.css'

const EXPLANATIONS: Record<IndiceContrato, string> = {
  IPC: 'Índice de Precios al Consumidor (INDEC): mide la inflación general del país.',
  ICL: 'Índice para Contratos de Locación (BCRA): combina salarios e inflación, pensado específicamente para alquileres.',
  CAC: 'Índice del Costo de la Construcción (Cámara Argentina de la Construcción): sigue cuánto cuesta construir.',
  sin_ajuste: 'El monto queda fijo durante todo el contrato: no se ajusta por ningún índice.',
}

/** Lo que dice el badge (los índices, por su sigla). */
const LABELS: Record<IndiceContrato, string> = { IPC: 'IPC', ICL: 'ICL', CAC: 'CAC', sin_ajuste: 'Sin ajuste' }

/** Props de {@link IndexBadge}. */
interface IndexBadgeProps {
  /**
   * Índice de ajuste: el de la publicación (ICL o IPC) o el del contrato
   * (también CAC o `sin_ajuste`, que se ve neutro: no es un índice).
   */
  index: IndiceContrato
  'data-testid'?: string
}

/**
 * Badge del índice de ajuste (IPC, ICL, CAC o "Sin ajuste") con tooltip explicativo — para que
 * un locador o locatario sin conocimiento técnico entienda qué significa
 * sin salir de la pantalla (RNF-10, usabilidad para perfiles no técnicos).
 */
export function IndexBadge({ index, ...rest }: IndexBadgeProps) {
  return (
    <Tooltip title={EXPLANATIONS[index]}>
      <span className={index === 'sin_ajuste' ? `${styles.badge} ${styles.sinAjuste}` : styles.badge} {...rest}>
        {LABELS[index]}
        <InfoCircleOutlined className={styles.icon} />
      </span>
    </Tooltip>
  )
}
