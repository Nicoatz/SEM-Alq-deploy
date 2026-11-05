/**
 * contrato.adapter.ts — traduce los contratos del back a los tipos de vista,
 * y los errores a mensajes en español.
 *
 * Qué es: la frontera entre los DTO PROPUESTOS de `/contratos` (ver
 * `shared/backend-dtos.ts`, "Contratos") y `ContratoResumen` /
 * `ContratoBorrador` / `ContratoEnviado`. Cuando el back haga las rutas, lo
 * que cambie de forma se ajusta acá, nunca en las pantallas.
 * Cubre: US-05 Registrar contrato de alquiler y US-07 Firmar contrato de
 * alquiler (detalle, firmas, historial), contra rutas propuestas; y US-27
 * Consultar mis alquileres contra `GET /alquileres-locatario` (EXISTE, ver
 * "Alquileres del locatario (US-27)" más abajo).
 * Quién lo usa: `services/contratos.service.ts` (los mensajes, también la
 * rama mock, así responde igual que el back).
 */
import type {
  AlquilerResumen,
  ClausulaContrato,
  ContratoBorrador,
  ContratoDePropiedad,
  ContratoDetalle,
  ContratoEnviado,
  ContratoResumen,
  ContratosDePropiedad,
  DatosContrato,
  EventoContrato,
  FirmanteContrato,
  GaranteContrato,
  IndiceContrato,
  ParteContrato,
  PeriodicidadAjuste,
  RolFirmante,
} from '@rentar/shared-types'
import { MESES_POR_PERIODO } from '@/lib/contratos/fechas'
import { separarContratos } from '@/lib/contratos/propiedad'
import { completarClausulas } from '@/lib/contratos/plantilla'
import { DIA_VENCIMIENTO_POR_DEFECTO, DURACION_POR_DEFECTO } from '@/lib/contratos/validaciones'
import { telefonoAE164, telefonoDelBack } from '@/lib/perfil/formato'
import type {
  AlquilerLocatarioDetalleResponse,
  AlquilerLocatarioItemResponse,
  ClausulaDto,
  CodigoErrorContrato,
  ContratoDetalleResponse,
  ContratoEnviadoResponse,
  ContratoPropiedadResponse,
  ContratoRequest,
  ContratoResponse,
  ContratoResumenResponse,
  ContratosInmuebleResponse,
  EventoContratoDto,
  FirmaAlquilerDto,
  FirmanteApiDto,
  FirmanteDto,
  FirmasApiDto,
  GaranteDto,
  ParteContratoDto,
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
export const CONTRATO_NO_EDITABLE_MESSAGE = 'Este contrato ya se envió a firmar y no se puede editar.'
/** US-43: "sin distinguir" si la propiedad no existe o no es del usuario. */
export const PROPIEDAD_NO_ENCONTRADA_MESSAGE = 'No encontramos esta propiedad'
export const CONTRATOS_DE_PROPIEDAD_ERROR_MESSAGE = 'Probá de nuevo en unos minutos. El resto de la propiedad está bien.'
export const CONTRATO_ERROR_GENERICO_MESSAGE = 'No pudimos guardar el contrato. Probá de nuevo en unos minutos.'
// US-07
export const CONTRATO_NO_PENDIENTE_MESSAGE = 'Este contrato ya no está pendiente de firma.'
export const YA_FIRMO_MESSAGE = 'Ya firmaste este contrato: una parte no puede firmarlo dos veces.'
export const FIRMA_RECHAZADA_MESSAGE = 'Rechazaste la firma de este contrato. Para firmarlo, el locador tiene que volver a enviártelo.'
export const OTRA_PARTE_FIRMO_MESSAGE = 'No se puede cancelar el envío: el locatario ya firmó el contrato.'
export const FIRMANTE_NO_PENDIENTE_MESSAGE = 'Solo se puede reenviar la invitación a quien todavía no firmó ni rechazó.'
export const REENVIO_MUY_PRONTO_MESSAGE = 'Ya se reenvió la invitación hace menos de una hora. Se puede reenviar una vez por hora.'
export const SOLO_LOCADOR_MESSAGE = 'Solo el locador del contrato puede hacer esto.'
export const SOLO_LOCATARIO_MESSAGE = 'Solo el locatario puede rechazar la firma.'
export const MIS_ALQUILERES_ERROR_MESSAGE = 'No pudimos traer tus alquileres. Probá de nuevo en unos minutos.'
export const FIRMA_ERROR_GENERICO_MESSAGE = 'No pudimos registrar la acción. No se cambió nada: probá de nuevo.'
const CONTRATO_SIN_RED_MESSAGE = 'No pudimos conectarnos con el servidor. Revisá tu conexión y probá de nuevo.'

// ─── DTO → vista ────────────────────────────────────────────────────────

/** Locador o locatario del back → `ParteContrato`. */
function parteDeDto(dto: ParteContratoDto): ParteContrato {
  return {
    userId: String(dto.id),
    nombre: dto.nombre,
    apellido: dto.apellido ?? '',
    dni: dto.numero_documento || null,
    email: dto.email,
    telefono: telefonoAE164(dto.telefono),
  }
}

/** Garante del back → vista. La clave es local (para la lista del paso 1). */
function garanteDeDto(dto: GaranteDto, indice: number): GaranteContrato {
  return { key: `garante-${indice + 1}`, fullName: dto.nombre_apellido, dni: dto.numero_documento, email: dto.email }
}

/** Cláusula del back → vista. */
function clausulaDeDto(dto: ClausulaDto): ClausulaContrato {
  return { key: dto.clave, tipo: dto.tipo, titulo: dto.titulo, texto: dto.texto, editada: dto.tipo === 'editable' && dto.editada }
}

/** Fila de `GET /contratos` → `ContratoResumen`. La dirección es la exacta (el listado es del locador). */
export function contratoResumenDeDto(dto: ContratoResumenResponse): ContratoResumen {
  return {
    id: String(dto.id),
    code: dto.codigo,
    status: dto.estado,
    propertyId: String(dto.inmueble.id),
    propertyAddress: formatExactAddress(dto.inmueble.direccion, dto.inmueble.numero, dto.inmueble.piso),
    neighborhoodName: barrioDe(dto.inmueble.barrio).name,
    tenantName: [dto.locatario.nombre, dto.locatario.apellido].filter(Boolean).join(' '),
    currentAmount: dto.monto_actual,
    startDate: dto.fecha_inicio,
    endDate: dto.fecha_fin,
    adjustmentIndex: dto.indice,
    nextAdjustmentDate: dto.proximo_ajuste,
    solicitudId: dto.id_solicitud === null ? null : String(dto.id_solicitud),
  }
}

/**
 * Las firmas del back → solo locador y locatario. `null` si alguna de las dos
 * partes no tiene registro: no se inventa quién firmó (US-42).
 * TODO(backend): el back cuenta al garante como firmante, y el garante no firma
 * (decisión del PO; issue del Sprint 4, punto 2). Se saca acá y `faltan` se
 * recalcula en la vista con `firmasQueFaltan`.
 */
function partesQueFirman(firmas: FirmasApiDto | null): (FirmanteApiDto & { rol: RolFirmante; estado: FirmanteContrato['estado'] })[] | null {
  if (!firmas) return null
  const partes = firmas.firmantes.filter((firmante) => firmante.rol !== 'garante')
  if (partes.length === 0 || partes.some((firmante) => firmante.estado === 'sin_registro')) return null
  return partes as (FirmanteApiDto & { rol: RolFirmante; estado: FirmanteContrato['estado'] })[]
}

/**
 * La fecha en que firmaron las dos partes: la última `fecha_firma`. Se calcula
 * con las partes porque `firmado_por_todos_el` queda en `null` si hay garantes.
 */
function firmadoPorLasPartes(partes: { fecha_firma: string | null }[] | null): string | null {
  const fechas = (partes ?? []).map((parte) => parte.fecha_firma)
  if (fechas.length < 2 || fechas.some((fecha) => fecha === null)) return null
  return (fechas as string[]).sort().at(-1) ?? null
}

/** Una fila de `GET /inmuebles/:id/contratos` → la pestaña Contratos (US-43). */
function contratoDePropiedadDeDto(dto: ContratoPropiedadResponse): ContratoDePropiedad {
  const partes = partesQueFirman(dto.firmas)
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
    firmasRegistradas: partes !== null,
    firmantes: (partes ?? []).map((parte) => ({ rol: parte.rol, nombre: nombreCompleto(parte), estado: parte.estado, firmadoEl: parte.fecha_firma })),
    firmadoPorTodasEl: dto.estado === 'vigente' ? firmadoPorLasPartes(partes) : null,
    documento: dto.pdf ? { tipo: 'archivo', url: dto.pdf.url } : null,
  }
}

/** `GET /inmuebles/:id/contratos` → la pestaña Contratos (US-43). */
export function contratosDePropiedadDeDto(dto: ContratosInmuebleResponse): ContratosDePropiedad {
  const solicitud = dto.solicitud_para_contrato === null ? null : String(dto.solicitud_para_contrato)
  return separarContratos(dto.contratos.map(contratoDePropiedadDeDto), solicitud)
}

/**
 * `GET /contratos/:id` o `/contratos/preparar` → `ContratoBorrador`.
 * - `condiciones` en `null` (lo que manda `/preparar`): los valores por
 *   defecto de US-05 (24 meses, precio publicado, un mes de depósito, día
 *   10, el índice de la publicación).
 * - `clausulas` vacías: la plantilla del front, completada con los datos.
 */
export function contratoDeDto(dto: ContratoResponse): ContratoBorrador {
  const { inmueble } = dto
  const precio = inmueble.precio_publicado
  const borrador: ContratoBorrador = {
    id: dto.id === null ? null : String(dto.id),
    code: dto.codigo,
    status: dto.estado,
    solicitudId: String(dto.id_solicitud),
    solicitudAceptadaEl: dto.fecha_aceptacion_solicitud,
    propiedad: {
      id: String(inmueble.id),
      address: formatExactAddress(inmueble.direccion, inmueble.numero, inmueble.piso),
      neighborhoodName: barrioDe(inmueble.barrio).name,
      priceMonthly: precio,
      adjustmentIndex: inmueble.indice_publicacion,
      photoSrc: inmueble.foto_principal ?? null,
      cobro: {
        paymentMethods: inmueble.medios_pago.map(medioPagoFromId).filter((medio) => medio !== null),
        graceDays: inmueble.dias_gracia,
        dailyInterestPct: inmueble.interes_por_dia,
      },
    },
    locador: parteDeDto(dto.locador),
    locatario: parteDeDto(dto.locatario),
    garantiasOfrecidas: dto.garantias_ofrecidas,
    garantes: dto.garantes.map(garanteDeDto),
    condiciones: dto.condiciones
      ? {
          startDate: dto.condiciones.fecha_inicio,
          durationMonths: dto.condiciones.duracion_meses,
          initialAmount: dto.condiciones.monto_inicial,
          deposit: dto.condiciones.deposito,
          paymentDueDay: dto.condiciones.dia_vencimiento,
          adjustmentIndex: dto.condiciones.indice,
          adjustmentPeriod: dto.condiciones.periodicidad,
        }
      : {
          startDate: null,
          durationMonths: DURACION_POR_DEFECTO,
          initialAmount: precio,
          deposit: precio,
          paymentDueDay: DIA_VENCIMIENTO_POR_DEFECTO,
          adjustmentIndex: inmueble.indice_publicacion ?? 'sin_ajuste',
          // NOTA: la periodicidad de la publicación es texto libre en el back: se elige en el paso 2.
          adjustmentPeriod: null,
        },
    clausulas: dto.clausulas.map(clausulaDeDto),
    ultimoPaso: dto.ultimo_paso,
  }
  return { ...borrador, clausulas: completarClausulas(borrador.clausulas, borrador) }
}

/** Firmante del back → vista. */
function firmanteDeDto(dto: FirmanteDto): FirmanteContrato {
  return {
    rol: dto.rol,
    userId: String(dto.id_usuario),
    nombre: [dto.nombre, dto.apellido].filter(Boolean).join(' '),
    estado: dto.estado,
    firmadoEl: dto.fecha_firma,
    rechazadoEl: dto.fecha_rechazo,
    motivoRechazo: dto.motivo_rechazo,
    ultimaInvitacion: dto.fecha_ultima_invitacion,
  }
}

/** Evento del historial del back → vista. */
function eventoDeDto(dto: EventoContratoDto): EventoContrato {
  return { id: String(dto.id), tipo: dto.tipo, fecha: dto.fecha, rol: dto.rol, nombre: dto.nombre, motivo: dto.motivo }
}

/** `GET /contratos/:id` (y las acciones de US-07) → `ContratoDetalle`. Los firmantes, locador primero. */
export function contratoDetalleDeDto(dto: ContratoDetalleResponse): ContratoDetalle {
  const orden: Record<FirmanteDto['rol'], number> = { locador: 0, locatario: 1 }
  return {
    ...contratoDeDto(dto),
    enviadoEl: dto.fecha_envio,
    firmadoPorTodasEl: dto.fecha_firma_completa,
    firmasRegistradas: dto.firmas_registradas,
    firmantes: [...dto.firmantes].sort((a, b) => orden[a.rol] - orden[b.rol]).map(firmanteDeDto),
    historial: dto.historial.map(eventoDeDto),
    endDate: dto.fecha_fin,
    montoActual: dto.monto_actual,
    ajusteCadaMeses: dto.condiciones?.indice && dto.condiciones.indice !== 'sin_ajuste' && dto.condiciones.periodicidad ? MESES_POR_PERIODO[dto.condiciones.periodicidad] : null,
    // El detalle propuesto de `/contratos/:id` no trae los datos de `/alquileres-locatario`.
    datosApi: null,
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
 * Firmas del detalle → firmantes de la vista (locador primero).
 * - Decisión del PO (Sprint 3): firman el locador y el locatario; los
 *   garantes que traiga `firmas[]` se descartan acá (la ficha los muestra
 *   como datos, sin estado de firma).
 * - El locador se nombra con `locador` del DTO; el locatario es quien mira
 *   la ficha (el back solo responde contratos propios): "Vos".
 * - Si alguna de las dos está en `desconocido` o falta, no hay registro de
 *   firmas: lista vacía (no se inventa un "pendiente").
 * TODO(backend): las invitaciones (US-07) no existen: `ultimaInvitacion` va en `null`.
 */
function firmantesDeDetalle(dto: AlquilerLocatarioDetalleResponse): FirmanteContrato[] {
  const nombres: Record<RolFirmante, string> = { locador: nombreCompleto(dto.locador), locatario: 'Vos' }
  const ids: Record<RolFirmante, string> = { locador: String(dto.locador.id), locatario: '' }
  const firmantes: FirmanteContrato[] = []
  for (const rol of ['locador', 'locatario'] as const) {
    const firma = dto.firmas.find((item) => item.tipo === rol)
    const estado = firma ? estadoDeFirma(firma.estado) : null
    if (!firma || !estado) return []
    firmantes.push({
      rol,
      userId: ids[rol],
      nombre: nombres[rol],
      estado,
      firmadoEl: firma.fecha_firma,
      rechazadoEl: firma.fecha_rechazo,
      motivoRechazo: firma.motivo_rechazo,
      ultimaInvitacion: null,
    })
  }
  return firmantes
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
 * - Garantes: nombre y correo; sin DNI (el back no lo manda en la ficha).
 * - Condiciones: sin monto inicial ni duración (no vienen) y sin día de pago
 *   (el back modela un plazo en días: `datosApi.diasParaVencimiento`).
 * - Cláusulas e historial: vacíos. TODO(backend): el detalle no trae las
 *   cláusulas ni el historial de US-07.
 * - `firmadoPorTodasEl`: la última `fecha_firma`, si firmaron las dos partes.
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
    garantes: dto.garantes.map((garante, posicion) => ({ key: `garante-${posicion + 1}`, fullName: nombreCompleto(garante), dni: '', email: garante.email })),
    condiciones: {
      startDate: dto.fecha_inicio_contrato,
      durationMonths: null,
      initialAmount: null,
      deposit: dto.deposito,
      paymentDueDay: null,
      adjustmentIndex: indice,
      adjustmentPeriod: indice === 'sin_ajuste' ? null : periodicidadDeFrecuencia(dto.frecuencia_ajuste),
    },
    clausulas: [],
    ultimoPaso: 3,
    enviadoEl: null,
    firmadoPorTodasEl: firmadoPorTodas ? ([...fechasDeFirma].sort().at(-1) ?? null) : null,
    firmasRegistradas: firmantes.length > 0,
    firmantes,
    historial: [],
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

/** Respuesta de `POST /contratos/:id/enviar` → `ContratoEnviado`. Los firmantes salen del borrador (decisión del PO: locador y locatario). */
export function contratoEnviadoDeDto(dto: ContratoEnviadoResponse, borrador: Pick<ContratoBorrador, 'locador' | 'locatario'>): ContratoEnviado {
  return {
    id: String(dto.id),
    code: dto.codigo,
    status: 'pendiente_firma',
    firmantes: [
      { rol: 'locador', nombre: `${borrador.locador.nombre} ${borrador.locador.apellido}`.trim() },
      { rol: 'locatario', nombre: `${borrador.locatario.nombre} ${borrador.locatario.apellido}`.trim() },
    ],
  }
}

// ─── Vista → DTO ────────────────────────────────────────────────────────

/** Lo que se guarda → cuerpo de `POST` / `PUT /contratos`. */
export function datosToContratoRequest(datos: DatosContrato): ContratoRequest {
  const { condiciones } = datos
  return {
    id_solicitud: Number(datos.solicitudId),
    garantes: datos.garantes.map((garante) => ({ nombre_apellido: garante.fullName.trim(), numero_documento: garante.dni.trim(), email: garante.email.trim().toLowerCase() })),
    condiciones: {
      fecha_inicio: condiciones.startDate,
      duracion_meses: condiciones.durationMonths,
      monto_inicial: condiciones.initialAmount,
      deposito: condiciones.deposit,
      dia_vencimiento: condiciones.paymentDueDay,
      indice: condiciones.adjustmentIndex,
      periodicidad: condiciones.adjustmentIndex === 'sin_ajuste' ? null : condiciones.adjustmentPeriod,
    },
    clausulas: datos.clausulas.map((clausula) => ({ clave: clausula.key, tipo: clausula.tipo, titulo: clausula.titulo, texto: clausula.texto, editada: clausula.editada })),
    ultimo_paso: datos.ultimoPaso,
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
  CONTRATO_FIRMADO_POR_LOCATARIO: 'No se puede modificar un contrato que el locatario ya firmó.',
  CONTRATO_YA_EN_BORRADOR: 'El contrato ya está en borrador.',
  CONTRATO_NO_EDITABLE: CONTRATO_NO_EDITABLE_MESSAGE,
  CONTRATO_NO_PENDIENTE: CONTRATO_NO_PENDIENTE_MESSAGE,
  YA_FIRMO: YA_FIRMO_MESSAGE,
  FIRMA_RECHAZADA: FIRMA_RECHAZADA_MESSAGE,
  OTRA_PARTE_FIRMO: OTRA_PARTE_FIRMO_MESSAGE,
  FIRMANTE_NO_PENDIENTE: FIRMANTE_NO_PENDIENTE_MESSAGE,
}

/**
 * Error de cualquier ruta de `/contratos` → mensaje de la pantalla (US-05):
 * - 409 con `codigo` → el mensaje de ese caso (solicitud no aceptada, ya
 *   tiene contrato, la propiedad tiene otro, el contrato ya no es borrador).
 *   Sin `codigo`, `porDefecto409` (cada ruta sabe cuál es su 409 más común).
 * - 403 y 404 → "No encontramos este contrato." (o la solicitud): no se
 *   distingue "no existe" de "no es tuyo". Salvo que la ruta pase
 *   `prohibido`: es parte del contrato pero no le toca (US-07: el locatario
 *   que cancela el envío), y se dice por qué.
 * - 429 → "una vez por hora" (US-07, reenviar la invitación).
 * - 400 → `validation` con el texto del back (repite las reglas del front).
 *   Con `idInvalidoEsNoEncontrado`, en una ruta sin cuerpo el único 400 es un
 *   id que no es un entero: va como "no encontrado", sin mostrar el texto técnico.
 * - 401 → `unauthorized`, con el "Tu sesión venció" que ya puso `apiClient`.
 * - 5xx / sin red → mensaje genérico, nunca el texto técnico.
 * Lee `code` y `apiCode`, que salen del `error` y el `codigo` del sobre (nunca de `message`).
 */
export function errorDeContrato(
  error: unknown,
  opciones: { porDefecto409: CodigoErrorContrato; noEncontrado?: string; prohibido?: string; generico?: string; idInvalidoEsNoEncontrado?: boolean },
): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'conflict') {
    const codigo = (error.apiCode as CodigoErrorContrato | undefined) ?? opciones.porDefecto409
    return new ServiceError('conflict', MENSAJE_DE_CODIGO[codigo] ?? MENSAJE_DE_CODIGO[opciones.porDefecto409], codigo)
  }
  if (error.code === 'forbidden' && opciones.prohibido) return new ServiceError('forbidden', opciones.prohibido)
  if (error.code === 'validation' && opciones.idInvalidoEsNoEncontrado) return new ServiceError('not_found', opciones.noEncontrado ?? CONTRATO_NO_ENCONTRADO_MESSAGE)
  if (error.code === 'forbidden' || error.code === 'not_found') return new ServiceError('not_found', opciones.noEncontrado ?? CONTRATO_NO_ENCONTRADO_MESSAGE)
  if (error.code === 'too_many_requests') return new ServiceError('too_many_requests', REENVIO_MUY_PRONTO_MESSAGE)
  if (error.code === 'server') return new ServiceError('server', opciones.generico ?? CONTRATO_ERROR_GENERICO_MESSAGE)
  if (error.code === 'network') return new ServiceError('network', CONTRATO_SIN_RED_MESSAGE)
  return error
}
