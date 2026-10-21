'use client'

/**
 * StatusTag.tsx — etiqueta de estado (propiedad, contrato, cobro, reclamo…) con color e ícono de
 * `statusMeta`.
 *
 * Quién lo usa: `/panel`, `/panel/propiedades`, el alta y el catálogo.
 */
import { Tag } from 'antd'
import type { StatusDomain, StatusDomainMap } from '@rentar/shared-types'
import type { SemanticColorKey } from '../../tokens/semantic'
import type { StatusMeta } from '../../tokens/status-meta'
import { getStatusMeta } from '../../utils/getStatusMeta'
import styles from './StatusTag.module.css'

/**
 * Mapea cada color semántico a su clase de `StatusTag.module.css`. Antes
 * usábamos los presets de color de `Tag` (`success`/`warning`/`processing`/
 * ...), pero esos presets derivan fondo y texto de `colorSuccess`/
 * `colorWarning`/etc. del `ConfigProvider` — tokens pensados como tinta de
 * texto (oscuros y desaturados), no como semilla de paleta, así que antd
 * generaba un fondo pastel lavado con texto de bajo contraste. Estas clases
 * fijan fondo/tinta/borde a mano por `colorKey` (`--rentar-status-*` en
 * css-vars.css, con su propio par para `[data-rentar-theme='dark']`),
 * verificado ≥4.5:1 de contraste texto/fondo en ambos temas.
 */
const TAG_CLASS_BY_KEY: Record<SemanticColorKey, string> = {
  success: styles.success,
  warning: styles.warning,
  error: styles.error,
  info: styles.info,
  neutral: styles.neutral,
  money: styles.money,
}

/**
 * Props de {@link StatusTag}. `D` lleva default (`= StatusDomain`, la unión
 * completa) para que herramientas que leen el `.d.ts` sin hacer inferencia
 * real de tipos (el extractor de `/design-sync`, entre otras) tengan un tipo
 * concreto para resolver — sin default, algunas de esas herramientas emiten
 * un `StatusTagProps` con `D` y `StatusDomainMap[D]` sin resolver, y sintetizan
 * un ejemplo vacío (`{}`) en vez de valores reales. No afecta la inferencia en
 * los call sites reales (`<StatusTag domain="contrato" status="..." />` sigue
 * angostando `D` a `'contrato'` como siempre).
 */
interface StatusTagProps<D extends StatusDomain = StatusDomain> {
  /** Dominio del estado (`'propiedad'`, `'contrato'`, etc.). */
  domain: D
  /** Estado dentro de ese dominio — tipado en función de `domain`. */
  status: StatusDomainMap[D]
  'data-testid'?: string
}

/**
 * Tag de estado de dominio (propiedad, contrato, firma, cobro, reclamo,
 * suscripción): resuelve label + color + ícono desde `getStatusMeta`, así
 * que ningún componente de la app tiene que decidir a mano qué color le
 * corresponde a un estado.
 *
 * @example
 * <StatusTag domain="contrato" status="pendiente_firma" />
 */
export function StatusTag<D extends StatusDomain = StatusDomain>({ domain, status, ...rest }: StatusTagProps<D>) {
  // `getStatusMeta` nunca devuelve undefined (con un estado desconocido da un
  // fallback neutro), pero igual no se asume el ícono: si una entrada de
  // `statusMeta` quedara sin ícono, la etiqueta sale sin él en vez de romper.
  const meta = getStatusMeta(domain, status)
  const Icon: StatusMeta['icon'] | undefined = meta.icon

  return (
    <Tag className={TAG_CLASS_BY_KEY[meta.colorKey] ?? styles.neutral} icon={Icon ? <Icon /> : undefined} {...rest}>
      {meta.label}
    </Tag>
  )
}
