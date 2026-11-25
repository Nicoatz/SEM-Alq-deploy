/**
 * reglas.ts — quién puede hacer qué con un reclamo y cómo cambia su estado (US-15 a US-18).
 *
 * Qué es: funciones puras (sin React ni services) con los permisos y las
 * transiciones. La rama mock de `reclamos.service.ts` las aplica tal cual; el back
 * aplica las mismas (ver las brechas en `docs/HANDOFF-BACKEND.md` §7).
 *
 * Reglas (US y decisiones del PO del 24/11):
 * - Estados: abierto → en proceso → resuelto, o cancelado. Resuelto y cancelado son finales.
 * - El locador no cambia estados: el reclamo pasa solo a "en proceso" con su
 *   primera respuesta (US-18).
 * - Solo el locatario que lo registró lo marca como resuelto, y solo desde "en
 *   proceso" (US-16), o lo cancela, desde "abierto" o "en proceso" (US-17).
 * - Chat del reclamo: el locador escribe con el reclamo abierto o en proceso
 *   (US-18); el locatario, solo en proceso (con el reclamo abierto espera la
 *   respuesta). Resuelto o cancelado: solo lectura para los dos.
 * - Cualquier otro usuario no ve el reclamo: recibe el mismo "no encontrado".
 *
 * Quién lo usa: `services/reclamos.service.ts` y `components/reclamos/*`.
 */
import type { ClaimStatus } from '@rentar/shared-types'
import type { Reclamo } from './tipos'

/** Estados desde los que no se sale (US-16 y US-17). */
const ESTADOS_FINALES: readonly ClaimStatus[] = ['resuelto', 'cancelado']

/** `true` si el reclamo está resuelto o cancelado. */
export function esEstadoFinal(estado: ClaimStatus): boolean {
  return ESTADOS_FINALES.includes(estado)
}

/** Resultado de una regla: si se permite y, si no, por qué (para el botón deshabilitado o el error). */
export type Permiso = { permitido: true } | { permitido: false; motivo: string }

const PERMITIDO: Permiso = { permitido: true }

// ─── Mensajes ───────────────────────────────────────────────────────────

/** Motivo del "Marcar como resuelto" deshabilitado con el reclamo abierto (prompt de la Tanda B). */
export const ESPERA_RESPUESTA_MOTIVO = 'Esperá la respuesta del locador'
/** Un reclamo ajeno o inexistente (US-16 a US-18: "siendo un usuario distinto… (falla)"). */
export const RECLAMO_NO_ENCONTRADO_MESSAGE = 'No encontramos este reclamo.'

/** "Este reclamo ya está resuelto: no se puede cancelar" (el estado cambió en otra pestaña). */
export function textoEstadoYaCambio(estado: ClaimStatus, accion: 'resolver' | 'cancelar' | 'responder'): string {
  const ya = estado === 'en_proceso' ? 'ya está en proceso' : estado === 'abierto' ? 'todavía está abierto' : `ya está ${estado}`
  const verbo = accion === 'resolver' ? 'marcar como resuelto' : accion
  return `Este reclamo ${ya}: no se puede ${verbo}.`
}

// ─── Quién es quién ─────────────────────────────────────────────────────

/** `true` si el usuario es el locatario que registró el reclamo. */
export function esLocatarioDelReclamo(reclamo: Pick<Reclamo, 'locatario'>, usuarioId: string): boolean {
  return reclamo.locatario.id === usuarioId
}

/** `true` si el usuario es el locador dueño de la propiedad del reclamo. */
export function esLocadorDelReclamo(reclamo: Pick<Reclamo, 'locador'>, usuarioId: string): boolean {
  return reclamo.locador.id === usuarioId
}

/** `true` si el usuario puede ver el reclamo (es una de las dos partes). */
export function puedeVerReclamo(reclamo: Pick<Reclamo, 'locador' | 'locatario'>, usuarioId: string): boolean {
  return esLocatarioDelReclamo(reclamo, usuarioId) || esLocadorDelReclamo(reclamo, usuarioId)
}

// ─── Acciones del locatario (US-16 y US-17) ─────────────────────────────

/**
 * US-16 — marcar como resuelto: solo el locatario que lo registró y solo con el
 * reclamo en proceso ("No se puede marcar como resuelto un reclamo en estado
 * 'abierto', 'resuelto' o 'cancelado'").
 */
export function puedeResolver(reclamo: Pick<Reclamo, 'estado' | 'locatario'>, usuarioId: string): Permiso {
  if (!esLocatarioDelReclamo(reclamo, usuarioId)) return { permitido: false, motivo: 'Solo el locatario que registró el reclamo puede marcarlo como resuelto.' }
  if (reclamo.estado === 'abierto') return { permitido: false, motivo: ESPERA_RESPUESTA_MOTIVO }
  if (reclamo.estado !== 'en_proceso') return { permitido: false, motivo: textoEstadoYaCambio(reclamo.estado, 'resolver') }
  return PERMITIDO
}

/**
 * US-17 — cancelar: solo el locatario que lo registró y solo con el reclamo
 * abierto o en proceso.
 */
export function puedeCancelar(reclamo: Pick<Reclamo, 'estado' | 'locatario'>, usuarioId: string): Permiso {
  if (!esLocatarioDelReclamo(reclamo, usuarioId)) return { permitido: false, motivo: 'Solo el locatario que registró el reclamo puede cancelarlo.' }
  if (esEstadoFinal(reclamo.estado)) return { permitido: false, motivo: textoEstadoYaCambio(reclamo.estado, 'cancelar') }
  return PERMITIDO
}

// ─── Chat del reclamo (US-18) ───────────────────────────────────────────

/**
 * Si el usuario puede escribir en el chat del reclamo.
 * - Locador dueño: con el reclamo abierto (su primera respuesta) o en proceso (US-18).
 * - Locatario que lo registró: solo en proceso. Con el reclamo abierto ve
 *   "Esperando la respuesta de <locador>" (decisión del PO, 24/11).
 * - Resuelto o cancelado: solo lectura para los dos (decisión del PO, 24/11).
 */
export function puedeEscribirEnChat(reclamo: Pick<Reclamo, 'estado' | 'locador' | 'locatario'>, usuarioId: string): Permiso {
  if (esEstadoFinal(reclamo.estado)) return { permitido: false, motivo: `El reclamo está ${reclamo.estado}: el chat quedó de solo lectura.` }
  if (esLocadorDelReclamo(reclamo, usuarioId)) return PERMITIDO
  if (esLocatarioDelReclamo(reclamo, usuarioId)) {
    return reclamo.estado === 'en_proceso' ? PERMITIDO : { permitido: false, motivo: 'Esperando la respuesta del locador.' }
  }
  return { permitido: false, motivo: RECLAMO_NO_ENCONTRADO_MESSAGE }
}

/**
 * Estado después de que el locador escribe en el chat (US-18: "su estado debe
 * cambiar automáticamente de 'abierto' a 'en proceso'"). En cualquier otro
 * estado no cambia.
 */
export function estadoTrasRespuestaDelLocador(estado: ClaimStatus): ClaimStatus {
  return estado === 'abierto' ? 'en_proceso' : estado
}
