/**
 * estadoAccion.ts — qué muestra el botón "Solicitar alquiler" del detalle.
 *
 * Qué es: la regla que elige uno de los estados del botón (Detalle de
 * propiedad · 02, "Los cuatro estados del botón"), separada de la pantalla
 * para que se pueda leer y probar sola. Más "propia", que el diseño no
 * dibuja y aprobó el PO.
 * Cubre: US-41 Consultar detalle de propiedad y US-35 Enviar solicitud
 * (numeración de Jira).
 * Quién lo usa: `DetallePropiedad`, `AccionSolicitar` y `BarraAccionMovil`.
 */
import type { PropiedadDetalle, Solicitud, UsuarioSesion } from '@rentar/shared-types'
import { esSolicitudActiva } from '@/lib/validation/solicitud.rules'

/** Los estados del botón, cada uno con lo que necesita para dibujarse. */
export type EstadoAccion =
  /** Todavía se resuelve la sesión o "mi solicitud": el botón no se muestra. */
  | { tipo: 'cargando' }
  /** Sin sesión: "Ingresar para solicitar" lleva a `/login` y al volver se abre el modal (US-35). */
  | { tipo: 'sin_sesion' }
  /** Con sesión y disponible: "Solicitar alquiler" abre el modal. */
  | { tipo: 'puede_solicitar' }
  /** Ya tiene una solicitud pendiente o aceptada: se muestra su estado y el link a Mis solicitudes. */
  | { tipo: 'ya_solicitada'; solicitud: Solicitud }
  /** Es el dueño: "Es tu publicación" (deshabilitado) y el link a Mis propiedades. */
  | { tipo: 'propia' }
  /** Alquilada sin fecha o pausada: "Ya no está disponible" y el atajo al barrio. */
  | { tipo: 'no_disponible' }

/** Lo que hace falta para decidir el estado. */
interface DatosEstadoAccion {
  propiedad: PropiedadDetalle
  /** `undefined` mientras el `AuthProvider` resuelve la sesión. */
  usuario: UsuarioSesion | null | undefined
  /** `undefined` mientras se pide; `null` si nunca la solicitó. */
  miSolicitud: Solicitud | null | undefined
}

/**
 * Elige el estado del botón. El orden importa:
 * 1. Propia: el dueño nunca ve "Solicitar alquiler" (aunque esté alquilada).
 * 2. Ya solicitada: si la persona tiene una solicitud viva, ve su estado aunque
 *    la propiedad ya no esté disponible (es lo que le interesa).
 * 3. No disponible.
 * 4. Sin sesión.
 * 5. Puede solicitar.
 *
 * NOTA: con el back real `owner` llega en `null` (TODO(backend) en el
 * adaptador): el front no puede detectar "propia" y muestra "Solicitar
 * alquiler"; el back tiene que rechazar esa solicitud (403).
 * NOTA: una solicitud `rechazada` o `cancelada` no bloquea una nueva
 * (`esSolicitudActiva`): en ese caso se puede volver a solicitar.
 */
export function estadoAccion({ propiedad, usuario, miSolicitud }: DatosEstadoAccion): EstadoAccion {
  if (usuario === undefined) return { tipo: 'cargando' }
  if (usuario && propiedad.owner && propiedad.owner.id === usuario.id) return { tipo: 'propia' }
  if (usuario && miSolicitud === undefined) return { tipo: 'cargando' }
  if (miSolicitud && esSolicitudActiva(miSolicitud.status)) return { tipo: 'ya_solicitada', solicitud: miSolicitud }
  if (propiedad.availability === 'no_disponible') return { tipo: 'no_disponible' }
  if (!usuario) return { tipo: 'sin_sesion' }
  return { tipo: 'puede_solicitar' }
}

/** Parámetro de la URL que pide abrir el modal al volver del login (`/propiedad/[id]?solicitar=1`). */
export const PARAM_SOLICITAR = 'solicitar'

/** `/login?next=/propiedad/[id]?solicitar=1`: el login vuelve acá y la página abre el modal. */
export function hrefLoginParaSolicitar(propiedadId: string): string {
  const vuelta = `/propiedad/${encodeURIComponent(propiedadId)}?${PARAM_SOLICITAR}=1`
  return `/login?next=${encodeURIComponent(vuelta)}`
}
