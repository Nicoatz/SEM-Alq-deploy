/**
 * SimulatedFeatureNotice.tsx — aviso de que una función está simulada (por ejemplo, el email de
 * confirmación).
 *
 * Quién lo usa: el registro (US-19) y el catálogo.
 */
import { Alert } from 'antd'

/** Props de {@link SimulatedFeatureNotice}. */
interface SimulatedFeatureNoticeProps {
  /** Qué función es simulada, ej. "el pago" o "la firma electrónica". Si no se pasa, el mensaje queda genérico. */
  feature?: string
  /**
   * Por qué está simulada, como oración completa (ej. "El servidor todavía no
   * envía emails de confirmación."). Si no se pasa, se usa el motivo por
   * defecto: "no hay backend conectado en esta etapa". Sirve cuando el back
   * ya está conectado pero esa función puntual todavía no existe.
   */
  reason?: string
  'data-testid'?: string
}

/**
 * Aviso de que una función todavía es simulada (sin backend real detrás) —
 * pagos, firma electrónica, notificaciones. Sigue el principio de
 * "prototype honesty" de docs/PRODUCT.md: nunca simular que algo funciona
 * de verdad sin decirlo.
 */
export function SimulatedFeatureNotice({ feature, reason, ...rest }: SimulatedFeatureNoticeProps) {
  const funcion = feature ? `Esta función (${feature})` : 'Esta función'
  // Sin `reason`, el texto es exactamente el de siempre.
  const title = reason
    ? `${funcion} todavía es simulada. ${reason}`
    : `${funcion} todavía es simulada — no hay backend conectado en esta etapa.`
  return <Alert type="info" showIcon title={title} {...rest} />
}
