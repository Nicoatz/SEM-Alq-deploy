/**
 * contratos.service.ts — frontera con el backend para los contratos del locador.
 *
 * Qué es: los contratos de una propiedad (US-43), el inicio desde una solicitud
 * aceptada, el borrador (guardar, retomar y eliminar) y el envío a firmar.
 * Cubre: US-05 Registrar contrato de alquiler (alta y envío a firmar), US-06
 * Modificar (`reabrirContrato`), US-07 Firmar contrato de alquiler (firma en
 * DocuSign y rechazo), US-42 y US-43 (detalle y pestaña Contratos) y US-27
 * Consultar mis alquileres (`listarMisAlquileres`, `contarMisAlquileres` y
 * `getMiAlquiler`).
 * De dónde saca los datos:
 * - Modo mock: los vigentes del elenco (`propiedades.mock.ts`, `rental`),
 *   `contratos.mock.ts` y los borradores del navegador, a través de
 *   `adapters/contrato-mock.adapter.ts` (ver ahí la NOTA de datos sensibles:
 *   el DNI de los garantes no se guarda en `localStorage`).
 * - Modo real: todas las rutas existen (la firma con DocuSign desde el 10/11).
 *   Estado de cada una en `docs/api-endpoints.md`, "Contratos", "Firma de
 *   contratos" y "Alquileres del locatario".
 * Quién lo usa: `components/contratos/*` y `app/(app)/panel/contratos/*`.
 *
 * NOTA (decisiones del PO del 11/11, se acepta lo que hizo el back): firman el
 * locador, el locatario y los garantes; rechazar vuelve el contrato a borrador;
 * no hay "Reenviar invitación". Mientras el contrato está pendiente de firma, la
 * propiedad sigue publicada (este service no toca la propiedad).
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
  EnlaceGarante,
  FirmanteContrato,
  MiAlquiler,
  ParteContrato,
  PerfilUsuario,
  RolFirmante,
} from '@rentar/shared-types'
import dayjs from 'dayjs'
import { fechaFin, MESES_POR_PERIODO } from '@/lib/contratos/fechas'
import { errorDeMotivoRechazo, normalizarMotivoRechazo } from '@/lib/contratos/firmas'
import { ordenarAlquileres } from '@/lib/contratos/listado'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase/client'
import { cabeceraDe, errorDeArchivoPdf } from '@/lib/contratos/pdfCarga'
import { separarContratos } from '@/lib/contratos/propiedad'
import { PLAZO_VENCIMIENTO_POR_DEFECTO, DURACION_POR_DEFECTO, errorParaEnviar } from '@/lib/contratos/validaciones'
import { hoy } from '@/lib/utils/fechas'
import { PLAZO_POR_CONTRATO, type ContratoMock, type FirmaMock, type FirmasMock, type PropiedadMock } from '@/lib/mocks'
import {
  ahoraIsoMock,
  aplicarFirmasDiferidasMock,
  guardarEnlaceGaranteMock,
  hashDeTokenMock,
  HORAS_VIGENCIA_ENLACE_GARANTE,
  tokenDeEnlaceMock,
  PDF_FICTICIO_URL,
  pdfDeContratoMock,
  recordarPdfMock,
  contratoDeSolicitudMock,
  contratosDeLocadorMock,
  contratosDeLocatarioMock,
  eliminarContratoMock,
  firmasAlEnviar,
  guardarContratoMock,
  periodicidadDePublicacion,
  propiedadConContratoActivoMock,
  readContratosMock,
  readPropiedadesContratoMock,
  rechazoMock,
  registrarFirmaDiferidaMock,
  siguienteCodigoMock,
} from './adapters/contrato-mock.adapter'
import {
  ALQUILER_NO_ENCONTRADO_MESSAGE,
  alquilerResumenDeItem,
  CONTRATO_NO_BORRADOR_MESSAGE,
  CONTRATO_NO_EDITABLE_MESSAGE,
  CONTRATO_NO_ENCONTRADO_MESSAGE,
  CONTRATO_NO_PENDIENTE_MESSAGE,
  borradorDeApi,
  contratoEnviadoDeDto,
  detalleDeLocadorDeDto,
  DETALLE_CONTRATO_ERROR_MESSAGE,
  DOCUSIGN_ENVIO_ERROR_MESSAGE,
  DOCUSIGN_FIRMA_ERROR_MESSAGE,
  ENLACE_GARANTE_ERROR_MESSAGE,
  GARANTE_NO_ENCONTRADO_MESSAGE,
  GARANTE_YA_FIRMO_MESSAGE,
  CONTRATOS_DE_PROPIEDAD_ERROR_MESSAGE,
  contratosDePropiedadDeDto,
  patchDeCambios,
  errorDeMiAlquiler,
  errorDeContrato,
  FIRMA_ERROR_GENERICO_MESSAGE,
  garanteParaLocatario,
  miAlquilerDeDetalle,
  CONTRATO_FIRMADO_POR_LOCATARIO_MESSAGE,
  PROPIEDAD_CON_CONTRATO_MESSAGE,
  SOLICITUD_CON_CONTRATO_MESSAGE,
  SOLICITUD_NO_ACEPTADA_MESSAGE,
  SOLICITUD_NO_ENCONTRADA_PARA_CONTRATO_MESSAGE,
  PDF_SUBIDA_ERROR_MESSAGE,
  PROPIEDAD_NO_ENCONTRADA_MESSAGE,
  SOLO_LOCADOR_MESSAGE,
  YA_FIRMO_MESSAGE,
  YA_FIRMO_NO_RECHAZA_MESSAGE,
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
  ContratoEnviadoResponse,
  EnlaceFirmaGaranteResponse,
  EnviarContratoRequest,
  FirmarContratoRequest,
  IniciarFirmaResponse,
  RegistrarPdfRequest,
  UrlSubidaPdfResponse,
  ContratosInmuebleResponse,
  RechazarContratoResponse,
  RechazarFirmaRequest,
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
    ultimoPaso: contrato.ultimoPaso,
    pdf: pdfDeContratoMock(contrato),
    fechaInicioVencida: contrato.status === 'borrador' && contrato.condiciones.startDate !== null && contrato.condiciones.startDate < hoyIso(),
    endDate: fechaFin(contrato.condiciones.startDate, contrato.condiciones.durationMonths),
  }
  return base
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
 * Se llama al tocar "Guardar borrador" o "Enviar a firmar", antes del `PATCH`, no
 * al adjuntar (US-05 y US-06: el PDF adjuntado es un cambio sin guardar más).
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
 * US-05 — "Al enviarlo, el contrato pasa al estado 'pendiente de firma' y
 * recibe un código con formato CT-AAAA-NNNN." La propiedad sigue publicada
 * (decisión del PO). Lo último ya se guardó con `guardarBorrador`. El back
 * arma la hoja de firmas y crea el sobre en DocuSign (US-07).
 * @backend POST /api/v1/contratos/:id/enviar   (existe · rol locador) body `{ confirma_revision: true }` → 200 ContratoEnviadoResponse
 * @param borrador Las partes y los garantes, para decir quiénes firman (el back no los devuelve).
 * @returns el código y quiénes firman (locador, locatario y garantes).
 * @throws {ServiceError}
 *   - `validation`: falta un dato o no cumple la US (el texto del back: `FALTA_PDF`,
 *     `FALTAN_CONDICIONES`, `FALTAN_PARTES`, `FECHA_INICIO_VENCIDA`…).
 *   - `conflict` (`apiCode`): `CONTRATO_NO_BORRADOR` (ya se envió) o, en mock, `PROPIEDAD_CON_CONTRATO`.
 *   - `server`: DocuSign no respondió (502). El contrato sigue en borrador: se puede reintentar.
 */
export async function enviarAFirmar(id: string, borrador: Pick<ContratoBorrador, 'locador' | 'locatario' | 'garantes'>): Promise<ContratoEnviado> {
  if (USE_MOCKS) {
    await delay()
    const contrato = contratoPropioMock(id, requireSessionUserId())
    const actual = borradorDeContratoMock(contrato)
    if (contrato.status !== 'borrador') throw new ServiceError('conflict', CONTRATO_NO_BORRADOR_MESSAGE, 'CONTRATO_NO_BORRADOR')
    const error = errorParaEnviar(actual, hoyIso())
    if (error) throw new ServiceError('validation', error)
    if (propiedadConContratoActivoMock(contrato.propertyId, contrato.id)) throw new ServiceError('conflict', PROPIEDAD_CON_CONTRATO_MESSAGE, 'PROPIEDAD_CON_CONTRATO')
    // NOTA: si el envío se había cancelado (US-06) o rechazado (US-07), conserva el código que ya tenía.
    const code = contrato.code ?? siguienteCodigoMock(hoy().year())
    const ahora = ahoraIsoMock()
    const aFirmar: ContratoMock = {
      ...contrato,
      code,
      status: 'pendiente_firma',
      updatedAt: ahora,
      sentAt: ahora,
      // US-07: firman el locador, el locatario y cada garante, con las firmas en cero.
      firmas: firmasAlEnviar(contrato.garantes.length),
      firmadoPorTodasEl: null,
    }
    if (!guardarContratoMock(aFirmar)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    const enviado = contratoEnviadoDeDto({ id: 0, codigo: code, estado: 'pendiente_firma' }, actual)
    return { ...enviado, id: contrato.id }
  }
  try {
    const body: EnviarContratoRequest = { confirma_revision: true }
    const dto = await apiRequest<ContratoEnviadoResponse>(`/contratos/${encodeURIComponent(id)}/enviar`, { method: 'POST', body })
    return contratoEnviadoDeDto(dto, borrador)
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_BORRADOR', prohibido: SOLO_LOCADOR_MESSAGE, docusign: DOCUSIGN_ENVIO_ERROR_MESSAGE })
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

/** Rol del usuario en el contrato guardado, o `null` si no es parte (el garante no tiene cuenta). */
function rolEnContratoMock(contrato: Pick<ContratoMock, 'ownerId' | 'tenantUserId'>, userId: string): Exclude<RolFirmante, 'garante'> | null {
  if (contrato.ownerId === userId) return 'locador'
  if (contrato.tenantUserId === userId) return 'locatario'
  return null
}

/**
 * El contrato guardado `id` del que el usuario es parte (locador o
 * locatario). Un borrador solo lo ve el locador. No distingue "no existe"
 * de "no es tuyo" (US-07).
 */
function contratoDeParteMock(id: string, userId: string): { contrato: ContratoMock; rol: Exclude<RolFirmante, 'garante'> } {
  const contrato = buscarContratoMock(id)
  const rol = contrato ? rolEnContratoMock(contrato, userId) : null
  if (!contrato || !rol || (contrato.status === 'borrador' && rol !== 'locador')) throw new ServiceError('not_found', CONTRATO_NO_ENCONTRADO_MESSAGE)
  return { contrato, rol }
}

/**
 * Contrato guardado → `ContratoDetalle` (firmantes con el nombre de hoy del perfil).
 * - Firmantes: locador, locatario y cada garante (US-07).
 * - `puedoFirmar`: pendiente de firma y la firma de `userId` pendiente, como
 *   `acciones.firmar` / `puede_firmar` del back.
 * - Vigente: el PDF pasa a ser el "firmado" (`<código>-firmado.pdf`), como en
 *   real; el archivo sigue siendo el ficticio del elenco.
 */
function detalleDeContratoMock(contrato: ContratoMock, userId?: string): ContratoDetalle {
  const base = borradorDeContratoMock(contrato)
  const nombreDe = (parte: ParteContrato) => `${parte.nombre} ${parte.apellido}`.trim()
  const { firmas } = contrato
  const firmantes: FirmanteContrato[] = firmas
    ? [
        { key: 'locador', rol: 'locador', userId: base.locador.userId, garanteId: null, nombre: nombreDe(base.locador), ...estadoDeFirmaMock(firmas.locador) },
        { key: 'locatario', rol: 'locatario', userId: base.locatario.userId, garanteId: null, nombre: nombreDe(base.locatario) || contrato.tenantName, ...estadoDeFirmaMock(firmas.locatario) },
        ...firmas.garantes.map((firma, posicion): FirmanteContrato => ({
          key: `garante-${posicion + 1}`,
          rol: 'garante',
          userId: '',
          // NOTA: en mock, el id del garante es su posición (`garante-1`…), como la `key` del alta.
          garanteId: `garante-${posicion + 1}`,
          nombre: contrato.garantes[posicion]?.fullName ?? `Garante ${posicion + 1}`,
          ...estadoDeFirmaMock(firma),
        })),
      ]
    : []
  const rol = userId ? rolEnContratoMock(contrato, userId) : null
  const miFirma = rol && firmas ? firmas[rol] : null
  const firmado = contrato.status === 'vigente' && Boolean(firmas) && base.pdf
  return {
    ...base,
    pdf: firmado && base.pdf ? { ...base.pdf, nombre: `${contrato.code ?? 'contrato'}-firmado.pdf` } : base.pdf,
    enviadoEl: contrato.sentAt,
    firmadoPorTodasEl: contrato.firmadoPorTodasEl ?? null,
    firmasRegistradas: Boolean(firmas),
    modificarDelBack: null,
    firmantes,
    puedoFirmar: contrato.status === 'pendiente_firma' && miFirma?.estado === 'pendiente',
    endDate: fechaFin(contrato.condiciones.startDate, contrato.condiciones.durationMonths),
    // NOTA: en mock los ajustes no se calculan: el monto actual es el inicial.
    montoActual: contrato.condiciones.initialAmount,
    ajusteCadaMeses: cadaMesesDe(contrato.condiciones),
    // En mock, la ficha calcula las fechas y arma el PDF en el navegador.
    datosApi: null,
  }
}

/** El estado de una firma del mock, sin el enlace del garante (su hash no sale del service). */
function estadoDeFirmaMock({ estado, firmadoEl, rechazadoEl, motivoRechazo }: FirmaMock): Pick<FirmanteContrato, 'estado' | 'firmadoEl' | 'rechazadoEl' | 'motivoRechazo'> {
  return { estado, firmadoEl, rechazadoEl, motivoRechazo }
}

/** Cada cuántos meses ajusta un contrato de RentAR (`null` sin ajuste). */
function cadaMesesDe(condiciones: ContratoBorrador['condiciones']): number | null {
  if (condiciones.adjustmentIndex === 'sin_ajuste' || !condiciones.adjustmentPeriod) return null
  return MESES_POR_PERIODO[condiciones.adjustmentPeriod]
}

/** Plazo de vencimiento de un alquiler del elenco, en días; `null` si no tiene. */
function plazoDelElenco(contractId: string): number | null {
  return PLAZO_POR_CONTRATO[contractId] ?? null
}

/**
 * Un vigente del elenco (`propiedad.rental`, anterior a RentAR) → detalle.
 * Solo con lo que el elenco tiene: sin firmas ni monto inicial
 * (se muestran vacíos, nunca inventados); el depósito y los garantes, solo
 * donde el elenco los cargó. El monto
 * actual y el próximo ajuste salen de `rental`; el plazo de pago, de
 * `periodos.mock.ts` (US-27, tanda 4).
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
    ultimoPaso: 3,
    pdf: { nombre: `${rental.contractId}.pdf`, tamanoBytes: 1, subidoEl: null, url: PDF_FICTICIO_URL },
    fechaInicioVencida: false,
    endDate: rental.endDate,
  }
  return {
    ...base,
    enviadoEl: null,
    firmadoPorTodasEl: null,
    firmasRegistradas: false,
    modificarDelBack: null,
    firmantes: [],
    puedoFirmar: false,
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
    aplicarFirmasDiferidasMock()
    const userId = requireSessionUserId()
    const guardado = buscarContratoMock(id)
    // Como el back: un borrador no tiene detalle (409); la pantalla lo manda al alta.
    if (guardado?.status === 'borrador' && guardado.ownerId === userId) throw new ServiceError('conflict', 'Este contrato es un borrador: se sigue editando en el alta.', 'CONTRATO_BORRADOR')
    if (guardado) return detalleDeContratoMock(contratoDeParteMock(id, userId).contrato, userId)
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
    firmantes: (detalle?.firmantes ?? []).map(({ key, rol, nombre, estado, firmadoEl }) => ({ key, rol, nombre, estado, firmadoEl })),
    firmadoPorTodasEl: detalle?.firmadoPorTodasEl ?? null,
    // US-43: el PDF, "salvo que sea un borrador". El detalle del anterior lo baja desde su pantalla.
    tienePdf: resumen.status !== 'borrador' && resumen.status !== 'finalizado' && Boolean(detalle?.pdf),
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
    aplicarFirmasDiferidasMock()
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

/**
 * S4-13 — La URL firmada del PDF vence a los 5 minutos: se pide al usarla, no al
 * cargar la pantalla. Cada vista la saca de la ruta que puede leer.
 * @backend GET /api/v1/contratos/:id   (existe · rol locador): `borrador`.
 * @backend GET /api/v1/contratos/:id/detalle   (existe · rol locador): `locador`.
 * @backend GET /api/v1/alquileres-locatario/:idContrato   (existe): `locatario`.
 * TODO(backend): una ruta solo para la URL evitaría pedir el detalle entero.
 * @returns la URL, o `null` si el contrato no tiene PDF.
 * @throws {ServiceError} `not_found`, `unauthorized`, `network` / `server`.
 */
export async function urlPdfDeContrato(id: string, vista: 'borrador' | 'locador' | 'locatario'): Promise<string | null> {
  if (USE_MOCKS) {
    const guardado = buscarContratoMock(id)
    return guardado ? (pdfDeContratoMock(guardado)?.url ?? null) : PDF_FICTICIO_URL
  }
  const ruta = encodeURIComponent(id)
  try {
    if (vista === 'locatario') return (await apiRequest<AlquilerLocatarioDetalleResponse>(`/alquileres-locatario/${ruta}`)).pdf_url
    const contrato = await apiRequest<ContratoBorradorApiResponse | ContratoDetalleApiResponse>(vista === 'borrador' ? `/contratos/${ruta}` : `/contratos/${ruta}/detalle`)
    return contrato.pdf?.url ?? null
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_BORRADOR', prohibido: SOLO_LOCADOR_MESSAGE })
  }
}

// ─── US-07: firmar y rechazar ───────────────────────────────────────────

/** El contrato pendiente de firma con sus firmas (si no está pendiente, 409 `CONTRATO_NO_PENDIENTE`). */
function pendienteDeFirmaMock(contrato: ContratoMock): FirmasMock {
  if (contrato.status !== 'pendiente_firma' || !contrato.firmas) {
    throw new ServiceError('conflict', CONTRATO_NO_PENDIENTE_MESSAGE, 'CONTRATO_NO_PENDIENTE')
  }
  return contrato.firmas
}

/** A dónde vuelve cada parte después de firmar en DocuSign (las mismas URL que arma el back). */
function regresoDeFirma(id: string, rol: Exclude<RolFirmante, 'garante'>): string {
  return rol === 'locador' ? `/panel/contratos/${encodeURIComponent(id)}` : `/panel/alquiler?contrato=${encodeURIComponent(id)}`
}

/**
 * US-07 — "Firma": pide la URL de DocuSign donde firma quien está en sesión (el
 * locador desde el detalle; el locatario, desde Mi alquiler). La pantalla ya
 * pidió leer hasta la última página, la casilla y la confirmación, y redirige a
 * la URL apenas llega: dura pocos minutos, se usa una sola vez y no se guarda.
 * - La firma NO se registra acá: la registra el back cuando DocuSign le avisa
 *   (entre 3 y 30 s después). Al volver, la pantalla espera ese aviso
 *   (`useRegresoDeFirma`).
 * - "Una parte no puede firmar más de una vez el mismo contrato": 409 `YA_FIRMO`.
 * - Las firmas son en paralelo: nadie espera a nadie.
 * - En mock, la URL es la del simulador (`/simulador-firma`), con los datos en el
 *   fragmento (`#`): no viajan al servidor ni quedan en el `Referer`.
 * @backend POST /api/v1/contratos/:id/firmar   (existe · locador o locatario) body `{ acepta_condiciones: true }` → 200 IniciarFirmaResponse
 * @throws {ServiceError}
 *   - `conflict` (`apiCode`): `CONTRATO_NO_PENDIENTE` (borrador, vigente…), `YA_FIRMO` o `SOBRE_NO_DISPONIBLE`.
 *   - `not_found`: no existe o no es parte.
 *   - `server`: DocuSign no respondió (502); se puede reintentar.
 */
export async function iniciarFirma(id: string): Promise<{ url: string }> {
  if (USE_MOCKS) {
    await delay()
    const { contrato, rol } = contratoDeParteMock(id, requireSessionUserId())
    const firmas = pendienteDeFirmaMock(contrato)
    if (firmas[rol].estado === 'firmado') throw new ServiceError('conflict', YA_FIRMO_MESSAGE, 'YA_FIRMO')
    if (firmas[rol].estado !== 'pendiente') throw new ServiceError('conflict', CONTRATO_NO_PENDIENTE_MESSAGE, 'CONTRATO_NO_PENDIENTE')
    return { url: urlDelSimuladorMock({ contratoId: contrato.id, firmante: rol, regreso: regresoDeFirma(id, rol) }) }
  }
  try {
    const body: FirmarContratoRequest = { acepta_condiciones: true }
    return await apiRequest<IniciarFirmaResponse>(`/contratos/${encodeURIComponent(id)}/firmar`, { method: 'POST', body })
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_PENDIENTE', generico: FIRMA_ERROR_GENERICO_MESSAGE, docusign: DOCUSIGN_FIRMA_ERROR_MESSAGE })
  }
}

/**
 * US-07 — "Tanto el locatario como el locador pueden rechazar la firma" (D1,
 * 11/11), con un motivo opcional de hasta 300 caracteres y confirmación (la pide
 * la pantalla). "Al rechazar la firma el contrato vuelve a 'borrador' y se borran
 * las firmas registradas": las de todos, también la del locatario si ya firmó.
 * Conserva el código. Quien ya firmó no puede rechazar.
 * Después, el locador sigue en el alta (`/editar`) y el locatario deja de ver el
 * contrato (para él, un borrador no existe).
 * @backend POST /api/v1/contratos/:id/rechazar   (existe · locador o locatario) body RechazarFirmaRequest → 200 RechazarContratoResponse
 * @returns el id y el estado nuevo (`borrador`): el back no devuelve el detalle.
 * @throws {ServiceError}
 *   - `validation`: el motivo pasa los 300 caracteres.
 *   - `conflict` (`apiCode`): `CONTRATO_NO_PENDIENTE`, `YA_FIRMO` (ya firmó: no puede rechazar) o `SOBRE_NO_DISPONIBLE`.
 *   - `not_found`: no existe o no es parte.
 */
export async function rechazarFirma(id: string, motivo: string | null): Promise<{ id: string; estado: 'borrador' }> {
  const error = errorDeMotivoRechazo(motivo)
  const limpio = normalizarMotivoRechazo(motivo)
  // Como el back: el largo se valida antes de buscar el contrato.
  if (error) throw new ServiceError('validation', error)
  if (USE_MOCKS) {
    await delay()
    const { contrato, rol } = contratoDeParteMock(id, requireSessionUserId())
    const firmas = pendienteDeFirmaMock(contrato)
    if (firmas[rol].estado === 'firmado') throw new ServiceError('conflict', YA_FIRMO_NO_RECHAZA_MESSAGE, 'YA_FIRMO')
    // NOTA: el motivo no se guarda en el contrato (el back lo deja solo en su registro de avisos).
    if (!guardarContratoMock(rechazoMock(contrato, ahoraIsoMock()))) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return { id: contrato.id, estado: 'borrador' }
  }
  try {
    const body: RechazarFirmaRequest = { motivo: limpio }
    const dto = await apiRequest<RechazarContratoResponse>(`/contratos/${encodeURIComponent(id)}/rechazar`, { method: 'POST', body })
    return { id: String(dto.id), estado: dto.estado }
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_PENDIENTE', generico: FIRMA_ERROR_GENERICO_MESSAGE, mensajesPorCodigo: { YA_FIRMO: YA_FIRMO_NO_RECHAZA_MESSAGE } })
  }
}

// ─── US-07: simulador de DocuSign (solo mock) ───────────────────────────

/**
 * Lo que el simulador necesita saber: qué contrato, quién firma y a dónde vuelve.
 * Viaja en el fragmento de la URL (`/simulador-firma#…`), nunca en `localStorage`.
 */
export interface SesionSimuladorFirma {
  contratoId: string
  /** Quién firma: una parte o un garante por su posición (`garante-1`…). */
  firmante: FirmanteSimulador
  /**
   * Ruta de regreso, sin `?event=` (el simulador lo agrega). Para el garante es
   * `/firma-garante/<token>`, igual que en DocuSign.
   */
  regreso: string
}

/** Quién firma en el simulador. */
export type FirmanteSimulador = Exclude<RolFirmante, 'garante'> | `garante-${number}`

/**
 * Arma la URL del simulador con la sesión en el fragmento (base64url de un JSON).
 * Solo mock: la usan `iniciarFirma` y `firma-garante.service#iniciarFirmaGarante`.
 */
export function urlDelSimuladorMock(sesion: SesionSimuladorFirma): string {
  const json = JSON.stringify(sesion)
  const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
  return `/simulador-firma#${base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

/**
 * Lee la sesión del fragmento del simulador. `null` si falta o está mal formada
 * (la pantalla muestra "Esta sesión de firma no es válida").
 * Solo mock: en real no existe el simulador.
 */
export function leerSesionSimulador(fragmento: string): SesionSimuladorFirma | null {
  try {
    const base64 = fragmento.replace(/^#/, '').replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (letra) => letra.charCodeAt(0))
    const datos: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof datos !== 'object' || datos === null) return null
    const { contratoId, firmante, regreso } = datos as Record<string, unknown>
    const firmanteValido = typeof firmante === 'string' && /^(locador|locatario|garante-\d+)$/.test(firmante)
    // La ruta de regreso tiene que ser interna: nunca otro sitio.
    if (typeof contratoId !== 'string' || !firmanteValido || typeof regreso !== 'string' || !regreso.startsWith('/') || regreso.startsWith('//')) return null
    return { contratoId, firmante: firmante as FirmanteSimulador, regreso }
  } catch {
    return null
  }
}

/** Qué hace la persona en el simulador. */
export type AccionSimulador = 'firmar' | 'declinar'

/**
 * US-07, solo mock — Lo que en real hace DocuSign y su aviso al back: deja la
 * firma (o el rechazo) para dentro de `demoraMs`. La pantalla, después, vuelve a
 * la ruta de regreso con `?event=`. Sirve para las partes y para los garantes:
 * un `decline` de cualquiera vuelve el contrato a borrador, como en real.
 * @backend ninguno: en real, DocuSign avisa al back por `POST /webhooks/docusign`.
 * @throws {ServiceError} `server` si `localStorage` está lleno, o si se llama en modo real.
 */
export async function simularFirmaMock(sesion: SesionSimuladorFirma, accion: AccionSimulador, demoraMs: number): Promise<void> {
  if (!USE_MOCKS) throw new ServiceError('server', 'El simulador de firma solo existe en modo mock.')
  await delay(300)
  const datos = { contratoId: sesion.contratoId, firmante: sesion.firmante, accion: accion === 'firmar' ? ('firmar' as const) : ('rechazar' as const) }
  if (!registrarFirmaDiferidaMock(datos, demoraMs)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
}

// ─── US-07: acciones del locador ────────────────────────────────────────

/** El contrato guardado del que el usuario es el LOCADOR (403 si es el locatario; 404 si no es parte). */
function contratoDelLocadorMock(id: string, userId: string): ContratoMock {
  const { contrato, rol } = contratoDeParteMock(id, userId)
  if (rol !== 'locador') throw new ServiceError('forbidden', SOLO_LOCADOR_MESSAGE)
  return contrato
}

/**
 * US-06 — "Antes de modificar un contrato pendiente de firma, se debe solicitar
 * confirmación" (la pide la pantalla). "Al confirmar, el contrato vuelve a
 * 'borrador' y conserva su código": se cancela el envío y se borran las firmas.
 * Es la acción principal del locador para volver atrás un envío (D1, 11/11:
 * "Rechazar firma" es la secundaria). La firma del propio locador no cuenta: se
 * borra. En real, además, el back anula el sobre de DocuSign.
 * @backend POST /api/v1/contratos/:id/reabrir   (existe · rol locador) → 200 ContratoBorradorApiResponse
 * @throws {ServiceError}
 *   - `conflict` (`apiCode`): `CONTRATO_FIRMADO_POR_LOCATARIO`, `CONTRATO_VIGENTE`,
 *     `CONTRATO_FINALIZADO` o `CONTRATO_YA_EN_BORRADOR`.
 *   - `not_found`: no existe o no es suyo.
 */
export async function reabrirContrato(id: string): Promise<void> {
  if (USE_MOCKS) {
    await delay()
    const contrato = contratoDelLocadorMock(id, requireSessionUserId())
    const firmas = pendienteDeFirmaMock(contrato)
    if (firmas.locatario.estado === 'firmado') throw new ServiceError('conflict', CONTRATO_FIRMADO_POR_LOCATARIO_MESSAGE, 'CONTRATO_FIRMADO_POR_LOCATARIO')
    // Como el back: borrador, sin firmas y de vuelta al paso 1 (el mismo resultado que un rechazo).
    if (!guardarContratoMock(rechazoMock(contrato, ahoraIsoMock()))) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return
  }
  try {
    await apiRequest<ContratoBorradorApiResponse>(`/contratos/${encodeURIComponent(id)}/reabrir`, { method: 'POST' })
  } catch (error) {
    throw errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_EDITABLE', prohibido: SOLO_LOCADOR_MESSAGE, generico: FIRMA_ERROR_GENERICO_MESSAGE })
  }
}

/**
 * US-07 — "Los garantes firman el contrato desde un enlace temporal que les
 * entrega el locador, sin necesidad de iniciar sesión." El enlace vence a las
 * 48 h; uno nuevo anula el anterior. Solo con el contrato pendiente de firma y
 * el garante sin firmar.
 * NOTA (seguridad): la URL se devuelve una sola vez (el back guarda solo el hash
 * del token) y la pantalla la muestra sin guardarla en ningún lado.
 * @param garanteId El id del garante (en real, `garantes[].id` del detalle, emparejado por posición;
 *   en mock, `garante-<n>`).
 * @backend POST /api/v1/contratos/:id/garantes/:idGarante/enlace-firma   (existe · rol locador) → 200 EnlaceFirmaGaranteResponse
 * @throws {ServiceError}
 *   - `conflict` (`apiCode`): `CONTRATO_NO_PENDIENTE`, `YA_FIRMO` ("Este garante ya firmó") o `SOBRE_NO_DISPONIBLE`.
 *   - `not_found`: el contrato o el garante no existen o no son suyos (sin distinguir).
 */
export async function generarEnlaceGarante(contratoId: string, garanteId: string): Promise<EnlaceGarante> {
  if (USE_MOCKS) {
    await delay()
    const contrato = contratoDelLocadorMock(contratoId, requireSessionUserId())
    const firmas = pendienteDeFirmaMock(contrato)
    const posicion = Number(garanteId.replace('garante-', '')) - 1
    const firma = firmas.garantes[posicion]
    if (!firma) throw new ServiceError('not_found', GARANTE_NO_ENCONTRADO_MESSAGE)
    if (firma.estado !== 'pendiente') throw new ServiceError('conflict', GARANTE_YA_FIRMO_MESSAGE, 'YA_FIRMO')
    const token = tokenDeEnlaceMock()
    // NOTA: el vencimiento usa el reloj del mock (el "hoy" del elenco con la hora real), como el resto de las fechas.
    const venceEl = dayjs(ahoraIsoMock()).add(HORAS_VIGENCIA_ENLACE_GARANTE, 'hour').format('YYYY-MM-DDTHH:mm:ss')
    if (!guardarEnlaceGaranteMock(contrato, posicion, { hash: await hashDeTokenMock(token), venceEl })) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return { url: `${window.location.origin}/firma-garante/${token}`, venceEl }
  }
  try {
    const dto = await apiRequest<EnlaceFirmaGaranteResponse>(`/contratos/${encodeURIComponent(contratoId)}/garantes/${encodeURIComponent(garanteId)}/enlace-firma`, { method: 'POST' })
    return { url: dto.url, venceEl: dto.vence_en }
  } catch (error) {
    throw errorDeContrato(error, {
      porDefecto409: 'CONTRATO_NO_PENDIENTE',
      noEncontrado: GARANTE_NO_ENCONTRADO_MESSAGE,
      prohibido: SOLO_LOCADOR_MESSAGE,
      generico: ENLACE_GARANTE_ERROR_MESSAGE,
      mensajesPorCodigo: { YA_FIRMO: GARANTE_YA_FIRMO_MESSAGE },
    })
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
    aplicarFirmasDiferidasMock()
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
    aplicarFirmasDiferidasMock()
    const { guardados, alquileres } = misContratosMock(requireSessionUserId())
    return guardados.length + alquileres.length
  }
  return (await listarMisAlquileres()).length
}

/**
 * US-27 — En mock, la ficha del locatario sale del mismo armado que el detalle
 * del locador: se le aplica el descarte de real (`garanteParaLocatario`), así
 * ni el DNI ni el correo de los garantes llegan a la ficha.
 */
function fichaDeLocatarioMock(detalle: ContratoDetalle): ContratoDetalle {
  return { ...detalle, garantes: detalle.garantes.map(garanteParaLocatario) }
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
    aplicarFirmasDiferidasMock()
    const userId = requireSessionUserId()
    const { guardados, alquileres } = misContratosMock(userId)
    if (contratoId) {
      const guardado = guardados.find((contrato) => contrato.id === contratoId || contrato.code === contratoId)
      if (guardado) return { tipo: 'uno', contrato: fichaDeLocatarioMock(detalleDeContratoMock(guardado, userId)) }
      const propiedad = alquileres.find((item) => item.rental?.contractId === contratoId)
      const detalle = propiedad ? detalleDeAlquilerMock(propiedad) : null
      if (!detalle) throw new ServiceError('not_found', ALQUILER_NO_ENCONTRADO_MESSAGE)
      return { tipo: 'uno', contrato: fichaDeLocatarioMock(detalle) }
    }
    const cantidad = guardados.length + alquileres.length
    if (cantidad === 0) return { tipo: 'ninguno' }
    if (cantidad > 1) return { tipo: 'varios', cantidad }
    const unico = guardados[0] ? detalleDeContratoMock(guardados[0], userId) : alquileres[0] ? detalleDeAlquilerMock(alquileres[0]) : null
    return unico ? { tipo: 'uno', contrato: fichaDeLocatarioMock(unico) } : { tipo: 'ninguno' }
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
