/**
 * contratos.service.ts — frontera con el backend para los contratos del locador.
 *
 * Qué es: los contratos de una propiedad (US-43), el inicio desde una solicitud
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
 * - Modo real: US-27 (Mis alquileres) contra `GET /alquileres-locatario`
 *   (EXISTE desde el 26/10). Lo de US-05 y US-07 sigue contra las rutas PROPUESTAS
 *   del Sprint 3 hasta conectarlo (Tandas 1 a 3 del Sprint 4). Estado de cada una en
 *   `docs/api-endpoints.md`, "Contratos" y "Alquileres del locatario".
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
  CambiosBorrador,
  ContratoBorrador,
  ContratoDePropiedad,
  ContratoDetalle,
  ContratoEnviado,
  ContratoResumen,
  ContratosDePropiedad,
  FirmanteContrato,
  MiAlquiler,
  ParteContrato,
  PerfilUsuario,
  RolFirmante,
} from '@rentar/shared-types'
import dayjs from 'dayjs'
import { fechaFin, MESES_POR_PERIODO } from '@/lib/contratos/fechas'
import { errorDeMotivoRechazo, normalizarMotivoRechazo, reenvioBloqueado } from '@/lib/contratos/firmas'
import { ordenarAlquileres } from '@/lib/contratos/listado'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase/client'
import { cabeceraDe, errorDeArchivoPdf } from '@/lib/contratos/pdfCarga'
import { completarClausulas } from '@/lib/contratos/plantilla'
import { separarContratos } from '@/lib/contratos/propiedad'
import { PLAZO_VENCIMIENTO_POR_DEFECTO, DURACION_POR_DEFECTO, errorParaEnviar } from '@/lib/contratos/validaciones'
import { hoy } from '@/lib/utils/fechas'
import { cobros as cobrosElenco, type ContratoMock, type FirmaMock, type PropiedadMock } from '@/lib/mocks'
import {
  ahoraIsoMock,
  PDF_FICTICIO_URL,
  pdfDeContratoMock,
  recordarPdfMock,
  contratoDeSolicitudMock,
  contratosDeLocadorMock,
  contratosDeLocatarioMock,
  eliminarContratoMock,
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
  alquilerResumenDeItem,
  CONTRATO_NO_EDITABLE_MESSAGE,
  CONTRATO_NO_ENCONTRADO_MESSAGE,
  CONTRATO_NO_PENDIENTE_MESSAGE,
  borradorDeApi,
  contratoDetalleDeDto,
  contratoEnviadoDeDto,
  detalleDeLocadorDeDto,
  DETALLE_CONTRATO_ERROR_MESSAGE,
  CONTRATOS_DE_PROPIEDAD_ERROR_MESSAGE,
  contratosDePropiedadDeDto,
  patchDeCambios,
  errorDeMiAlquiler,
  errorDeContrato,
  FIRMA_ERROR_GENERICO_MESSAGE,
  FIRMA_RECHAZADA_MESSAGE,
  FIRMANTE_NO_PENDIENTE_MESSAGE,
  miAlquilerDeDetalle,
  OTRA_PARTE_FIRMO_MESSAGE,
  PROPIEDAD_CON_CONTRATO_MESSAGE,
  REENVIO_MUY_PRONTO_MESSAGE,
  SOLICITUD_CON_CONTRATO_MESSAGE,
  SOLICITUD_NO_ACEPTADA_MESSAGE,
  SOLICITUD_NO_ENCONTRADA_PARA_CONTRATO_MESSAGE,
  PDF_SUBIDA_ERROR_MESSAGE,
  PROPIEDAD_NO_ENCONTRADA_MESSAGE,
  SOLO_LOCADOR_MESSAGE,
  SOLO_LOCATARIO_MESSAGE,
  YA_FIRMO_MESSAGE,
} from './adapters/contrato.adapter'
import { formatAddress, mainPhotoSrc } from './adapters/propiedad-mock.adapter'
import { perfilMockDe } from './perfil.service'
import { apiRequest } from './shared/apiClient'
import type {
  AlquilerLocatarioDetalleResponse,
  AlquilerLocatarioItemResponse,
  ContratoBorradorApiResponse,
  ContratoCreadoResponse,
  ContratoDetalleApiResponse,
  ContratoDetalleResponse,
  RegistrarPdfRequest,
  UrlSubidaPdfResponse,
  ContratosInmuebleResponse,
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
    pdf: pdfDeContratoMock(contrato),
    fechaInicioVencida: contrato.status === 'borrador' && contrato.condiciones.startDate !== null && contrato.condiciones.startDate < hoyIso(),
  }
  return { ...base, clausulas: completarClausulas(base.clausulas, base) }
}

/** El contrato guardado `id` del locador en sesión (no distingue "no existe" de "no es tuyo"). */
function contratoPropioMock(id: string, ownerId: string): ContratoMock {
  const contrato = buscarContratoMock(id)
  if (!contrato || contrato.ownerId !== ownerId) throw new ServiceError('not_found', CONTRATO_NO_ENCONTRADO_MESSAGE)
  return contrato
}

// ─── Inicio ─────────────────────────────────────────────────────────────

/**
 * US-05 — "Se debe iniciar el contrato desde una solicitud aceptada (botón
 * 'Iniciar contrato'), con la propiedad y el locatario precargados." El
 * borrador se crea acá: el back copia las condiciones de la oferta y los
 * valores por defecto de la US (24 meses, un mes de depósito).
 * @backend POST /api/v1/contratos   (existe · rol locador) body `{ id_solicitud }` → 201 fila del contrato (se usa solo `id`)
 * @backend GET  /api/v1/contratos/:id   (existe · rol locador) → ContratoBorradorApiResponse
 * @returns el borrador creado.
 * @throws {ServiceError}
 *   - `not_found`: la solicitud no existe o no es de una propiedad del locador.
 *   - `conflict` (`apiCode`): `SOLICITUD_NO_ACEPTADA`, `SOLICITUD_CON_CONTRATO`,
 *     `PROPIEDAD_CON_BORRADOR`, `PROPIEDAD_CON_CONTRATO`, `PROPIEDAD_SIN_OFERTA` o `CONTRATO_DUPLICADO`.
 */
export async function iniciarContrato(solicitudId: string): Promise<ContratoBorrador> {
  if (USE_MOCKS) {
    await delay(300)
    const ownerId = requireSessionUserId()
    const { solicitud, propiedad } = solicitudParaContratoMock(solicitudId, ownerId)
    const precio = propiedad.priceMonthly
    // US-05: inicio sin valor por defecto; se precarga la disponibilidad si todavía no pasó.
    const inicio = propiedad.availableFrom && propiedad.availableFrom >= hoyIso() ? propiedad.availableFrom : null
    const indice = propiedad.adjustmentIndex ?? 'sin_ajuste'
    const ahora = ahoraIsoMock()
    const id = `BOR-${Date.now()}`
    const contrato: ContratoMock = {
      id,
      code: null,
      status: 'borrador',
      ownerId,
      propertyId: propiedad.id,
      solicitudId: solicitud.id,
      tenantUserId: solicitud.applicantUserId,
      tenantName: solicitud.applicantName,
      garantes: [],
      condiciones: {
        startDate: inicio,
        durationMonths: DURACION_POR_DEFECTO,
        initialAmount: precio,
        // US-05: "por defecto equivale a un mes de alquiler".
        deposit: precio,
        paymentTermDays: PLAZO_VENCIMIENTO_POR_DEFECTO,
        // Decisión del PO: el índice de la publicación (IPC o ICL); si no tiene, "Sin ajuste".
        adjustmentIndex: indice,
        adjustmentPeriod: indice === 'sin_ajuste' ? null : periodicidadDePublicacion(propiedad),
      },
      clausulas: null,
      ultimoPaso: 0,
      createdAt: ahora,
      updatedAt: ahora,
      sentAt: null,
    }
    if (!guardarContratoMock(contrato)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return borradorDeContratoMock(contrato)
  }
  try {
    const creado = await apiRequest<ContratoCreadoResponse>('/contratos', { method: 'POST', body: { id_solicitud: Number(solicitudId) } })
    return await getBorrador(String(creado.id))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'SOLICITUD_CON_CONTRATO', noEncontrado: SOLICITUD_NO_ENCONTRADA_PARA_CONTRATO_MESSAGE, prohibido: SOLO_LOCADOR_MESSAGE })
  }
}

// ─── Borrador ───────────────────────────────────────────────────────────

/**
 * US-06 — "Un borrador se debe retomar desde el paso en que quedó, con todos
 * los datos cargados precargados." Trae un contrato del locador en sesión, en
 * cualquier estado: si no es borrador, la pantalla explica por qué no se edita.
 * @backend GET /api/v1/contratos/:id   (existe · rol locador) → ContratoBorradorApiResponse
 * @throws {ServiceError} `not_found` si no existe o no es suyo (no se distingue).
 */
export async function getBorrador(id: string): Promise<ContratoBorrador> {
  if (USE_MOCKS) {
    await delay(300)
    const ownerId = requireSessionUserId()
    // Los vigentes del elenco salen de `rental`: la pantalla explica por qué no se editan (US-06).
    const propiedad = readPropiedadesContratoMock().find((item) => item.rental?.contractId === id && item.ownerId === ownerId)
    const alquiler = !buscarContratoMock(id) && propiedad ? detalleDeAlquilerMock(propiedad) : null
    return alquiler ?? borradorDeContratoMock(contratoPropioMock(id, ownerId))
  }
  try {
    return borradorDeApi(await apiRequest<ContratoBorradorApiResponse>(`/contratos/${encodeURIComponent(id)}`))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_EDITABLE', prohibido: SOLO_LOCADOR_MESSAGE, idInvalidoEsNoEncontrado: true })
  }
}

/**
 * US-05 — "Se puede guardar el contrato como borrador desde cualquier paso,
 * sin completar los datos obligatorios de los pasos siguientes."
 * @param cambios Solo lo que cambió (`cambiosDeBorrador`): reenviar una fecha de inicio vencida da 400.
 * @backend PATCH /api/v1/contratos/:id   (existe · rol locador) body `{ paso?, condiciones?, garantes? }` → 200 ContratoBorradorApiResponse
 * @returns el borrador guardado.
 * @throws {ServiceError}
 *   - `conflict` `CONTRATO_NO_EDITABLE`: el contrato ya no es borrador.
 *   - `validation`: el dato no cumple la US, con el texto del back.
 *   - `not_found`: no existe o no es del locador.
 */
export async function guardarBorrador(id: string, cambios: CambiosBorrador): Promise<ContratoBorrador> {
  if (USE_MOCKS) {
    await delay()
    const actual = contratoPropioMock(id, requireSessionUserId())
    if (actual.status !== 'borrador') throw new ServiceError('conflict', CONTRATO_NO_EDITABLE_MESSAGE, 'CONTRATO_NO_EDITABLE')
    const contrato: ContratoMock = {
      ...actual,
      garantes: cambios.garantes ?? actual.garantes,
      condiciones: { ...actual.condiciones, ...cambios.condiciones },
      ultimoPaso: cambios.paso ?? actual.ultimoPaso,
      updatedAt: ahoraIsoMock(),
    }
    if (!guardarContratoMock(contrato)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return borradorDeContratoMock(contrato)
  }
  try {
    return borradorDeApi(await apiRequest<ContratoBorradorApiResponse>(`/contratos/${encodeURIComponent(id)}`, { method: 'PATCH', body: patchDeCambios(cambios) }))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_EDITABLE', prohibido: SOLO_LOCADOR_MESSAGE })
  }
}

/** Bucket privado del PDF del contrato. */
const BUCKET_CONTRATOS = 'contratos-pdf'

/**
 * US-05, paso 3 — "Se debe cargar el contrato en formato PDF". El archivo no
 * pasa por la API (acepta hasta 4,5 MB): va directo a Storage con una URL firmada.
 * @backend POST /api/v1/contratos/:id/pdf/url-subida   (existe · rol locador) → UrlSubidaPdfResponse
 * @backend PUT  /api/v1/contratos/:id/pdf   (existe · rol locador) body `{ path, nombre }` → 200 ContratoBorradorApiResponse
 * @returns el borrador con el PDF nuevo. Si falla, el anterior queda como estaba.
 * @throws {ServiceError}
 *   - `validation`: no es un PDF real o supera los 5 MB (también 413).
 *   - `conflict` `CONTRATO_NO_EDITABLE`: ya no es borrador.
 */
export async function subirPdfContrato(id: string, archivo: File): Promise<ContratoBorrador> {
  if (USE_MOCKS) {
    await delay()
    const actual = contratoPropioMock(id, requireSessionUserId())
    if (actual.status !== 'borrador') throw new ServiceError('conflict', CONTRATO_NO_EDITABLE_MESSAGE, 'CONTRATO_NO_EDITABLE')
    const error = errorDeArchivoPdf(archivo, await cabeceraDe(archivo))
    if (error) throw new ServiceError('validation', error)
    const contrato: ContratoMock = { ...actual, pdf: { nombre: archivo.name, tamanoBytes: archivo.size, subidoEl: ahoraIsoMock() }, updatedAt: ahoraIsoMock() }
    if (!guardarContratoMock(contrato)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    recordarPdfMock(contrato.id, archivo)
    return borradorDeContratoMock(contrato)
  }
  try {
    const ruta = `/contratos/${encodeURIComponent(id)}/pdf`
    const subida = await apiRequest<UrlSubidaPdfResponse>(`${ruta}/url-subida`, { method: 'POST' })
    const { error } = await getSupabaseBrowserClient().storage.from(BUCKET_CONTRATOS).uploadToSignedUrl(subida.path, subida.token, archivo, { contentType: 'application/pdf' })
    if (error) throw new ServiceError('server', PDF_SUBIDA_ERROR_MESSAGE)
    const body: RegistrarPdfRequest = { path: subida.path, nombre: archivo.name }
    return borradorDeApi(await apiRequest<ContratoBorradorApiResponse>(ruta, { method: 'PUT', body }))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_EDITABLE', prohibido: SOLO_LOCADOR_MESSAGE, generico: PDF_SUBIDA_ERROR_MESSAGE })
  }
}

/**
 * US-05 — "Se puede eliminar un borrador, previa confirmación." (La
 * confirmación la pide la pantalla.)
 * @backend DELETE /api/v1/contratos/:id   (existe · rol locador) → 200 sin `data`; la solicitud de origen vuelve a pendiente
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
 * En real no hay envío a firmar: el flujo termina en borrador (decisión del PO,
 * Sprint 4). La pantalla deja "Enviar a firmar" deshabilitado.
 * TODO(backend): `POST /contratos/:id/enviar` (issue del Sprint 4, punto 1).
 */
export const ENVIO_A_FIRMA_DISPONIBLE = USE_MOCKS

/**
 * US-05 — "Al enviarlo, el contrato pasa al estado 'pendiente de firma' y
 * recibe un código con formato CT-AAAA-NNNN." La propiedad sigue publicada
 * (decisión del PO). Lo último ya se guardó con `guardarBorrador`.
 * @backend POST /api/v1/contratos/:id/enviar   (no existe — propuesto) → 200 ContratoEnviadoResponse
 * @returns el código y quiénes firman (locador y locatario).
 * @throws {ServiceError}
 *   - `validation`: falta un dato o no cumple la US (el primer error).
 *   - `conflict` (`apiCode`): `CONTRATO_NO_EDITABLE` o `PROPIEDAD_CON_CONTRATO`.
 */
export async function enviarAFirmar(id: string): Promise<ContratoEnviado> {
  if (USE_MOCKS) {
    await delay()
    const contrato = contratoPropioMock(id, requireSessionUserId())
    const borrador = borradorDeContratoMock(contrato)
    const error = errorParaEnviar(borrador, hoyIso())
    if (error) throw new ServiceError('validation', error)
    if (propiedadConContratoActivoMock(contrato.propertyId, contrato.id)) throw new ServiceError('conflict', PROPIEDAD_CON_CONTRATO_MESSAGE, 'PROPIEDAD_CON_CONTRATO')
    // NOTA: si el envío se había cancelado (US-06), conserva el código que ya tenía.
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
    }
    if (!guardarContratoMock(aFirmar)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    const enviado = contratoEnviadoDeDto({ id: 0, codigo: code, estado: 'pendiente_firma' }, borrador)
    return { ...enviado, id: contrato.id }
  }
  throw new ServiceError('conflict', CONTRATO_NO_EDITABLE_MESSAGE, 'CONTRATO_NO_EDITABLE')
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
  return {
    ...base,
    enviadoEl: contrato.sentAt,
    firmadoPorTodasEl: contrato.firmadoPorTodasEl ?? null,
    firmasRegistradas: Boolean(firmas),
    firmantes,
    endDate: fechaFin(contrato.condiciones.startDate, contrato.condiciones.durationMonths),
    // NOTA: en mock los ajustes no se calculan: el monto actual es el inicial.
    montoActual: contrato.condiciones.initialAmount,
    ajusteCadaMeses: cadaMesesDe(contrato.condiciones),
    // En mock, la ficha calcula las fechas y arma el PDF en el navegador.
    datosApi: null,
  }
}

/** Cada cuántos meses ajusta un contrato de RentAR (`null` sin ajuste). */
function cadaMesesDe(condiciones: ContratoBorrador['condiciones']): number | null {
  if (condiciones.adjustmentIndex === 'sin_ajuste' || !condiciones.adjustmentPeriod) return null
  return MESES_POR_PERIODO[condiciones.adjustmentPeriod]
}

/**
 * Plazo de vencimiento de un alquiler del elenco, en días: sale del vencimiento
 * de su cobro en `panel.mock.ts` (dato del elenco, no inventado); `null` si no tiene.
 */
function plazoDelElenco(contractId: string): number | null {
  const cobro = cobrosElenco.find((item) => item.contractId === contractId)
  return cobro ? dayjs(cobro.dueDate).date() : null
}

/**
 * Un vigente del elenco (`propiedad.rental`, anterior a RentAR) → detalle.
 * Solo con lo que el elenco tiene: sin firmas ni monto inicial
 * (se muestran vacíos, nunca inventados); el depósito y los garantes, solo
 * donde el elenco los cargó. El monto
 * actual y el próximo ajuste salen de `rental`; el plazo de pago, de su
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
    // US-27 (tanda 4): el depósito y los garantes, si el elenco los tiene (CT-2026-0148 y 0133).
    garantes: rental.guarantors ?? [],
    condiciones: {
      startDate: rental.startDate,
      durationMonths: meses,
      // NOTA: `rental` guarda el monto ACTUAL (ya ajustado), no el inicial.
      initialAmount: null,
      deposit: rental.deposit ?? null,
      paymentTermDays: plazoDelElenco(rental.contractId),
      adjustmentIndex: indice,
      adjustmentPeriod: indice === 'sin_ajuste' ? null : periodicidadDePublicacion(propiedad),
    },
    clausulas: [],
    ultimoPaso: 3,
    pdf: { nombre: `${rental.contractId}.pdf`, tamanoBytes: 1, subidoEl: null, url: PDF_FICTICIO_URL },
    fechaInicioVencida: false,
  }
  return {
    ...base,
    clausulas: completarClausulas([], base),
    enviadoEl: null,
    firmadoPorTodasEl: null,
    firmasRegistradas: false,
    firmantes: [],
    endDate: rental.endDate,
    montoActual: rental.currentAmount,
    // El elenco ajusta cada 4 o 12 meses (la periodicidad del contrato de RentAR no tiene 4).
    ajusteCadaMeses: indice === 'sin_ajuste' ? null : propiedad.adjustmentEveryMonths,
    datosApi: null,
  }
}

/**
 * US-42 — "Consultar detalle del contrato": partes, condiciones, firmas y
 * documento. Un borrador no tiene detalle: la pantalla lo manda a `/editar`.
 * @backend GET /api/v1/contratos/:id/detalle   (existe · rol locador) → ContratoDetalleApiResponse
 * @throws {ServiceError}
 *   - `not_found` "No encontramos este contrato." si no existe o no es suyo, sin distinguir (US-42).
 *   - `conflict` `CONTRATO_BORRADOR`: es un borrador.
 * NOTA: el locatario no usa esta ruta: lee su contrato de `GET /alquileres-locatario/:idContrato`.
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
    return detalleDeLocadorDeDto(await apiRequest<ContratoDetalleApiResponse>(`/contratos/${encodeURIComponent(id)}/detalle`))
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_BORRADOR', prohibido: SOLO_LOCADOR_MESSAGE, generico: DETALLE_CONTRATO_ERROR_MESSAGE, idInvalidoEsNoEncontrado: true })
  }
}

// ─── US-43: los contratos de una propiedad ──────────────────────────────

/** Una fila del elenco o guardada → la pestaña Contratos, con sus firmas. */
function contratoDePropiedadMock(resumen: ContratoResumen, propiedad: PropiedadMock): ContratoDePropiedad {
  const guardado = buscarContratoMock(resumen.id)
  const detalle = guardado ? detalleDeContratoMock(guardado) : detalleDeAlquilerMock(propiedad)
  return {
    id: resumen.id,
    code: resumen.code,
    status: resumen.status,
    tenantName: resumen.tenantName || null,
    currentAmount: resumen.currentAmount,
    startDate: resumen.startDate,
    endDate: resumen.endDate,
    adjustmentIndex: resumen.adjustmentIndex,
    nextAdjustmentDate: resumen.nextAdjustmentDate,
    firmasRegistradas: detalle?.firmasRegistradas ?? false,
    firmantes: (detalle?.firmantes ?? []).map(({ rol, nombre, estado, firmadoEl }) => ({ rol, nombre, estado, firmadoEl })),
    firmadoPorTodasEl: detalle?.firmadoPorTodasEl ?? null,
    // US-43: el PDF, "salvo que sea un borrador". El detalle del anterior lo baja desde su pantalla.
    documento: resumen.status !== 'borrador' && resumen.status !== 'finalizado' && detalle?.pdf ? { tipo: 'archivo', url: detalle.pdf.url } : null,
  }
}

/**
 * US-43 — "Los contratos se consultan únicamente desde el detalle de la
 * propiedad": el actual, los anteriores y desde qué solicitud se puede iniciar uno.
 * @backend GET /api/v1/inmuebles/:id/contratos   (existe · rol locador) → ContratosInmuebleResponse
 * @returns sin DNI ni contacto (US-43).
 * @throws {ServiceError} `not_found` "No encontramos esta propiedad" si no existe o es ajena (sin distinguir); `unauthorized`; `network` / `server`.
 */
export async function listarContratosDePropiedad(propiedadId: string): Promise<ContratosDePropiedad> {
  if (USE_MOCKS) {
    await delay()
    const userId = requireSessionUserId()
    const propiedad = readPropiedadesContratoMock().find((item) => item.id === propiedadId)
    if (!propiedad || propiedad.ownerId !== userId) throw new ServiceError('not_found', PROPIEDAD_NO_ENCONTRADA_MESSAGE)
    const contratos = contratosDeLocadorMock(userId, nombreDeCuenta, hoyIso())
      .filter((contrato) => contrato.propertyId === propiedadId)
      .map((contrato) => contratoDePropiedadMock(contrato, propiedad))
    const hayActual = contratos.some((contrato) => contrato.status !== 'finalizado')
    const aceptada = readSolicitudesMock().find((item) => item.propertyId === propiedadId && item.status === 'aceptada' && !contratoDeSolicitudMock(item.id))
    return separarContratos(contratos, !hayActual && aceptada ? aceptada.id : null)
  }
  try {
    return contratosDePropiedadDeDto(await apiRequest<ContratosInmuebleResponse>(`/inmuebles/${encodeURIComponent(propiedadId)}/contratos`))
  } catch (error) {
    throw errorDeContrato(error, {
      porDefecto409: 'CONTRATO_NO_EDITABLE',
      noEncontrado: PROPIEDAD_NO_ENCONTRADA_MESSAGE,
      prohibido: SOLO_LOCADOR_MESSAGE,
      generico: CONTRATOS_DE_PROPIEDAD_ERROR_MESSAGE,
      idInvalidoEsNoEncontrado: true,
    })
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
 * - "Se deben registrar la fecha y la hora de cada firma": lo hace el back. En
 *   mock, el "hoy" del elenco con la hora real (`ahora()`).
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
    const conFirma: ContratoMock = { ...contrato, firmas: nuevas, updatedAt: ahora }
    const firmado: ContratoMock = todas
      ? { ...conFirma, status: 'vigente', firmadoPorTodasEl: ahora }
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
 * @backend POST /api/v1/contratos/:id/reabrir   (existe · rol locador; reemplaza al `cancelar-envio` propuesto) → 200 ContratoBorradorResponse
 * NOTA: la rama real todavía llama a `cancelar-envio`, que no existe. Se conecta en la Tanda 3 del Sprint 4.
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
 * US-06 — "Antes de modificar un contrato pendiente de firma, se debe solicitar
 * confirmación" (la pide la pantalla). "Al confirmar, el contrato vuelve a
 * 'borrador' y conserva su código": se cancela el envío y se borran las firmas.
 * @backend POST /api/v1/contratos/:id/reabrir   (existe · rol locador) → 200 ContratoBorradorApiResponse
 * @throws {ServiceError}
 *   - `conflict` (`apiCode`): `CONTRATO_FIRMADO_POR_LOCATARIO`, `CONTRATO_VIGENTE`,
 *     `CONTRATO_FINALIZADO` o `CONTRATO_YA_EN_BORRADOR`.
 *   - `not_found`: no existe o no es suyo.
 */
export async function reabrirContrato(id: string): Promise<void> {
  if (USE_MOCKS) {
    await cancelarEnvio(id)
    return
  }
  try {
    await apiRequest<ContratoBorradorApiResponse>(`/contratos/${encodeURIComponent(id)}/reabrir`, { method: 'POST' })
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_EDITABLE', prohibido: SOLO_LOCADOR_MESSAGE, generico: FIRMA_ERROR_GENERICO_MESSAGE })
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
 * Rama real: los contratos del usuario como locatario, sin filtro (los tres
 * estados de US-27). Lo usan el listado, la cuenta del menú y Mi alquiler.
 */
function alquileresLocatarioApi(): Promise<AlquilerLocatarioItemResponse[]> {
  return apiRequest<AlquilerLocatarioItemResponse[]>('/alquileres-locatario')
}

/**
 * US-27 — Mis alquileres (`/panel/alquileres`): los contratos del usuario
 * como locatario, ordenados (pendientes de firma, vigentes y al final los
 * finalizados). Cada fila con dirección, barrio, locador, estado, monto
 * actual, vigencia y próximo ajuste. Sin datos de otras propiedades del
 * locador ni de otros postulantes.
 * @backend GET /api/v1/alquileres-locatario   (existe) → AlquilerLocatarioItemResponse[]
 * NOTA: el back ya los manda ordenados (pendiente → vigente → finalizado); se
 * vuelven a ordenar con `ordenarAlquileres` para que mock y real usen la misma regla.
 * @throws {ServiceError} `unauthorized` sin sesión; `network` / `server`.
 */
export async function listarMisAlquileres(): Promise<AlquilerResumen[]> {
  if (USE_MOCKS) {
    await delay(400)
    return ordenarAlquileres(contratosDeLocatarioMock(requireSessionUserId(), nombreDeCuenta, hoyIso(), ESTADOS_MIS_ALQUILERES))
  }
  try {
    return ordenarAlquileres((await alquileresLocatarioApi()).map(alquilerResumenDeItem))
  } catch (error) {
    throw errorDeMiAlquiler(error, { detalle: false })
  }
}

/**
 * Cuántos contratos tiene el usuario como locatario (para el menú: "Mi
 * alquiler" o "Mis alquileres", US-27). En real, el largo del listado sin filtro.
 * @backend GET /api/v1/alquileres-locatario   (existe)
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
 * @backend GET /api/v1/alquileres-locatario   (existe) → AlquilerLocatarioItemResponse[] (sin `contratoId`, para saber cuántos tiene)
 * @backend GET /api/v1/alquileres-locatario/:idContrato   (existe) → AlquilerLocatarioDetalleResponse
 * @throws {ServiceError} `not_found` "No encontramos este alquiler." si el contrato no existe, el usuario no es su locatario o el id no es válido (US-27: "sin distinguir si el contrato existe").
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
  let id = contratoId
  if (!id) {
    let mios: AlquilerLocatarioItemResponse[]
    try {
      mios = await alquileresLocatarioApi()
    } catch (error) {
      throw errorDeMiAlquiler(error, { detalle: false })
    }
    if (mios.length === 0) return { tipo: 'ninguno' }
    if (mios.length > 1) return { tipo: 'varios', cantidad: mios.length }
    id = String(mios[0].id_contrato)
  }
  try {
    return { tipo: 'uno', contrato: miAlquilerDeDetalle(await apiRequest<AlquilerLocatarioDetalleResponse>(`/alquileres-locatario/${encodeURIComponent(id)}`)) }
  } catch (error) {
    throw errorDeMiAlquiler(error, { detalle: true })
  }
}
