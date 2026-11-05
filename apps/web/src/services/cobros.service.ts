/**
 * cobros.service.ts — frontera con el backend para los cobros del locador.
 *
 * Qué es: el listado de períodos, su detalle, el registro de un cobro y el
 * comprobante. Cubre US-08 Registrar cobro, US-09 Consultar cobro y US-10 Emitir
 * comprobante de pago.
 * De dónde saca los datos:
 * - Modo mock: `lib/mocks/periodos.mock.ts`, a través de
 *   `adapters/cobro-mock.adapter.ts`.
 * - Modo real: `apps/api`, a través de `adapters/cobro.adapter.ts`.
 * Quién lo usa: `components/cobros/*`.
 *
 * NOTA (decisión del PO, 05/11): un cobro por período, por el total. No hay pago
 * parcial, así que tampoco saldo.
 */
import type {
  CobroCreado,
  Comprobante,
  CondicionesCobro,
  DetallePeriodo,
  FiltrosCobros,
  ListadoCobros,
  PeriodoFila,
  PeriodoRegistrable,
  RegistrarCobroDatos,
} from '@rentar/shared-types'
import { armarListado } from '@/lib/cobros/listado'
import { errorDeAdjunto, errorDeFechaCobro, errorDeNota } from '@/lib/cobros/validaciones'
import { ahoraIso, hoy } from '@/lib/utils/fechas'
import {
  comprobanteMock,
  condicionesDeContratoMock,
  detalleMock,
  filasDeLocadorMock,
  guardarCobroMock,
  nombreDeUsuarioMock,
  periodoParaRegistrarMock,
  registrablesDeLocadorMock,
  siguienteComprobanteMock,
} from './adapters/cobro-mock.adapter'
import {
  COBRO_NO_ENCONTRADO_MESSAGE,
  cobroCreadoDeDto,
  comprobanteDeDto,
  COMPROBANTE_NO_ENCONTRADO_MESSAGE,
  detalleDeDto,
  detalleDeResumen,
  errorDeCobros,
  errorDeComprobante,
  errorDePeriodo,
  errorDeRegistro,
  filaDeDto,
  PERIODO_FUTURO_MESSAGE,
  PERIODO_PAGADO_MESSAGE,
  REGISTRAR_ERROR_MESSAGE,
  registrableDeDto,
} from './adapters/cobro.adapter'
import { apiBlob, apiRequest } from './shared/apiClient'
import type {
  ComprobantePagoResponse,
  ContratoDetalleApiResponse,
  DetalleCobroResponse,
  HistorialCobrosResponse,
  PeriodoCobroResumenResponse,
  PeriodosCobroResponse,
  RegistrarCobroResponse,
} from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { requireSessionUserId } from './shared/session'

/**
 * `true` si el comprobante se descarga como PDF. En mock, "Descargar" abre la
 * impresión: el PDF lo genera el back (decisión del PO, 05/11).
 */
export const PDF_COMPROBANTE_DISPONIBLE = !USE_MOCKS

/** Máximo de filas por página que acepta el back. */
const LIMITE_POR_PAGINA = 100

/** Hoy en ISO, `AAAA-MM-DD`. */
function hoyIso(): string {
  return hoy().format('YYYY-MM-DD')
}

/** Trae todas las páginas de un listado. */
async function todasLasPaginas<T>(path: string): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page += 1) {
    const respuesta = await apiRequest<{ items: T[]; total: number }>(path, { query: { page, limit: LIMITE_POR_PAGINA } })
    items.push(...respuesta.items)
    if (respuesta.items.length === 0 || items.length >= respuesta.total) return items
  }
}

/** Todos los períodos del locador, sin filtros (ver `lib/cobros/listado.ts`). */
async function historialCompleto(): Promise<PeriodoCobroResumenResponse[]> {
  try {
    return await todasLasPaginas<HistorialCobrosResponse['items'][number]>('/cobros-locador/historial')
  } catch (error) {
    throw errorDeCobros(error)
  }
}

// ─── Consultas ────────────────────────────────────────────────────────

/**
 * Listado de `/panel/cobros` con sus filtros, cantidades e indicadores (US-09).
 *
 * @backend GET /api/v1/cobros-locador/historial (existe) → los filtros se aplican
 * acá: las cantidades del back dependen del estado y trae períodos futuros.
 */
export async function listarCobrosLocador(filtros: FiltrosCobros): Promise<ListadoCobros> {
  let filas: PeriodoFila[]
  if (USE_MOCKS) {
    await delay()
    filas = filasDeLocadorMock(requireSessionUserId(), hoyIso())
  } else {
    filas = (await historialCompleto()).map(filaDeDto)
  }
  return armarListado(filas, filtros, hoyIso())
}

/**
 * Períodos que se pueden cobrar, para el modal abierto desde el botón general
 * (US-08). Sin los futuros, que el back trae y el `POST` rechaza.
 *
 * @backend GET /api/v1/cobros-locador (existe)
 */
export async function listarPeriodosRegistrables(): Promise<PeriodoRegistrable[]> {
  if (USE_MOCKS) {
    await delay()
    return registrablesDeLocadorMock(requireSessionUserId(), hoyIso())
  }
  try {
    const items = await todasLasPaginas<PeriodosCobroResponse['items'][number]>('/cobros-locador')
    return items.filter((item) => item.estado !== 'pagado' && item.fecha_inicio <= hoyIso()).map(registrableDeDto)
  } catch (error) {
    throw errorDeCobros(error)
  }
}

/**
 * Tasa, gracia e inicio del contrato, para mostrar el monto antes de registrar
 * (US-08).
 *
 * NOTA: se leen del contrato porque los DTO de períodos no los traen. El monto
 * final lo calcula el back con los datos del período.
 * TODO(backend): que el período traiga tasa, gracia y el monto a una fecha dada.
 *
 * @backend GET /api/v1/contratos/:id/detalle (existe)
 */
export async function getCondicionesCobro(contratoId: string): Promise<CondicionesCobro> {
  if (USE_MOCKS) {
    await delay()
    const condiciones = condicionesDeContratoMock(contratoId)
    if (!condiciones) throw new ServiceError('not_found', COBRO_NO_ENCONTRADO_MESSAGE)
    return condiciones
  }
  const { condiciones } = await apiRequest<ContratoDetalleApiResponse>(`/contratos/${encodeURIComponent(contratoId)}/detalle`)
  return {
    tasaDiariaPct: condiciones.interes_por_dia ?? 0,
    diasGracia: condiciones.dias_gracia ?? 0,
    inicioContrato: condiciones.fecha_inicio_contrato,
  }
}

/**
 * Detalle de un período (US-09). Lo pueden pedir las dos partes.
 *
 * NOTA (PO, 05/11): si `GET /cobros/:id` da 500, se busca el período en el
 * listado del locador, así el historial no rompe toda la pantalla. Ver
 * `detalleDeResumen`. Ese listado solo trae períodos propios: si no está ahí,
 * para el locador no existe. Si el listado también falla (el locatario no tiene
 * acceso), se muestra el error con "Reintentar".
 *
 * @backend GET /api/v1/cobros/:id (existe; hoy da 500 siempre, S4-16)
 * @throws {ServiceError} `not_found` si no existe o es ajeno.
 */
export async function getPeriodo(id: string): Promise<DetallePeriodo> {
  if (USE_MOCKS) {
    await delay()
    const detalle = detalleMock(id, requireSessionUserId(), hoyIso())
    if (!detalle) throw new ServiceError('not_found', COBRO_NO_ENCONTRADO_MESSAGE)
    return detalle
  }
  try {
    return detalleDeDto(await apiRequest<DetalleCobroResponse>(`/cobros/${encodeURIComponent(id)}`))
  } catch (error) {
    if (!(error instanceof ServiceError) || error.code !== 'server') throw errorDePeriodo(error)
    const items = await historialCompleto().catch(() => null)
    if (!items) throw errorDePeriodo(error)
    const item = items.find((periodo) => String(periodo.id_periodo) === id)
    if (!item) throw new ServiceError('not_found', COBRO_NO_ENCONTRADO_MESSAGE)
    return detalleDeResumen(item)
  }
}

/**
 * URL del adjunto de un cobro, pedida al usarla: vence a los 60 segundos.
 *
 * @backend GET /api/v1/cobros/:id (existe) → `cobros[].adjunto_url`
 */
export async function urlAdjuntoDeCobro(periodoId: string, cobroId: string): Promise<string> {
  const detalle = await apiRequest<DetalleCobroResponse>(`/cobros/${encodeURIComponent(periodoId)}`)
  const url = detalle.cobros.find((cobro) => String(cobro.id_cobro) === cobroId)?.adjunto_url
  if (!url) throw new ServiceError('not_found', 'No encontramos el adjunto.')
  return url
}

// ─── Registrar ────────────────────────────────────────────────────────

/** Rama mock de {@link registrarCobro}: responde como el back. */
function registrarCobroMock(datos: RegistrarCobroDatos): CobroCreado {
  const userId = requireSessionUserId()
  const item = periodoParaRegistrarMock(datos.periodoId, userId, hoyIso(), datos.fecha)
  if (!item) throw new ServiceError('not_found', COBRO_NO_ENCONTRADO_MESSAGE)
  if (item.cobro) throw new ServiceError('conflict', PERIODO_PAGADO_MESSAGE)
  if (item.inicio > hoyIso()) throw new ServiceError('conflict', PERIODO_FUTURO_MESSAGE)

  const error =
    errorDeFechaCobro(datos.fecha, hoyIso(), item.inicioContrato) ??
    errorDeNota(datos.medio, datos.nota ?? '') ??
    (datos.adjunto ? errorDeAdjunto(datos.adjunto) : null)
  if (error) throw new ServiceError('validation', error)

  const id = siguienteComprobanteMock(hoy().year())
  const guardado = guardarCobroMock({
    id,
    periodoId: datos.periodoId,
    fecha: datos.fecha,
    medio: datos.medio,
    nota: datos.nota,
    registradoPor: nombreDeUsuarioMock(userId),
    registradoEl: ahoraIso(),
    adjuntoNombre: datos.adjunto?.name ?? null,
  })
  if (!guardado) throw new ServiceError('server', REGISTRAR_ERROR_MESSAGE)
  return { cobroId: id, periodoId: datos.periodoId, monto: item.mora.total, numeroComprobante: id }
}

/**
 * Registra el cobro de un período, por el total (US-08). Emite el comprobante
 * (US-10).
 *
 * @backend POST /api/v1/cobros-locador (existe, multipart: `id_periodo`,
 * `fecha_cobro`, `medio`, `nota` y `comprobante`) → 201
 */
export async function registrarCobro(datos: RegistrarCobroDatos): Promise<CobroCreado> {
  if (USE_MOCKS) {
    await delay()
    return registrarCobroMock(datos)
  }
  const cuerpo = new FormData()
  cuerpo.append('id_periodo', datos.periodoId)
  cuerpo.append('fecha_cobro', datos.fecha)
  cuerpo.append('medio', datos.medio)
  if (datos.nota) cuerpo.append('nota', datos.nota)
  if (datos.adjunto) cuerpo.append('comprobante', datos.adjunto)
  try {
    return cobroCreadoDeDto(await apiRequest<RegistrarCobroResponse>('/cobros-locador', { method: 'POST', body: cuerpo }))
  } catch (error) {
    throw errorDeRegistro(error)
  }
}

// ─── Comprobante ──────────────────────────────────────────────────────

/**
 * Comprobante de un cobro (US-10). El locador y el locatario ven el mismo.
 *
 * @backend GET /api/v1/cobros/:id/comprobante (existe), con el id del cobro
 * @throws {ServiceError} `not_found` si no existe o es ajeno.
 */
export async function getComprobante(idCobro: string): Promise<Comprobante> {
  if (USE_MOCKS) {
    await delay()
    const comprobante = comprobanteMock(idCobro, requireSessionUserId(), hoyIso())
    if (!comprobante) throw new ServiceError('not_found', COMPROBANTE_NO_ENCONTRADO_MESSAGE)
    return comprobante
  }
  try {
    return comprobanteDeDto(await apiRequest<ComprobantePagoResponse>(`/cobros/${encodeURIComponent(idCobro)}/comprobante`))
  } catch (error) {
    throw errorDeComprobante(error)
  }
}

/**
 * Comprobante del período de la URL: la ruta usa el id del período y la API el
 * del cobro. Hay un cobro por período, así que sale del detalle (decisión del
 * PO, 05/11).
 *
 * @throws {ServiceError} `not_found` si el período no existe, es ajeno o no tiene cobros.
 */
export async function getComprobanteDePeriodo(idPeriodo: string): Promise<Comprobante> {
  const detalle = await getPeriodo(idPeriodo).catch((error: unknown) => {
    throw errorDeComprobante(error)
  })
  if (!detalle.comprobanteCobroId) throw new ServiceError('not_found', COMPROBANTE_NO_ENCONTRADO_MESSAGE)
  return getComprobante(detalle.comprobanteCobroId)
}

/**
 * PDF del comprobante (US-10), como archivo.
 *
 * @backend GET /api/v1/cobros/:id/comprobante/pdf (existe), con el id del cobro
 */
export async function descargarComprobantePdf(idCobro: string): Promise<Blob> {
  try {
    return await apiBlob(`/cobros/${encodeURIComponent(idCobro)}/comprobante/pdf`)
  } catch (error) {
    throw errorDeComprobante(error)
  }
}
