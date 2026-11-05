/**
 * propiedad.ts — reglas de la pestaña Contratos de una propiedad.
 *
 * Qué es: funciones puras sobre los contratos de UNA propiedad, separadas de
 * la pantalla y de los services (las usan la rama mock y la real).
 * Cubre: US-43 Consultar contratos locador, "Contrato actual" y "Contratos
 * anteriores".
 * Quién lo usa: `services/contratos.service.ts`,
 * `services/adapters/contrato.adapter.ts` y
 * `components/mi-propiedad/PestanaContratos.tsx`.
 */
import type { ContractStatus, ContratoDePropiedad, ContratosDePropiedad } from '@rentar/shared-types'
import { fechaCorta } from './fechas'

/** US-43: "El contrato actual es el que está en borrador, pendiente de firma o vigente." */
const ESTADOS_ACTUAL: readonly ContractStatus[] = ['borrador', 'pendiente_firma', 'vigente']

/**
 * Separa el contrato actual de los anteriores.
 * - US-43: "Una propiedad puede tener como máximo un contrato actual".
 * - US-43: anteriores = "los contratos finalizados", ordenados "por fecha de
 *   inicio, del más reciente al más antiguo". Decisión del PO (05/11): vale la
 *   versión del repo; `rescindido` no existe en la base.
 * @param solicitudParaContrato Solicitud aceptada que todavía no originó un contrato.
 */
export function separarContratos(contratos: readonly ContratoDePropiedad[], solicitudParaContrato: string | null): ContratosDePropiedad {
  const actual = contratos.find((contrato) => ESTADOS_ACTUAL.includes(contrato.status)) ?? null
  const anteriores = contratos
    .filter((contrato) => contrato.status === 'finalizado')
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
  return { actual, anteriores, solicitudParaContrato }
}

/** US-43: vigencia "dd/mm/aaaa → dd/mm/aaaa"; "—" si falta una fecha (un borrador incompleto). */
export function vigenciaDeContrato(contrato: Pick<ContratoDePropiedad, 'startDate' | 'endDate'>): string {
  return contrato.startDate && contrato.endDate ? `${fechaCorta(contrato.startDate)} → ${fechaCorta(contrato.endDate)}` : '—'
}

/** "3 contratos desde 2023 · del más reciente al más antiguo" (diseño, §02). Sin contratos, vacío. */
export function subtituloContratosDePropiedad({ actual, anteriores }: ContratosDePropiedad): string {
  const todos = actual ? [actual, ...anteriores] : anteriores
  if (todos.length === 0) return ''
  const anios = todos.flatMap((contrato) => (contrato.startDate ? [contrato.startDate.slice(0, 4)] : [])).sort()
  const cantidad = todos.length === 1 ? '1 contrato' : `${todos.length} contratos`
  return anios[0] ? `${cantidad} desde ${anios[0]} · del más reciente al más antiguo` : cantidad
}
