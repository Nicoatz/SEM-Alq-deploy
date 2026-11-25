/**
 * bandeja.ts — buscar, ordenar y encontrar conversaciones en Mensajes (US-24).
 *
 * Qué es: funciones puras (sin React) de `/panel/mensajes`.
 * Reglas (prompt de la Tanda C y decisiones del PO del 24/11 y 25/11):
 * - Orden por último mensaje: la más reciente arriba.
 * - Buscador por persona o propiedad (la dirección, cuando el back la manda).
 * - Sin leídas ni no leídas: no hay US ni back (decisión del PO, 24/11).
 * - Una conversación por persona y propiedad: antes de crear, se busca una que
 *   ya exista y se abre esa.
 *
 * Quién lo usa: `components/mensajes/*` y `services/mensajes.service.ts`.
 */
import { formatDate } from '@rentar/ui'
import type { ConversacionVista } from './tipos'

/** Más recientes arriba. Desempata por id, para que el orden sea estable. */
export function ordenarConversaciones(conversaciones: readonly ConversacionVista[]): ConversacionVista[] {
  return [...conversaciones].sort((a, b) => Date.parse(b.actualizadaEl) - Date.parse(a.actualizadaEl) || b.id.localeCompare(a.id))
}

/** Saca tildes y mayúsculas, para que "sofia" encuentre a "Sofía". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

/** Filtra por persona o propiedad. Un buscador vacío no filtra. */
export function filtrarConversaciones(conversaciones: readonly ConversacionVista[], busqueda: string): ConversacionVista[] {
  const buscado = normalizar(busqueda)
  if (!buscado) return [...conversaciones]
  return conversaciones.filter((item) => normalizar(item.otraPersona.nombre).includes(buscado) || normalizar(item.propiedad?.direccion ?? '').includes(buscado))
}

/**
 * La conversación que ya existe con esa persona por esa propiedad, si hay
 * (decisión del PO: "una conversación por persona y propiedad"). Sin propiedad,
 * cualquiera con esa persona que tampoco tenga propiedad.
 */
export function conversacionExistente(conversaciones: readonly ConversacionVista[], personaId: string, propiedadId: string | null): ConversacionVista | null {
  return conversaciones.find((item) => item.otraPersona.id === personaId && (item.propiedad?.id ?? null) === propiedadId) ?? null
}

/**
 * Fecha de la fila (Mensajes · 01): la hora si es de hoy, "ayer", el día de la
 * semana si es de los últimos 6 días ("lun") y si no, "12/09".
 */
export function fechaEnBandeja(fechaIso: string, hoyIso: string): string {
  const dia = (iso: string) => Date.parse(formatDate(iso, 'YYYY-MM-DD'))
  const dias = Math.round((dia(hoyIso) - dia(fechaIso)) / 86_400_000)
  if (dias <= 0) return formatDate(fechaIso, 'HH:mm')
  if (dias === 1) return 'ayer'
  if (dias < 7) return formatDate(fechaIso, 'ddd').replace('.', '')
  return formatDate(fechaIso, 'DD/MM')
}

/** La línea del último mensaje: "Vos: Dale, gracias." / "Mensaje eliminado" / "Todavía no hay mensajes". */
export function textoUltimoMensaje(conversacion: Pick<ConversacionVista, 'ultimoMensaje'>): string {
  const ultimo = conversacion.ultimoMensaje
  if (!ultimo) return 'Todavía no hay mensajes'
  const texto = ultimo.eliminado ? 'Mensaje eliminado' : ultimo.contenido.replace(/\s+/g, ' ').trim()
  return ultimo.esPropio ? `Vos: ${texto}` : texto
}

/** "Consulta por Obispo Trejo 1250, 7° B": el `asunto` obligatorio del back, que no se muestra. */
export function asuntoDeConversacion(direccion: string | null): string {
  return (direccion ? `Consulta por ${direccion}` : 'Consulta').slice(0, 150)
}
