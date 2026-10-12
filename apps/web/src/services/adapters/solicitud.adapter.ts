/**
 * solicitud.adapter.ts — traduce las solicitudes del back al tipo de vista,
 * y el envío del modal al cuerpo que esperaría el back.
 *
 * Qué es: la frontera entre `SolicitudResponse` / `CrearSolicitudRequest`
 * (DTOs PROPUESTOS, en `shared/backend-dtos.ts`: el back todavía no tiene el
 * módulo) y `Solicitud` / `SolicitudNueva` (tipos de vista de
 * `@rentar/shared-types`).
 * Cubre: US-35 Enviar solicitud, US-36 Consultar, US-37 Aceptar o rechazar y
 * US-38 Cancelar (numeración de Jira).
 * Quién lo usa: la rama real de `services/solicitudes.service.ts`.
 */
import type { Solicitud, SolicitudNueva } from '@rentar/shared-types'
import type { ActorSolicitud } from '@/lib/validation/solicitud.rules'
import { PLACEHOLDER_PHOTO_SRC } from '@/lib/imagenes/fotoConRespaldo'
import type { CrearSolicitudRequest, SolicitudResponse } from '../shared/backend-dtos'
import { formatExactAddress } from './direccion'
import { barrioDe } from './propiedad.adapter'

/**
 * `SolicitudResponse` → `Solicitud`.
 *
 * `vista` dice quién la mira: `'locador'` (Solicitudes recibidas) o
 * `'postulante'` (Mis solicitudes, el detalle de la propiedad).
 *
 * Campo por campo:
 * - `property.address`: la EXACTA ("Rondeau 480, PB") para los dos (decisión
 *   del PO con la US-35 actualizada: con sesión se ve la exacta; reemplaza la
 *   regla de las tandas 1 y 2, en la que el postulante veía la aproximada).
 *   Las dos rutas piden sesión, así que siempre es la exacta.
 * - `applicant.dni`, `contact` y `legajo` (US-35 actualizada): solo en la
 *   vista del locador (`/recibidas`); para el postulante quedan sin definir.
 *   `null` si la solicitud no los trae ("Sin datos de legajo").
 * - `property.neighborhoodSlug` / `neighborhoodName`: `inmueble.barrio` (texto
 *   libre), con el slug del catálogo si lo tiene (`barrioDe`).
 * - `property.imageSrc`: `foto_principal`, o el placeholder si no tiene fotos.
 * - `applicant.fullName`: "Nombre Apellido".
 * - `message`: `null` si vino vacío.
 * - `respondedAt`: `fecha_respuesta` (TODO(backend): la columna no existe).
 */
export function solicitudResponseToSolicitud(dto: SolicitudResponse, vista: ActorSolicitud): Solicitud {
  const barrio = barrioDe(dto.inmueble.barrio)
  const { direccion, numero, piso } = dto.inmueble
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
      ...(vista === 'locador' ? { dni: dto.postulante.dni ?? null } : {}),
    },
    ...(vista === 'locador' ? datosParaElLocador(dto) : {}),
    message: dto.mensaje?.trim() ? dto.mensaje : null,
    status: dto.estado,
    createdAt: dto.fecha_creacion,
    respondedAt: dto.fecha_respuesta ?? null,
  }
}

/** Contacto y legajo de la respuesta (solo vista del locador). */
function datosParaElLocador(dto: SolicitudResponse): Pick<Solicitud, 'contact' | 'legajo'> {
  const { telefono, email } = dto.postulante
  const legajo = dto.legajo
  return {
    contact: telefono || email ? { phone: telefono ?? '', email: email ?? '' } : null,
    legajo: legajo
      ? {
          occupation: legajo.ocupacion,
          monthlyIncome: legajo.ingresos,
          residents: legajo.convivientes,
          hasPets: legajo.mascotas,
          petsDetail: legajo.detalle_mascotas,
          guarantees: legajo.garantias,
        }
      : null,
  }
}

/**
 * `SolicitudNueva` → cuerpo de `POST /solicitudes` (US-35 actualizada). El id
 * de la propiedad viaja como número (los ids del back son enteros; en el
 * front, texto). El mensaje ya llega normalizado (`null` si estaba vacío).
 * El nombre, el apellido y el DNI no viajan: salen del token.
 */
export function solicitudNuevaToCrearRequest(nueva: SolicitudNueva): CrearSolicitudRequest {
  return {
    id_inmueble: Number(nueva.propertyId),
    mensaje: nueva.message,
    telefono: nueva.contact.phone,
    email: nueva.contact.email.trim(),
    ocupacion: nueva.legajo.occupation,
    ingresos: nueva.legajo.monthlyIncome,
    convivientes: nueva.legajo.residents,
    mascotas: nueva.legajo.hasPets,
    detalle_mascotas: nueva.legajo.hasPets ? nueva.legajo.petsDetail : null,
    garantias: nueva.legajo.guarantees,
    acepta_condiciones: true,
  }
}
