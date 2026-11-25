/**
 * filtros.ts — pestañas, filtro por tipo, orden y agrupado del listado de reclamos (US-15).
 *
 * Qué es: funciones puras (sin React) que usa `/panel/reclamos`, así se pueden
 * leer y probar solas.
 *
 * Reglas (prompt de la Tanda A y Claude Design, "Reclamos" · 02):
 * - Pestañas Todos, Abiertos, En proceso, Resueltos y Cancelados, con contador.
 * - Filtro por tipo ("Todos los tipos") y orden: más recientes primero.
 * - El locador ve los reclamos agrupados por propiedad; el locatario, sin agrupar.
 * - Cada reclamo muestra un fragmento del mensaje (el completo va en el detalle).
 *
 * NOTA: el filtro por estado y por tipo se hace acá, también en real:
 * `GET /reclamos?estado=` no filtra (brecha P0) y no hay filtro por tipo.
 *
 * Quién lo usa: `components/reclamos/Reclamos.tsx` y sus filas.
 */
import type { ClaimStatus } from '@rentar/shared-types'
import { truncar } from '@/lib/utils/truncar'
import { ESTADO_RECLAMO_TEXTO, ESTADOS_RECLAMO } from './catalogo'
import type { PropiedadReclamo, Reclamo, TipoReclamoNombre } from './tipos'

// ─── Pestañas ───────────────────────────────────────────────────────────

/** Las pestañas de estado: `todos` o un estado. */
export type PestaniaReclamos = 'todos' | ClaimStatus

/** Pestañas en el orden del diseño. */
export const PESTANIAS_RECLAMOS: readonly { value: PestaniaReclamos; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...ESTADOS_RECLAMO.map((estado) => ({ value: estado, label: ESTADO_RECLAMO_TEXTO[estado].pestania })),
]

/** Valor del filtro por tipo que no filtra. */
export const TODOS_LOS_TIPOS = 'todos'
export type FiltroTipoReclamo = TipoReclamoNombre | typeof TODOS_LOS_TIPOS

/** Cuántos reclamos hay en cada pestaña (sobre la lista ya filtrada por tipo). */
export function contarPorPestania(reclamos: readonly Reclamo[]): Record<PestaniaReclamos, number> {
  const contadores: Record<PestaniaReclamos, number> = { todos: reclamos.length, abierto: 0, en_proceso: 0, resuelto: 0, cancelado: 0 }
  for (const reclamo of reclamos) contadores[reclamo.estado] += 1
  return contadores
}

/** Filtra por tipo. */
export function filtrarPorTipo(reclamos: readonly Reclamo[], tipo: FiltroTipoReclamo): Reclamo[] {
  return tipo === TODOS_LOS_TIPOS ? [...reclamos] : reclamos.filter((reclamo) => reclamo.tipo === tipo)
}

/** Filtra por pestaña. */
export function filtrarPorPestania(reclamos: readonly Reclamo[], pestania: PestaniaReclamos): Reclamo[] {
  return pestania === 'todos' ? [...reclamos] : reclamos.filter((reclamo) => reclamo.estado === pestania)
}

// ─── Orden ──────────────────────────────────────────────────────────────

/** Más recientes primero (prompt de la Tanda A). Desempata por código, para que el orden sea estable. */
export function ordenarRecientes(reclamos: readonly Reclamo[]): Reclamo[] {
  return [...reclamos].sort((a, b) => b.creadoEl.localeCompare(a.creadoEl) || b.codigo.localeCompare(a.codigo))
}

// ─── Agrupado (vista del locador) ───────────────────────────────────────

/** Los reclamos de una propiedad, con su locatario (Claude Design, "Reclamos" · 02). */
export interface GrupoReclamos {
  propiedad: PropiedadReclamo
  locatario: Reclamo['locatario']
  reclamos: Reclamo[]
}

/**
 * Agrupa por propiedad, respetando el orden recibido: la propiedad del reclamo
 * más reciente va primero, y adentro de cada grupo el orden no cambia.
 * NOTA: el grupo lleva el locatario del reclamo más reciente. Si una propiedad
 * cambió de locatario, los reclamos viejos quedan en el mismo grupo (el diseño
 * agrupa por propiedad, no por contrato).
 */
export function agruparPorPropiedad(reclamos: readonly Reclamo[]): GrupoReclamos[] {
  const grupos = new Map<string, GrupoReclamos>()
  for (const reclamo of reclamos) {
    const grupo = grupos.get(reclamo.propiedad.id)
    if (grupo) grupo.reclamos.push(reclamo)
    else grupos.set(reclamo.propiedad.id, { propiedad: reclamo.propiedad, locatario: reclamo.locatario, reclamos: [reclamo] })
  }
  return [...grupos.values()]
}

// ─── Textos ─────────────────────────────────────────────────────────────

/** Cuántos caracteres del mensaje se ven en el listado (US-15: "un fragmento del mensaje"). */
export const FRAGMENTO_MENSAJE_MAX = 110

/** El comienzo del mensaje, en una línea. */
export function fragmentoMensaje(mensaje: string): string {
  return truncar(mensaje.replace(/\s+/g, ' ').trim(), FRAGMENTO_MENSAJE_MAX)
}

/** Subtítulo del listado (· 02): "1 abierto · 1 en proceso · 1 resuelto · 1 cancelado". Solo los estados que hay. */
export function resumenEstados(reclamos: readonly Reclamo[]): string {
  const contadores = contarPorPestania(reclamos)
  return ESTADOS_RECLAMO.filter((estado) => contadores[estado] > 0)
    .map((estado) => `${contadores[estado]} ${contadores[estado] === 1 ? ESTADO_RECLAMO_TEXTO[estado].singular : ESTADO_RECLAMO_TEXTO[estado].plural}`)
    .join(' · ')
}

/** "2 fotos" / "1 foto" / "sin fotos". */
export function fotosTexto(cantidad: number): string {
  if (cantidad === 0) return 'sin fotos'
  return `${cantidad} ${cantidad === 1 ? 'foto' : 'fotos'}`
}
