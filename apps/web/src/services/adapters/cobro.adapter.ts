/**
 * cobro.adapter.ts — traduce los DTO de cobros del back a los tipos de vista.
 *
 * Qué es: el mapeo campo por campo y la traducción de errores de US-08, US-09 y
 * US-10. Un dato que el back no manda se muestra vacío, nunca inventado.
 * De dónde saca los datos: `GET /cobros-locador`, `/cobros-locador/historial`,
 * `/cobros/:id` y `/cobros/:id/comprobante`.
 * Quién lo usa: la rama real de `services/cobros.service.ts`.
 */
import type {
  CobroCreado,
  CobroRegistrado,
  Comprobante,
  DetallePeriodo,
  EventoPeriodo,
  ParteComprobante,
  PeriodoFila,
  PeriodoRegistrable,
} from '@rentar/shared-types'
import type {
  CargoCobroResponse,
  CobroRegistradoResponse,
  ComprobantePagoResponse,
  DetalleCobroResponse,
  EventoPeriodoResponse,
  PeriodoCobroItemResponse,
  PeriodoCobroResumenResponse,
  PersonaComprobanteResponse,
  RegistrarCobroResponse,
} from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'

// ─── Mensajes ─────────────────────────────────────────────────────────

/** US-09: el mismo texto si el período no existe o es ajeno. */
export const COBRO_NO_ENCONTRADO_MESSAGE = 'No encontramos este cobro'

/** US-10: el mismo texto si el comprobante no existe o es ajeno. */
export const COMPROBANTE_NO_ENCONTRADO_MESSAGE = 'No encontramos este comprobante'

export const COBROS_ERROR_MESSAGE = 'No pudimos traer los cobros. Probá de nuevo.'
export const PERIODO_PAGADO_MESSAGE = 'Este período ya está pagado.'
export const PERIODO_FUTURO_MESSAGE = 'Todavía no se puede registrar un cobro de este período.'
export const CONTRATO_NO_VIGENTE_MESSAGE = 'Solo se pueden registrar cobros de contratos vigentes.'
export const ADJUNTO_GRANDE_MESSAGE = 'El comprobante es demasiado grande. Probá con un archivo más liviano.'
export const ADJUNTO_TIPO_MESSAGE = 'El comprobante tiene que ser PDF, JPG o PNG.'
export const REGISTRAR_ERROR_MESSAGE = 'No pudimos registrar el cobro. Probá de nuevo.'

// ─── Helpers ──────────────────────────────────────────────────────────

/** "Laprida 340" o "Obispo Trejo 1250, 7° B". */
function domicilioDe(propiedad: { direccion: string; numero: number; piso: string | null }): string {
  const calle = `${propiedad.direccion} ${propiedad.numero}`
  return propiedad.piso ? `${calle}, ${propiedad.piso}` : calle
}

/** Nombre y apellido; `null` si no hay persona. */
function nombreDe(persona: { nombre: string; apellido: string | null } | null | undefined): string | null {
  if (!persona) return null
  return [persona.nombre, persona.apellido].filter(Boolean).join(' ')
}

/**
 * Días de mora de un cargo.
 *
 * NOTA: el back los manda con tres nombres según el endpoint.
 * TODO(backend): unificarlos.
 */
function diasDeMora(cargo: CargoCobroResponse | undefined): number {
  return cargo?.dias_mora ?? cargo?.diasMora ?? cargo?.dias_interes ?? 0
}

/** Alquiler, mora y días de mora a partir de las líneas de cargos. */
function cargosDe(cargos: CargoCobroResponse[]): { alquiler: number; mora: number; diasMora: number } {
  const mora = cargos.find((cargo) => cargo.concepto === 'intereses_mora')
  return {
    alquiler: cargos.find((cargo) => cargo.concepto === 'alquiler')?.monto ?? 0,
    mora: mora?.monto ?? 0,
    diasMora: diasDeMora(mora),
  }
}

/** El id del cobro dentro de `comprobante_url`; `null` si no tiene. */
function cobroIdDeUrl(url: string | null): string | null {
  return url?.match(/\/cobros\/(\d+)\/comprobante/)?.[1] ?? null
}

// ─── Consultas ────────────────────────────────────────────────────────

/** Fila de `GET /cobros-locador/historial` → fila del listado. */
export function filaDeDto(dto: PeriodoCobroResumenResponse): PeriodoFila {
  return {
    id: String(dto.id_periodo),
    contratoId: String(dto.id_contrato),
    propiedadId: String(dto.propiedad.id),
    propiedad: domicilioDe(dto.propiedad),
    locatario: nombreDe(dto.locatario),
    periodo: dto.periodo.slice(0, 7),
    inicio: dto.fecha_inicio,
    vencimiento: dto.fecha_vencimiento,
    estado: dto.estado,
    monto: dto.estado === 'pagado' ? dto.total_cobrado : dto.monto_exigible,
    diasAtraso: dto.dias_atraso,
  }
}

/** Fila de `GET /cobros-locador` → período que se puede cobrar. */
export function registrableDeDto(dto: PeriodoCobroItemResponse): PeriodoRegistrable {
  return {
    id: String(dto.id_periodo),
    contratoId: String(dto.id_contrato),
    propiedadId: String(dto.inmueble.id),
    propiedad: domicilioDe(dto.inmueble),
    locatario: nombreDe(dto.locatario),
    periodo: dto.periodo.slice(0, 7),
    vencimiento: dto.fecha_vencimiento,
    alquiler: dto.monto_base_alquiler,
  }
}

/** Cobro del detalle → vista. */
function cobroDeDto(dto: CobroRegistradoResponse): CobroRegistrado {
  return {
    id: String(dto.id_cobro),
    numeroComprobante: dto.numero_comprobante,
    fecha: dto.fecha_cobro,
    monto: dto.monto,
    medio: dto.medio,
    nota: dto.nota,
    registradoPor: nombreDe(dto.usuario_registro),
    registradoEl: dto.created_at,
    adjuntoNombre: null,
    tieneAdjunto: dto.tiene_adjunto,
  }
}

/** Título de cada evento del historial. */
const TITULO_DE_EVENTO: Record<EventoPeriodoResponse['tipo'], string> = {
  periodo_generado: 'Período generado',
  cobro_registrado: 'Cobro registrado',
  periodo_pagado: 'Período pagado',
}

/** Evento del historial → vista. */
function eventoDeDto(dto: EventoPeriodoResponse, indice: number): EventoPeriodo {
  return {
    id: `${dto.tipo}-${indice}`,
    titulo: TITULO_DE_EVENTO[dto.tipo],
    fecha: dto.fecha_hora,
    quien: nombreDe(dto.usuario),
  }
}

/** `GET /cobros/:id` → detalle del período. */
export function detalleDeDto(dto: DetalleCobroResponse): DetallePeriodo {
  const cobros = dto.cobros.map(cobroDeDto)
  return {
    id: String(dto.id_periodo),
    contratoId: String(dto.id_contrato),
    contratoCodigo: dto.contrato.codigo,
    propiedadId: String(dto.propiedad.id),
    propiedad: domicilioDe(dto.propiedad),
    barrio: dto.propiedad.barrio,
    locadorId: String(dto.locador.id),
    locatario: nombreDe(dto.locatario),
    periodo: dto.periodo.periodo.slice(0, 7),
    inicio: dto.periodo.fecha_inicio,
    fin: dto.periodo.fecha_fin,
    vencimiento: dto.periodo.fecha_vencimiento,
    estado: dto.periodo.estado,
    ...cargosDe(dto.cargos),
    total: dto.periodo.estado === 'pagado' ? dto.total_cobrado : dto.total_exigible,
    cobros,
    cobrosDisponibles: true,
    comprobanteCobroId: cobros[0]?.id ?? null,
    historial: dto.historial.map(eventoDeDto),
  }
}

/**
 * Detalle armado con la fila del listado, cuando `GET /cobros/:id` da 500.
 *
 * NOTA (PO, 05/11): el detalle lee `periodo_cobro_evento`, que no existe hasta
 * aplicar la migración de US-09, y ese error tira abajo toda la respuesta. Esto
 * muestra lo que se sabe del período, sin cobros ni historial.
 * TODO(backend): sacarlo cuando se aplique la migración.
 */
export function detalleDeResumen(dto: PeriodoCobroResumenResponse): DetallePeriodo {
  return {
    id: String(dto.id_periodo),
    contratoId: String(dto.id_contrato),
    contratoCodigo: dto.codigo_contrato,
    propiedadId: String(dto.propiedad.id),
    propiedad: domicilioDe(dto.propiedad),
    barrio: dto.propiedad.barrio,
    locadorId: null,
    locatario: nombreDe(dto.locatario),
    periodo: dto.periodo.slice(0, 7),
    inicio: dto.fecha_inicio,
    fin: dto.fecha_fin,
    vencimiento: dto.fecha_vencimiento,
    estado: dto.estado,
    alquiler: dto.monto_base_alquiler,
    mora: dto.intereses_mora,
    diasMora: dto.dias_interes,
    total: dto.estado === 'pagado' ? dto.total_cobrado : dto.monto_exigible,
    cobros: [],
    cobrosDisponibles: false,
    comprobanteCobroId: cobroIdDeUrl(dto.comprobante_url),
    historial: null,
  }
}

/** Una persona del comprobante → vista. */
function parteDeDto(dto: PersonaComprobanteResponse): ParteComprobante {
  return {
    nombre: nombreDe(dto) ?? '',
    documento: dto.numero_documento,
    email: dto.email,
    telefono: dto.telefono,
  }
}

/**
 * `GET /cobros/:id/comprobante` → comprobante.
 *
 * NOTA: `total_en_letras` no se usa: el texto del back tiene errores (issue del
 * Sprint 4, punto 7). La hoja lo arma con `lib/cobros/montoEnLetras.ts`.
 */
export function comprobanteDeDto(dto: ComprobantePagoResponse): Comprobante {
  const { propiedad } = dto
  return {
    cobroId: String(dto.id_cobro),
    numero: dto.numero_comprobante,
    emitidoEl: dto.fecha_emision,
    locatario: parteDeDto(dto.locatario),
    locador: parteDeDto(dto.locador),
    domicilio: [domicilioDe(propiedad), propiedad.barrio, propiedad.ciudad].filter(Boolean).join(', '),
    contratoCodigo: dto.contrato.codigo,
    contratoInicio: dto.contrato.fecha_inicio,
    contratoFin: dto.contrato.fecha_fin,
    periodo: dto.periodo.periodo.slice(0, 7),
    periodoInicio: dto.periodo.fecha_inicio,
    periodoFin: dto.periodo.fecha_fin,
    vencimiento: dto.periodo.fecha_vencimiento,
    ...cargosDe(dto.cargos),
    total: dto.total_pagado,
    medio: dto.medio,
    fechaPago: dto.fecha_cobro,
  }
}

/** `POST /cobros-locador` → resultado. */
export function cobroCreadoDeDto(dto: RegistrarCobroResponse): CobroCreado {
  return {
    cobroId: String(dto.cobro_id),
    periodoId: String(dto.periodo_id),
    monto: dto.monto,
    numeroComprobante: dto.numero_comprobante,
  }
}

// ─── Errores ──────────────────────────────────────────────────────────

/**
 * Error de una consulta de período.
 * - 404 y 400 de id → "No encontramos este cobro" (US-09: sin distinguir).
 */
export function errorDePeriodo(error: unknown): unknown {
  if (error instanceof ServiceError && (error.code === 'not_found' || error.code === 'validation')) {
    return new ServiceError('not_found', COBRO_NO_ENCONTRADO_MESSAGE)
  }
  return error
}

/** Error del comprobante: 404 y 400 de id → "No encontramos este comprobante" (US-10). */
export function errorDeComprobante(error: unknown): unknown {
  if (error instanceof ServiceError && (error.code === 'not_found' || error.code === 'validation')) {
    return new ServiceError('not_found', COMPROBANTE_NO_ENCONTRADO_MESSAGE)
  }
  return error
}

/**
 * Error de `POST /cobros-locador`.
 *
 * NOTA: se distingue por el texto porque el back no manda `codigo`, y el
 * middleware pisa con 400 el 409 de `registrar_cobro_manual`. Multer manda el
 * archivo grande y el tipo inválido como 500.
 * TODO(backend): mandar `codigo` y los status correctos (issue, punto 8).
 */
export function errorDeRegistro(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'network' || error.code === 'unauthorized') return error

  const texto = error.message
  if (/file too large|superar los \d+ ?mb/i.test(texto)) return new ServiceError('validation', ADJUNTO_GRANDE_MESSAGE)
  if (/debe ser pdf/i.test(texto)) return new ServiceError('validation', ADJUNTO_TIPO_MESSAGE)
  if (/el per[ií]odo no existe|no pertenece al locador/i.test(texto)) {
    return new ServiceError('not_found', COBRO_NO_ENCONTRADO_MESSAGE)
  }
  if (/per[ií]odos futuros/i.test(texto)) return new ServiceError('conflict', PERIODO_FUTURO_MESSAGE)
  if (/no est[aá] disponible para registrar/i.test(texto)) return new ServiceError('conflict', PERIODO_PAGADO_MESSAGE)
  if (/contratos vigentes/i.test(texto)) return new ServiceError('conflict', CONTRATO_NO_VIGENTE_MESSAGE)
  if (error.code === 'validation') return error
  return new ServiceError(error.code, REGISTRAR_ERROR_MESSAGE)
}
