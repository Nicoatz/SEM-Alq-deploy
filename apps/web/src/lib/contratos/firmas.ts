/**
 * firmas.ts — reglas de la firma, el rechazo y la modificación de un contrato enviado.
 *
 * Qué es: lógica pura (sin React ni services). Cubre US-07 Firmar contrato de
 * alquiler y US-06 Modificar. Las usan la pantalla (qué botón se ve y por qué
 * está deshabilitado) y la rama mock del service (que responde como el back),
 * así las dos dicen lo mismo.
 *
 * Decisiones del PO del 11/11 (se acepta lo que hizo el back): firman el
 * locador, el locatario y cada garante; rechazar vuelve el contrato a borrador;
 * no hay "Reenviar invitación".
 *
 * Quién lo usa: `components/contratos/DetalleContrato.tsx`,
 * `components/contratos/FirmaContrato.tsx`, `components/mi-propiedad/PestanaContratos.tsx`
 * y `services/contratos.service.ts`.
 */
import type { ContratoDetalle, FirmanteContrato, RolFirmante } from '@rentar/shared-types'
import dayjs from 'dayjs'

/** US-07: "un motivo opcional de hasta 300 caracteres". */
export const MOTIVO_RECHAZO_MAX = 300

/** Cómo se nombra cada rol en el detalle. */
export const NOMBRE_ROL: Record<RolFirmante, string> = {
  locador: 'Locador',
  locatario: 'Locatario',
  garante: 'Garante',
}

/** Fecha y hora para mostrar: "22/09/2026 a las 11:40". */
export function fechaYHora(iso: string): string {
  return dayjs(iso).format('DD/MM/YYYY [a las] HH:mm')
}

/** US-07: "se debe indicar cuántas firmas faltan" (garantes incluidos). */
export function firmasQueFaltan(firmantes: readonly FirmanteContrato[]): number {
  return firmantes.filter((firmante) => firmante.estado !== 'firmado').length
}

/**
 * ¿El locador puede modificar el contrato? En real decide el back
 * (`acciones.modificar`); en mock, la regla de US-06: "pendiente de firma sin la
 * firma del locatario". Las firmas del locador y de los garantes no cuentan: se borran.
 */
export function puedeModificar(contrato: Pick<ContratoDetalle, 'status' | 'firmantes' | 'modificarDelBack'>): boolean {
  if (contrato.modificarDelBack !== null) return contrato.modificarDelBack
  if (contrato.status !== 'pendiente_firma') return false
  return !contrato.firmantes.some((firmante) => firmante.rol === 'locatario' && firmante.estado === 'firmado')
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
