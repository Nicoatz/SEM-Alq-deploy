/**
 * contrato.adapter.ts — traduce los contratos del back a los tipos de vista,
 * y los errores a mensajes en español.
 *
 * Qué es: la frontera entre los DTO de `/contratos` (ver
 * `shared/backend-dtos.ts`, "Contratos") y `ContratoDePropiedad` /
 * `ContratoBorrador` / `ContratoEnviado` / `ContratoDetalle`. Si el back
 * cambia algo de forma, se ajusta acá, nunca en las pantallas.
 * Cubre: US-05 Registrar contrato de alquiler, US-07 Firmar contrato de
 * alquiler (firma con DocuSign: locador, locatario y garantes), US-42 y US-43
 * (detalle y pestaña Contratos), y US-27 Consultar mis alquileres contra
 * `GET /alquileres-locatario`.
 * Quién lo usa: `services/contratos.service.ts` (los mensajes, también la
 * rama mock, así responde igual que el back).
 */
import type {
  AlquilerResumen,
  CambiosBorrador,
  ContratoBorrador,
  ContratoDePropiedad,
  ContratoDetalle,
  ContratoEnviado,
  ContratosDePropiedad,
  FirmanteContrato,
  GaranteContrato,
  IndiceContrato,
  GarantiaOfrecida,
  ParteContrato,
  PdfContrato,
  PeriodicidadAjuste,
  SignatureStatus,
} from '@rentar/shared-types'
import { separarContratos } from '@/lib/contratos/propiedad'
import { telefonoDelBack } from '@/lib/perfil/formato'
import type {
  AlquilerLocatarioDetalleResponse,
  AlquilerLocatarioItemResponse,
  CodigoErrorContrato,
  ContratoBorradorApiResponse,
  ContratoDetalleApiResponse,
  ContratoEnviadoResponse,
  ContratoPdfDto,
  ContratoPropiedadResponse,
  ContratosInmuebleResponse,
  FirmaAlquilerDto,
  FirmasApiDto,
  GuardarBorradorRequest,
  ParteApiDto,
} from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'
import { formatExactAddress } from './direccion'
import { barrioDe, medioPagoFromId } from './propiedad.adapter'

// ─── Mensajes (en español, listos para mostrar) ─────────────────────────

export const CONTRATO_NO_ENCONTRADO_MESSAGE = 'No encontramos este contrato.'
/** Mi alquiler (US-07 / US-27): el contrato no existe o el usuario no es su locatario. */
export const ALQUILER_NO_ENCONTRADO_MESSAGE = 'No encontramos este alquiler.'
export const SOLICITUD_NO_ENCONTRADA_PARA_CONTRATO_MESSAGE = 'No encontramos esa solicitud entre las de tus propiedades.'
export const SOLICITUD_NO_ACEPTADA_MESSAGE = 'Solo se puede iniciar un contrato desde una solicitud aceptada.'
export const SOLICITUD_CON_CONTRATO_MESSAGE = 'Esta solicitud ya originó un contrato: una solicitud aceptada puede originar uno solo.'
export const PROPIEDAD_CON_CONTRATO_MESSAGE = 'La propiedad ya tiene un contrato vigente o pendiente de firma. No se puede iniciar otro.'
export const CONTRATO_NO_EDITABLE_MESSAGE = 'Este contrato ya no es un borrador y no se puede editar.'
/** US-43: "sin distinguir" si la propiedad no existe o no es del usuario. */
export const PROPIEDAD_NO_ENCONTRADA_MESSAGE = 'No encontramos esta propiedad'
export const PDF_SUBIDA_ERROR_MESSAGE = 'No pudimos subir el PDF. El que estaba cargado sigue igual: probá de nuevo.'
export const DETALLE_CONTRATO_ERROR_MESSAGE = 'No pudimos abrir el contrato. Probá de nuevo en unos minutos.'
export const CONTRATOS_DE_PROPIEDAD_ERROR_MESSAGE = 'Probá de nuevo en unos minutos. El resto de la propiedad está bien.'
export const CONTRATO_ERROR_GENERICO_MESSAGE = 'No pudimos guardar el contrato. Probá de nuevo en unos minutos.'
// US-07
export const CONTRATO_NO_PENDIENTE_MESSAGE = 'Este contrato ya no está pendiente de firma.'
export const YA_FIRMO_MESSAGE = 'Ya firmaste este contrato: una parte no puede firmarlo dos veces.'
/** US-07: quien ya firmó no puede rechazar (409 `YA_FIRMO` de `/rechazar`). */
export const YA_FIRMO_NO_RECHAZA_MESSAGE = 'Ya firmaste este contrato: no podés rechazarlo.'
export const SOBRE_NO_DISPONIBLE_MESSAGE = 'La firma todavía no está lista. Probá de nuevo en unos minutos.'
export const CONTRATO_NO_BORRADOR_MESSAGE = 'Este contrato ya no es un borrador: ya se envió a firmar.'
export const CONTRATO_FIRMADO_POR_LOCATARIO_MESSAGE = 'No se puede modificar un contrato que el locatario ya firmó.'
export const SOLO_LOCADOR_MESSAGE = 'Solo el locador del contrato puede hacer esto.'
/** 502 de `/firmar`: DocuSign no respondió. Se puede reintentar. */
export const DOCUSIGN_FIRMA_ERROR_MESSAGE = 'No pudimos abrir la firma en DocuSign. Probá de nuevo en unos minutos.'
/** 502 de `/enviar` (guía del back, §3.1): el contrato sigue en borrador. */
export const DOCUSIGN_ENVIO_ERROR_MESSAGE = 'No pudimos enviar el contrato, probá de nuevo. El contrato sigue en borrador.'
export const MIS_ALQUILERES_ERROR_MESSAGE = 'No pudimos traer tus alquileres. Probá de nuevo en unos minutos.'
export const FIRMA_ERROR_GENERICO_MESSAGE = 'No pudimos registrar la acción. No se cambió nada: probá de nuevo.'
const CONTRATO_SIN_RED_MESSAGE = 'No pudimos conectarnos con el servidor. Revisá tu conexión y probá de nuevo.'

// ─── DTO → vista ────────────────────────────────────────────────────────

/**
 * Las firmas del back → firmantes de la vista: locador, locatario y cada
 * garante (US-07: los garantes firman, decisión del PO del 11/11; se sacó el
 * filtro de la brecha S4-3). `null` si no hay registro (contratos anteriores
 * a RentAR, `sin_registro`): no se inventa quién firmó (US-42).
 * - `key`: `locador`, `locatario` o `garante-<n>` (puede haber varios garantes).
 * - `garanteId`: el `id` de `garantes[]` en la misma posición.
 *   TODO(backend): el firmante garante no trae su id (HANDOFF §7, US-07); el
 *   back arma las dos listas desde el mismo arreglo y en el mismo orden.
 */
function firmantesDeApi(firmas: FirmasApiDto | null, garantes: readonly { id: number }[]): FirmanteContrato[] | null {
  if (!firmas || firmas.firmantes.length === 0 || firmas.firmantes.some((firmante) => firmante.estado === 'sin_registro')) return null
  let posicionGarante = 0
  return firmas.firmantes.map((firmante) => {
    const esGarante = firmante.rol === 'garante'
    if (esGarante) posicionGarante += 1
    const garante = esGarante ? garantes[posicionGarante - 1] : undefined
    return {
      key: esGarante ? `garante-${posicionGarante}` : firmante.rol,
      rol: firmante.rol,
      userId: '',
      garanteId: garante ? String(garante.id) : null,
      nombre: nombreCompleto(firmante),
      // `sin_registro` ya se descartó arriba.
      estado: firmante.estado as SignatureStatus,
      firmadoEl: firmante.fecha_firma,
      rechazadoEl: firmante.fecha_rechazo,
      motivoRechazo: firmante.motivo_rechazo,
    }
  })
}

/** Una fila de `GET /inmuebles/:id/contratos` → la pestaña Contratos (US-43). */
function contratoDePropiedadDeDto(dto: ContratoPropiedadResponse): ContratoDePropiedad {
  const firmantes = firmantesDeApi(dto.firmas, [])
  return {
    id: String(dto.id),
    code: dto.codigo,
    status: dto.estado,
    tenantName: dto.locatario ? nombreCompleto(dto.locatario) : null,
    currentAmount: dto.monto_actual,
    startDate: dto.fecha_inicio_contrato,
    endDate: dto.fecha_fin_contrato,
    adjustmentIndex: dto.indice,
    nextAdjustmentDate: dto.proximo_ajuste,
    firmasRegistradas: firmantes !== null,
    firmantes: (firmantes ?? []).map(({ key, rol, nombre, estado, firmadoEl }) => ({ key, rol, nombre, estado, firmadoEl })),
    // US-07: el back lo calcula con todos los firmantes, garantes incluidos.
    firmadoPorTodasEl: dto.firmas?.firmado_por_todos_el ?? null,
    tienePdf: dto.pdf !== null,
  }
}

/** `GET /inmuebles/:id/contratos` → la pestaña Contratos (US-43). */
export function contratosDePropiedadDeDto(dto: ContratosInmuebleResponse): ContratosDePropiedad {
  const solicitud = dto.solicitud_para_contrato === null ? null : String(dto.solicitud_para_contrato)
  return separarContratos(dto.contratos.map(contratoDePropiedadDeDto), solicitud)
}

/** Id de `tipo_indice` de cada índice. "Sin ajuste" va en `null`. */
const INDICE_ID: Record<Exclude<IndiceContrato, 'sin_ajuste'>, number> = { ICL: 1, IPC: 2, CAC: 3 }

/**
 * El índice, venga como venga: el back lo manda como id en `/:id`, como
 * `{ id, descripcion }` en `/detalle` y como sigla en el listado.
 */
export function indiceDeApi(indice: number | string | { descripcion: string } | null | undefined): IndiceContrato {
  if (typeof indice === 'number') return (Object.entries(INDICE_ID).find(([, id]) => id === indice)?.[0] as IndiceContrato | undefined) ?? 'sin_ajuste'
  return indiceDeDescripcion(typeof indice === 'string' ? indice : (indice?.descripcion ?? null))
}

/** `garantias_ofrecidas` del back: nombres de `tipo_garantia`, no códigos. */
const GARANTIA_DE_NOMBRE: Record<string, GarantiaOfrecida> = { 'garantía propietaria': 'propietaria', 'seguro de caución': 'caucion', otra: 'otra' }

/** PDF del back → vista. */
function pdfDeApi(dto: ContratoPdfDto | null): PdfContrato | null {
  return dto ? { nombre: dto.nombre, tamanoBytes: dto.tamano_bytes, subidoEl: dto.subido_en, url: dto.url } : null
}

/** `GET /contratos/:id` → el alta (US-05, US-06). El back ya manda los valores por defecto de US-05. */
export function borradorDeApi(dto: ContratoBorradorApiResponse): ContratoBorrador {
  const { condiciones, inmueble } = dto
  const indice = indiceDeApi(condiciones.indice_aumento)
  return {
    id: String(dto.id),
    code: dto.codigo,
    status: dto.estado,
    solicitudId: dto.id_solicitud === null ? '' : String(dto.id_solicitud),
    solicitudAceptadaEl: null,
    propiedad: {
      id: String(inmueble.id),
      address: formatExactAddress(inmueble.direccion, inmueble.numero, inmueble.piso),
      neighborhoodName: barrioDe(inmueble.barrio).name,
      priceMonthly: inmueble.precio_publicado,
      adjustmentIndex: null,
      cobro: {
        paymentMethods: condiciones.medios_pago.flatMap((id) => medioPagoFromId(id) ?? []),
        graceDays: condiciones.dias_gracia,
        dailyInterestPct: condiciones.interes_por_dia,
      },
      photoSrc: null,
    },
    locador: parteDeApi(dto.locador),
    locatario: parteDeApi(dto.locatario),
    garantiasOfrecidas: dto.garantias_ofrecidas.flatMap((nombre) => GARANTIA_DE_NOMBRE[nombre.trim().toLowerCase()] ?? []),
    garantes: dto.garantes.map((garante, posicion) => ({ key: `garante-${posicion + 1}`, fullName: nombreCompleto(garante), dni: garante.dni, email: garante.email })),
    condiciones: {
      startDate: condiciones.fecha_inicio_contrato,
      durationMonths: condiciones.duracion_meses,
      initialAmount: condiciones.monto_alquiler,
      deposit: condiciones.deposito,
      paymentTermDays: condiciones.dias_para_vencimiento,
      adjustmentIndex: indice,
      adjustmentPeriod: indice === 'sin_ajuste' ? null : periodicidadDeFrecuencia(condiciones.frecuencia_ajuste),
    },
    // El back cuenta los pasos de 1 a 4; el wizard, de 0 a 3.
    ultimoPaso: Math.max((dto.ultimo_paso ?? 1) - 1, 0),
    pdf: pdfDeApi(dto.pdf),
    fechaInicioVencida: dto.fecha_inicio_vencida,
    endDate: condiciones.fecha_fin_contrato,
  }
}

/**
 * El nombre del garante en dos partes: el front lo carga en un solo campo
 * (US-05: "nombre y apellido") y el back los pide por separado. La primera
 * palabra es el nombre y el resto, el apellido.
 */
function nombreYApellido(completo: string): { nombre: string; apellido: string } {
  const [nombre = '', ...resto] = completo.trim().split(/\s+/)
  return { nombre, apellido: resto.join(' ') }
}

/** Los cambios del borrador → cuerpo de `PATCH /contratos/:id`. Solo viaja lo que vino. */
export function patchDeCambios(cambios: CambiosBorrador): GuardarBorradorRequest {
  const cuerpo: GuardarBorradorRequest = {}
  if (cambios.paso !== undefined) cuerpo.paso = cambios.paso + 1
  if (cambios.garantes) {
    cuerpo.garantes = cambios.garantes.map((garante) => ({ ...nombreYApellido(garante.fullName), dni: garante.dni.trim(), email: garante.email.trim().toLowerCase() }))
  }
  const { condiciones } = cambios
  if (condiciones) {
    const salida: NonNullable<GuardarBorradorRequest['condiciones']> = {}
    if ('startDate' in condiciones) salida.fecha_inicio_contrato = condiciones.startDate
    if ('durationMonths' in condiciones) salida.duracion_meses = condiciones.durationMonths
    if ('initialAmount' in condiciones) salida.monto_alquiler = condiciones.initialAmount
    if ('deposit' in condiciones) salida.deposito = condiciones.deposit
    if ('paymentTermDays' in condiciones) salida.dias_para_vencimiento = condiciones.paymentTermDays
    if (condiciones.adjustmentIndex) salida.indice_aumento = condiciones.adjustmentIndex === 'sin_ajuste' ? null : INDICE_ID[condiciones.adjustmentIndex]
    if ('adjustmentPeriod' in condiciones) salida.frecuencia_ajuste = condiciones.adjustmentPeriod
    if (Object.keys(salida).length > 0) cuerpo.condiciones = salida
  }
  return cuerpo
}

/** Una parte del back → vista. `null` (contrato sin esa parte cargada) → vacía: se muestra "Sin dato". */
function parteDeApi(dto: ParteApiDto | null): ParteContrato {
  if (!dto) return { userId: '', nombre: '', apellido: '', dni: null, email: '', telefono: null }
  return { userId: String(dto.id), nombre: dto.nombre, apellido: dto.apellido, dni: dto.numero_documento, email: dto.email, telefono: telefonoDelBack(dto.telefono) }
}

/**
 * `GET /contratos/:id/detalle` → el detalle del locador (US-42 y US-07).
 * - Lo que no vino queda en `null` o vacío: la pantalla muestra "Sin dato".
 * - Firmantes: locador, locatario y garantes (`firmantesDeApi`).
 * - `puedoFirmar` = `acciones.firmar` (pendiente de firma y el locador sin firmar).
 * - `pdf`: con el contrato vigente es el documento firmado (`<codigo>-firmado.pdf`,
 *   con el certificado de DocuSign); mientras no se guarde, el original.
 */
export function detalleDeLocadorDeDto(dto: ContratoDetalleApiResponse): ContratoDetalle {
  const { condiciones } = dto
  const indice = indiceDeDescripcion(condiciones.indice?.descripcion ?? null)
  const firmantes = firmantesDeApi(dto.firmas, dto.garantes)
  return {
    id: String(dto.id),
    code: dto.codigo,
    status: dto.estado,
    solicitudId: dto.id_solicitud === null ? '' : String(dto.id_solicitud),
    solicitudAceptadaEl: null,
    propiedad: {
      id: String(dto.inmueble.id),
      address: formatExactAddress(dto.inmueble.direccion, dto.inmueble.numero, dto.inmueble.piso),
      neighborhoodName: barrioDe(dto.inmueble.barrio).name,
      priceMonthly: null,
      adjustmentIndex: null,
      cobro: {
        paymentMethods: condiciones.medios_pago.flatMap((medio) => medioPagoFromId(medio.id) ?? []),
        graceDays: condiciones.dias_gracia,
        dailyInterestPct: condiciones.interes_por_dia,
      },
      photoSrc: null,
    },
    locador: parteDeApi(dto.locador),
    locatario: parteDeApi(dto.locatario),
    garantiasOfrecidas: [],
    garantes: dto.garantes.map((garante, posicion) => ({ key: `garante-${posicion + 1}`, fullName: nombreCompleto(garante), dni: garante.dni, email: garante.email })),
    condiciones: {
      startDate: condiciones.fecha_inicio_contrato,
      durationMonths: condiciones.duracion_meses,
      initialAmount: condiciones.monto_inicial,
      deposit: condiciones.deposito,
      paymentTermDays: condiciones.dias_para_vencimiento,
      adjustmentIndex: indice,
      adjustmentPeriod: indice === 'sin_ajuste' ? null : periodicidadDeFrecuencia(condiciones.frecuencia_ajuste),
    },
    ultimoPaso: 3,
    pdf: pdfDeApi(dto.pdf),
    fechaInicioVencida: false,
    enviadoEl: null,
    firmadoPorTodasEl: dto.firmas?.firmado_por_todos_el ?? null,
    firmasRegistradas: firmantes !== null,
    modificarDelBack: dto.acciones.modificar,
    firmantes: firmantes ?? [],
    puedoFirmar: dto.acciones.firmar,
    endDate: condiciones.fecha_fin_contrato,
    montoActual: condiciones.monto_actual,
    ajusteCadaMeses: indice === 'sin_ajuste' ? null : mesesDeFrecuencia(condiciones.frecuencia_ajuste),
    datosApi: {
      pdfUrl: dto.pdf?.url ?? null,
      diasParaVencimiento: condiciones.dias_para_vencimiento,
      proximoVencimientoPago: null,
      proximoAjuste: null,
      ultimoAjuste: null,
      frecuenciaAjuste: condiciones.frecuencia_ajuste,
      // NOTA: la vista del locador no usa `expensas`: el detalle no las manda.
      expensas: 0,
      mediosPago: condiciones.medios_pago.map((medio) => medio.nombre),
    },
  }
}

// ─── Alquileres del locatario (US-27) · EXISTE ──────────────────────────

/**
 * `indice_ajuste` del back (la descripción de `tipo_indice`, "ICL (Índice de
 * Contratos de Locación)") → índice del contrato. `null` → `sin_ajuste`.
 * NOTA: una descripción que no empieza con ICL, IPC ni CAC también se toma
 * como `sin_ajuste` (hoy `tipo_indice` solo tiene esos tres).
 */
function indiceDeDescripcion(descripcion: string | null): IndiceContrato {
  const texto = descripcion?.trim().toUpperCase() ?? ''
  if (texto.startsWith('ICL')) return 'ICL'
  if (texto.startsWith('IPC')) return 'IPC'
  if (texto.startsWith('CAC')) return 'CAC'
  return 'sin_ajuste'
}

/**
 * Meses de cada frecuencia de `contrato.frecuencia_ajuste` (texto libre en
 * la base). Los mismos nombres que interpreta el back para calcular
 * `fecha_proximo_ajuste` (`alquiler-locatario.service.ts`), así la ficha dice
 * lo mismo que la fecha.
 */
const MESES_DE_FRECUENCIA: Record<string, number> = { mensual: 1, bimestral: 2, trimestral: 3, cuatrimestral: 4, semestral: 6, anual: 12 }

/** "Semestral" o "6 meses" → 6; `null` si no se reconoce (se muestra el índice sin "cada N meses"). */
function mesesDeFrecuencia(frecuencia: string | null): number | null {
  const texto = frecuencia?.trim().toLowerCase() ?? ''
  if (MESES_DE_FRECUENCIA[texto]) return MESES_DE_FRECUENCIA[texto]
  const enMeses = texto.match(/^(\d+)\s+mes(?:es)?$/)
  return enMeses ? Number(enMeses[1]) : null
}

/** Periodicidad de US-05 (trimestral, semestral o anual) si la frecuencia del back es una de esas; si no, `null`. */
function periodicidadDeFrecuencia(frecuencia: string | null): PeriodicidadAjuste | null {
  const texto = frecuencia?.trim().toLowerCase()
  return texto === 'trimestral' || texto === 'semestral' || texto === 'anual' ? texto : null
}

/** "Nombre Apellido" (el apellido puede venir `null`). */
function nombreCompleto(persona: { nombre: string; apellido: string | null }): string {
  return [persona.nombre, persona.apellido].filter(Boolean).join(' ')
}

/**
 * Fila de `GET /alquileres-locatario` → `AlquilerResumen` (Mis alquileres, US-27).
 * - `code`: lo que manda el back. TODO(backend): hoy es `String(id_contrato)`,
 *   no `CT-AAAA-NNNN` (US-05).
 * - `tenantName` vacío: la fila es del propio locatario (no se muestra).
 * - `solicitudId` en `null`: el back no lo manda (la fila no lo necesita).
 */
export function alquilerResumenDeItem(dto: AlquilerLocatarioItemResponse): AlquilerResumen {
  const indice = indiceDeDescripcion(dto.indice_ajuste)
  return {
    id: String(dto.id_contrato),
    code: dto.codigo,
    status: dto.estado,
    propertyId: String(dto.inmueble.id),
    propertyAddress: formatExactAddress(dto.inmueble.direccion, dto.inmueble.numero, dto.inmueble.piso),
    neighborhoodName: barrioDe(dto.inmueble.barrio).name,
    tenantName: '',
    currentAmount: dto.monto_actual,
    startDate: dto.fecha_inicio_contrato,
    endDate: dto.fecha_fin_contrato,
    adjustmentIndex: indice === 'sin_ajuste' ? null : indice,
    // US-27: "contrato sin ajuste → no se muestra la fecha de próximo ajuste".
    nextAdjustmentDate: indice === 'sin_ajuste' ? null : dto.fecha_proximo_ajuste,
    solicitudId: null,
    landlordName: nombreCompleto(dto.locador),
  }
}

/**
 * Estado de firma del back → el de la vista. `desconocido` (relaciones
 * anteriores a la migración de US-27) no tiene equivalente: `null`, y la
 * ficha no inventa un estado.
 */
function estadoDeFirma(estado: FirmaAlquilerDto['estado']): FirmanteContrato['estado'] | null {
  return estado === 'desconocido' ? null : estado
}

/**
 * Firmas de Mi alquiler → firmantes de la vista: locador, locatario ("Vos") y
 * cada garante (US-07: los garantes firman, decisión del PO del 11/11).
 * - El locador se nombra con `locador` del DTO; el locatario es quien mira
 *   la ficha (el back solo responde contratos propios): "Vos".
 * - Los garantes se nombran con `garantes[]` en la misma posición.
 *   TODO(backend): las firmas de tipo `garante` no traen el nombre (HANDOFF §7, US-07).
 * - Si alguna está en `desconocido`, o falta el locador o el locatario, no hay
 *   registro de firmas: lista vacía (no se inventa un "pendiente").
 */
function firmantesDeDetalle(dto: AlquilerLocatarioDetalleResponse): FirmanteContrato[] {
  const locador = dto.firmas.find((item) => item.tipo === 'locador')
  const locatario = dto.firmas.find((item) => item.tipo === 'locatario')
  const garantes = dto.firmas.filter((item) => item.tipo === 'garante')
  if (!locador || !locatario) return []
  const firmante = (firma: FirmaAlquilerDto, datos: Pick<FirmanteContrato, 'key' | 'rol' | 'userId' | 'nombre'>): FirmanteContrato | null => {
    const estado = estadoDeFirma(firma.estado)
    if (!estado) return null
    return { ...datos, garanteId: null, estado, firmadoEl: firma.fecha_firma, rechazadoEl: firma.fecha_rechazo, motivoRechazo: firma.motivo_rechazo }
  }
  const firmantes = [
    firmante(locador, { key: 'locador', rol: 'locador', userId: String(dto.locador.id), nombre: nombreCompleto(dto.locador) }),
    firmante(locatario, { key: 'locatario', rol: 'locatario', userId: '', nombre: 'Vos' }),
    ...garantes.map((firma, posicion) => {
      const garante = dto.garantes[posicion]
      return firmante(firma, { key: `garante-${posicion + 1}`, rol: 'garante', userId: '', nombre: garante ? nombreCompleto(garante) : `Garante ${posicion + 1}` })
    }),
  ]
  return firmantes.every((item): item is FirmanteContrato => item !== null) ? firmantes : []
}

/**
 * US-27 — Lo que el locatario ve de cada garante en Mi alquiler: solo el
 * nombre. La misma regla en real (`miAlquilerDeDetalle`) y en mock
 * (`contratos.service#getMiAlquiler`).
 * NOTA: DNI y correo van vacíos a propósito: el tipo los exige y la ficha no los muestra.
 */
export function garanteParaLocatario({ key, fullName }: Pick<GaranteContrato, 'key' | 'fullName'>): GaranteContrato {
  return { key, fullName, dni: '', email: '' }
}

/**
 * `GET /alquileres-locatario/:idContrato` → `ContratoDetalle` (la ficha de Mi
 * alquiler, US-27). Campo por campo; lo que el back no manda queda vacío:
 * - Locatario: vacío (es quien mira; el back no lo repite).
 * - Locador: teléfono con el mismo criterio que el perfil (`telefonoDelBack`:
 *   con código de país a E.164, sin él tal cual). Sin DNI.
 * - Propiedad: dirección exacta con el piso; foto principal directa del
 *   bucket. Sin precio publicado ni condiciones de cobro (los medios de pago
 *   del contrato van en `datosApi.mediosPago`).
 * - Garantes: solo el nombre. Sin DNI (el back no lo manda en la ficha) y sin
 *   correo ni teléfono: el back los manda, pero ninguna pantalla del locatario
 *   los usa (US-27 dice solo "garantes"), así que se descartan acá.
 *   TODO(backend): que `GET /alquileres-locatario/:id` no mande `email` ni
 *   `telefono` de los garantes (HANDOFF §7, US-27): hoy igual llegan al navegador.
 * - Condiciones: sin monto inicial ni duración (no vienen).
 * - `firmadoPorTodasEl`: la última `fecha_firma`, si firmaron todos (garantes incluidos).
 * - `puedoFirmar` = `puede_firmar` del back (US-07: pendiente, con sobre y sin su firma).
 * - `pdfUrl`: con el contrato vigente o finalizado, el documento firmado. Es una
 *   URL firmada de 60 s: la pantalla la vuelve a pedir al hacer clic (S4-13).
 */
export function miAlquilerDeDetalle(dto: AlquilerLocatarioDetalleResponse): ContratoDetalle {
  const indice = indiceDeDescripcion(dto.indice_ajuste)
  const firmantes = firmantesDeDetalle(dto)
  const fechasDeFirma = firmantes.map((firmante) => firmante.firmadoEl).filter((fecha): fecha is string => fecha !== null)
  const firmadoPorTodas = firmantes.length > 0 && fechasDeFirma.length === firmantes.length
  const sinDatos: ParteContrato = { userId: '', nombre: '', apellido: '', dni: null, email: '', telefono: null }
  return {
    id: String(dto.id_contrato),
    // TODO(backend): hoy `codigo` es `String(id_contrato)`, no `CT-AAAA-NNNN` (US-05).
    code: dto.codigo,
    status: dto.estado,
    solicitudId: '',
    solicitudAceptadaEl: null,
    propiedad: {
      id: String(dto.inmueble.id),
      address: formatExactAddress(dto.inmueble.direccion, dto.inmueble.numero, dto.inmueble.piso),
      neighborhoodName: barrioDe(dto.inmueble.barrio).name,
      priceMonthly: null,
      adjustmentIndex: null,
      cobro: { paymentMethods: [], graceDays: null, dailyInterestPct: null },
      photoSrc: dto.inmueble.foto_principal,
    },
    locador: {
      userId: String(dto.locador.id),
      nombre: dto.locador.nombre,
      apellido: dto.locador.apellido ?? '',
      dni: null,
      email: dto.locador.email,
      telefono: telefonoDelBack(dto.locador.telefono),
    },
    locatario: sinDatos,
    garantiasOfrecidas: [],
    garantes: dto.garantes.map((garante, posicion) => garanteParaLocatario({ key: `garante-${posicion + 1}`, fullName: nombreCompleto(garante) })),
    condiciones: {
      startDate: dto.fecha_inicio_contrato,
      durationMonths: null,
      initialAmount: null,
      deposit: dto.deposito,
      paymentTermDays: dto.dias_para_vencimiento,
      adjustmentIndex: indice,
      adjustmentPeriod: indice === 'sin_ajuste' ? null : periodicidadDeFrecuencia(dto.frecuencia_ajuste),
    },
    ultimoPaso: 3,
    pdf: null,
    fechaInicioVencida: false,
    enviadoEl: null,
    firmadoPorTodasEl: firmadoPorTodas ? ([...fechasDeFirma].sort().at(-1) ?? null) : null,
    firmasRegistradas: firmantes.length > 0,
    modificarDelBack: null,
    firmantes,
    puedoFirmar: dto.puede_firmar,
    endDate: dto.fecha_fin_contrato,
    montoActual: dto.monto_actual,
    ajusteCadaMeses: indice === 'sin_ajuste' ? null : mesesDeFrecuencia(dto.frecuencia_ajuste),
    datosApi: {
      pdfUrl: dto.pdf_url,
      diasParaVencimiento: dto.dias_para_vencimiento,
      proximoVencimientoPago: dto.fecha_proximo_vencimiento_pago,
      // US-27: "contrato sin ajuste → no se muestra la fecha de próximo ajuste".
      proximoAjuste: indice === 'sin_ajuste' ? null : dto.fecha_proximo_ajuste,
      ultimoAjuste: dto.fecha_ultimo_ajuste,
      frecuenciaAjuste: dto.frecuencia_ajuste,
      expensas: dto.expensas,
      mediosPago: dto.medios_pago,
    },
  }
}

/**
 * Error de `/alquileres-locatario` → mensaje de Mi alquiler (US-27):
 * - Detalle (`detalle: true`): 404 → "No encontramos este alquiler."; un 400
 *   (id que no es un entero) va igual, como `not_found`: hacia la vista no
 *   se distingue "no existe", "no es tuyo" ni "id inválido".
 * - Listado: un 400 (filtro de estado inválido; el front solo manda los
 *   tres válidos) → el error genérico.
 * - 5xx y sin red: los mismos mensajes que el resto de contratos.
 */
export function errorDeMiAlquiler(error: unknown, opciones: { detalle: boolean }): unknown {
  if (!(error instanceof ServiceError)) return error
  if (opciones.detalle && (error.code === 'validation' || error.code === 'not_found' || error.code === 'forbidden')) {
    return new ServiceError('not_found', ALQUILER_NO_ENCONTRADO_MESSAGE)
  }
  if (error.code === 'validation') return new ServiceError('server', MIS_ALQUILERES_ERROR_MESSAGE)
  return errorDeContrato(error, { porDefecto409: 'CONTRATO_NO_PENDIENTE', noEncontrado: ALQUILER_NO_ENCONTRADO_MESSAGE, generico: MIS_ALQUILERES_ERROR_MESSAGE })
}

/**
 * Respuesta de `POST /contratos/:id/enviar` → `ContratoEnviado`. Los firmantes
 * salen del borrador: el locador, el locatario y cada garante (US-07).
 */
export function contratoEnviadoDeDto(dto: ContratoEnviadoResponse, borrador: Pick<ContratoBorrador, 'locador' | 'locatario' | 'garantes'>): ContratoEnviado {
  return {
    id: String(dto.id),
    code: dto.codigo,
    status: 'pendiente_firma',
    firmantes: [
      { rol: 'locador', nombre: `${borrador.locador.nombre} ${borrador.locador.apellido}`.trim() },
      { rol: 'locatario', nombre: `${borrador.locatario.nombre} ${borrador.locatario.apellido}`.trim() },
      ...borrador.garantes.map((garante) => ({ rol: 'garante' as const, nombre: garante.fullName })),
    ],
  }
}

// ─── Errores ────────────────────────────────────────────────────────────

/** Mensaje de cada 409 de contratos, por el `codigo` del sobre. */
const MENSAJE_DE_CODIGO: Record<CodigoErrorContrato, string> = {
  SOLICITUD_NO_ACEPTADA: SOLICITUD_NO_ACEPTADA_MESSAGE,
  SOLICITUD_CON_CONTRATO: SOLICITUD_CON_CONTRATO_MESSAGE,
  PROPIEDAD_CON_CONTRATO: PROPIEDAD_CON_CONTRATO_MESSAGE,
  PROPIEDAD_CON_BORRADOR: 'La propiedad ya tiene un contrato en borrador.',
  PROPIEDAD_SIN_OFERTA: 'La propiedad no tiene condiciones de oferta cargadas.',
  CONTRATO_DUPLICADO: 'Ya existe un contrato para esta solicitud o propiedad.',
  CONTRATO_BORRADOR: 'Este contrato es un borrador: se sigue editando en el alta.',
  CONTRATO_VIGENTE: 'No se puede modificar un contrato vigente: todas las partes ya lo firmaron.',
  CONTRATO_FINALIZADO: 'No se puede modificar un contrato finalizado.',
  CONTRATO_FIRMADO_POR_LOCATARIO: CONTRATO_FIRMADO_POR_LOCATARIO_MESSAGE,
  CONTRATO_YA_EN_BORRADOR: 'El contrato ya está en borrador.',
  CONTRATO_NO_EDITABLE: CONTRATO_NO_EDITABLE_MESSAGE,
  CONTRATO_NO_BORRADOR: CONTRATO_NO_BORRADOR_MESSAGE,
  CONTRATO_NO_PENDIENTE: CONTRATO_NO_PENDIENTE_MESSAGE,
  YA_FIRMO: YA_FIRMO_MESSAGE,
  SOBRE_NO_DISPONIBLE: SOBRE_NO_DISPONIBLE_MESSAGE,
}

/**
 * Textos del back que no sirven para el usuario: nombran campos o rutas
 * internas, o vienen de Postgres en inglés. Van al mensaje genérico.
 */
const TEXTOS_TECNICOS = [
  /^El campo id_solicitud/,
  /^El cuerpo de la solicitud/,
  /^Las condiciones deben enviarse/,
  /^Los garantes deben enviarse/,
  /^El garante \d+ no es válido/,
  /^No hay datos para guardar/,
  /^El paso del alta/,
  /^Falta la ruta del archivo/,
  /^La ruta del archivo no corresponde/,
  /^Falta el nombre del archivo/,
  /violates|invalid input|out of range|duplicate key/i,
]

/**
 * Error de cualquier ruta de `/contratos` → mensaje de la pantalla (US-05):
 * - 409 con `codigo` → el mensaje de ese caso (solicitud no aceptada, ya
 *   tiene contrato, la propiedad tiene otro, el contrato ya no es borrador).
 *   Sin `codigo`, `porDefecto409` (cada ruta sabe cuál es su 409 más común).
 * - 403 y 404 → "No encontramos este contrato." (o la solicitud): no se
 *   distingue "no existe" de "no es tuyo". Salvo que la ruta pase
 *   `prohibido`: es parte del contrato pero no le toca (US-07: el locatario
 *   que cancela el envío), y se dice por qué.
 * - `mensajesPorCodigo`: la ruta cambia el texto de un 409 (US-07: `YA_FIRMO`
 *   no dice lo mismo al rechazar que al firmar).
 * - 502 con `docusign`: DocuSign no respondió (US-07); se puede reintentar.
 * - 400 → `validation` con el texto del back (repite las reglas del front).
 *   Con `idInvalidoEsNoEncontrado`, en una ruta sin cuerpo el único 400 es un
 *   id que no es un entero: va como "no encontrado", sin mostrar el texto técnico.
 * - 401 → `unauthorized`, con el "Tu sesión venció" que ya puso `apiClient`.
 * - 5xx / sin red → mensaje genérico, nunca el texto técnico.
 * Lee `code` y `apiCode`, que salen del `error` y el `codigo` del sobre (nunca de `message`).
 */
export function errorDeContrato(
  error: unknown,
  opciones: {
    porDefecto409: CodigoErrorContrato
    noEncontrado?: string
    prohibido?: string
    generico?: string
    idInvalidoEsNoEncontrado?: boolean
    mensajesPorCodigo?: Partial<Record<CodigoErrorContrato, string>>
    /** Mensaje del 502 (DocuSign no respondió). Sin él, un 502 es un 5xx más. */
    docusign?: string
  },
): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'conflict') {
    const codigo = (error.apiCode as CodigoErrorContrato | undefined) ?? opciones.porDefecto409
    const mensaje = opciones.mensajesPorCodigo?.[codigo] ?? MENSAJE_DE_CODIGO[codigo] ?? MENSAJE_DE_CODIGO[opciones.porDefecto409]
    return new ServiceError('conflict', mensaje, codigo)
  }
  if (error.code === 'server' && opciones.docusign && error.status === 502) return new ServiceError('server', opciones.docusign)
  if (error.code === 'forbidden' && opciones.prohibido) return new ServiceError('forbidden', opciones.prohibido)
  if (error.code === 'validation' && opciones.idInvalidoEsNoEncontrado) return new ServiceError('not_found', opciones.noEncontrado ?? CONTRATO_NO_ENCONTRADO_MESSAGE)
  if (error.code === 'validation' && TEXTOS_TECNICOS.some((texto) => texto.test(error.message))) return new ServiceError('validation', opciones.generico ?? CONTRATO_ERROR_GENERICO_MESSAGE)
  if (error.code === 'forbidden' || error.code === 'not_found') return new ServiceError('not_found', opciones.noEncontrado ?? CONTRATO_NO_ENCONTRADO_MESSAGE)
  // 413 de `PUT /pdf`: el texto del back se puede mostrar, y no es una caída.
  if (error.code === 'server' && /supera?r? los 5 MB/.test(error.message)) return new ServiceError('validation', error.message)
  if (error.code === 'server') return new ServiceError('server', opciones.generico ?? CONTRATO_ERROR_GENERICO_MESSAGE)
  if (error.code === 'network') return new ServiceError('network', CONTRATO_SIN_RED_MESSAGE)
  return error
}
