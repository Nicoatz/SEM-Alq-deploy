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
import type { GarantiaOfrecida, ResumenSolicitud, Solicitud } from '@rentar/shared-types'
import { textoHaceHorasODias } from '@/lib/utils/fechas'
import { GARANTIA_LABEL } from '@/lib/validation/solicitud.rules'

/** "14/09". */
export function fechaCorta(fecha: string): string {
  return dayjs(fecha).format('DD/MM')
}

/** "14/09/2026". */
export function fechaLargaNumerica(fecha: string): string {
  return dayjs(fecha).format('DD/MM/YYYY')
}

/**
 * Cuánto hace que se envió: "hace menos de 1 h", "hace 3 h", "hace 2 días".
 * US-36: en horas durante las primeras 23 y en días desde las 24 (P4 del
 * testing del Sprint 2: antes decía "hoy"). `createdAt` trae la hora
 * (`fecha_creacion` es TIMESTAMPTZ y el adaptador la pasa entera).
 */
export function enviadaHace(solicitud: Pick<Solicitud, 'createdAt'>): string {
  return textoHaceHorasODias(solicitud.createdAt)
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
 * "A", "A y B", "A, B y C": une una lista como se diría en castellano.
 * Los elementos después del primero van con minúscula inicial ("Garantía
 * propietaria y seguro de caución").
 */
function unirConY(items: readonly string[]): string {
  const [primero, ...resto] = items.map((item, indice) => (indice === 0 ? item : item.charAt(0).toLowerCase() + item.slice(1)))
  if (resto.length === 0) return primero ?? ''
  const ultimo = resto.pop()
  return `${[primero, ...resto].join(', ')} y ${ultimo}`
}

/** La garantía en el resumen: "Otra" sola no se entiende fuera del formulario. */
function garantiaEnResumen(garantia: GarantiaOfrecida): string {
  return garantia === 'otra' ? 'Otra garantía' : GARANTIA_LABEL[garantia]
}

/**
 * El resumen de la fila del locador (US-36: "cantidad de convivientes, si
 * posee mascotas, tipo de garantía, si declaró o no ingresos"):
 * "2 personas · Sin mascotas · Garantía propietaria y seguro de caución · Declaró ingresos: sí".
 * - Personas: "1 persona" en singular.
 * - Garantías: con " y " entre dos, y con comas si son más ("…, … y …");
 *   sin ninguna, "Sin garantía".
 * - Ingresos: solo sí o no. NOTA: nunca el monto (dato sensible, solo en el detalle).
 */
export function textoResumen(resumen: ResumenSolicitud): string {
  const personas = `${resumen.residents} ${resumen.residents === 1 ? 'persona' : 'personas'}`
  const mascotas = resumen.hasPets ? 'Con mascotas' : 'Sin mascotas'
  const garantias = resumen.guarantees.length ? unirConY(resumen.guarantees.map(garantiaEnResumen)) : 'Sin garantía'
  const ingresos = `Declaró ingresos: ${resumen.declaredIncome ? 'sí' : 'no'}`
  return [personas, mascotas, garantias, ingresos].join(' · ')
}

/**
 * Qué pasó y qué sigue, para el locador.
 * NOTA: no dice si dejó un mensaje: desde la tanda C la fila muestra el
 * extracto (o "Sin mensaje.") y el detalle, el mensaje completo.
 * @param aceptadaDeLaPropiedad la otra solicitud ya aceptada de la misma
 *   propiedad, si hay (una sola aceptada por propiedad).
 */
export function lineaRecibida(solicitud: Solicitud, aceptadaDeLaPropiedad: Solicitud | undefined, sePuedeCancelarAceptada = true): string {
  switch (solicitud.status) {
    case 'pendiente': {
      // Aceptar no rechaza a las demás: siguen esperando (· 02).
      return aceptadaDeLaPropiedad
        ? `Sigue esperando respuesta aunque ya aceptaste a ${primerNombre(aceptadaDeLaPropiedad.applicant.fullName)}.`
        : 'Espera tu respuesta.'
    }
    case 'aceptada':
      // US-38: el locador puede dar de baja una aceptada para considerar a otro postulante
      // (si el back lo permite: `solicitudes.service#puedeCancelarAceptada`).
      return sePuedeCancelarAceptada ? 'La aceptaste. Si cambiás de idea, podés cancelarla y aceptar a otro postulante.' : 'La aceptaste.'
    case 'rechazada':
      return 'La rechazaste. Puede volver a solicitar la propiedad mientras siga publicada.'
    case 'cancelada':
      return 'Cancelada. Ya no está entre las que esperan tu respuesta.'
  }
}

// ─── Postulante (Mis solicitudes · 04) ──────────────────────────────────

/** Qué pasó y qué sigue, para quien la envió. */
export function lineaMiSolicitud(solicitud: Solicitud, sePuedeCancelarAceptada = true): string {
  const respondida = solicitud.respondedAt ? fechaCorta(solicitud.respondedAt) : null
  switch (solicitud.status) {
    case 'pendiente':
      return `Enviada ${enviadaHace(solicitud)} · el dueño todavía no respondió.`
    case 'aceptada':
      // · 04: "No puede cancelar sola: si se arrepiente, se lo dice y el dueño cierra la solicitud" (US-38).
      // Mientras el back no deje cancelarla (`puedeCancelarAceptada`), no se promete que el dueño pueda.
      return `${respondida ? `Te aceptaron el ${respondida}.` : 'Te aceptaron.'}${sePuedeCancelarAceptada ? ' Si te arrepentís, avisale al dueño: él puede cancelarla.' : ''}`
    case 'rechazada':
      return `${respondida ? `La rechazaron el ${respondida}.` : 'La rechazaron.'} Podés volver a solicitarla mientras siga publicada.`
    case 'cancelada':
      return `${respondida ? `Cancelada el ${respondida}.` : 'Cancelada.'} Podés volver a solicitarla mientras siga publicada.`
  }
}
