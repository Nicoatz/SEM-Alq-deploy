/**
 * filtros.ts — pestañas, orden y agrupado de las listas de solicitudes.
 *
 * Qué es: funciones puras (sin React) que usan Solicitudes recibidas
 * (`/panel/solicitudes`) y Mis solicitudes (`/panel/mis-solicitudes`), así
 * se pueden leer y probar solas. Cubre US-36 Consultar solicitudes
 * (numeración de Jira).
 *
 * Reglas (Claude Design, "Flujo de solicitudes" · 02 y 04):
 * - Pestañas Pendientes, Aceptadas, Cerradas y Todas, con su contador.
 *   "Cerradas" junta rechazadas y canceladas: las dos son historia.
 * - El locador ve sus solicitudes agrupadas por propiedad.
 *
 * Quién lo usa: `components/solicitudes/*` y `components/mis-solicitudes/*`.
 */
import type { EstadoSolicitud, Solicitud } from '@rentar/shared-types'

// ─── Pestañas ───────────────────────────────────────────────────────────

/** Las pestañas de estado de las dos listas. */
export type PestaniaSolicitudes = 'pendientes' | 'aceptadas' | 'cerradas' | 'todas'

/** Qué estados entran en cada pestaña. `todas` no filtra. */
const ESTADOS_DE_PESTANIA: Record<Exclude<PestaniaSolicitudes, 'todas'>, readonly EstadoSolicitud[]> = {
  pendientes: ['pendiente'],
  aceptadas: ['aceptada'],
  cerradas: ['rechazada', 'cancelada'],
}

/** Una pestaña con su texto visible. */
export interface OpcionPestania {
  value: PestaniaSolicitudes
  label: string
}

/**
 * Pestañas de Solicitudes recibidas (· 02): primero Pendientes, porque es lo
 * que el locador tiene que responder.
 */
export const PESTANIAS_RECIBIDAS: readonly OpcionPestania[] = [
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'aceptadas', label: 'Aceptadas' },
  { value: 'cerradas', label: 'Cerradas' },
  { value: 'todas', label: 'Todas' },
]

/** Pestañas de Mis solicitudes (· 04): primero Todas, el locatario sigue todo lo que mandó. */
export const PESTANIAS_MIS: readonly OpcionPestania[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'aceptadas', label: 'Aceptadas' },
  { value: 'cerradas', label: 'Cerradas' },
]

/** `true` si la solicitud entra en esa pestaña. */
export function estaEnPestania(solicitud: Solicitud, pestania: PestaniaSolicitudes): boolean {
  return pestania === 'todas' || ESTADOS_DE_PESTANIA[pestania].includes(solicitud.status)
}

/** Cuántas solicitudes hay en cada pestaña. */
export function contarPorPestania(solicitudes: readonly Solicitud[]): Record<PestaniaSolicitudes, number> {
  return {
    pendientes: solicitudes.filter((item) => estaEnPestania(item, 'pendientes')).length,
    aceptadas: solicitudes.filter((item) => estaEnPestania(item, 'aceptadas')).length,
    cerradas: solicitudes.filter((item) => estaEnPestania(item, 'cerradas')).length,
    todas: solicitudes.length,
  }
}

// ─── Orden ──────────────────────────────────────────────────────────────

/** Orden de la lista del locador (· 02, "Más nuevas primero"). */
export type OrdenSolicitudes = 'recientes' | 'antiguas'

export const ORDEN_SOLICITUDES_OPTIONS: { value: OrdenSolicitudes; label: string }[] = [
  { value: 'recientes', label: 'Más nuevas primero' },
  { value: 'antiguas', label: 'Más viejas primero' },
]

/** Copia ordenada por fecha de envío. */
export function ordenarSolicitudes(solicitudes: readonly Solicitud[], orden: OrdenSolicitudes): Solicitud[] {
  const signo = orden === 'recientes' ? -1 : 1
  return [...solicitudes].sort((a, b) => signo * a.createdAt.localeCompare(b.createdAt))
}

// ─── Filtro por propiedad y agrupado (solo el locador) ──────────────────

/** Valor del filtro "Todas las propiedades". */
export const TODAS_LAS_PROPIEDADES = 'todas'

/** Opciones del filtro por propiedad: una por cada propiedad con solicitudes, por dirección. */
export function propiedadesConSolicitudes(solicitudes: readonly Solicitud[]): { value: string; label: string }[] {
  const porId = new Map<string, string>()
  for (const item of solicitudes) porId.set(item.property.id, item.property.address || 'Propiedad sin dirección')
  return [...porId.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))
}

/** Las solicitudes de una propiedad, con los datos de la propiedad para el encabezado del grupo. */
export interface GrupoSolicitudes {
  property: Solicitud['property']
  solicitudes: Solicitud[]
}

/**
 * Agrupa por propiedad (· 02: "Agrupadas por propiedad"). Respeta el orden
 * que ya trae la lista: cada grupo aparece donde aparece su primera solicitud.
 */
export function agruparPorPropiedad(solicitudes: readonly Solicitud[]): GrupoSolicitudes[] {
  const grupos = new Map<string, GrupoSolicitudes>()
  for (const item of solicitudes) {
    const grupo = grupos.get(item.property.id)
    if (grupo) grupo.solicitudes.push(item)
    else grupos.set(item.property.id, { property: item.property, solicitudes: [item] })
  }
  return [...grupos.values()]
}

/**
 * Lo que se ve en la lista del locador: pestaña, propiedad y orden.
 */
export function filtrarRecibidas(
  solicitudes: readonly Solicitud[],
  pestania: PestaniaSolicitudes,
  propertyId: string,
  orden: OrdenSolicitudes,
): Solicitud[] {
  const visibles = solicitudes.filter(
    (item) => estaEnPestania(item, pestania) && (propertyId === TODAS_LAS_PROPIEDADES || item.property.id === propertyId),
  )
  return ordenarSolicitudes(visibles, orden)
}

// ─── Cambios locales ────────────────────────────────────────────────────

/** Estado nuevo de una solicitud después de una acción, por id. */
export type CambiosSolicitudes = Record<string, Pick<Solicitud, 'status' | 'respondedAt'>>

/**
 * Aplica sobre la lista las respuestas de las acciones hechas en la pantalla
 * (aceptar, rechazar o cancelar), sin volver a pedirla. Toma de cada
 * respuesta SOLO el estado y la fecha: la dirección que trae puede ser la de
 * otra vista (ver `cancelarSolicitud`).
 */
export function aplicarCambios(solicitudes: readonly Solicitud[], cambios: CambiosSolicitudes): Solicitud[] {
  return solicitudes.map((item) => (cambios[item.id] ? { ...item, ...cambios[item.id] } : item))
}
