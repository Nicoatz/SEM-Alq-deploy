/**
 * contrato.adapter.ts — traduce los contratos del back a los tipos de vista,
 * y los errores a mensajes en español.
 *
 * Qué es: la frontera entre los DTO PROPUESTOS de `/contratos` (ver
 * `shared/backend-dtos.ts`, "Contratos") y `ContratoResumen` /
 * `ContratoBorrador` / `ContratoEnviado`. Cuando el back haga las rutas, lo
 * que cambie de forma se ajusta acá, nunca en las pantallas.
 * Cubre: US-05 Registrar contrato de alquiler y US-07 Firmar contrato de
 * alquiler (detalle, firmas, historial).
 * Quién lo usa: `services/contratos.service.ts` (los mensajes, también la
 * rama mock, así responde igual que el back).
 */
import type {
  ClausulaContrato,
  ContratoBorrador,
  ContratoDetalle,
  ContratoEnviado,
  ContratoResumen,
  DatosContrato,
  EventoContrato,
  FirmanteContrato,
  GaranteContrato,
  ParteContrato,
} from '@rentar/shared-types'
import { completarClausulas } from '@/lib/contratos/plantilla'
import { DIA_VENCIMIENTO_POR_DEFECTO, DURACION_POR_DEFECTO } from '@/lib/contratos/validaciones'
import { telefonoAE164 } from '@/lib/perfil/formato'
import type {
  ClausulaDto,
  CodigoErrorContrato,
  ContratoDetalleResponse,
  ContratoEnviadoResponse,
  ContratoRequest,
  ContratoResponse,
  ContratoResumenResponse,
  EventoContratoDto,
  FirmanteDto,
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
  }
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
 * - 5xx / sin red → mensaje genérico, nunca el texto técnico.
 */
export function errorDeContrato(
  error: unknown,
  opciones: { porDefecto409: CodigoErrorContrato; noEncontrado?: string; prohibido?: string; generico?: string },
): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'conflict') {
    const codigo = (error.apiCode as CodigoErrorContrato | undefined) ?? opciones.porDefecto409
    return new ServiceError('conflict', MENSAJE_DE_CODIGO[codigo] ?? MENSAJE_DE_CODIGO[opciones.porDefecto409], codigo)
  }
  if (error.code === 'forbidden' && opciones.prohibido) return new ServiceError('forbidden', opciones.prohibido)
  if (error.code === 'forbidden' || error.code === 'not_found') return new ServiceError('not_found', opciones.noEncontrado ?? CONTRATO_NO_ENCONTRADO_MESSAGE)
  if (error.code === 'too_many_requests') return new ServiceError('too_many_requests', REENVIO_MUY_PRONTO_MESSAGE)
  if (error.code === 'server') return new ServiceError('server', opciones.generico ?? CONTRATO_ERROR_GENERICO_MESSAGE)
  if (error.code === 'network') return new ServiceError('network', CONTRATO_SIN_RED_MESSAGE)
  return error
}
