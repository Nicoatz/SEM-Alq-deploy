/**
 * catalogo.ts — los tipos de reclamo y los textos de los estados (US-14, US-15).
 *
 * Qué es: el catálogo fijo de US-14 ("pintura, reparación del inmueble,
 * reparación de artefactos, cobros, otro") con el texto de ayuda de las tarjetas
 * del alta (Claude Design, "Reclamos" · 01). En real, el id de cada tipo sale de
 * `GET /reclamos/tipos`; el nombre y la ayuda, de acá.
 *
 * Quién lo usa: `services/reclamos.service.ts`, sus adaptadores y `components/reclamos/*`.
 */
import type { ClaimStatus } from '@rentar/shared-types'
import type { TipoReclamoNombre, TipoReclamoVista } from './tipos'

/**
 * Los cinco tipos, en el orden del diseño. Los ids coinciden con los del
 * catálogo del back (`tipo_reclamo`, migración `20261109000000_us14_reclamos.sql`),
 * así el modo mock usa los mismos.
 */
export const TIPOS_RECLAMO: readonly TipoReclamoVista[] = [
  { id: 1, nombre: 'pintura', label: 'Pintura', ayuda: 'Paredes, techos, aberturas' },
  { id: 2, nombre: 'reparacion_inmueble', label: 'Reparación del inmueble', ayuda: 'Cañerías, humedad, pisos, techos' },
  { id: 3, nombre: 'reparacion_artefactos', label: 'Reparación de artefactos', ayuda: 'Calefón, cocina, aire, portero' },
  { id: 4, nombre: 'cobros', label: 'Cobros', ayuda: 'Montos, recibos, pagos' },
  { id: 5, nombre: 'otro', label: 'Otro', ayuda: 'Lo que no entre arriba' },
]

/** "Reparación del inmueble". Un nombre desconocido se muestra tal cual. */
export function labelTipoReclamo(nombre: TipoReclamoNombre | string): string {
  return TIPOS_RECLAMO.find((tipo) => tipo.nombre === nombre)?.label ?? nombre
}

/** Estados en plural, para el subtítulo y las pestañas ("1 abierto · 2 en proceso"). */
export const ESTADO_RECLAMO_TEXTO: Record<ClaimStatus, { singular: string; plural: string; pestania: string }> = {
  abierto: { singular: 'abierto', plural: 'abiertos', pestania: 'Abiertos' },
  en_proceso: { singular: 'en proceso', plural: 'en proceso', pestania: 'En proceso' },
  resuelto: { singular: 'resuelto', plural: 'resueltos', pestania: 'Resueltos' },
  cancelado: { singular: 'cancelado', plural: 'cancelados', pestania: 'Cancelados' },
}

/** Orden de los estados en el subtítulo y en las pestañas. */
export const ESTADOS_RECLAMO: readonly ClaimStatus[] = ['abierto', 'en_proceso', 'resuelto', 'cancelado']

/**
 * Código visible del reclamo: `RCL-<año>-<id con 4 dígitos>` (decisión del PO, 24/11).
 * El año es el del registro.
 */
export function codigoReclamo(id: number | string, creadoEl: string): string {
  return `RCL-${creadoEl.slice(0, 4)}-${String(id).padStart(4, '0')}`
}
