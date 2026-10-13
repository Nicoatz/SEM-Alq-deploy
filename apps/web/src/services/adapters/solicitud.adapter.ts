/**
 * solicitud.adapter.ts — traduce las solicitudes del back al tipo de vista,
 * el envío del modal al cuerpo que espera el back, y los errores del back a
 * los mensajes del front.
 *
 * Qué es: la frontera entre los DTOs de `apps/api/src/dtos/solicitud.dto.ts`
 * (copiados en `shared/backend-dtos.ts`) y `Solicitud` / `SolicitudNueva`
 * (tipos de vista de `@rentar/shared-types`).
 * Cubre: US-35 Enviar solicitud, US-36 Consultar, US-37 Aceptar o rechazar y
 * US-38 Cancelar (numeración de Jira).
 * Quién lo usa: la rama real de `services/solicitudes.service.ts` (y los
 * mensajes, también la rama mock).
 *
 * NOTA: los errores del back se traducen ACÁ, nunca en los componentes. El back
 * mezcla voseo y tuteo ("No puedes…") y en un 5xx manda el texto crudo de
 * Supabase (brechas anotadas en HANDOFF §7): solo pasa tal cual un texto que
 * está en la lista de {@link TEXTOS_DEL_BACK_QUE_PASAN}.
 */
import type { EstadoSolicitud, GarantiaOfrecida, PreparacionSolicitud, Solicitud, SolicitudNueva } from '@rentar/shared-types'
import { PLACEHOLDER_PHOTO_SRC } from '@/lib/imagenes/fotoConRespaldo'
import { MENSAJES_SOLICITUD, SOLICITUD_MENSAJE_LARGO_MESSAGE } from '@/lib/validation/solicitud.rules'
import type { CrearSolicitudRequest, SolicitudPreparacionResponse, SolicitudResponse } from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'
import { formatExactAddress } from './direccion'
import { barrioDe } from './propiedad.adapter'

// ─── Mensajes ───────────────────────────────────────────────────────────

/** 409: ya hay una solicitud pendiente o aceptada de esta persona para esta propiedad. */
export const SOLICITUD_DUPLICADA_MESSAGE = 'Ya habías enviado una solicitud para esta propiedad.'

/** La propiedad se alquiló o se pausó (Detalle de propiedad · 02, "Ya no está disponible"). */
export const PROPIEDAD_NO_SOLICITABLE_MESSAGE = 'Esta propiedad ya no recibe solicitudes.'

/** La propiedad no existe (o el id no es válido). */
export const PUBLICACION_NO_DISPONIBLE_MESSAGE = 'Esta publicación ya no está disponible.'

/** El dueño intentó solicitar su propia publicación. */
export const SOLICITUD_PROPIA_MESSAGE = 'No podés solicitar tu propia publicación.'

/** 409: la solicitud cambió de estado mientras se miraba (ej. el postulante la canceló). */
export const SOLICITUD_YA_NO_PENDIENTE_MESSAGE = 'Esta solicitud ya no está pendiente.'

/** 409: el locador quiso cancelar una que ya no está aceptada. */
export const SOLICITUD_YA_NO_ACEPTADA_MESSAGE = 'Esta solicitud ya no está aceptada.'

/** No se encontró la solicitud (o no es de quien la pide). */
export const SOLICITUD_NO_ENCONTRADA_MESSAGE = 'No encontramos esa solicitud.'

/** 403 en una lista: la cuenta no tiene el rol que pide la ruta. */
export const SOLICITUDES_SIN_PERMISO_MESSAGE = 'No tenés permiso para ver estas solicitudes.'

/** Un error del servidor, o un texto del back que no se puede mostrar (técnico o en tuteo). */
export const SOLICITUD_ERROR_GENERICO_MESSAGE = 'Ocurrió un error inesperado. Probá de nuevo.'

// ─── Estados y vistas ───────────────────────────────────────────────────

/**
 * Quién mira la solicitud y cuánto ve:
 * - `'postulante'`: Mis solicitudes y el botón del detalle de la propiedad.
 *   Sin DNI, contacto ni legajo (aunque el back los mande, HANDOFF §7).
 * - `'locador-lista'`: la lista de Solicitudes recibidas. Tampoco los lleva:
 *   los datos sensibles van solo en el detalle del postulante.
 * - `'locador-detalle'`: el detalle del postulante. Lleva DNI, contacto y legajo.
 */
export type VistaSolicitud = 'postulante' | 'locador-lista' | 'locador-detalle'

const ESTADOS_SOLICITUD: readonly EstadoSolicitud[] = ['pendiente', 'aceptada', 'rechazada', 'cancelada']

/** `estado` del back → `EstadoSolicitud`, o `null` si llega uno que el front no conoce. */
function estadoDeSolicitud(estado: string): EstadoSolicitud | null {
  return ESTADOS_SOLICITUD.find((item) => item === estado) ?? null
}

/** El teléfono que manda el back (solo dígitos) → E.164, con el "+". */
function telefonoE164(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '')
  return digitos ? `+${digitos}` : ''
}

// ─── Respuestas → vista ─────────────────────────────────────────────────

/**
 * `SolicitudResponse` → `Solicitud`, para las respuestas de UN elemento
 * (`POST`, aceptar, rechazar y cancelar).
 *
 * Campo por campo:
 * - `property.address`: la EXACTA ("Rondeau 480, PB") en todas las vistas
 *   (decisión del PO con la US-35 actualizada: con sesión se ve la exacta).
 * - `applicant.dni`, `contact` y `legajo`: solo en `'locador-detalle'`
 *   (ver {@link VistaSolicitud}); en las otras vistas quedan sin definir.
 * - `contact.phone`: el back lo manda sin el "+"; acá vuelve a E.164.
 * - `legajo.monthlyIncome`: `null` ("no informa") → 0, la convención del front.
 * - `property.neighborhoodSlug` / `neighborhoodName`: `inmueble.barrio` (texto
 *   libre), con el slug del catálogo si lo tiene (`barrioDe`).
 * - `property.imageSrc`: `foto_principal`, o el placeholder si no tiene fotos.
 * - `applicant.fullName`: "Nombre Apellido".
 * - `message`: `null` si vino vacío.
 * - `mensaje_rechazo`: no se usa (sin motivo de rechazo, decisión del PO).
 *
 * @throws {ServiceError} `server` si el estado no es uno de los cuatro conocidos.
 */
export function solicitudResponseToSolicitud(dto: SolicitudResponse, vista: VistaSolicitud): Solicitud {
  const status = estadoDeSolicitud(dto.estado)
  if (!status) throw new ServiceError('server', SOLICITUD_ERROR_GENERICO_MESSAGE)
  return aVista(dto, status, vista)
}

/**
 * Lista de `SolicitudResponse` → `Solicitud[]` (`/mias` y `/recibidas`).
 * NOTA: una fila con un estado que el front no conoce se descarta (no rompe
 * toda la lista) y se avisa en la consola solo con el id y el estado, sin
 * datos personales.
 */
export function solicitudesResponseToSolicitudes(dtos: SolicitudResponse[], vista: VistaSolicitud): Solicitud[] {
  return dtos.flatMap((dto) => {
    const status = estadoDeSolicitud(dto.estado)
    if (!status) {
      console.warn(`[solicitudes] Se descartó la solicitud ${dto.id}: estado desconocido "${dto.estado}".`)
      return []
    }
    return [aVista(dto, status, vista)]
  })
}

/** El armado común de {@link solicitudResponseToSolicitud} y {@link solicitudesResponseToSolicitudes}. */
function aVista(dto: SolicitudResponse, status: EstadoSolicitud, vista: VistaSolicitud): Solicitud {
  const barrio = barrioDe(dto.inmueble.barrio)
  const { direccion, numero, piso } = dto.inmueble
  const conDatosSensibles = vista === 'locador-detalle'
  return {
    id: String(dto.id),
    property: {
      id: String(dto.inmueble.id),
      address: formatExactAddress(direccion, numero, piso),
      neighborhoodSlug: barrio.slug,
      neighborhoodName: barrio.name,
      imageSrc: dto.inmueble.foto_principal ?? PLACEHOLDER_PHOTO_SRC,
    },
    applicant: {
      id: String(dto.postulante.id),
      fullName: [dto.postulante.nombre, dto.postulante.apellido].filter(Boolean).join(' '),
      ...(conDatosSensibles ? { dni: dto.postulante.dni ?? null } : {}),
    },
    ...(conDatosSensibles ? datosSensibles(dto) : {}),
    message: dto.mensaje?.trim() ? dto.mensaje : null,
    status,
    createdAt: dto.fecha_creacion,
    respondedAt: dto.fecha_respuesta ?? null,
  }
}

/** Contacto y legajo de la respuesta (solo en el detalle del postulante). */
function datosSensibles(dto: SolicitudResponse): Pick<Solicitud, 'contact' | 'legajo'> {
  const { telefono, email } = dto.postulante
  const legajo = dto.legajo
  return {
    contact: telefono || email ? { phone: telefono ? telefonoE164(telefono) : '', email: email ?? '' } : null,
    legajo: legajo
      ? {
          occupation: legajo.ocupacion,
          monthlyIncome: legajo.ingresos ?? 0,
          residents: legajo.convivientes,
          hasPets: legajo.mascotas,
          petsDetail: legajo.detalle_mascotas,
          guarantees: legajo.garantias,
        }
      : null,
  }
}

// ─── Precarga del modal ─────────────────────────────────────────────────

/**
 * `SolicitudPreparacionResponse` → `PreparacionSolicitud` (US-35).
 * - `perfil`: el `usuario` del back. El apellido vacío queda `''`; el DNI y
 *   el teléfono, `null` si no los tiene. El teléfono llega sin el "+": lo
 *   arregla `telefonoParaPrecargar` en el formulario.
 * - `garantiasExigidas`: los ids de `garantias_exigidas`, traducidos con el
 *   catálogo `garantias` que viene en la misma respuesta.
 *   TODO(db): hoy llega siempre vacío (el esquema no guarda las exigidas).
 * - `situaciones_ocupacionales` y `valores_iniciales` no se usan: el front
 *   tiene sus etiquetas y sus valores por defecto (los mismos que el back).
 */
export function preparacionResponseToPreparacion(dto: SolicitudPreparacionResponse): PreparacionSolicitud {
  const { usuario } = dto
  const garantiasExigidas = dto.garantias_exigidas.flatMap((id): GarantiaOfrecida[] => {
    const garantia = dto.garantias.find((item) => item.id === id)
    return garantia ? [garantia.codigo] : []
  })
  return {
    perfil: {
      nombre: usuario.nombre,
      apellido: usuario.apellido ?? '',
      dni: usuario.dni || null,
      telefono: usuario.telefono || null,
      email: usuario.email,
    },
    garantiasExigidas,
  }
}

// ─── Vista → cuerpo del POST ────────────────────────────────────────────

/**
 * `SolicitudNueva` → cuerpo de `POST /solicitudes` (US-35 actualizada). El id
 * de la propiedad viaja como número (los ids del back son enteros; en el
 * front, texto). El mensaje ya llega normalizado (`null` si estaba vacío).
 * Los ingresos en 0 ("no informa", convención del front) viajan como `null`,
 * que es lo que espera el back. El nombre, el apellido y el DNI no viajan:
 * salen del token.
 */
export function solicitudNuevaToCrearRequest(nueva: SolicitudNueva): CrearSolicitudRequest {
  return {
    id_inmueble: Number(nueva.propertyId),
    mensaje: nueva.message,
    telefono: nueva.contact.phone,
    email: nueva.contact.email.trim(),
    ocupacion: nueva.legajo.occupation,
    ingresos: nueva.legajo.monthlyIncome > 0 ? nueva.legajo.monthlyIncome : null,
    convivientes: nueva.legajo.residents,
    mascotas: nueva.legajo.hasPets,
    detalle_mascotas: nueva.legajo.hasPets ? nueva.legajo.petsDetail : null,
    garantias: nueva.legajo.guarantees,
    acepta_condiciones: true,
  }
}

// ─── Errores del back → mensajes del front ──────────────────────────────

/**
 * Los 400 de `POST /solicitudes` que repiten una regla del front: se
 * muestran con el texto de `MENSAJES_SOLICITUD` (el mismo que muestra el
 * formulario). La clave es un fragmento del texto del back
 * (`apps/api/src/services/solicitud.service.ts`, `create`).
 */
const TEXTOS_DEL_BACK_CON_REGLA_DEL_FRONT: readonly [fragmento: string, mensaje: string][] = [
  ['El mensaje no puede superar', SOLICITUD_MENSAJE_LARGO_MESSAGE],
  ['El teléfono debe tener formato internacional', MENSAJES_SOLICITUD.telefonoLargo],
  ['El email ingresado no tiene un formato válido', MENSAJES_SOLICITUD.emailInvalido],
  ['Los ingresos aproximados deben ser', MENSAJES_SOLICITUD.ingresosInvalidos],
  ['La cantidad de personas debe ser', MENSAJES_SOLICITUD.convivientesMinimo],
  ['El detalle de mascotas no puede superar', MENSAJES_SOLICITUD.mascotasLargo],
  ['Debés aceptar lo que implica', MENSAJES_SOLICITUD.aceptacion],
]

/**
 * Los textos del back que se pueden mostrar tal cual: en voseo, sin detalles
 * técnicos, y sin regla equivalente en el front. Cualquier otro texto (en
 * tuteo, técnico o de Postgres) pasa a {@link SOLICITUD_ERROR_GENERICO_MESSAGE}.
 */
const TEXTOS_DEL_BACK_QUE_PASAN: readonly string[] = ['Debés indicar información sobre las mascotas si marcaste que poseés mascotas.']

/** Un 400 del back → el mensaje que se muestra (P7 de la tanda 5). */
function mensajeDeValidacion(textoDelBack: string): string {
  const conRegla = TEXTOS_DEL_BACK_CON_REGLA_DEL_FRONT.find(([fragmento]) => textoDelBack.includes(fragmento))
  if (conRegla) return conRegla[1]
  return TEXTOS_DEL_BACK_QUE_PASAN.includes(textoDelBack) ? textoDelBack : SOLICITUD_ERROR_GENERICO_MESSAGE
}

/** Un 5xx (o `success: false` con 200) → el genérico: el back manda el texto crudo de Supabase (HANDOFF §7). */
function sinTextoTecnico(error: ServiceError): ServiceError {
  return error.code === 'server' ? new ServiceError('server', SOLICITUD_ERROR_GENERICO_MESSAGE) : error
}

/**
 * Error de `POST /api/v1/solicitudes` (US-35) → el que muestra el modal.
 * - 400 → `validation`, con el texto de la regla del front si coincide.
 * - 403 → `forbidden` con {@link SOLICITUD_PROPIA_MESSAGE} (es su propiedad).
 * - 404 → `not_found` con {@link PUBLICACION_NO_DISPONIBLE_MESSAGE}.
 * - 409 → `conflict` con {@link SOLICITUD_DUPLICADA_MESSAGE}: el back lo
 *   responde si ya tiene una pendiente o aceptada para esa propiedad.
 * - 401 ya llega con "Tu sesión venció" (`apiClient`); `network` pasa igual.
 */
export function errorDeEnviarSolicitud(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'validation') return new ServiceError('validation', mensajeDeValidacion(error.message))
  if (error.code === 'forbidden') return new ServiceError('forbidden', SOLICITUD_PROPIA_MESSAGE)
  if (error.code === 'not_found') return new ServiceError('not_found', PUBLICACION_NO_DISPONIBLE_MESSAGE)
  if (error.code === 'conflict') return new ServiceError('conflict', SOLICITUD_DUPLICADA_MESSAGE)
  return sinTextoTecnico(error)
}

/**
 * Error de `GET /api/v1/solicitudes/preparar` (US-35) → el que muestra el modal
 * antes del formulario.
 * - 403 → `forbidden` con {@link SOLICITUD_PROPIA_MESSAGE}.
 * - 404, y el 400 de un id inválido → `not_found` con {@link PUBLICACION_NO_DISPONIBLE_MESSAGE}.
 * - 409 → `validation` con {@link PROPIEDAD_NO_SOLICITABLE_MESSAGE}. NOTA: a
 *   propósito NO es `conflict`: el modal entiende `conflict` como "ya la
 *   habías solicitado", y este 409 es "la propiedad ya no recibe solicitudes".
 * - 401 ya llega con "Tu sesión venció" (también el "No se encontró el perfil" del back).
 */
export function errorDePrepararSolicitud(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'forbidden') return new ServiceError('forbidden', SOLICITUD_PROPIA_MESSAGE)
  if (error.code === 'not_found' || error.code === 'validation') return new ServiceError('not_found', PUBLICACION_NO_DISPONIBLE_MESSAGE)
  if (error.code === 'conflict') return new ServiceError('validation', PROPIEDAD_NO_SOLICITABLE_MESSAGE)
  return sinTextoTecnico(error)
}

/**
 * Error de `PATCH /api/v1/solicitudes/:id/aceptar | rechazar | cancelar`
 * (US-37 y US-38) → el que muestra el modal de confirmación.
 * - 403 y 404 → `not_found` con {@link SOLICITUD_NO_ENCONTRADA_MESSAGE}.
 *   NOTA: el back responde 404 si la solicitud no es de quien llama (también
 *   cuando el locador quiere cancelar una aceptada, brecha 1 de HANDOFF §7) y
 *   403 si no tiene el rol locador. Se muestran igual, como en propiedades.
 * - 409 → `conflict` con {@link SOLICITUD_YA_NO_PENDIENTE_MESSAGE}: el back
 *   solo cambia solicitudes pendientes.
 * - 400 (id inválido) y 5xx → `server` con el genérico.
 */
export function errorDeAccionSolicitud(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'forbidden' || error.code === 'not_found') return new ServiceError('not_found', SOLICITUD_NO_ENCONTRADA_MESSAGE)
  if (error.code === 'conflict') return new ServiceError('conflict', SOLICITUD_YA_NO_PENDIENTE_MESSAGE)
  if (error.code === 'validation') return new ServiceError('server', SOLICITUD_ERROR_GENERICO_MESSAGE)
  return sinTextoTecnico(error)
}

/**
 * Error de `GET /api/v1/solicitudes/mias` y `/recibidas` (US-36).
 * - 400 (filtro inválido: es un error del front, no de quien usa la app) y
 *   5xx → `server` con el genérico.
 * - 403 (`/recibidas` sin rol locador) → `forbidden` con {@link SOLICITUDES_SIN_PERMISO_MESSAGE}.
 */
export function errorDeListarSolicitudes(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'validation') return new ServiceError('server', SOLICITUD_ERROR_GENERICO_MESSAGE)
  if (error.code === 'forbidden') return new ServiceError('forbidden', SOLICITUDES_SIN_PERMISO_MESSAGE)
  return sinTextoTecnico(error)
}
