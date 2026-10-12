/**
 * solicitud-mock.adapter.ts — traduce una solicitud del elenco mock al tipo
 * de vista.
 *
 * Qué es: el equivalente, en modo mock, de `solicitud.adapter.ts`. La
 * solicitud mock guarda solo el id de la propiedad; la dirección y la foto
 * salen de la propiedad del elenco.
 * Cubre: US-35 a US-38 (numeración de Jira).
 * Quién lo usa: la rama mock de `services/solicitudes.service.ts`.
 */
import type { Solicitud } from '@rentar/shared-types'
import type { PropiedadMock, SolicitudMock, UsuarioMock } from '@/lib/mocks'
import type { ActorSolicitud } from '@/lib/validation/solicitud.rules'
import { PLACEHOLDER_PHOTO_SRC } from '@/lib/imagenes/fotoConRespaldo'
import { formatAddress, mainPhotoSrc } from './propiedad-mock.adapter'

/**
 * `SolicitudMock` → `Solicitud`. Con las mismas reglas que la rama real
 * (`solicitud.adapter.ts#solicitudResponseToSolicitud`): dirección exacta
 * (con sesión, decisión del PO con la US-35 actualizada), placeholder si la
 * propiedad no tiene foto, y DNI, contacto y legajo solo en la vista del
 * locador (`vista`). `postulante` es la cuenta de quien la envió, para el DNI.
 * Las enviadas antes de esta tanda no tienen legajo: `null` ("Sin datos de
 * legajo").
 * `propiedad` es `null` si ya no existe (por ejemplo, se reiniciaron los
 * datos de prueba): la solicitud se muestra igual, sin dirección.
 */
export function solicitudMockToSolicitud(
  solicitud: SolicitudMock,
  propiedad: PropiedadMock | null,
  vista: ActorSolicitud,
  postulante: UsuarioMock | null = null,
): Solicitud {
  // La regla de la dirección está explicada en `solicitud.adapter.ts`.
  const address = propiedad ? formatAddress(propiedad) : ''
  const paraElLocador = vista === 'locador'
  return {
    id: solicitud.id,
    property: {
      id: solicitud.propertyId,
      address,
      neighborhoodSlug: propiedad?.neighborhoodSlug ?? '',
      neighborhoodName: propiedad?.neighborhoodName ?? '',
      imageSrc: (propiedad && mainPhotoSrc(propiedad)) || PLACEHOLDER_PHOTO_SRC,
    },
    applicant: {
      id: solicitud.applicantUserId,
      fullName: solicitud.applicantName,
      ...(paraElLocador ? { dni: postulante?.dni ?? null } : {}),
    },
    ...(paraElLocador ? { contact: solicitud.contact ?? null, legajo: solicitud.legajo ?? null } : {}),
    message: solicitud.message,
    status: solicitud.status,
    createdAt: solicitud.createdAt,
    // `?? null`: las enviadas en el navegador antes de la tanda 2 no tienen el campo.
    respondedAt: solicitud.respondedAt ?? null,
  }
}
