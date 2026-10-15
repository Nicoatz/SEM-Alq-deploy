/**
 * truncar.ts — acorta un texto largo para un listado, con "..." al final.
 *
 * Cubre: US-36 ("se debe mostrar el mensaje de rechazo en el listado de
 * solicitudes, hasta 80 caracteres (terminar con '...' si lo excede)").
 * Quién lo usa: las filas de Mis solicitudes (`FilaMiSolicitud`) y de
 * Solicitudes recibidas (`FilaSolicitudRecibida`).
 */

/** Cuántos caracteres del motivo del rechazo se muestran en el listado (US-36). */
export const MENSAJE_RECHAZO_LISTADO_MAX = 80

/**
 * Deja los primeros `max` caracteres del texto y agrega "..." si lo excede.
 * Si tiene `max` o menos, va completo y sin puntos.
 * NOTA: antes de los puntos se sacan los espacios del final, para que no
 * quede "palabra ..." (decisión del PO, tanda B). Los "..." no cuentan en los
 * `max` caracteres: con 81, se ven los primeros 80 más "..." (decisión del PO).
 *
 * Casos (con `max = 80`):
 * - 80 caracteres → el texto completo, sin "...".
 * - 81 caracteres → los primeros 80 + "...".
 * - 81 caracteres donde el 80.º es un espacio → los primeros 79 + "...".
 */
export function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto
  return `${texto.slice(0, max).trimEnd()}...`
}
