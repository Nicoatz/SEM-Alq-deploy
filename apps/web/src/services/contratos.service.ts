/**
 * contratos.service.ts — frontera con el backend para los contratos del locador.
 *
 * Qué es: el listado de `/panel/contratos`, el inicio desde una solicitud
 * aceptada, el borrador (guardar, retomar y eliminar) y el envío a firmar.
 * Cubre: US-05 Registrar contrato de alquiler.
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
import type { ContratoBorrador, ContratoEnviado, ContratoResumen, DatosContrato, GarantiaOfrecida, ParteContrato, PerfilUsuario } from '@rentar/shared-types'
import { completarClausulas } from '@/lib/contratos/plantilla'
import { DIA_VENCIMIENTO_POR_DEFECTO, DURACION_POR_DEFECTO, errorParaEnviar } from '@/lib/contratos/validaciones'
import { hoy } from '@/lib/utils/fechas'
import type { ContratoMock, PropiedadMock } from '@/lib/mocks'
import {
  ahoraIsoMock,
  contratoDeSolicitudMock,
  contratosDeLocadorMock,
  eliminarContratoMock,
  guardarContratoMock,
  periodicidadDePublicacion,
  propiedadConContratoActivoMock,
  readContratosMock,
  readPropiedadesContratoMock,
  siguienteCodigoMock,
} from './adapters/contrato-mock.adapter'
import {
  CONTRATO_NO_EDITABLE_MESSAGE,
  CONTRATO_NO_ENCONTRADO_MESSAGE,
  contratoDeDto,
  contratoEnviadoDeDto,
  contratoResumenDeDto,
  datosToContratoRequest,
  errorDeContrato,
  PROPIEDAD_CON_CONTRATO_MESSAGE,
  SOLICITUD_CON_CONTRATO_MESSAGE,
  SOLICITUD_NO_ACEPTADA_MESSAGE,
  SOLICITUD_NO_ENCONTRADA_PARA_CONTRATO_MESSAGE,
} from './adapters/contrato.adapter'
import { formatAddress } from './adapters/propiedad-mock.adapter'
import { perfilMockDe } from './perfil.service'
import { apiRequest } from './shared/apiClient'
import type { ContratoEnviadoResponse, ContratoResponse, ContratoResumenResponse } from './shared/backend-dtos'
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
  const contrato = readContratosMock().find((item) => item.id === id)
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
      contrato = {
        id: `BOR-${Date.now()}`,
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
    const code = siguienteCodigoMock(hoy().year())
    const ahora = ahoraIsoMock()
    if (!guardarContratoMock({ ...contrato, code, status: 'pendiente_firma', updatedAt: ahora, sentAt: ahora })) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
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
