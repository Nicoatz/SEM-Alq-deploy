/**
 * listado.ts — arma lo que muestra `/panel/cobros` a partir de los períodos.
 *
 * Qué es: filtros, cantidades, indicadores y orden de US-09, iguales en mock y
 * en real.
 *
 * NOTA: se calcula acá porque el back saca `cantidades` después de filtrar por
 * estado, no manda `resumen` de pendientes e incluye períodos futuros, que no se
 * pueden cobrar (issue #27, puntos 9 y 11).
 * TODO(backend): filtrar del lado del back cuando esté corregido.
 *
 * Quién lo usa: `services/cobros.service.ts`.
 */
import type { FiltrosCobros, ListadoCobros, PeriodoFila } from '@rentar/shared-types'
import { ordenarPeriodos } from './orden'

/**
 * Arma el listado.
 *
 * - Los períodos futuros no se muestran.
 * - Las cantidades de cada estado respetan la propiedad y el mes, no el estado.
 * - Los indicadores son del mes elegido; sin mes, del mes de hoy (US-09).
 * - Una propiedad que no está en la lista se ignora, como un filtro desconocido.
 *
 * @param hoyIso Fecha de hoy, `AAAA-MM-DD`.
 */
export function armarListado(periodos: readonly PeriodoFila[], filtros: FiltrosCobros, hoyIso: string): ListadoCobros {
  const vigentes = periodos.filter((periodo) => periodo.inicio <= hoyIso)

  const nombres = new Map(vigentes.map((periodo) => [periodo.propiedadId, periodo.propiedad]))
  const propiedades = [...nombres].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  const propiedad = filtros.propiedad && nombres.has(filtros.propiedad) ? filtros.propiedad : null

  const dePropiedad = vigentes.filter((periodo) => !propiedad || periodo.propiedadId === propiedad)
  const delFiltro = dePropiedad.filter((periodo) => !filtros.mes || periodo.periodo === filtros.mes)
  const contar = (estado: PeriodoFila['estado']) => delFiltro.filter((periodo) => periodo.estado === estado).length

  const mes = filtros.mes ?? hoyIso.slice(0, 7)
  const sumar = (estado: PeriodoFila['estado']) =>
    dePropiedad
      .filter((periodo) => periodo.periodo === mes && periodo.estado === estado)
      .reduce((total, periodo) => total + periodo.monto, 0)

  return {
    filas: ordenarPeriodos(delFiltro.filter((periodo) => filtros.estado === 'todos' || periodo.estado === filtros.estado)),
    totalPeriodos: vigentes.length,
    cantidades: {
      todos: delFiltro.length,
      vencido: contar('vencido'),
      pendiente: contar('pendiente'),
      pagado: contar('pagado'),
    },
    indicadores: { mes, cobrado: sumar('pagado'), vencido: sumar('vencido') },
    propiedades,
    meses: [...new Set(vigentes.map((periodo) => periodo.periodo))].sort().reverse(),
  }
}
