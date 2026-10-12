/**
 * direccion.ts — formatos de dirección.
 *
 * Qué es: la dirección aproximada de la zona pública ("Rondeau 480, PB" →
 * "Rondeau al 400") y el piso/depto del alta ("7" + "B" → "7° B").
 *
 * NOTA: es una decisión de privacidad del diseño ("Búsqueda de propiedades"):
 * en la zona pública (landing, `/buscar`) nunca se muestra la altura exacta
 * ni el piso, solo la calle y la cuadra. Cumple el "mostrar la dirección de
 * cada propiedad" de US-34 sin exponer dónde vive alguien. La dirección
 * exacta la ven el locador (US-02) y, desde la US-35 actualizada, cualquier
 * usuario con sesión en el detalle, el modal "Solicitar alquiler" y Mis
 * solicitudes (decisión del PO). Las tarjetas de `/buscar` siguen con la
 * aproximada para todos.
 * NOTA: mientras el back mande la altura y el piso sin token, esto es solo
 * cosmético (HANDOFF §10).
 *
 * Quién lo usa: `propiedad-mock.adapter.ts`, `propiedad.adapter.ts` y los
 * adaptadores de solicitudes.
 */

/**
 * Calle + cuadra, redondeando la altura hacia abajo al centenar ("al 400").
 * Las alturas de 1 a 99 no tienen un "al 0" natural: se muestran como
 * "primera cuadra".
 */
export function formatApproxAddress(street: string, streetNumber: number): string {
  const cuadra = Math.floor(streetNumber / 100) * 100
  return cuadra > 0 ? `${street} al ${cuadra}` : `${street} (primera cuadra)`
}

/**
 * Dirección exacta: "Rondeau 480, PB". Solo para quien tiene derecho a verla
 * (el locador, sobre sus propias propiedades); nunca en la zona pública.
 */
export function formatExactAddress(street: string, streetNumber: number, floor?: string | null): string {
  const base = `${street} ${streetNumber}`
  return floor?.trim() ? `${base}, ${floor.trim()}` : base
}

/**
 * Inversa de {@link formatFloorUnit}, para cargar el formulario de edición
 * (US-03) con lo que guardó el alta: "7° B" → ("7", "B"); "7°" → ("7",
 * null); "Depto B" → (null, "B"); "PB" → ("PB", null). Si no se entiende,
 * todo va al piso.
 */
export function separarPisoDepto(piso: string | null | undefined): { floor: string | null; unit: string | null } {
  const texto = piso?.trim()
  if (!texto) return { floor: null, unit: null }
  const soloDepto = texto.match(/^Depto\s+(.+)$/i)
  if (soloDepto) return { floor: null, unit: soloDepto[1] ?? null }
  const conNumero = texto.match(/^(\d+)\s*°\s*(.*)$/)
  if (conNumero) return { floor: conNumero[1] ?? null, unit: conNumero[2]?.trim() || null }
  const [primero, ...resto] = texto.split(/\s+/)
  return { floor: primero ?? null, unit: resto.join(' ') || null }
}

/**
 * Piso y departamento del alta (US-01) en el formato del elenco:
 * ("7", "B") → "7° B"; ("7", null) → "7°"; (null, "B") → "Depto B";
 * "PB" se deja tal cual. `null` si no se cargó ninguno de los dos.
 */
export function formatFloorUnit(floor: string | null, unit: string | null): string | null {
  const piso = floor?.trim() || null
  const depto = unit?.trim() || null
  if (!piso && !depto) return null
  if (!piso) return `Depto ${depto}`
  const pisoTexto = /^\d+$/.test(piso) ? `${piso}°` : piso
  return depto ? `${pisoTexto} ${depto}` : pisoTexto
}
