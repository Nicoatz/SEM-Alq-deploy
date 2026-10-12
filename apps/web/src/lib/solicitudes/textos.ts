/**
 * textos.ts — la línea en castellano que acompaña al estado de cada solicitud.
 *
 * Qué es: Claude Design, "Flujo de solicitudes" · 07: "El estado nunca se
 * explica solo con el tag: al lado siempre hay una línea en castellano que
 * dice qué pasó y qué sigue". Se habla de vos ("te aceptaron", "todavía no
 * respondió"). Un texto para el locador (Solicitudes recibidas) y otro para
 * el postulante (Mis solicitudes). Cubre US-36 (numeración de Jira).
 *
 * NOTA: no se promete nada que no exista: el diseño dice "Suele responder en
 * 3 días", "Rocío te va a mandar el contrato" o "Escribile"; no hay datos ni
 * módulos detrás (contratos y mensajes son de otro sprint), así que no van.
 *
 * Quién lo usa: `components/solicitudes/*` y `components/mis-solicitudes/*`.
 */
import dayjs from 'dayjs'
import type { Solicitud } from '@rentar/shared-types'
import { diasDesde, textoHaceDias } from '@/lib/utils/fechas'

/** "14/09". */
export function fechaCorta(fecha: string): string {
  return dayjs(fecha).format('DD/MM')
}

/** "14/09/2026". */
export function fechaLargaNumerica(fecha: string): string {
  return dayjs(fecha).format('DD/MM/YYYY')
}

/** "hace 2 días", "ayer", "hoy" para la fecha de envío. */
export function enviadaHace(solicitud: Pick<Solicitud, 'createdAt'>): string {
  return textoHaceDias(diasDesde(solicitud.createdAt))
}

/** Primer nombre: "Julieta Peralta" → "Julieta". */
export function primerNombre(nombreCompleto: string): string {
  return nombreCompleto.trim().split(/\s+/)[0] ?? ''
}

// ─── Locador (Solicitudes recibidas · 02) ───────────────────────────────

/**
 * La fecha que va al lado del tag en la fila del locador: cuándo llegó si
 * está pendiente ("hace 2 días"), o cuándo se respondió ("aceptada el 14/09").
 */
export function fechaFilaRecibida(solicitud: Solicitud): string {
  if (solicitud.status === 'pendiente' || !solicitud.respondedAt) return enviadaHace(solicitud)
  const verbo = { aceptada: 'aceptada', rechazada: 'rechazada', cancelada: 'cancelada' }[solicitud.status]
  return `${verbo} el ${fechaCorta(solicitud.respondedAt)}`
}

/**
 * Qué pasó y qué sigue, para el locador.
 * @param aceptadaDeLaPropiedad la otra solicitud ya aceptada de la misma
 *   propiedad, si hay (una sola aceptada por propiedad).
 */
export function lineaRecibida(solicitud: Solicitud, aceptadaDeLaPropiedad: Solicitud | undefined): string {
  switch (solicitud.status) {
    case 'pendiente': {
      const mensaje = solicitud.message ? 'Te dejó un mensaje.' : 'Sin mensaje.'
      // Aceptar no rechaza a las demás: siguen esperando (· 02).
      return aceptadaDeLaPropiedad
        ? `${mensaje} Sigue esperando respuesta aunque ya aceptaste a ${primerNombre(aceptadaDeLaPropiedad.applicant.fullName)}.`
        : `${mensaje} Espera tu respuesta.`
    }
    case 'aceptada':
      // US-38: el locador puede dar de baja una aceptada para considerar a otro postulante.
      return 'La aceptaste. Si cambiás de idea, podés cancelarla y aceptar a otro postulante.'
    case 'rechazada':
      return 'La rechazaste. Puede volver a solicitar la propiedad mientras siga publicada.'
    case 'cancelada':
      return 'Cancelada. Ya no está entre las que esperan tu respuesta.'
  }
}

// ─── Postulante (Mis solicitudes · 04) ──────────────────────────────────

/** Qué pasó y qué sigue, para quien la envió. */
export function lineaMiSolicitud(solicitud: Solicitud): string {
  const respondida = solicitud.respondedAt ? fechaCorta(solicitud.respondedAt) : null
  switch (solicitud.status) {
    case 'pendiente':
      return `Enviada ${enviadaHace(solicitud)} · el dueño todavía no respondió.`
    case 'aceptada':
      // · 04: "No puede cancelar sola: si se arrepiente, se lo dice y el dueño cierra la solicitud" (US-38).
      return `${respondida ? `Te aceptaron el ${respondida}.` : 'Te aceptaron.'} Si te arrepentís, avisale al dueño: él puede cancelarla.`
    case 'rechazada':
      return `${respondida ? `La rechazaron el ${respondida}.` : 'La rechazaron.'} Podés volver a solicitarla mientras siga publicada.`
    case 'cancelada':
      return `${respondida ? `Cancelada el ${respondida}.` : 'Cancelada.'} Podés volver a solicitarla mientras siga publicada.`
  }
}
