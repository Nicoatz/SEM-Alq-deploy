/**
 * status-meta.ts — texto, color e ícono de cada estado de dominio (propiedad, contrato, cobro,
 * reclamo…).
 *
 * Quién lo usa: `StatusTag` (vía `getStatusMeta`) y `theme.ts`.
 */
import {
  CalendarOutlined,
  CheckCircleFilled,
  ClockCircleFilled,
  CloseCircleFilled,
  EditFilled,
  ExclamationCircleFilled,
  FlagFilled,
  PauseCircleFilled,
  StopFilled,
  SyncOutlined,
} from '@ant-design/icons'
import type { StatusDomain, StatusDomainMap } from '@rentar/shared-types'
import type { SemanticColorKey } from './semantic'

/**
 * En un archivo aparte de `semantic.ts` a propósito: `@ant-design/icons` usa
 * Context de React internamente, que no existe en Server Components. Si este
 * módulo se mezclara con `semantic.ts` (que sí importa `theme.ts`, usado
 * desde el layout raíz — un Server Component), el build fallaría con
 * "createContext is not a function". `theme.ts` nunca debe importar este
 * archivo, ni directa ni indirectamente a través del barrel `./tokens`.
 */

/** `label` + a qué color semántico y qué ícono corresponde un estado puntual. */
export interface StatusMeta {
  label: string
  colorKey: SemanticColorKey
  icon: typeof CheckCircleFilled
}

type StatusMetaMap = {
  [D in StatusDomain]: Record<StatusDomainMap[D], StatusMeta>
}

/**
 * Fuente de verdad de `getStatusMeta`: label en español + color semántico +
 * ícono para cada estado de cada dominio. Ver docs/DESIGN.md, sección
 * "Mapa de estados" para la justificación de cada asignación de color.
 */
export const statusMeta: StatusMetaMap = {
  propiedad: {
    publicada: { label: 'Publicada', colorKey: 'success', icon: CheckCircleFilled },
    pausada: { label: 'Pausada', colorKey: 'warning', icon: PauseCircleFilled },
    alquilada: { label: 'Alquilada', colorKey: 'info', icon: CheckCircleFilled },
    // Mismo colorKey que "alquilada" (parte de su mismo tono, sigue siendo
    // fundamentalmente una propiedad alquilada) — el ícono de calendario es
    // lo que la diferencia a simple vista de "alquilada" a secas, y el
    // colorKey 'info' ya la diferencia de "publicada" (success).
    alquilada_publicada: { label: 'Alquilada · publicada', colorKey: 'info', icon: CalendarOutlined },
  },
  contrato: {
    // Neutro: todavía no compromete a nadie. El lápiz lo separa de los otros neutros
    // (anulado, cancelada), que llevan el ícono de "detenido".
    borrador: { label: 'Borrador', colorKey: 'neutral', icon: EditFilled },
    pendiente_firma: { label: 'Pendiente de firma', colorKey: 'warning', icon: ClockCircleFilled },
    vigente: { label: 'Vigente', colorKey: 'success', icon: CheckCircleFilled },
    finalizado: { label: 'Finalizado', colorKey: 'info', icon: FlagFilled },
    // Rescindido se distingue de finalizado por color (error vs. info) y por ícono: finalizado
    // terminó en su fecha (bandera), rescindido se cortó antes (cruz).
    rescindido: { label: 'Rescindido', colorKey: 'error', icon: CloseCircleFilled },
  },
  firma: {
    pendiente: { label: 'Pendiente', colorKey: 'warning', icon: ClockCircleFilled },
    firmado: { label: 'Firmado', colorKey: 'success', icon: CheckCircleFilled },
    rechazado: { label: 'Rechazado', colorKey: 'error', icon: CloseCircleFilled },
  },
  cobro: {
    pendiente: { label: 'Pendiente', colorKey: 'warning', icon: ClockCircleFilled },
    pagado: { label: 'Pagado', colorKey: 'success', icon: CheckCircleFilled },
    vencido: { label: 'Vencido', colorKey: 'error', icon: ExclamationCircleFilled },
    anulado: { label: 'Anulado', colorKey: 'neutral', icon: StopFilled },
    parcial: { label: 'Pago parcial', colorKey: 'warning', icon: ExclamationCircleFilled },
  },
  reclamo: {
    abierto: { label: 'Abierto', colorKey: 'error', icon: ExclamationCircleFilled },
    en_proceso: { label: 'En proceso', colorKey: 'warning', icon: SyncOutlined },
    resuelto: { label: 'Resuelto', colorKey: 'success', icon: CheckCircleFilled },
    cerrado: { label: 'Cerrado', colorKey: 'neutral', icon: CheckCircleFilled },
  },
  suscripcion: {
    activa: { label: 'Activa', colorKey: 'success', icon: CheckCircleFilled },
    vencida: { label: 'Vencida', colorKey: 'error', icon: ExclamationCircleFilled },
    cancelada: { label: 'Cancelada', colorKey: 'neutral', icon: StopFilled },
  },
  solicitud: {
    pendiente: { label: 'Pendiente', colorKey: 'warning', icon: ClockCircleFilled },
    aceptada: { label: 'Aceptada', colorKey: 'success', icon: CheckCircleFilled },
    rechazada: { label: 'Rechazada', colorKey: 'error', icon: CloseCircleFilled },
    cancelada: { label: 'Cancelada', colorKey: 'neutral', icon: StopFilled },
  },
  usuario: {
    activo: { label: 'Activo', colorKey: 'success', icon: CheckCircleFilled },
    suspendido: { label: 'Suspendido', colorKey: 'error', icon: StopFilled },
    sin_verificar: { label: 'Sin verificar', colorKey: 'warning', icon: ExclamationCircleFilled },
  },
  factura: {
    pagada: { label: 'Pagada', colorKey: 'success', icon: CheckCircleFilled },
    rechazada: { label: 'Rechazada', colorKey: 'error', icon: CloseCircleFilled },
  },
}
