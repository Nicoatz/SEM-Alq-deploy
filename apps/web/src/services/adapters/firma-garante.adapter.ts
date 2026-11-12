/**
 * firma-garante.adapter.ts — la página pública del garante: DTO → vista y errores → mensajes.
 *
 * Qué es: traduce `GET /firma-garante/:token` a `FirmaGarantePublica` y los
 * errores de las dos rutas públicas a mensajes en español.
 * Cubre: US-07 Firmar contrato de alquiler, "Garantes": "Si el enlace no existe,
 * venció o ya se usó, se debe mostrar el mismo mensaje en los tres casos".
 * Quién lo usa: `services/firma-garante.service.ts` (también su rama mock, así
 * responde igual que el back).
 */
import type { FirmaGarantePublica } from '@rentar/shared-types'
import type { ConsultaEnlaceGaranteResponse } from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'

/** El mismo texto que el back para cualquier enlace que no sirve (US-07): no se distingue el motivo. */
export const ENLACE_INVALIDO_MESSAGE = 'Este enlace no es válido o ya no está disponible.'
/** 429: más de 30 pedidos en 10 minutos desde la misma IP (guía del back, §3.6). */
export const DEMASIADOS_INTENTOS_MESSAGE = 'Demasiados intentos, esperá unos minutos.'
export const ENLACE_ERROR_GENERICO_MESSAGE = 'No pudimos abrir el enlace. Probá de nuevo en unos minutos.'
const SOBRE_NO_DISPONIBLE_MESSAGE = 'La firma todavía no está lista. Probá de nuevo en unos minutos.'
const DOCUSIGN_ERROR_MESSAGE = 'No pudimos abrir la firma en DocuSign. Probá de nuevo en unos minutos.'
const SIN_RED_MESSAGE = 'No pudimos conectarnos con el servidor. Revisá tu conexión y probá de nuevo.'

/** `GET /firma-garante/:token` → lo que ve el garante. Solo lo que manda el back. */
export function firmaGaranteDeDto(dto: ConsultaEnlaceGaranteResponse): FirmaGarantePublica {
  return {
    nombre: [dto.garante.nombre, dto.garante.apellido].filter(Boolean).join(' '),
    codigo: dto.contrato.codigo,
    propiedad: dto.contrato.propiedad,
    venceEl: dto.vence_en,
  }
}

/**
 * Error de las rutas públicas del garante → mensaje de la pantalla:
 * - 404 (inexistente, vencido, usado, mal formado o contrato que ya no está
 *   pendiente) → siempre {@link ENLACE_INVALIDO_MESSAGE}, `not_found`.
 * - 429 → {@link DEMASIADOS_INTENTOS_MESSAGE}.
 * - 400 `FALTA_ACEPTAR_CONDICIONES` → el texto del back (pide la casilla).
 * - 409 `SOBRE_NO_DISPONIBLE` y 502 (DocuSign no respondió) → se puede reintentar.
 * - Sin red u otro 5xx → mensajes genéricos, nunca el texto técnico.
 */
export function errorDeFirmaGarante(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'not_found') return new ServiceError('not_found', ENLACE_INVALIDO_MESSAGE)
  if (error.code === 'too_many_requests') return new ServiceError('too_many_requests', DEMASIADOS_INTENTOS_MESSAGE)
  if (error.code === 'validation') return new ServiceError('validation', error.message, error.apiCode)
  if (error.code === 'conflict') return new ServiceError('conflict', SOBRE_NO_DISPONIBLE_MESSAGE, error.apiCode)
  if (error.code === 'server' && error.status === 502) return new ServiceError('server', DOCUSIGN_ERROR_MESSAGE)
  if (error.code === 'network') return new ServiceError('network', SIN_RED_MESSAGE)
  return new ServiceError('server', ENLACE_ERROR_GENERICO_MESSAGE)
}
