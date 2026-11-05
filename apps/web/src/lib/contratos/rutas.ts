/**
 * rutas.ts — las rutas del flujo de contratos, en un solo lugar.
 *
 * Qué es: arma los links a los contratos. Desde el Sprint 4 no hay listado
 * general (US-43: "Los contratos se consultan únicamente desde el detalle de
 * la propiedad"): lo que antes volvía a `/panel/contratos` vuelve a la pestaña
 * Contratos de la propiedad o, si no se conoce la propiedad, a Mis propiedades.
 * Quién lo usa: `components/contratos/*`, `components/mi-propiedad/*`,
 * `components/panel/*` y `components/mis-propiedades/*`.
 */

/** Mis propiedades: donde se entra a los contratos de cada una. */
export const MIS_PROPIEDADES_HREF = '/panel/propiedades'

/** "Ver solicitudes aceptadas". */
export const SOLICITUDES_ACEPTADAS_HREF = '/panel/solicitudes?pestania=aceptadas'

/** La pestaña Contratos de una propiedad (US-43). */
export function contratosDePropiedadHref(propiedadId: string): string {
  return `/panel/propiedades/${encodeURIComponent(propiedadId)}?tab=contratos`
}

/** El detalle de un contrato (US-42). */
export function contratoHref(contratoId: string): string {
  return `/panel/contratos/${encodeURIComponent(contratoId)}`
}

/** Retomar un borrador en el alta, en el paso en que quedó (US-05). */
export function editarContratoHref(contratoId: string): string {
  return `${contratoHref(contratoId)}/editar`
}

/** Iniciar el contrato desde una solicitud aceptada (US-05). */
export function iniciarContratoHref(solicitudId: string): string {
  return `/panel/contratos/nuevo?solicitud=${encodeURIComponent(solicitudId)}`
}

/** Las solicitudes de una propiedad (US-43: "el acceso a las solicitudes de la propiedad"). */
export function solicitudesDePropiedadHref(propiedadId: string): string {
  return `/panel/solicitudes?pestania=todas&propiedad=${encodeURIComponent(propiedadId)}`
}
