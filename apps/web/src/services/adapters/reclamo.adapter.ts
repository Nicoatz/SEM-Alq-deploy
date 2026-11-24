/**
 * reclamo.adapter.ts — traduce los DTO de `/api/v1/reclamos` a los tipos de vista
 * de Reclamos, y los errores del back al español de la pantalla (US-14 a US-18).
 *
 * Qué hace, campo por campo (verificado en real el 24/11, prueba de humo):
 * - `estado`: el back llama `pendiente` al estado "abierto" (`estado_reclamo.id = 1`).
 *   Un nombre desconocido se toma por el id (`id_estado_reclamo`).
 * - `codigo`: no existe en el back; se arma `RCL-<año>-<id con 4 dígitos>`
 *   (decisión del PO, 24/11).
 * - `titulo`: lo genera el back ("Reclamo: Reparación del inmueble"); no se
 *   muestra (decisión del PO: sin título visible).
 * - `locador` / `locatario`: nombre y apellido. TODO(db): sin foto de perfil.
 * - `enProcesoDesde` / `cerradoEl`: TODO(backend): el back no guarda la fecha
 *   de cada cambio de estado (`fecha_actualizacion` se pisa); quedan en `null`.
 *
 * Quién lo usa: `services/reclamos.service.ts` (rama real).
 */
import type { ClaimStatus, ReclamoResponse, TipoReclamo } from '@rentar/shared-types'
import { codigoReclamo, TIPOS_RECLAMO } from '@/lib/reclamos/catalogo'
import { RECLAMO_NO_ENCONTRADO_MESSAGE } from '@/lib/reclamos/reglas'
import type { PersonaReclamo, PropiedadParaReclamo, Reclamo, TipoReclamoVista } from '@/lib/reclamos/tipos'
import type { AlquilerLocatarioItemResponse } from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'
import { formatExactAddress } from './direccion'
import { barrioDe } from './propiedad.adapter'

// ─── Mensajes ───────────────────────────────────────────────────────────

/** Error genérico del registro (también el 500 de un mensaje de más de 1000 caracteres, brecha P0). */
export const RECLAMO_NO_REGISTRADO_MESSAGE = 'No pudimos registrar el reclamo. Probá de nuevo en unos minutos.'
/** Error genérico al leer reclamos. */
export const RECLAMOS_ERROR_GENERICO_MESSAGE = 'No pudimos cargar los reclamos. Probá de nuevo.'
/** 403 `SIN_CONTRATO_VIGENTE` del registro (US-14). */
export const RECLAMO_SIN_CONTRATO_MESSAGE = 'No tenés un contrato vigente para esa propiedad: no podés registrar un reclamo.'
/** Sin conexión con la API. */
export const RECLAMOS_SIN_RED_MESSAGE = 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.'
/** Una foto no es JPG/PNG o pesa más de 350 KB (la pantalla ya lo valida al cargarla). */
export const FOTO_RECLAMO_INVALIDA_MESSAGE = 'Una de las fotos no es JPG o PNG, o pesa más de 350 KB. Sacala y volvé a intentar.'
/** Storage rechazó una foto o no respondió. */
export const FOTOS_RECLAMO_NO_SUBIDAS_MESSAGE = 'No pudimos subir las fotos. Revisá tu conexión e intentá de nuevo: lo que escribiste sigue acá.'

// ─── Estados y tipos ────────────────────────────────────────────────────

/** Estado de la base → estado de la vista. `pendiente` es "abierto". */
const ESTADO_POR_NOMBRE: Record<string, ClaimStatus> = {
  pendiente: 'abierto',
  abierto: 'abierto',
  en_proceso: 'en_proceso',
  resuelto: 'resuelto',
  cancelado: 'cancelado',
}

/** Mismo mapeo por id (`estado_reclamo`: 1 pendiente, 2 en proceso, 3 resuelto, 4 cancelado). */
const ESTADO_POR_ID: Record<number, ClaimStatus> = { 1: 'abierto', 2: 'en_proceso', 3: 'resuelto', 4: 'cancelado' }

/**
 * Estado de un reclamo del back. Prioriza el id: con el filtro `?estado=` el
 * nombre puede llegar mal (brecha P0 de `GET /reclamos`).
 */
export function estadoDeReclamo(dto: Pick<ReclamoResponse, 'estado' | 'id_estado_reclamo'>): ClaimStatus {
  return ESTADO_POR_ID[dto.id_estado_reclamo] ?? ESTADO_POR_NOMBRE[dto.estado] ?? 'abierto'
}

/**
 * Catálogo del back (`GET /reclamos/tipos`) → tipos con el texto del diseño.
 * Un tipo que el front no conoce se muestra con la descripción del back.
 */
export function tiposDeReclamoDeDto(dtos: readonly TipoReclamo[]): TipoReclamoVista[] {
  return dtos.map((dto) => {
    const conocido = TIPOS_RECLAMO.find((tipo) => tipo.nombre === dto.nombre)
    return { id: dto.id, nombre: dto.nombre, label: conocido?.label ?? dto.descripcion, ayuda: conocido?.ayuda ?? '' }
  })
}

// ─── Reclamo ────────────────────────────────────────────────────────────

/** Persona del reclamo: nombre y apellido. */
function personaDeDto(persona: Pick<ReclamoResponse['locador'], 'id' | 'nombre' | 'apellido'>): PersonaReclamo {
  return { id: String(persona.id), nombre: [persona.nombre, persona.apellido].filter(Boolean).join(' '), fotoSrc: null }
}

/** Nombre del archivo en el bucket (lo último de la URL), para el texto alternativo. */
function nombreDeArchivo(url: string): string {
  return decodeURIComponent(url.split('/').pop() ?? 'foto')
}

/** `ReclamoResponse` → `Reclamo`. */
export function reclamoDeDto(dto: ReclamoResponse): Reclamo {
  return {
    id: String(dto.id),
    codigo: codigoReclamo(dto.id, dto.fecha_creacion),
    propiedad: {
      id: String(dto.inmueble.id),
      direccion: formatExactAddress(dto.inmueble.direccion, dto.inmueble.numero, dto.inmueble.piso),
      barrio: dto.inmueble.barrio ? barrioDe(dto.inmueble.barrio).name : null,
      fotoSrc: dto.inmueble.foto_principal ?? null,
    },
    locador: personaDeDto(dto.locador),
    locatario: personaDeDto(dto.locatario),
    tipo: dto.tipo_reclamo.nombre,
    estado: estadoDeReclamo(dto),
    mensaje: dto.descripcion,
    fotos: [...dto.fotos].sort((a, b) => a.orden - b.orden).map((foto) => ({ id: String(foto.id), src: foto.url, nombre: nombreDeArchivo(foto.url) })),
    creadoEl: dto.fecha_creacion,
    // TODO(backend): sin fecha del pasaje a en proceso ni del cierre (brecha 11 del issue).
    enProcesoDesde: null,
    cerradoEl: null,
    conversacionId: dto.id_conversacion === null ? null : String(dto.id_conversacion),
  }
}

/**
 * Un contrato vigente del locatario (`GET /alquileres-locatario`) → una opción
 * del selector de propiedad del registro (US-14).
 * NOTA: el back manda `codigo` como el id del contrato (`"17"`), no
 * `CT-AAAA-NNNN` (HANDOFF §7, US-27); se muestra tal cual.
 */
export function propiedadParaReclamoDeAlquiler(dto: AlquilerLocatarioItemResponse): PropiedadParaReclamo {
  return {
    id: String(dto.inmueble.id),
    direccion: formatExactAddress(dto.inmueble.direccion, dto.inmueble.numero, dto.inmueble.piso),
    barrio: dto.inmueble.barrio ? barrioDe(dto.inmueble.barrio).name : null,
    fotoSrc: dto.inmueble.foto_principal,
    contratoCodigo: dto.codigo || null,
    locadorNombre: [dto.locador.nombre, dto.locador.apellido].filter(Boolean).join(' '),
  }
}

// ─── Errores del back ───────────────────────────────────────────────────

/** Sin red o 5xx → texto propio: nunca se muestra un mensaje técnico. */
function sinTextoTecnico(error: ServiceError, generico: string): ServiceError {
  if (error.code === 'network') return new ServiceError('network', RECLAMOS_SIN_RED_MESSAGE)
  if (error.code === 'server') return new ServiceError('server', generico)
  return error
}

/**
 * Error de `GET /reclamos` y `GET /reclamos/tipos` (US-15).
 * - 403 (sin el rol que se pide) → lista vacía no; `forbidden` con el genérico,
 *   porque el rol sale del rol activo y no debería pasar.
 */
export function errorDeListarReclamos(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'forbidden' || error.code === 'validation') return new ServiceError('server', RECLAMOS_ERROR_GENERICO_MESSAGE)
  return sinTextoTecnico(error, RECLAMOS_ERROR_GENERICO_MESSAGE)
}

/**
 * Error de `GET /reclamos/:id` (US-15 a US-18).
 * - 400 (id inválido), 403 (no es una de las partes) y 404 → `not_found` con
 *   el mismo texto: un reclamo ajeno no se distingue de uno que no existe
 *   (decisión del PO, 24/11; el back responde 403, brecha P2).
 */
export function errorDeReclamo(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'validation' || error.code === 'forbidden' || error.code === 'not_found') {
    return new ServiceError('not_found', RECLAMO_NO_ENCONTRADO_MESSAGE, error.apiCode, error.status)
  }
  return sinTextoTecnico(error, RECLAMOS_ERROR_GENERICO_MESSAGE)
}

/** Textos de validación del back (`reclamo.service.ts` de `apps/api`) → los del formulario. */
const VALIDACIONES_DEL_BACK: readonly [string, string][] = [
  ['Debe seleccionar una propiedad', 'Elegí una propiedad.'],
  ['Debe seleccionar un tipo de reclamo', 'Elegí un tipo de reclamo.'],
  ['tipo de reclamo seleccionado no es válido', 'Elegí un tipo de reclamo.'],
  ['Debe redactar un mensaje', 'Contá qué pasa: el mensaje es obligatorio.'],
  ['entre 50 y 5000 caracteres', 'El mensaje tiene que tener entre 50 y 5000 caracteres.'],
  ['más de 10 imágenes', 'Podés adjuntar hasta 10 fotos.'],
  ['formato JPG o PNG', 'Las fotos tienen que ser JPG o PNG.'],
  ['350kb', 'Cada foto puede pesar hasta 350 KB.'],
]

/**
 * Error de `POST /reclamos` (US-14) → el que muestra el formulario.
 * - 400 → `validation` con el texto del formulario que corresponde.
 * - 403 `SIN_CONTRATO_VIGENTE` (o sin rol locatario) → `forbidden` con
 *   {@link RECLAMO_SIN_CONTRATO_MESSAGE}.
 * - 404 (la propiedad no existe) → `validation`: elegir otra.
 * - 5xx → {@link RECLAMO_NO_REGISTRADO_MESSAGE}. NOTA: un mensaje de 1001 a 5000
 *   caracteres hoy da 500 (`descripcion` es `VARCHAR(1000)`, brecha P0): el
 *   front no recorta y muestra este genérico (decisión del PO, 24/11).
 */
export function errorDeRegistrarReclamo(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'validation') {
    const traducido = VALIDACIONES_DEL_BACK.find(([texto]) => error.message.includes(texto))?.[1]
    return new ServiceError('validation', traducido ?? RECLAMO_NO_REGISTRADO_MESSAGE)
  }
  if (error.code === 'forbidden') return new ServiceError('forbidden', RECLAMO_SIN_CONTRATO_MESSAGE, error.apiCode)
  if (error.code === 'not_found') return new ServiceError('validation', 'Esa propiedad ya no está disponible. Elegí otra.')
  return sinTextoTecnico(error, RECLAMO_NO_REGISTRADO_MESSAGE)
}
