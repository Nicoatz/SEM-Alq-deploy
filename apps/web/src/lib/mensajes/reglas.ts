/**
 * reglas.ts — reglas de los mensajes de una conversación (US-24; también el chat del reclamo, US-18).
 *
 * Qué es: funciones puras (sin React ni services). La rama mock de los services
 * las aplica tal cual; el back aplica las mismas (`mensaje.service.ts` de `apps/api`).
 *
 * Criterios de US-24:
 * - "No se puede enviar un mensaje vacío o compuesto únicamente por espacios en blanco."
 * - "Se debe registrar y mostrar la fecha y hora exacta, con precisión de minutos."
 * - "No se permite editar un mensaje una vez enviado." (no hay acción de editar)
 * - "Se permite eliminar un mensaje propio ya enviado"; "no puede eliminar mensajes
 *   enviados por el otro participante".
 * - "Cada conversación debe conservar un historial de hasta 100 mensajes"; con el
 *   101, "se debe descartar el mensaje más antiguo".
 * US-18: en el chat del reclamo, el mensaje original y sus fotos no cuentan en los 100
 * (no son un mensaje: se muestran aparte, siempre arriba).
 *
 * Quién lo usa: `services/mensajes.service.ts` y `components/mensajes/*`.
 */
import { formatDate } from '@rentar/ui'
import type { MensajeChat } from './tipos'

/** US-24: "hasta 100 mensajes" por conversación. */
export const MENSAJES_MAX = 100

/** Mensaje vacío o solo con espacios (US-24). La pantalla deja Enviar deshabilitado; esto es el respaldo. */
export const MENSAJE_VACIO_MESSAGE = 'Escribí un mensaje: no puede estar vacío ni tener solo espacios.'

/** `true` si el texto se puede enviar: tiene algo más que espacios. */
export function textoEnviable(texto: string): boolean {
  return texto.trim().length > 0
}

/** `true` si el mensaje se puede eliminar: es propio y todavía no se eliminó. */
export function puedeEliminar(mensaje: Pick<MensajeChat, 'esPropio' | 'eliminadoEl'>): boolean {
  return mensaje.esPropio && mensaje.eliminadoEl === null
}

/**
 * Deja los últimos {@link MENSAJES_MAX}, del más viejo al más nuevo. Los
 * eliminados también cuentan (igual que en el back: la marca ocupa su lugar).
 */
export function aplicarLimite<T extends Pick<MensajeChat, 'enviadoEl'>>(mensajes: readonly T[]): T[] {
  const ordenados = [...mensajes].sort((a, b) => a.enviadoEl.localeCompare(b.enviadoEl))
  return ordenados.slice(Math.max(0, ordenados.length - MENSAJES_MAX))
}

// ─── Textos de fecha ────────────────────────────────────────────────────

/** "14/09/2026 · 10:41" (US-24: fecha y hora con minutos). */
export function fechaHoraMensaje(fechaIso: string): string {
  return `${formatDate(fechaIso)} · ${formatDate(fechaIso, 'HH:mm')}`
}

/** "Mensaje eliminado · 10:41": la hora en que se eliminó (decisión del PO, 24/11). */
export function textoMensajeEliminado(eliminadoEl: string): string {
  return `Mensaje eliminado · ${formatDate(eliminadoEl, 'HH:mm')}`
}

/** "Martes 15 de septiembre", para el separador de cada día. */
export function textoDia(fechaIso: string): string {
  const texto = formatDate(fechaIso, 'dddd D [de] MMMM')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** Clave del día ("2026-09-15") de una fecha ISO, en la hora local. */
export function diaDe(fechaIso: string): string {
  return formatDate(fechaIso, 'YYYY-MM-DD')
}
