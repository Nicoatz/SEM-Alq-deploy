/**
 * getStatusMeta.ts — devuelve texto, color e ícono de un estado (tipado según el dominio).
 *
 * Quién lo usa: `StatusTag`.
 */
import { QuestionCircleFilled } from '@ant-design/icons'
import type { StatusDomain, StatusDomainMap } from '@rentar/shared-types'
import { statusMeta } from '../tokens/status-meta'
import type { StatusMeta } from '../tokens/status-meta'

/**
 * Devuelve `{ label, colorKey, icon }` para un estado de un dominio dado,
 * tipado en función de `domain` (si `domain` es `'cobro'`, `status` solo
 * acepta `PaymentStatus`). Es la fuente que consume `StatusTag`.
 *
 * Nunca devuelve `undefined`: si el dominio o el estado no están en
 * `statusMeta` (o `status` llega vacío), devuelve un fallback neutro con el
 * estado crudo como texto (o "—") y el ícono de pregunta.
 *
 * NOTA: el tipo no deja pasar un estado desconocido, pero en ejecución puede
 * llegar uno: un estado nuevo del back que todavía no está en `statusMeta`, o
 * un campo que el adaptador no completó. Antes eso devolvía `undefined` y
 * `StatusTag` rompía la pantalla entera ("Cannot read properties of undefined
 * (reading 'icon')"). Una etiqueta gris es mejor que una página caída; el
 * `console.warn` (solo en desarrollo) avisa que falta el estado en el mapa.
 *
 * @example
 * getStatusMeta('contrato', 'pendiente_firma')
 * // -> { label: 'Pendiente de firma', colorKey: 'warning', icon: ClockCircleFilled }
 * getStatusMeta('contrato', 'otro' as never)
 * // -> { label: 'otro', colorKey: 'neutral', icon: QuestionCircleFilled }
 */
export function getStatusMeta<D extends StatusDomain>(
  domain: D,
  status: StatusDomainMap[D] | null | undefined,
): StatusMeta {
  // Se lee como un mapa de strings sin tipar: justamente hay que cubrir los
  // dominios y estados que el tipo dice que no pueden llegar. `Object.hasOwn`
  // evita que un estado como "constructor" devuelva algo del prototipo.
  const metaByDomain: Record<string, Record<string, StatusMeta> | undefined> = statusMeta
  const domainMeta = Object.hasOwn(metaByDomain, domain) ? metaByDomain[domain] : undefined
  const meta =
    domainMeta && status != null && Object.hasOwn(domainMeta, status) ? domainMeta[status] : undefined
  if (meta) return meta

  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[getStatusMeta] Estado sin metadatos en statusMeta: domain="${String(domain)}", status="${String(status)}"`)
  }
  return { label: String(status ?? '—'), colorKey: 'neutral', icon: QuestionCircleFilled }
}
