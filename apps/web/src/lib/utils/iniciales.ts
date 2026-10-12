/**
 * iniciales.ts — iniciales de una persona para el avatar.
 *
 * Quién lo usa: la tarjeta del dueño del detalle público (`OwnerCard`) y las
 * filas de solicitudes (avatar del postulante).
 */

/** Iniciales para el avatar: "Nicolás Arrieta" → "NA". */
export function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}
