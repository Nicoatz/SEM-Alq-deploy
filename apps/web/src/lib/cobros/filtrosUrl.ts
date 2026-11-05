/**
 * filtrosUrl.ts — los filtros de `/panel/cobros` en la URL.
 *
 * Qué es: US-09 pide poder copiar la URL con los filtros y abrirla en otra
 * pestaña. Un valor desconocido cae en el predeterminado, no rompe la pantalla.
 * Quién lo usa: `components/cobros/Cobros.tsx`.
 */
import type { FiltroEstadoCobro, FiltrosCobros } from '@rentar/shared-types'

/** Filtros sin elegir nada. */
export const FILTROS_PREDETERMINADOS: FiltrosCobros = { estado: 'todos', propiedad: null, mes: null }

const ESTADOS: readonly FiltroEstadoCobro[] = ['todos', 'vencido', 'pendiente', 'pagado']

/** `AAAA-MM` con un mes válido. */
const MES = /^\d{4}-(0[1-9]|1[0-2])$/

/**
 * Lee los filtros de los parámetros de la URL.
 *
 * @example
 * filtrosDeUrl(new URLSearchParams('estado=vencido&mes=2026-09&propiedad=prop-1'))
 * // → { estado: 'vencido', propiedad: 'prop-1', mes: '2026-09' }
 * @example
 * filtrosDeUrl(new URLSearchParams('estado=parcial&mes=septiembre'))
 * // → { estado: 'todos', propiedad: null, mes: null }
 */
export function filtrosDeUrl(parametros: Pick<URLSearchParams, 'get'>): FiltrosCobros {
  const estado = parametros.get('estado')
  const mes = parametros.get('mes')
  return {
    estado: ESTADOS.find((opcion) => opcion === estado) ?? FILTROS_PREDETERMINADOS.estado,
    propiedad: parametros.get('propiedad') || null,
    mes: mes && MES.test(mes) ? mes : null,
  }
}

/**
 * Arma la query de la URL. Lo predeterminado no se escribe.
 *
 * @example
 * urlDeFiltros({ estado: 'vencido', propiedad: null, mes: '2026-09' }) // → 'estado=vencido&mes=2026-09'
 * urlDeFiltros(FILTROS_PREDETERMINADOS) // → ''
 */
export function urlDeFiltros(filtros: FiltrosCobros): string {
  const parametros = new URLSearchParams()
  if (filtros.estado !== 'todos') parametros.set('estado', filtros.estado)
  if (filtros.propiedad) parametros.set('propiedad', filtros.propiedad)
  if (filtros.mes) parametros.set('mes', filtros.mes)
  return parametros.toString()
}

/** `true` si hay algún filtro elegido. */
export function hayFiltros(filtros: FiltrosCobros): boolean {
  return urlDeFiltros(filtros) !== ''
}
