/**
 * misPagos.ts — arma lo que muestra `/panel/pagos` y sus filtros en la URL.
 *
 * Qué es: filtros, indicadores del año y orden de US-09 (locatario), iguales en
 * mock y en real.
 *
 * NOTA: se calcula acá porque `GET /cobros-locatario` con `anio` también filtra
 * `proximo_periodo` (issue #27, punto 17), así que se pide todo y se filtra en el
 * front. El historial solo trae pagos: el filtro de estado actúa sobre toda la
 * pantalla, no sobre la tabla (ver {@link armarMisPagos}).
 *
 * Quién lo usa: `services/cobros.service.ts` y `components/cobros/MisPagos.tsx`.
 */
import type { DatosPagos, FiltroEstadoCobro, FiltrosPagos, MedioCobro, MisPagos, PagoFila } from '@rentar/shared-types'
import { ETIQUETA_MEDIO } from './medios'

/** Filtros sin elegir nada. */
export const FILTROS_PAGOS_PREDETERMINADOS: FiltrosPagos = { anio: null, estado: 'todos', medio: null }

const ESTADOS: readonly FiltroEstadoCobro[] = ['todos', 'vencido', 'pendiente', 'pagado']

/**
 * Lee los filtros de la URL. Un valor desconocido cae en el predeterminado.
 *
 * @example
 * filtrosPagosDeUrl(new URLSearchParams('anio=2025&medio=efectivo'))
 * // → { anio: 2025, estado: 'todos', medio: 'efectivo' }
 * filtrosPagosDeUrl(new URLSearchParams('anio=dos&estado=parcial&medio=bitcoin'))
 * // → { anio: null, estado: 'todos', medio: null }
 */
export function filtrosPagosDeUrl(parametros: Pick<URLSearchParams, 'get'>): FiltrosPagos {
  const anio = parametros.get('anio')
  const estado = parametros.get('estado')
  const medio = parametros.get('medio')
  return {
    anio: anio && /^\d{4}$/.test(anio) ? Number(anio) : null,
    estado: ESTADOS.find((opcion) => opcion === estado) ?? 'todos',
    medio: medio && medio in ETIQUETA_MEDIO ? (medio as MedioCobro) : null,
  }
}

/** Arma la query de la URL. Lo predeterminado no se escribe. */
export function urlDeFiltrosPagos(filtros: FiltrosPagos): string {
  const parametros = new URLSearchParams()
  if (filtros.anio) parametros.set('anio', String(filtros.anio))
  if (filtros.estado !== 'todos') parametros.set('estado', filtros.estado)
  if (filtros.medio) parametros.set('medio', filtros.medio)
  return parametros.toString()
}

/** Del más nuevo al más viejo (US-09). */
function delMasNuevo(pagos: readonly PagoFila[]): PagoFila[] {
  return [...pagos].sort((a, b) => b.periodo.localeCompare(a.periodo) || a.propiedad.localeCompare(b.propiedad))
}

/** Los últimos 3 pagos (US-12). */
export function ultimosPagos(pagos: readonly PagoFila[]): PagoFila[] {
  return [...pagos].sort((a, b) => b.fechaPago.localeCompare(a.fechaPago)).slice(0, 3)
}

/**
 * Arma Mis pagos.
 *
 * - Filtro de estado: "Pagados" oculta el bloque de arriba; "Vencidos" y
 *   "Pendientes" dejan solo ese estado arriba y ocultan el historial.
 * - Los indicadores son del año elegido; sin año, del año de hoy.
 *
 * @param hoyIso Fecha de hoy, `AAAA-MM-DD`.
 */
export function armarMisPagos({ pendientes, pagos }: DatosPagos, filtros: FiltrosPagos, hoyIso: string): MisPagos {
  const { anio, estado, medio } = filtros
  const anioIndicadores = anio ?? Number(hoyIso.slice(0, 4))
  const delAnio = pagos.filter((pago) => pago.fechaPago.startsWith(String(anioIndicadores)))
  const conHistorial = estado === 'todos' || estado === 'pagado'

  return {
    pendientes: estado === 'pagado' ? [] : pendientes.filter((item) => estado === 'todos' || item.estado === estado),
    pagos: conHistorial
      ? delMasNuevo(pagos.filter((pago) => (!anio || pago.periodo.startsWith(String(anio))) && (!medio || pago.medio === medio)))
      : [],
    totalPagos: pagos.length,
    indicadores: {
      anio: anioIndicadores,
      totalPagado: delAnio.reduce((total, pago) => total + pago.monto, 0),
      aTermino: delAnio.filter((pago) => pago.diasAtraso === 0).length,
      recargos: delAnio.reduce((total, pago) => total + pago.recargo, 0),
    },
    anios: [...new Set(pagos.map((pago) => Number(pago.periodo.slice(0, 4))))].sort((a, b) => b - a),
    variasPropiedades: new Set([...pagos, ...pendientes].map((item) => item.propiedad)).size >= 2,
  }
}
