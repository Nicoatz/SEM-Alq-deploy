/**
 * legajo.ts — si el legajo del usuario está completo y qué le falta.
 *
 * Qué es: una función pura, separada de la pantalla para leerla y probarla
 * sola.
 * Cubre: US-20 Consultar usuario ("se debe indicar si el legajo está
 * completo o incompleto y, si está incompleto, qué datos faltan").
 * Quién lo usa: `components/perfil/LegajoBloque.tsx` y `PerfilScreen.tsx`
 * (en móvil, el legajo incompleto va primero, como en el diseño).
 */
import type { LegajoUsuario } from '@rentar/shared-types'

/** Un dato del legajo que puede faltar. */
export type DatoLegajo = 'situacion' | 'ingreso' | 'garantias'

/** Cómo se nombra cada dato faltante en la pantalla. */
export const NOMBRE_DATO_LEGAJO: Record<DatoLegajo, string> = {
  situacion: 'situación ocupacional',
  ingreso: 'ingreso mensual',
  garantias: 'al menos una garantía',
}

/** Resultado de {@link estadoLegajo}. */
export interface EstadoLegajo {
  completo: boolean
  /** Lo que falta, en el orden en que se muestra el legajo. Vacío si está completo. */
  faltantes: DatoLegajo[]
  /** Cuántos de los tres datos están cargados (el "2 de 3" del diseño). */
  cargados: number
  total: number
}

/**
 * Estado del legajo (US-20). Decisión del PO: está completo cuando tiene los
 * tres datos que la US enumera para el legajo:
 * - situación ocupacional distinta de "-" (`sin_informar` es "prefiero no
 *   decirlo": no cuenta como cargada);
 * - ingreso mensual cargado (en el perfil no existe el 0: vacío = falta);
 * - al menos una garantía que pueda ofrecer.
 */
export function estadoLegajo(legajo: LegajoUsuario): EstadoLegajo {
  const faltantes: DatoLegajo[] = []
  if (legajo.occupation === 'sin_informar') faltantes.push('situacion')
  if (legajo.monthlyIncome === null) faltantes.push('ingreso')
  if (legajo.guarantees.length === 0) faltantes.push('garantias')
  const total = 3
  return { completo: faltantes.length === 0, faltantes, cargados: total - faltantes.length, total }
}

/** "Falta la situación ocupacional y el ingreso mensual." — la línea del aviso de legajo incompleto. */
export function textoFaltantes(faltantes: readonly DatoLegajo[]): string {
  const nombres = faltantes.map((dato) => NOMBRE_DATO_LEGAJO[dato])
  if (nombres.length === 0) return ''
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`
  return `${nombres.length === 1 ? 'Falta' : 'Faltan'} ${lista}.`
}
