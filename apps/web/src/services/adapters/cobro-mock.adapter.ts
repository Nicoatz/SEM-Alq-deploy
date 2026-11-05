/**
 * cobro-mock.adapter.ts — arma las vistas de cobros a partir del elenco.
 *
 * Qué es: la rama mock de US-08, US-09 y US-10. Calcula el estado, el
 * vencimiento y la mora de cada período contra hoy.
 * De dónde saca los datos: `lib/mocks/periodos.mock.ts`, la propiedad y su
 * `rental`, y los cobros registrados en el navegador (`rentar:mock:cobros`).
 * Quién lo usa: la rama mock de `services/cobros.service.ts`.
 *
 * NOTA: en `localStorage` solo va el cobro (fecha, medio, nota y nombre del
 * adjunto). Ni el archivo ni datos sensibles.
 */
import type {
  CobroRegistrado,
  Comprobante,
  CondicionesCobro,
  DetallePeriodo,
  EstadoPeriodo,
  EventoPeriodo,
  ParteComprobante,
  PeriodoFila,
  PeriodoRegistrable,
} from '@rentar/shared-types'
import dayjs from 'dayjs'
import { calcularMora, type Mora } from '@/lib/cobros/mora'
import {
  cobrosDePeriodos,
  periodos as periodosElenco,
  PLAZO_POR_CONTRATO,
  usuarios,
  type CobroRegistradoMock,
  type PeriodoMock,
  type PropiedadMock,
} from '@/lib/mocks'
import { readMockCollection, saveMockRecord } from '../shared/mockStore'
import { readPropiedadesContratoMock } from './contrato-mock.adapter'
import { formatAddress } from './propiedad-mock.adapter'

// ─── Lecturas ─────────────────────────────────────────────────────────

/** Cobros del elenco más los registrados en el navegador. */
export function readCobrosMock(): CobroRegistradoMock[] {
  return readMockCollection('cobros', cobrosDePeriodos)
}

/** Guarda un cobro. `false` si no se pudo. */
export function guardarCobroMock(cobro: CobroRegistradoMock): boolean {
  return saveMockRecord('cobros', cobro)
}

/** Siguiente número de comprobante, correlativo por año y sin huecos (US-10). */
export function siguienteComprobanteMock(anio: number): string {
  const numeros = readCobrosMock()
    .filter((cobro) => cobro.id.startsWith(`RC-${anio}-`))
    .map((cobro) => Number(cobro.id.slice(-4)))
  return `RC-${anio}-${String(Math.max(0, ...numeros) + 1).padStart(4, '0')}`
}

/** Un período con lo que se calcula de él. */
interface PeriodoCalculado {
  periodo: PeriodoMock
  propiedad: PropiedadMock
  cobro: CobroRegistradoMock | null
  inicio: string
  fin: string
  vencimiento: string
  estado: EstadoPeriodo
  mora: Mora
}

/** Vencimiento: inicio del período más el plazo del contrato (S4-2). */
function vencimientoDe(periodo: PeriodoMock): string {
  return dayjs(`${periodo.period}-01`).add(PLAZO_POR_CONTRATO[periodo.contractId] ?? 10, 'day').format('YYYY-MM-DD')
}

/** Condiciones de la propiedad; sin tasa, no hay mora. */
function condicionesDe(propiedad: PropiedadMock): { tasaDiariaPct: number; diasGracia: number } {
  return { tasaDiariaPct: propiedad.dailyInterestPct ?? 0, diasGracia: propiedad.graceDays ?? 0 }
}

/** Calcula estado y mora. Pagado: la mora a la fecha del cobro; si no, a hoy. */
function calcular(periodo: PeriodoMock, propiedad: PropiedadMock, cobros: CobroRegistradoMock[], hoyIso: string): PeriodoCalculado {
  const cobro = cobros.find((item) => item.periodoId === periodo.id) ?? null
  const vencimiento = vencimientoDe(periodo)
  const inicio = `${periodo.period}-01`
  return {
    periodo,
    propiedad,
    cobro,
    inicio,
    fin: dayjs(inicio).endOf('month').format('YYYY-MM-DD'),
    vencimiento,
    estado: cobro ? 'pagado' : vencimiento < hoyIso ? 'vencido' : 'pendiente',
    mora: calcularMora({ alquiler: periodo.amount, ...condicionesDe(propiedad), vencimiento, fecha: cobro?.fecha ?? hoyIso }),
  }
}

/** Todos los períodos del elenco, calculados. */
function periodosCalculados(hoyIso: string): PeriodoCalculado[] {
  const propiedades = readPropiedadesContratoMock()
  const cobros = readCobrosMock()
  return periodosElenco.flatMap((periodo) => {
    const propiedad = propiedades.find((item) => item.id === periodo.propertyId)
    return propiedad ? [calcular(periodo, propiedad, cobros, hoyIso)] : []
  })
}

/** Un período del usuario, como locador o locatario; `null` si no existe o es ajeno. */
function periodoDeUsuario(id: string, userId: string, hoyIso: string): PeriodoCalculado | null {
  const item = periodosCalculados(hoyIso).find((calculado) => calculado.periodo.id === id)
  if (!item) return null
  const esParte = item.propiedad.ownerId === userId || item.propiedad.rental?.tenantUserId === userId
  return esParte ? item : null
}

// ─── Vistas ───────────────────────────────────────────────────────────

/** Períodos del locador para el listado. */
export function filasDeLocadorMock(userId: string, hoyIso: string): PeriodoFila[] {
  return periodosCalculados(hoyIso)
    .filter((item) => item.propiedad.ownerId === userId)
    .map((item) => ({
      id: item.periodo.id,
      contratoId: item.periodo.contractId,
      propiedadId: item.propiedad.id,
      propiedad: formatAddress(item.propiedad),
      locatario: item.propiedad.rental?.tenantName ?? null,
      periodo: item.periodo.period,
      inicio: item.inicio,
      vencimiento: item.vencimiento,
      estado: item.estado,
      monto: item.mora.total,
      diasAtraso: item.mora.diasAtraso,
    }))
}

/** Períodos que el locador puede cobrar: pendientes o vencidos, no futuros (US-08). */
export function registrablesDeLocadorMock(userId: string, hoyIso: string): PeriodoRegistrable[] {
  return periodosCalculados(hoyIso)
    .filter((item) => item.propiedad.ownerId === userId && item.estado !== 'pagado' && item.inicio <= hoyIso)
    .map((item) => ({
      id: item.periodo.id,
      contratoId: item.periodo.contractId,
      propiedadId: item.propiedad.id,
      propiedad: formatAddress(item.propiedad),
      locatario: item.propiedad.rental?.tenantName ?? null,
      periodo: item.periodo.period,
      vencimiento: item.vencimiento,
      alquiler: item.periodo.amount,
    }))
}

/** Tasa, gracia e inicio del contrato; `null` si el contrato no está en el elenco. */
export function condicionesDeContratoMock(contratoId: string): CondicionesCobro | null {
  const propiedad = readPropiedadesContratoMock().find((item) => item.rental?.contractId === contratoId)
  if (!propiedad) return null
  return { ...condicionesDe(propiedad), inicioContrato: propiedad.rental?.startDate ?? null }
}

/** Cobro → vista. */
function cobroDeMock(cobro: CobroRegistradoMock, monto: number): CobroRegistrado {
  return {
    id: cobro.id,
    numeroComprobante: cobro.id,
    fecha: cobro.fecha,
    monto,
    medio: cobro.medio,
    nota: cobro.nota,
    registradoPor: cobro.registradoPor,
    registradoEl: cobro.registradoEl,
    adjuntoNombre: cobro.adjuntoNombre,
    tieneAdjunto: cobro.adjuntoNombre !== null,
  }
}

/** Historial: generado, vencido y cobro registrado, del más nuevo al más viejo. */
function historialDe(item: PeriodoCalculado): EventoPeriodo[] {
  const { cobro, inicio, vencimiento, periodo } = item
  const vencio = cobro ? cobro.fecha > vencimiento : item.estado === 'vencido'
  const eventos: EventoPeriodo[] = [{ id: `${periodo.id}-generado`, titulo: 'Período generado', fecha: `${inicio}T00:00:00`, quien: null }]
  if (vencio) {
    const fecha = `${dayjs(vencimiento).add(1, 'day').format('YYYY-MM-DD')}T00:00:00`
    eventos.push({ id: `${periodo.id}-vencido`, titulo: 'Período vencido', fecha, quien: null })
  }
  if (cobro) {
    eventos.push({ id: `${periodo.id}-cobro`, titulo: 'Cobro registrado', fecha: cobro.registradoEl, quien: cobro.registradoPor })
  }
  return eventos.reverse()
}

/** Detalle de un período; `null` si no existe o es ajeno. */
export function detalleMock(id: string, userId: string, hoyIso: string): DetallePeriodo | null {
  const item = periodoDeUsuario(id, userId, hoyIso)
  if (!item) return null
  const { periodo, propiedad, cobro, mora } = item
  return {
    id: periodo.id,
    contratoId: periodo.contractId,
    contratoCodigo: periodo.contractId,
    propiedadId: propiedad.id,
    propiedad: formatAddress(propiedad),
    barrio: propiedad.neighborhoodName,
    locadorId: propiedad.ownerId,
    locatario: propiedad.rental?.tenantName ?? null,
    periodo: periodo.period,
    inicio: item.inicio,
    fin: item.fin,
    vencimiento: item.vencimiento,
    estado: item.estado,
    alquiler: periodo.amount,
    mora: mora.mora,
    diasMora: mora.diasMora,
    total: mora.total,
    cobros: cobro ? [cobroDeMock(cobro, mora.total)] : [],
    cobrosDisponibles: true,
    comprobanteCobroId: cobro?.id ?? null,
    historial: historialDe(item),
  }
}

/**
 * Datos del período al registrar; `null` si no existe o no es del locador.
 * La fecha importa: la mora se calcula a la fecha del cobro (US-08).
 */
export function periodoParaRegistrarMock(id: string, userId: string, hoyIso: string, fecha: string) {
  const item = periodoDeUsuario(id, userId, hoyIso)
  if (!item || item.propiedad.ownerId !== userId) return null
  const mora = calcularMora({ alquiler: item.periodo.amount, ...condicionesDe(item.propiedad), vencimiento: item.vencimiento, fecha })
  return { ...item, mora, inicioContrato: item.propiedad.rental?.startDate ?? null }
}

/** Una persona del elenco en el comprobante. Quien no tiene cuenta queda con el nombre. */
function parteDe(userId: string | null | undefined, nombre: string): ParteComprobante {
  const usuario = usuarios.find((item) => item.id === userId)
  return {
    nombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : nombre,
    documento: usuario?.dni ?? null,
    email: usuario?.email ?? null,
    telefono: usuario?.telefono ?? null,
  }
}

/** Nombre y apellido de una cuenta del elenco, para "quién cargó el cobro". */
export function nombreDeUsuarioMock(userId: string): string {
  return parteDe(userId, 'Sin dato').nombre
}

/** Comprobante de un cobro; `null` si no existe o es ajeno. */
export function comprobanteMock(cobroId: string, userId: string, hoyIso: string): Comprobante | null {
  const cobro = readCobrosMock().find((item) => item.id === cobroId)
  const item = cobro ? periodoDeUsuario(cobro.periodoId, userId, hoyIso) : null
  if (!cobro || !item) return null
  const { periodo, propiedad, mora } = item
  return {
    cobroId: cobro.id,
    numero: cobro.id,
    emitidoEl: cobro.registradoEl,
    locatario: parteDe(propiedad.rental?.tenantUserId, propiedad.rental?.tenantName ?? ''),
    locador: parteDe(propiedad.ownerId, ''),
    domicilio: [formatAddress(propiedad), propiedad.neighborhoodName, propiedad.city].join(', '),
    contratoCodigo: periodo.contractId,
    contratoInicio: propiedad.rental?.startDate ?? null,
    contratoFin: propiedad.rental?.endDate ?? null,
    periodo: periodo.period,
    periodoInicio: item.inicio,
    periodoFin: item.fin,
    vencimiento: item.vencimiento,
    alquiler: periodo.amount,
    mora: mora.mora,
    diasMora: mora.diasMora,
    total: mora.total,
    medio: cobro.medio,
    fechaPago: cobro.fecha,
  }
}
