/**
 * cambios.ts — qué cambió de un borrador desde el último guardado.
 *
 * Qué es: función pura para mandar al back solo lo que cambió.
 * Cubre: US-05 ("guardar el contrato como borrador desde cualquier paso") y
 * US-06: reenviar una fecha de inicio ya vencida da 400, así que un contrato
 * reabierto se guarda sin tocar la fecha mientras no se cambie.
 * Quién lo usa: `components/contratos/AltaContrato.tsx`.
 */
import type { CambiosBorrador, CondicionesNuevoContrato, ContratoBorrador } from '@rentar/shared-types'

/**
 * Compara el borrador con lo último guardado.
 * El paso viaja siempre: "recuerda el último paso en que estaba el usuario".
 *
 * Casos verificados:
 * - Sin cambios: solo `paso`.
 * - Cambió el monto: `condiciones` trae solo el monto, no la fecha vencida.
 * - Pasó a "Sin ajuste": índice y periodicidad, los dos.
 * - Cambió un garante: `garantes` trae la lista entera (el back la reemplaza).
 */
export function cambiosDeBorrador(guardado: ContratoBorrador, actual: ContratoBorrador, paso: number): CambiosBorrador {
  const cambios: CambiosBorrador = { paso }
  const condiciones: Partial<CondicionesNuevoContrato> = {}
  for (const clave of Object.keys(actual.condiciones) as (keyof CondicionesNuevoContrato)[]) {
    if (actual.condiciones[clave] !== guardado.condiciones[clave]) Object.assign(condiciones, { [clave]: actual.condiciones[clave] })
  }
  if (Object.keys(condiciones).length > 0) cambios.condiciones = condiciones
  const sinClave = (borrador: ContratoBorrador) => JSON.stringify(borrador.garantes.map(({ fullName, dni, email }) => ({ fullName, dni, email })))
  if (sinClave(actual) !== sinClave(guardado)) cambios.garantes = actual.garantes
  return cambios
}
