/**
 * eliminada.ts — el aviso "Eliminaste <dirección>." de Mis propiedades (US-04).
 *
 * Qué es: después de eliminar, el detalle vuelve a `/panel/propiedades` con
 * `?eliminada=<id>` (decisión del PO: aviso por query param, como el
 * `?solicitar=1` de la tanda 1). La dirección viaja aparte, en
 * `sessionStorage`, porque la propiedad ya no está en la lista para
 * buscarla. Si no hay `sessionStorage` (navegación privada, bloqueado), el
 * aviso dice "Eliminaste la propiedad." sin la dirección.
 * Quién lo usa: `MiPropiedad` (guarda) y `MisPropiedades` (lee y limpia).
 */

/** Query param del aviso. */
export const PARAM_ELIMINADA = 'eliminada'

/** Prefijo de la clave en `sessionStorage`. */
const CLAVE = 'rentar:eliminada:'

/** Guarda la dirección de la propiedad recién eliminada y devuelve el link a Mis propiedades con el aviso. */
export function hrefTrasEliminar(id: string, direccion: string): string {
  try {
    window.sessionStorage.setItem(`${CLAVE}${id}`, direccion)
  } catch {
    // Sin sessionStorage: el aviso sale sin la dirección.
  }
  return `/panel/propiedades?${PARAM_ELIMINADA}=${encodeURIComponent(id)}`
}

/** La dirección guardada para el aviso, o `null`. */
export function direccionEliminada(id: string): string | null {
  try {
    return window.sessionStorage.getItem(`${CLAVE}${id}`)
  } catch {
    return null
  }
}

/** Borra la dirección guardada (el aviso ya se mostró). */
export function olvidarEliminada(id: string): void {
  try {
    window.sessionStorage.removeItem(`${CLAVE}${id}`)
  } catch {
    // Nada que borrar.
  }
}
