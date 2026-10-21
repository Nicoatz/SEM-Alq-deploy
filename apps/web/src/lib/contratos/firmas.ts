/**
 * firmas.ts — reglas de la firma, el rechazo, el reenvío y la cancelación.
 *
 * Qué es: lógica pura (sin React ni services). Cubre US-07 Firmar contrato de
 * alquiler. Las usan la pantalla (qué botón se ve y por qué está
 * deshabilitado) y la rama mock del service (que responde como el back), así
 * las dos dicen lo mismo.
 *
 * Decisiones del PO (Sprint 3): firman el locador y el locatario; el garante
 * es un dato del contrato y no firma.
 *
 * Quién lo usa: `components/contratos/DetalleContrato.tsx`,
 * `components/contratos/FirmaContrato.tsx` y `services/contratos.service.ts`.
 */
import type { ContratoDetalle, EventoContrato, FirmanteContrato, RolFirmante } from '@rentar/shared-types'
import dayjs from 'dayjs'

/** US-07: "como máximo una vez por hora". */
export const REENVIO_ESPERA_MINUTOS = 60

/** US-07: "un motivo opcional de hasta 300 caracteres". */
export const MOTIVO_RECHAZO_MAX = 300

/** Cómo se nombra cada rol en el detalle. */
export const NOMBRE_ROL: Record<RolFirmante, string> = {
  locador: 'Locador',
  locatario: 'Locatario',
}

/** Fecha y hora para mostrar: "22/09/2026 a las 11:40". */
export function fechaYHora(iso: string): string {
  return dayjs(iso).format('DD/MM/YYYY [a las] HH:mm')
}

/** US-07: "se debe indicar cuántas firmas faltan". */
export function firmasQueFaltan(firmantes: readonly FirmanteContrato[]): number {
  return firmantes.filter((firmante) => firmante.estado !== 'firmado').length
}

/**
 * Desde cuándo se puede volver a reenviar la invitación (fecha y hora ISO):
 * una hora después de la última. `null` si nunca se invitó.
 */
export function reenvioDisponibleDesde(firmante: Pick<FirmanteContrato, 'ultimaInvitacion'>): string | null {
  if (!firmante.ultimaInvitacion) return null
  return dayjs(firmante.ultimaInvitacion).add(REENVIO_ESPERA_MINUTOS, 'minute').format('YYYY-MM-DDTHH:mm:ss')
}

/**
 * ¿Se puede reenviar la invitación a este firmante? (US-07: "a un firmante
 * pendiente, como máximo una vez por hora. Mientras no pueda reenviar, el
 * botón debe explicar por qué".)
 * @returns `null` si se puede; si no, el motivo para mostrar en el botón.
 */
export function motivoSinReenvio(firmante: FirmanteContrato, ahoraIso: string): string | null {
  if (firmante.estado === 'firmado') return 'Ya firmó: no hace falta reenviarle la invitación.'
  if (firmante.estado === 'rechazado') return 'Rechazó la firma: para volver a invitarlo, cancelá el envío y volvé a enviarlo.'
  const desde = reenvioDisponibleDesde(firmante)
  if (desde && dayjs(ahoraIso).isBefore(dayjs(desde))) {
    return `La invitación se envió a las ${dayjs(firmante.ultimaInvitacion).format('HH:mm')}. Se puede reenviar una vez por hora: de nuevo desde las ${dayjs(desde).format('HH:mm')}.`
  }
  return null
}

/**
 * ¿El locador puede cancelar el envío? (US-07: "mientras ninguna otra parte
 * haya firmado". La firma del propio locador no cuenta: se borra.)
 */
export function puedeCancelarEnvio(contrato: Pick<ContratoDetalle, 'status' | 'firmantes'>): boolean {
  if (contrato.status !== 'pendiente_firma') return false
  return !contrato.firmantes.some((firmante) => firmante.rol !== 'locador' && firmante.estado === 'firmado')
}

/** El motivo del rechazo, limpio: sin espacios a los costados y `null` si quedó vacío. */
export function normalizarMotivoRechazo(motivo: string | null | undefined): string | null {
  const limpio = (motivo ?? '').trim()
  return limpio === '' ? null : limpio
}

/** Error del motivo (US-07: "hasta 300 caracteres"), o `null`. */
export function errorDeMotivoRechazo(motivo: string | null | undefined): string | null {
  const limpio = normalizarMotivoRechazo(motivo)
  return limpio && limpio.length > MOTIVO_RECHAZO_MAX ? `El motivo puede tener hasta ${MOTIVO_RECHAZO_MAX} caracteres.` : null
}

/** Título de cada evento del historial (US-07), en la voz del detalle. */
export function tituloDeEvento(evento: EventoContrato): string {
  const quien = evento.nombre ?? (evento.rol ? NOMBRE_ROL[evento.rol] : '')
  switch (evento.tipo) {
    case 'creado':
      return 'Se creó el borrador'
    case 'enviado':
      return 'Se envió a firmar'
    case 'firmado':
      return `Firmó ${quien}`
    case 'rechazado':
      return `${quien} rechazó la firma`
    case 'reenviado':
      return `Se le reenvió la invitación a ${quien}`
    case 'envio_cancelado':
      return 'Se canceló el envío: volvió a borrador'
    case 'vigente':
      return 'Firmado por todas las partes: el contrato está vigente'
  }
}
