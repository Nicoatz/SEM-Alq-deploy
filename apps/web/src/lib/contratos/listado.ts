/**
 * listado.ts — filtros, contadores, búsqueda y orden del listado de contratos.
 *
 * Qué es: funciones puras sobre `ContratoResumen[]`, separadas de la pantalla.
 * Cubre: US-05 Registrar contrato de alquiler, "Listado de contratos":
 * - "Se pueden filtrar los contratos por estado: todos, borradores,
 *   pendientes de firma, vigentes y finalizados. Se debe mostrar la cantidad
 *   de contratos de cada estado."
 * - "Se pueden buscar contratos por dirección de la propiedad o por nombre
 *   del locatario."
 * - "Por defecto, el listado muestra primero los pendientes de firma y
 *   después el resto, ordenado por fecha de fin."
 * Quién lo usa: `components/contratos/ListadoContratos.tsx`.
 */
import type { ContractStatus, ContratoResumen } from '@rentar/shared-types'

/** Las pestañas del filtro por estado (US-05). */
export type PestaniaContratos = 'todos' | 'borradores' | 'pendientes' | 'vigentes' | 'finalizados'

/** Las pestañas, en el orden de la US, con su texto. */
export const PESTANIAS_CONTRATOS: { value: PestaniaContratos; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'borradores', label: 'Borradores' },
  { value: 'pendientes', label: 'Pendientes de firma' },
  { value: 'vigentes', label: 'Vigentes' },
  { value: 'finalizados', label: 'Finalizados' },
]

/**
 * Estados de cada pestaña. NOTA: "Finalizados" incluye los rescindidos:
 * los dos son contratos que terminaron (la US no tiene una pestaña aparte).
 */
const ESTADOS_DE: Record<Exclude<PestaniaContratos, 'todos'>, readonly ContractStatus[]> = {
  borradores: ['borrador'],
  pendientes: ['pendiente_firma'],
  vigentes: ['vigente'],
  finalizados: ['finalizado', 'rescindido'],
}

/** `true` si el contrato va en esa pestaña. */
export function estaEnPestania(contrato: ContratoResumen, pestania: PestaniaContratos): boolean {
  return pestania === 'todos' || ESTADOS_DE[pestania].includes(contrato.status)
}

/** Cuántos contratos hay en cada pestaña (US-05: "la cantidad de contratos de cada estado"). */
export function contarPorPestania(contratos: readonly ContratoResumen[]): Record<PestaniaContratos, number> {
  return {
    todos: contratos.length,
    borradores: contratos.filter((item) => estaEnPestania(item, 'borradores')).length,
    pendientes: contratos.filter((item) => estaEnPestania(item, 'pendientes')).length,
    vigentes: contratos.filter((item) => estaEnPestania(item, 'vigentes')).length,
    finalizados: contratos.filter((item) => estaEnPestania(item, 'finalizados')).length,
  }
}

/** Minúsculas y sin tildes, para buscar "rios" y encontrar "Ríos". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** US-05: buscar por dirección de la propiedad o por nombre del locatario. Texto vacío = todos. */
export function coincideBusqueda(contrato: ContratoResumen, texto: string): boolean {
  const buscado = normalizar(texto)
  if (!buscado) return true
  return normalizar(`${contrato.propertyAddress} ${contrato.neighborhoodName}`).includes(buscado) || normalizar(contrato.tenantName).includes(buscado)
}

/**
 * Orden por defecto (US-05): primero los pendientes de firma; después el
 * resto por fecha de fin, de la más cercana a la más lejana. Los que no
 * tienen fecha de fin (un borrador incompleto) van al final.
 */
export function ordenarContratos(contratos: readonly ContratoResumen[]): ContratoResumen[] {
  return [...contratos].sort((a, b) => {
    const pendienteA = a.status === 'pendiente_firma' ? 0 : 1
    const pendienteB = b.status === 'pendiente_firma' ? 0 : 1
    if (pendienteA !== pendienteB) return pendienteA - pendienteB
    if (a.endDate === b.endDate) return a.propertyAddress.localeCompare(b.propertyAddress, 'es')
    if (!a.endDate) return 1
    if (!b.endDate) return -1
    return a.endDate.localeCompare(b.endDate)
  })
}

/** "1 pendiente de firma · 4 vigentes · 1 finalizado" (subtítulo del diseño, · 01). Omite los ceros. */
export function subtituloContratos(contadores: Record<PestaniaContratos, number>): string {
  const partes: string[] = []
  const agregar = (cantidad: number, singular: string, plural: string) => {
    if (cantidad > 0) partes.push(`${cantidad} ${cantidad === 1 ? singular : plural}`)
  }
  agregar(contadores.borradores, 'borrador', 'borradores')
  agregar(contadores.pendientes, 'pendiente de firma', 'pendientes de firma')
  agregar(contadores.vigentes, 'vigente', 'vigentes')
  agregar(contadores.finalizados, 'finalizado', 'finalizados')
  return partes.join(' · ')
}
