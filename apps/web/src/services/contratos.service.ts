/**
 * contratos.service.ts — frontera con el backend para los contratos del locador.
 *
 * Qué es: el listado de `/panel/contratos`, el inicio desde una solicitud
 * aceptada, el borrador (guardar, retomar y eliminar) y el envío a firmar.
 * Cubre: US-05 Registrar contrato de alquiler y US-07 Firmar contrato de
 * alquiler (detalle, firmar, rechazar, cancelar el envío y reenviar la
 * invitación); US-27 Consultar mis alquileres (`listarMisAlquileres`,
 * `contarMisAlquileres` y `getMiAlquiler`).
 * De dónde saca los datos:
 * - Modo mock: los vigentes del elenco (`propiedades.mock.ts`, `rental`),
 *   `contratos.mock.ts` y los borradores del navegador, a través de
 *   `adapters/contrato-mock.adapter.ts` (ver ahí la NOTA de datos sensibles:
 *   el DNI de los garantes no se guarda en `localStorage`).
 * - Modo real: rutas PROPUESTAS de `apps/api` (todavía no existen). Contrato
 *   de cada una en `docs/api-endpoints.md`, "Contratos".
 * Quién lo usa: `components/contratos/*` y `app/(app)/panel/contratos/*`.
 *
 * NOTA (decisiones del PO, Sprint 3): firman el locador y el locatario; el
 * garante es un dato del contrato y no firma. Mientras el contrato está
 * pendiente de firma, la propiedad sigue publicada (este service no toca la
 * propiedad).
 */
import type {
  AlquilerResumen,
  ContractStatus,
  ContratoBorrador,
  ContratoDetalle,
  ContratoEnviado,
  ContratoResumen,
  DatosContrato,
  EventoContrato,
  FirmanteContrato,
  GarantiaOfrecida,
  MiAlquiler,
  ParteContrato,
  PerfilUsuario,
  RolFirmante,
} from '@rentar/shared-types'
import dayjs from 'dayjs'
import { fechaFin, MESES_POR_PERIODO } from '@/lib/contratos/fechas'
import { errorDeMotivoRechazo, normalizarMotivoRechazo, reenvioBloqueado } from '@/lib/contratos/firmas'
import { ordenarAlquileres } from '@/lib/contratos/listado'
import { completarClausulas } from '@/lib/contratos/plantilla'
import { DIA_VENCIMIENTO_POR_DEFECTO, DURACION_POR_DEFECTO, errorParaEnviar } from '@/lib/contratos/validaciones'
import { hoy } from '@/lib/utils/fechas'
import { cobros as cobrosElenco, type ContratoMock, type FirmaMock, type PropiedadMock } from '@/lib/mocks'
import {
  ahoraIsoMock,
  conEvento,
  contratoDeSolicitudMock,
  contratosDeLocadorMock,
  contratosDeLocatarioMock,
  eliminarContratoMock,
  eventosDe,
  firmasAlEnviar,
  guardarContratoMock,
  pasarAVigenteMock,
  periodicidadDePublicacion,
  propiedadConContratoActivoMock,
  readContratosMock,
  readPropiedadesContratoMock,
  siguienteCodigoMock,
} from './adapters/contrato-mock.adapter'
import {
  ALQUILER_NO_ENCONTRADO_MESSAGE,
  alquilerResumenDeDto,
  CONTRATO_NO_EDITABLE_MESSAGE,
  CONTRATO_NO_ENCONTRADO_MESSAGE,
  CONTRATO_NO_PENDIENTE_MESSAGE,
  contratoDeDto,
  contratoDetalleDeDto,
  contratoEnviadoDeDto,
  contratoResumenDeDto,
  datosToContratoRequest,
  errorDeContrato,
  FIRMA_ERROR_GENERICO_MESSAGE,
  FIRMA_RECHAZADA_MESSAGE,
  FIRMANTE_NO_PENDIENTE_MESSAGE,
  MIS_ALQUILERES_ERROR_MESSAGE,
  OTRA_PARTE_FIRMO_MESSAGE,
  PROPIEDAD_CON_CONTRATO_MESSAGE,
  REENVIO_MUY_PRONTO_MESSAGE,
  SOLICITUD_CON_CONTRATO_MESSAGE,
  SOLICITUD_NO_ACEPTADA_MESSAGE,
  SOLICITUD_NO_ENCONTRADA_PARA_CONTRATO_MESSAGE,
  SOLO_LOCADOR_MESSAGE,
  SOLO_LOCATARIO_MESSAGE,
  YA_FIRMO_MESSAGE,
} from './adapters/contrato.adapter'
import { formatAddress, mainPhotoSrc } from './adapters/propiedad-mock.adapter'
import { perfilMockDe } from './perfil.service'
import { apiRequest } from './shared/apiClient'
import type {
  ContratoDetalleResponse,
  ContratoEnviadoResponse,
  ContratoResponse,
  ContratoResumenResponse,
  RechazarFirmaRequest,
  ReenviarInvitacionRequest,
} from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { requireSessionUserId } from './shared/session'
import { readSolicitudesMock } from './solicitudes.service'

// ─── Rama mock: helpers ─────────────────────────────────────────────────

/** Error de la rama mock si `localStorage` está lleno o bloqueado. */
const MOCK_STORAGE_FULL_MESSAGE = 'No pudimos guardar el contrato en este navegador. Tocá "Reiniciar datos de prueba" y probá de nuevo.'

/** Hoy en ISO (el 23/09/2026 en mock). */
function hoyIso(): string {
  return hoy().format('YYYY-MM-DD')
}

/** Perfil de una cuenta del elenco → parte del contrato. Sin perfil, una parte vacía (nunca inventada). */
function parteDe(perfil: PerfilUsuario | null, userId: string, nombreSinCuenta = ''): ParteContrato {
  if (!perfil) {
    const [nombre = '', ...resto] = nombreSinCuenta.split(' ')
    return { userId, nombre, apellido: resto.join(' '), dni: null, email: '', telefono: null }
  }
  return { userId: perfil.id, nombre: perfil.nombre, apellido: perfil.apellido, dni: perfil.dni, email: perfil.email, telefono: perfil.telefono }
}

/** "Nombre Apellido" de una cuenta del elenco, o `null`. */
function nombreDeCuenta(userId: string): string | null {
  const perfil = perfilMockDe(userId)
  return perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : null
}

/** La propiedad del contrato, como la necesita el alta (dirección exacta, precio, índice y cobro). */
function propiedadDelContrato(propiedad: PropiedadMock): ContratoBorrador['propiedad'] {
  return {
    id: propiedad.id,
    address: formatAddress(propiedad),
    neighborhoodName: propiedad.neighborhoodName,
    priceMonthly: propiedad.priceMonthly,
    adjustmentIndex: propiedad.adjustmentIndex,
    cobro: { paymentMethods: propiedad.paymentMethods, graceDays: propiedad.graceDays, dailyInterestPct: propiedad.dailyInterestPct },
    photoSrc: mainPhotoSrc(propiedad) || null,
  }
}

/**
 * La solicitud aceptada de una propiedad del locador en sesión, con las
 * respuestas que daría el back:
 * - `not_found` si no existe o no es de una propiedad suya (no se distingue).
 * - `conflict` `SOLICITUD_NO_ACEPTADA` / `SOLICITUD_CON_CONTRATO` /
 *   `PROPIEDAD_CON_CONTRATO` (US-05: "una solicitud aceptada puede originar
 *   un solo contrato"; "la propiedad no debe tener un contrato vigente ni
 *   pendiente de firma").
 */
function solicitudParaContratoMock(solicitudId: string, ownerId: string, exceptoContratoId?: string) {
  const solicitud = readSolicitudesMock().find((item) => item.id === solicitudId)
  const propiedad = solicitud ? readPropiedadesContratoMock().find((item) => item.id === solicitud.propertyId) : undefined
  if (!solicitud || !propiedad || propiedad.ownerId !== ownerId) throw new ServiceError('not_found', SOLICITUD_NO_ENCONTRADA_PARA_CONTRATO_MESSAGE)
  if (solicitud.status !== 'aceptada') throw new ServiceError('conflict', SOLICITUD_NO_ACEPTADA_MESSAGE, 'SOLICITUD_NO_ACEPTADA')
  const existente = contratoDeSolicitudMock(solicitudId)
  if (existente && existente.id !== exceptoContratoId) throw new ServiceError('conflict', SOLICITUD_CON_CONTRATO_MESSAGE, 'SOLICITUD_CON_CONTRATO')
  if (propiedadConContratoActivoMock(propiedad.id, exceptoContratoId)) throw new ServiceError('conflict', PROPIEDAD_CON_CONTRATO_MESSAGE, 'PROPIEDAD_CON_CONTRATO')
  return { solicitud, propiedad }
}

/** Arma el `ContratoBorrador` de un contrato guardado (las partes, del perfil de hoy). */
function borradorDeContratoMock(contrato: ContratoMock): ContratoBorrador {
  const propiedad = readPropiedadesContratoMock().find((item) => item.id === contrato.propertyId)
  if (!propiedad) throw new ServiceError('not_found', CONTRATO_NO_ENCONTRADO_MESSAGE)
  const solicitud = contrato.solicitudId ? readSolicitudesMock().find((item) => item.id === contrato.solicitudId) : undefined
  const base: ContratoBorrador = {
    id: contrato.id,
    code: contrato.code,
    status: contrato.status,
    solicitudId: contrato.solicitudId ?? '',
    solicitudAceptadaEl: solicitud?.respondedAt ?? null,
    propiedad: propiedadDelContrato(propiedad),
    locador: parteDe(perfilMockDe(contrato.ownerId), contrato.ownerId),
    locatario: parteDe(contrato.tenantUserId ? perfilMockDe(contrato.tenantUserId) : null, contrato.tenantUserId ?? '', contrato.tenantName),
    garantiasOfrecidas: solicitud?.legajo?.guarantees ?? [],
    garantes: contrato.garantes,
    condiciones: contrato.condiciones,
    clausulas: contrato.clausulas ?? [],
    ultimoPaso: contrato.ultimoPaso,
  }
  return { ...base, clausulas: completarClausulas(base.clausulas, base) }
}

/** El contrato guardado `id` del locador en sesión (no distingue "no existe" de "no es tuyo"). */
function contratoPropioMock(id: string, ownerId: string): ContratoMock {
  const contrato = buscarContratoMock(id)
  if (!contrato || contrato.ownerId !== ownerId) throw new ServiceError('not_found', CONTRATO_NO_ENCONTRADO_MESSAGE)
  return contrato
}

// ─── Listado ────────────────────────────────────────────────────────────

/**
 * US-05 — "Listado de contratos (/panel/contratos)": los contratos del
 * locador en sesión (borradores, pendientes de firma, vigentes y
 * finalizados), sin ordenar (ver `lib/contratos/listado.ts`).
 * @backend GET /api/v1/contratos   (no existe — propuesto · rol locador) → ContratoResumenResponse[]
 * @returns ContratoResumen[] — sin DNI ni contacto (solo el nombre del locatario).
 * @throws {ServiceError} `unauthorized` sin sesión; `network` / `server`.
 * TODO(backend): crear la ruta (contrato en `docs/api-endpoints.md`).
 */
export async function listarContratos(): Promise<ContratoResumen[]> {
  if (USE_MOCKS) {
    await delay()
    return contratosDeLocadorMock(requireSessionUserId(), nombreDeCuenta, hoyIso())
  }
  try {
    const dtos = await apiRequest<ContratoResumenResponse[]>('/contratos')
    return dtos.map(contratoResumenDeDto)
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_EDITABLE' })
  }
}

// ─── Inicio ─────────────────────────────────────────────────────────────

/**
 * US-05 — "Se debe poder iniciar el contrato desde una solicitud aceptada
 * (botón 'Iniciar contrato'), con la propiedad y el locatario precargados."
 * Devuelve el contrato SIN guardar (`id: null`), con los valores por
 * defecto del paso 2 y la plantilla completa.
 * @backend GET /api/v1/contratos/preparar?id_solicitud=:id   (no existe — propuesto) → ContratoResponse
 * @throws {ServiceError}
 *   - `not_found`: la solicitud no existe o no es de una propiedad del locador.
 *   - `conflict` (`apiCode`): `SOLICITUD_NO_ACEPTADA`, `SOLICITUD_CON_CONTRATO`
 *     o `PROPIEDAD_CON_CONTRATO`.
 */
export async function prepararContrato(solicitudId: string): Promise<ContratoBorrador> {
  if (USE_MOCKS) {
    await delay(300)
    const ownerId = requireSessionUserId()
    const { solicitud, propiedad } = solicitudParaContratoMock(solicitudId, ownerId)
    const precio = propiedad.priceMonthly
    // US-05: inicio sin valor por defecto; se precarga la disponibilidad si todavía no pasó.
    const inicio = propiedad.availableFrom && propiedad.availableFrom >= hoyIso() ? propiedad.availableFrom : null
    const indice = propiedad.adjustmentIndex ?? 'sin_ajuste'
    const base: ContratoBorrador = {
      id: null,
      code: null,
      status: 'borrador',
      solicitudId,
      solicitudAceptadaEl: solicitud.respondedAt,
      propiedad: propiedadDelContrato(propiedad),
      locador: parteDe(perfilMockDe(ownerId), ownerId),
      locatario: parteDe(perfilMockDe(solicitud.applicantUserId), solicitud.applicantUserId, solicitud.applicantName),
      garantiasOfrecidas: solicitud.legajo?.guarantees ?? ([] as GarantiaOfrecida[]),
      garantes: [],
      condiciones: {
        startDate: inicio,
        durationMonths: DURACION_POR_DEFECTO,
        initialAmount: precio,
        // US-05: "por defecto equivale a un mes de alquiler".
        deposit: precio,
        paymentDueDay: DIA_VENCIMIENTO_POR_DEFECTO,
        // Decisión del PO: el índice de la publicación (IPC o ICL); si no tiene, "Sin ajuste".
        adjustmentIndex: indice,
        adjustmentPeriod: indice === 'sin_ajuste' ? null : periodicidadDePublicacion(propiedad),
      },
      clausulas: [],
      ultimoPaso: 0,
    }
    return { ...base, clausulas: completarClausulas([], base) }
  }
  try {
    const dto = await apiRequest<ContratoResponse>('/contratos/preparar', { query: { id_solicitud: solicitudId } })
    return contratoDeDto(dto)
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'SOLICITUD_CON_CONTRATO', noEncontrado: SOLICITUD_NO_ENCONTRADA_PARA_CONTRATO_MESSAGE })
  }
}

// ─── Borrador ───────────────────────────────────────────────────────────

/**
 * US-05 — "Un borrador se puede retomar desde el paso en que quedó."
 * Trae un contrato del locador en sesión (cualquier estado: la pantalla
 * decide; si no es borrador, avisa que no se puede editar).
 * @backend GET /api/v1/contratos/:id   (no existe — propuesto) → ContratoResponse
 * @throws {ServiceError} `not_found` si no existe o no es suyo (no se distingue).
 */
export async function getContrato(id: string): Promise<ContratoBorrador> {
  if (USE_MOCKS) {
    await delay(300)
    return borradorDeContratoMock(contratoPropioMock(id, requireSessionUserId()))
  }
  try {
    return contratoDeDto(await apiRequest<ContratoResponse>(`/contratos/${encodeURIComponent(id)}`))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_EDITABLE' })
  }
}

/**
 * US-05 — "Se puede guardar el contrato como borrador desde cualquier paso."
 * Sin `id`, crea el borrador; con `id`, lo actualiza. Los datos pueden estar
 * incompletos (se validan al enviar a firmar).
 * @backend POST /api/v1/contratos   (no existe — propuesto) body ContratoRequest → 201 ContratoResponse
 * @backend PUT  /api/v1/contratos/:id   (no existe — propuesto) body ContratoRequest → 200 ContratoResponse
 * @returns el borrador guardado (con su `id`).
 * @throws {ServiceError}
 *   - `conflict` `CONTRATO_NO_EDITABLE`: el contrato ya no es borrador.
 *   - `conflict` `SOLICITUD_CON_CONTRATO` / `PROPIEDAD_CON_CONTRATO` al crear.
 *   - `not_found`: el contrato o la solicitud no son del locador.
 */
export async function guardarBorrador(id: string | null, datos: DatosContrato): Promise<ContratoBorrador> {
  if (USE_MOCKS) {
    await delay()
    const ownerId = requireSessionUserId()
    const ahora = ahoraIsoMock()
    let contrato: ContratoMock
    if (id) {
      const actual = contratoPropioMock(id, ownerId)
      if (actual.status !== 'borrador') throw new ServiceError('conflict', CONTRATO_NO_EDITABLE_MESSAGE, 'CONTRATO_NO_EDITABLE')
      contrato = { ...actual, garantes: datos.garantes, condiciones: datos.condiciones, clausulas: datos.clausulas, ultimoPaso: datos.ultimoPaso, updatedAt: ahora }
    } else {
      const { solicitud, propiedad } = solicitudParaContratoMock(datos.solicitudId, ownerId)
      const nuevoId = `BOR-${Date.now()}`
      contrato = {
        id: nuevoId,
        code: null,
        status: 'borrador',
        ownerId,
        propertyId: propiedad.id,
        solicitudId: solicitud.id,
        tenantUserId: solicitud.applicantUserId,
        tenantName: solicitud.applicantName,
        garantes: datos.garantes,
        condiciones: datos.condiciones,
        clausulas: datos.clausulas,
        ultimoPaso: datos.ultimoPaso,
        createdAt: ahora,
        updatedAt: ahora,
        sentAt: null,
        eventos: [{ id: `ev-${nuevoId}-1`, tipo: 'creado', fecha: ahora, rol: null, motivo: null }],
      }
    }
    if (!guardarContratoMock(contrato)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return borradorDeContratoMock(contrato)
  }
  try {
    const body = datosToContratoRequest(datos)
    const dto = id
      ? await apiRequest<ContratoResponse>(`/contratos/${encodeURIComponent(id)}`, { method: 'PUT', body })
      : await apiRequest<ContratoResponse>('/contratos', { method: 'POST', body })
    return contratoDeDto(dto)
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: id ? 'CONTRATO_NO_EDITABLE' : 'SOLICITUD_CON_CONTRATO' })
  }
}

/**
 * US-05 — "Se puede eliminar un borrador, previa confirmación." (La
 * confirmación la pide la pantalla.)
 * @backend DELETE /api/v1/contratos/:id   (no existe — propuesto) → 204
 * @throws {ServiceError} `conflict` `CONTRATO_NO_EDITABLE` si ya no es borrador; `not_found`.
 */
export async function eliminarBorrador(id: string): Promise<void> {
  if (USE_MOCKS) {
    await delay()
    const contrato = contratoPropioMock(id, requireSessionUserId())
    if (contrato.status !== 'borrador') throw new ServiceError('conflict', CONTRATO_NO_EDITABLE_MESSAGE, 'CONTRATO_NO_EDITABLE')
    if (!eliminarContratoMock(id)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return
  }
  try {
    await apiRequest<null>(`/contratos/${encodeURIComponent(id)}`, { method: 'DELETE' })
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_EDITABLE' })
  }
}

// ─── Enviar a firmar ────────────────────────────────────────────────────

/**
 * US-05 — "Al enviarlo, el contrato pasa al estado 'pendiente de firma',
 * recibe un código con formato CT-AAAA-NNNN y no se puede editar." Guarda
 * lo último y lo envía. La propiedad sigue publicada (decisión del PO).
 * @backend PUT  /api/v1/contratos/:id   (guarda lo último; o POST si todavía no tiene id)
 * @backend POST /api/v1/contratos/:id/enviar   (no existe — propuesto) → 200 ContratoEnviadoResponse
 * @returns el código y quiénes firman (locador y locatario).
 * @throws {ServiceError}
 *   - `validation`: falta un dato o no cumple la US (el primer error).
 *   - `conflict` (`apiCode`): `CONTRATO_NO_EDITABLE`, `SOLICITUD_CON_CONTRATO`
 *     o `PROPIEDAD_CON_CONTRATO` (otra solicitud ya lo hizo mientras tanto).
 */
export async function enviarAFirmar(id: string | null, datos: DatosContrato): Promise<ContratoEnviado> {
  const guardado = await guardarBorrador(id, datos)
  const contratoId = guardado.id
  if (!contratoId) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
  if (USE_MOCKS) {
    await delay()
    const ownerId = requireSessionUserId()
    const error = errorParaEnviar(guardado, hoyIso())
    if (error) throw new ServiceError('validation', error)
    const contrato = contratoPropioMock(contratoId, ownerId)
    if (propiedadConContratoActivoMock(contrato.propertyId, contrato.id)) throw new ServiceError('conflict', PROPIEDAD_CON_CONTRATO_MESSAGE, 'PROPIEDAD_CON_CONTRATO')
    // NOTA: si el envío se había cancelado (US-07), conserva el código que ya tenía.
    const code = contrato.code ?? siguienteCodigoMock(hoy().year())
    const ahora = ahoraIsoMock()
    const aFirmar: ContratoMock = {
      ...contrato,
      code,
      status: 'pendiente_firma',
      updatedAt: ahora,
      sentAt: ahora,
      // US-07: las dos partes quedan invitadas a firmar, con las firmas en cero.
      firmas: firmasAlEnviar(ahora),
      firmadoPorTodasEl: null,
      eventos: conEvento(contrato, 'enviado', ahora),
    }
    if (!guardarContratoMock(aFirmar)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    const enviado = contratoEnviadoDeDto({ id: 0, codigo: code, estado: 'pendiente_firma' }, guardado)
    return { ...enviado, id: contratoId }
  }
  try {
    const dto = await apiRequest<ContratoEnviadoResponse>(`/contratos/${encodeURIComponent(contratoId)}/enviar`, { method: 'POST' })
    return contratoEnviadoDeDto(dto, guardado)
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_EDITABLE' })
  }
}

// ─── US-07: detalle ─────────────────────────────────────────────────────

/**
 * Un contrato guardado por su id o por su código. NOTA: en mock, los que se
 * crean en el navegador tienen un id interno (`BOR-<n>`) y un código
 * `CT-AAAA-NNNN` al enviarse; la URL del detalle puede traer cualquiera de
 * los dos (en real, el id es el número de la base).
 */
function buscarContratoMock(id: string): ContratoMock | undefined {
  return readContratosMock().find((item) => item.id === id || item.code === id)
}

/** Rol del usuario en el contrato guardado, o `null` si no es parte. */
function rolEnContratoMock(contrato: Pick<ContratoMock, 'ownerId' | 'tenantUserId'>, userId: string): RolFirmante | null {
  if (contrato.ownerId === userId) return 'locador'
  if (contrato.tenantUserId === userId) return 'locatario'
  return null
}

/**
 * El contrato guardado `id` del que el usuario es parte (locador o
 * locatario). Un borrador solo lo ve el locador. No distingue "no existe"
 * de "no es tuyo" (US-07).
 */
function contratoDeParteMock(id: string, userId: string): { contrato: ContratoMock; rol: RolFirmante } {
  const contrato = buscarContratoMock(id)
  const rol = contrato ? rolEnContratoMock(contrato, userId) : null
  if (!contrato || !rol || (contrato.status === 'borrador' && rol !== 'locador')) throw new ServiceError('not_found', CONTRATO_NO_ENCONTRADO_MESSAGE)
  return { contrato, rol }
}

/** Contrato guardado → `ContratoDetalle` (firmantes con el nombre de hoy del perfil). */
function detalleDeContratoMock(contrato: ContratoMock): ContratoDetalle {
  const base = borradorDeContratoMock(contrato)
  const nombreDe = (parte: ParteContrato) => `${parte.nombre} ${parte.apellido}`.trim()
  const nombres: Record<RolFirmante, string> = { locador: nombreDe(base.locador), locatario: nombreDe(base.locatario) || contrato.tenantName }
  const ids: Record<RolFirmante, string> = { locador: base.locador.userId, locatario: base.locatario.userId }
  const { firmas } = contrato
  const firmantes: FirmanteContrato[] = firmas
    ? (['locador', 'locatario'] as const).map((rol) => ({ rol, userId: ids[rol], nombre: nombres[rol], ...firmas[rol] }))
    : []
  // Los anteriores a RentAR (sin solicitud de origen ni firmas, como CT-2023-0041) no tienen historial: no se inventa.
  const conRegistro = Boolean(firmas) || contrato.status === 'borrador' || contrato.solicitudId !== null
  const historial: EventoContrato[] = conRegistro
    ? eventosDe(contrato)
        .map((evento) => ({ ...evento, nombre: evento.rol ? nombres[evento.rol] : null }))
        .reverse()
    : []
  return {
    ...base,
    enviadoEl: contrato.sentAt,
    firmadoPorTodasEl: contrato.firmadoPorTodasEl ?? null,
    firmasRegistradas: Boolean(firmas),
    firmantes,
    historial,
    endDate: fechaFin(contrato.condiciones.startDate, contrato.condiciones.durationMonths),
    // NOTA: en mock los ajustes no se calculan: el monto actual es el inicial.
    montoActual: contrato.condiciones.initialAmount,
    ajusteCadaMeses: cadaMesesDe(contrato.condiciones),
  }
}

/** Cada cuántos meses ajusta un contrato de RentAR (`null` sin ajuste). */
function cadaMesesDe(condiciones: ContratoBorrador['condiciones']): number | null {
  if (condiciones.adjustmentIndex === 'sin_ajuste' || !condiciones.adjustmentPeriod) return null
  return MESES_POR_PERIODO[condiciones.adjustmentPeriod]
}

/**
 * Día de pago de un alquiler del elenco: el del vencimiento de su cobro en
 * `panel.mock.ts` (dato del elenco, no inventado); `null` si no tiene.
 */
function diaDePagoDelElenco(contractId: string): number | null {
  const cobro = cobrosElenco.find((item) => item.contractId === contractId)
  return cobro ? dayjs(cobro.dueDate).date() : null
}

/**
 * Un vigente del elenco (`propiedad.rental`, anterior a RentAR) → detalle.
 * Solo con lo que el elenco tiene: sin firmas, historial, garantes, monto
 * inicial ni depósito (se muestran vacíos, nunca inventados). El monto
 * actual y el próximo ajuste salen de `rental`; el día de pago, de su
 * cobro en `panel.mock.ts` (US-27, tanda 4).
 */
function detalleDeAlquilerMock(propiedad: PropiedadMock): ContratoDetalle | null {
  const { rental } = propiedad
  if (!rental) return null
  const meses = dayjs(rental.endDate).add(1, 'day').diff(dayjs(rental.startDate), 'month')
  const indice = propiedad.adjustmentIndex ?? 'sin_ajuste'
  const base: ContratoBorrador = {
    id: rental.contractId,
    code: rental.contractId,
    status: rental.contractStatus,
    solicitudId: '',
    solicitudAceptadaEl: null,
    propiedad: propiedadDelContrato(propiedad),
    locador: parteDe(perfilMockDe(propiedad.ownerId), propiedad.ownerId),
    locatario: parteDe(rental.tenantUserId ? perfilMockDe(rental.tenantUserId) : null, rental.tenantUserId ?? '', rental.tenantName),
    garantiasOfrecidas: [],
    garantes: [],
    condiciones: {
      startDate: rental.startDate,
      durationMonths: meses,
      // NOTA: `rental` guarda el monto ACTUAL (ya ajustado), no el inicial.
      initialAmount: null,
      deposit: null,
      paymentDueDay: diaDePagoDelElenco(rental.contractId),
      adjustmentIndex: indice,
      adjustmentPeriod: indice === 'sin_ajuste' ? null : periodicidadDePublicacion(propiedad),
    },
    clausulas: [],
    ultimoPaso: 3,
  }
  return {
    ...base,
    clausulas: completarClausulas([], base),
    enviadoEl: null,
    firmadoPorTodasEl: null,
    firmasRegistradas: false,
    firmantes: [],
    historial: [],
    endDate: rental.endDate,
    montoActual: rental.currentAmount,
    // El elenco ajusta cada 4 o 12 meses (la periodicidad del contrato de RentAR no tiene 4).
    ajusteCadaMeses: indice === 'sin_ajuste' ? null : propiedad.adjustmentEveryMonths,
  }
}

/**
 * US-07 — "Detalle del contrato": datos principales, firmantes con su
 * estado, documento e historial. Lo pueden ver el locador y el locatario
 * del contrato; un borrador, solo el locador (la pantalla lo manda a
 * `/editar`).
 * @backend GET /api/v1/contratos/:id   (no existe — propuesto) → ContratoDetalleResponse (con `firmantes` e `historial` en la misma respuesta)
 * @throws {ServiceError} `not_found` "No encontramos este contrato." si no existe o no es suyo (US-07: "sin distinguir entre los dos casos").
 * TODO(backend): crear la ruta (contrato en `docs/api-endpoints.md`, US-07).
 */
export async function getDetalleContrato(id: string): Promise<ContratoDetalle> {
  if (USE_MOCKS) {
    await delay(400)
    const userId = requireSessionUserId()
    if (buscarContratoMock(id)) return detalleDeContratoMock(contratoDeParteMock(id, userId).contrato)
    const propiedad = readPropiedadesContratoMock().find((item) => item.rental?.contractId === id)
    const esParte = propiedad && (propiedad.ownerId === userId || propiedad.rental?.tenantUserId === userId)
    const detalle = esParte ? detalleDeAlquilerMock(propiedad) : null
    if (!detalle) throw new ServiceError('not_found', CONTRATO_NO_ENCONTRADO_MESSAGE)
    return detalle
  }
  try {
    return contratoDetalleDeDto(await apiRequest<ContratoDetalleResponse>(`/contratos/${encodeURIComponent(id)}`))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_PENDIENTE' })
  }
}

// ─── US-07: firmar y rechazar ───────────────────────────────────────────

/** Guarda el contrato con los cambios de una acción de US-07 y devuelve el detalle. */
function guardarAccionMock(contrato: ContratoMock): ContratoDetalle {
  if (!guardarContratoMock(contrato)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
  return detalleDeContratoMock(contrato)
}

/** Las firmas del contrato pendiente de firma (si no está pendiente, 409 `CONTRATO_NO_PENDIENTE`). */
function pendienteDeFirmaMock(contrato: ContratoMock): Record<RolFirmante, FirmaMock> {
  if (contrato.status !== 'pendiente_firma' || !contrato.firmas) {
    throw new ServiceError('conflict', CONTRATO_NO_PENDIENTE_MESSAGE, 'CONTRATO_NO_PENDIENTE')
  }
  return contrato.firmas
}

/**
 * US-07 — "Firma": registra la firma de quien está en sesión (el locador
 * desde el detalle; el locatario, desde Mi alquiler). La pantalla ya pidió
 * leer hasta la última página, la casilla y la confirmación.
 * - "Se deben registrar la fecha, la hora y la IP de cada firma": lo hace el
 *   back. En mock, el "hoy" del elenco con la hora real (`ahora()`); la IP no.
 * - "Una parte no puede firmar más de una vez el mismo contrato": 409.
 * - "Cuando firman todas las partes, el contrato pasa a 'vigente'": la
 *   propiedad pasa a alquilada y sus solicitudes pendientes, a rechazadas
 *   (en mock, `pasarAVigenteMock`; en real, el back).
 * @backend POST /api/v1/contratos/:id/firmar   (no existe — propuesto) → 200 ContratoDetalleResponse
 * @throws {ServiceError}
 *   - `conflict` (`apiCode`): `CONTRATO_NO_PENDIENTE` (borrador, vigente…),
 *     `YA_FIRMO` o `FIRMA_RECHAZADA` (ver la NOTA).
 *   - `not_found`: no existe o no es parte.
 * NOTA (propuesta, pendiente del OK del PO): quien rechazó no puede firmar
 * después; el locador cancela el envío y lo vuelve a enviar.
 */
export async function firmarContrato(id: string): Promise<ContratoDetalle> {
  if (USE_MOCKS) {
    await delay()
    const { contrato, rol } = contratoDeParteMock(id, requireSessionUserId())
    const firmas = pendienteDeFirmaMock(contrato)
    if (firmas[rol].estado === 'firmado') throw new ServiceError('conflict', YA_FIRMO_MESSAGE, 'YA_FIRMO')
    if (firmas[rol].estado === 'rechazado') throw new ServiceError('conflict', FIRMA_RECHAZADA_MESSAGE, 'FIRMA_RECHAZADA')
    const ahora = ahoraIsoMock()
    const firmada: FirmaMock = { ...firmas[rol], estado: 'firmado', firmadoEl: ahora }
    const nuevas: Record<RolFirmante, FirmaMock> = { ...firmas, [rol]: firmada }
    const todas = nuevas.locador.estado === 'firmado' && nuevas.locatario.estado === 'firmado'
    const conFirma: ContratoMock = { ...contrato, firmas: nuevas, eventos: conEvento(contrato, 'firmado', ahora, rol), updatedAt: ahora }
    const firmado: ContratoMock = todas
      ? { ...conFirma, status: 'vigente', firmadoPorTodasEl: ahora, eventos: conEvento(conFirma, 'vigente', ahora) }
      : conFirma
    const detalle = guardarAccionMock(firmado)
    if (todas && !pasarAVigenteMock(firmado, ahora)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return detalle
  }
  try {
    return contratoDetalleDeDto(await apiRequest<ContratoDetalleResponse>(`/contratos/${encodeURIComponent(id)}/firmar`, { method: 'POST' }))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_PENDIENTE', generico: FIRMA_ERROR_GENERICO_MESSAGE })
  }
}

/**
 * US-07 — "El locatario puede rechazar la firma, indicando un motivo
 * opcional de hasta 300 caracteres, previa confirmación. Esto no cambia el
 * estado del contrato, que sigue pendiente de firma, y el rechazo se ve en
 * el detalle." (La confirmación la pide la pantalla.)
 * @backend POST /api/v1/contratos/:id/rechazar   (no existe — propuesto) body RechazarFirmaRequest → 200 ContratoDetalleResponse
 * @throws {ServiceError}
 *   - `validation`: el motivo pasa los 300 caracteres.
 *   - `forbidden`: quien llama es el locador.
 *   - `conflict`: `CONTRATO_NO_PENDIENTE`, `YA_FIRMO` o `FIRMA_RECHAZADA` (ya rechazó).
 *   - `not_found`: no existe o no es parte.
 */
export async function rechazarFirma(id: string, motivo: string | null): Promise<ContratoDetalle> {
  const error = errorDeMotivoRechazo(motivo)
  const limpio = normalizarMotivoRechazo(motivo)
  // Como el back: el largo se valida antes de buscar el contrato.
  if (error) throw new ServiceError('validation', error)
  if (USE_MOCKS) {
    await delay()
    const { contrato, rol } = contratoDeParteMock(id, requireSessionUserId())
    if (rol !== 'locatario') throw new ServiceError('forbidden', SOLO_LOCATARIO_MESSAGE)
    const firmas = pendienteDeFirmaMock(contrato)
    if (firmas.locatario.estado === 'firmado') throw new ServiceError('conflict', YA_FIRMO_MESSAGE, 'YA_FIRMO')
    if (firmas.locatario.estado === 'rechazado') throw new ServiceError('conflict', FIRMA_RECHAZADA_MESSAGE, 'FIRMA_RECHAZADA')
    const ahora = ahoraIsoMock()
    return guardarAccionMock({
      ...contrato,
      firmas: { ...firmas, locatario: { ...firmas.locatario, estado: 'rechazado', rechazadoEl: ahora, motivoRechazo: limpio } },
      eventos: conEvento(contrato, 'rechazado', ahora, 'locatario', limpio),
      updatedAt: ahora,
    })
  }
  try {
    const body: RechazarFirmaRequest = { motivo: limpio }
    return contratoDetalleDeDto(await apiRequest<ContratoDetalleResponse>(`/contratos/${encodeURIComponent(id)}/rechazar`, { method: 'POST', body }))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_PENDIENTE', prohibido: SOLO_LOCATARIO_MESSAGE, generico: FIRMA_ERROR_GENERICO_MESSAGE })
  }
}

// ─── US-07: acciones del locador ────────────────────────────────────────

/** El contrato guardado del que el usuario es el LOCADOR (403 si es el locatario; 404 si no es parte). */
function contratoDelLocadorMock(id: string, userId: string): ContratoMock {
  const { contrato, rol } = contratoDeParteMock(id, userId)
  if (rol !== 'locador') throw new ServiceError('forbidden', SOLO_LOCADOR_MESSAGE)
  return contrato
}

/**
 * US-07 — "El locador puede cancelar el envío mientras ninguna otra parte
 * haya firmado. El contrato vuelve a 'borrador' y se borran las firmas
 * registradas." Su propia firma no cuenta (se borra). Vuelve a ser
 * editable desde `/panel/contratos/[id]/editar`.
 * NOTA: conserva su código CT-AAAA-NNNN; si se vuelve a enviar, sale con el mismo.
 * @backend POST /api/v1/contratos/:id/cancelar-envio   (no existe — propuesto) → 200 ContratoDetalleResponse (en `borrador`)
 * @throws {ServiceError}
 *   - `forbidden`: quien llama es el locatario.
 *   - `conflict`: `OTRA_PARTE_FIRMO` o `CONTRATO_NO_PENDIENTE`.
 *   - `not_found`: no existe o no es parte.
 */
export async function cancelarEnvio(id: string): Promise<ContratoDetalle> {
  if (USE_MOCKS) {
    await delay()
    const contrato = contratoDelLocadorMock(id, requireSessionUserId())
    const firmas = pendienteDeFirmaMock(contrato)
    if (firmas.locatario.estado === 'firmado') throw new ServiceError('conflict', OTRA_PARTE_FIRMO_MESSAGE, 'OTRA_PARTE_FIRMO')
    const ahora = ahoraIsoMock()
    // Se borran las firmas registradas (US-07): el registro queda sin `firmas`, como un borrador.
    const sinFirmas: ContratoMock = { ...contrato }
    delete sinFirmas.firmas
    return guardarAccionMock({
      ...sinFirmas,
      status: 'borrador',
      sentAt: null,
      firmadoPorTodasEl: null,
      eventos: conEvento(contrato, 'envio_cancelado', ahora),
      updatedAt: ahora,
    })
  }
  try {
    return contratoDetalleDeDto(await apiRequest<ContratoDetalleResponse>(`/contratos/${encodeURIComponent(id)}/cancelar-envio`, { method: 'POST' }))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'OTRA_PARTE_FIRMO', prohibido: SOLO_LOCADOR_MESSAGE, generico: FIRMA_ERROR_GENERICO_MESSAGE })
  }
}

/**
 * US-07 — "El locador puede reenviar la invitación a un firmante pendiente,
 * como máximo una vez por hora." Hoy el único a quien reenviar es el
 * locatario (el garante no firma en el Sprint 3).
 * NOTA: no se manda ningún mail (ni en mock ni todavía en real): la
 * pantalla lo aclara con `SimulatedFeatureNotice`.
 * @backend POST /api/v1/contratos/:id/reenviar   (no existe — propuesto) body ReenviarInvitacionRequest → 200 ContratoDetalleResponse
 * @throws {ServiceError}
 *   - `too_many_requests` (429): pasó menos de una hora desde la última invitación.
 *   - `conflict`: `FIRMANTE_NO_PENDIENTE` (ya firmó o rechazó) o `CONTRATO_NO_PENDIENTE`.
 *   - `forbidden`: quien llama es el locatario. `not_found`: no es parte.
 */
export async function reenviarInvitacion(id: string, rol: RolFirmante): Promise<ContratoDetalle> {
  if (USE_MOCKS) {
    await delay()
    const contrato = contratoDelLocadorMock(id, requireSessionUserId())
    const firmas = pendienteDeFirmaMock(contrato)
    const firma = firmas[rol]
    if (rol === 'locador' || firma.estado !== 'pendiente') throw new ServiceError('conflict', FIRMANTE_NO_PENDIENTE_MESSAGE, 'FIRMANTE_NO_PENDIENTE')
    const ahora = ahoraIsoMock()
    if (reenvioBloqueado(firma, ahora)) throw new ServiceError('too_many_requests', REENVIO_MUY_PRONTO_MESSAGE)
    return guardarAccionMock({
      ...contrato,
      firmas: { ...firmas, [rol]: { ...firma, ultimaInvitacion: ahora } },
      eventos: conEvento(contrato, 'reenviado', ahora, rol),
      updatedAt: ahora,
    })
  }
  try {
    const body: ReenviarInvitacionRequest = { rol }
    return contratoDetalleDeDto(await apiRequest<ContratoDetalleResponse>(`/contratos/${encodeURIComponent(id)}/reenviar`, { method: 'POST', body }))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'FIRMANTE_NO_PENDIENTE', prohibido: SOLO_LOCADOR_MESSAGE, generico: FIRMA_ERROR_GENERICO_MESSAGE })
  }
}

// ─── US-27 Consultar mis alquileres (y la firma del locatario, US-07) ──

/**
 * US-27 — "Solo se muestran los contratos en los que el usuario es
 * locatario: pendientes de firma, vigentes y finalizados." Cuentan los tres
 * para decidir ficha o listado (decisión del PO, tanda 4).
 */
const ESTADOS_MIS_ALQUILERES: readonly ContractStatus[] = ['pendiente_firma', 'vigente', 'finalizado']

/** Rama mock: los contratos del usuario como locatario (guardados y del elenco), sin repetir. */
function misContratosMock(userId: string): { guardados: ContratoMock[]; alquileres: PropiedadMock[] } {
  const guardados = readContratosMock().filter((contrato) => contrato.tenantUserId === userId && ESTADOS_MIS_ALQUILERES.includes(contrato.status))
  const alquileres = readPropiedadesContratoMock().filter(
    (propiedad) =>
      propiedad.rental?.tenantUserId === userId &&
      ESTADOS_MIS_ALQUILERES.includes(propiedad.rental.contractStatus) &&
      !guardados.some((contrato) => contrato.code === propiedad.rental?.contractId),
  )
  return { guardados, alquileres }
}

/**
 * US-27 — Mis alquileres (`/panel/alquileres`): los contratos del usuario
 * como locatario, ordenados (pendientes de firma, vigentes y al final los
 * finalizados). Cada fila con dirección, barrio, locador, estado, monto
 * actual, vigencia y próximo ajuste. Sin datos de otras propiedades del
 * locador ni de otros postulantes.
 * @backend GET /api/v1/contratos?rol=locatario   (no existe — propuesto) → ContratoResumenResponse[] con `locador`
 * @throws {ServiceError} `unauthorized` sin sesión; `network` / `server`.
 */
export async function listarMisAlquileres(): Promise<AlquilerResumen[]> {
  if (USE_MOCKS) {
    await delay(400)
    return ordenarAlquileres(contratosDeLocatarioMock(requireSessionUserId(), nombreDeCuenta, hoyIso(), ESTADOS_MIS_ALQUILERES))
  }
  try {
    const dtos = await apiRequest<ContratoResumenResponse[]>('/contratos', { query: { rol: 'locatario' } })
    return ordenarAlquileres(dtos.filter((dto) => ESTADOS_MIS_ALQUILERES.includes(dto.estado)).map(alquilerResumenDeDto))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_PENDIENTE', generico: MIS_ALQUILERES_ERROR_MESSAGE })
  }
}

/**
 * Cuántos contratos tiene el usuario como locatario (para el menú: "Mi
 * alquiler" o "Mis alquileres", US-27).
 * @backend GET /api/v1/contratos?rol=locatario   (no existe — propuesto)
 */
export async function contarMisAlquileres(): Promise<number> {
  if (USE_MOCKS) {
    const { guardados, alquileres } = misContratosMock(requireSessionUserId())
    return guardados.length + alquileres.length
  }
  return (await listarMisAlquileres()).length
}

/**
 * Mi alquiler (`/panel/alquiler`), US-27 y US-07:
 * - Sin `contratoId`: con un solo contrato (pendiente de firma, vigente o
 *   finalizado), su ficha; con ninguno, `ninguno` ("Todavía no tenés un
 *   contrato activo"); con dos o más, `varios` (la pantalla va al listado
 *   `/panel/alquileres`).
 * - Con `contratoId` (`?contrato=`, desde el listado): la ficha de ese
 *   contrato, si es suyo como locatario.
 * @backend GET /api/v1/contratos?rol=locatario   (no existe — propuesto) → ContratoResumenResponse[]
 * @backend GET /api/v1/contratos/:id   (no existe — propuesto) → ContratoDetalleResponse
 * @throws {ServiceError} `not_found` "No encontramos este alquiler." si el contrato no existe o el usuario no es su locatario (US-27: "sin distinguir si el contrato existe").
 */
export async function getMiAlquiler(contratoId?: string): Promise<MiAlquiler> {
  if (USE_MOCKS) {
    await delay(400)
    const { guardados, alquileres } = misContratosMock(requireSessionUserId())
    if (contratoId) {
      const guardado = guardados.find((contrato) => contrato.id === contratoId || contrato.code === contratoId)
      if (guardado) return { tipo: 'uno', contrato: detalleDeContratoMock(guardado) }
      const propiedad = alquileres.find((item) => item.rental?.contractId === contratoId)
      const detalle = propiedad ? detalleDeAlquilerMock(propiedad) : null
      if (!detalle) throw new ServiceError('not_found', ALQUILER_NO_ENCONTRADO_MESSAGE)
      return { tipo: 'uno', contrato: detalle }
    }
    const cantidad = guardados.length + alquileres.length
    if (cantidad === 0) return { tipo: 'ninguno' }
    if (cantidad > 1) return { tipo: 'varios', cantidad }
    const unico = guardados[0] ? detalleDeContratoMock(guardados[0]) : alquileres[0] ? detalleDeAlquilerMock(alquileres[0]) : null
    return unico ? { tipo: 'uno', contrato: unico } : { tipo: 'ninguno' }
  }
  try {
    let id = contratoId
    if (!id) {
      const mios = (await apiRequest<ContratoResumenResponse[]>('/contratos', { query: { rol: 'locatario' } })).filter((dto) =>
        ESTADOS_MIS_ALQUILERES.includes(dto.estado),
      )
      if (mios.length === 0) return { tipo: 'ninguno' }
      if (mios.length > 1) return { tipo: 'varios', cantidad: mios.length }
      id = String(mios[0].id)
    }
    return { tipo: 'uno', contrato: contratoDetalleDeDto(await apiRequest<ContratoDetalleResponse>(`/contratos/${encodeURIComponent(id)}`)) }
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_PENDIENTE', noEncontrado: ALQUILER_NO_ENCONTRADO_MESSAGE, generico: MIS_ALQUILERES_ERROR_MESSAGE })
  }
}
