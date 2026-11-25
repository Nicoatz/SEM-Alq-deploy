/**
 * tipos.ts — los tipos de vista de la mensajería (US-24 y el chat del reclamo, US-18).
 *
 * Qué es: lo que usa `ConversacionChat`, igual en Mensajes y en el detalle de un
 * reclamo (decisión del PO del 24/11: "por debajo, el chat de un reclamo también
 * es una conversación": mismo modelo, mismo componente y mismas reglas). Los
 * adaptadores traducen a esto el `MensajeResponse` del back y el elenco de
 * `lib/mocks/mensajes.mock.ts`.
 *
 * Quién lo usa: `lib/mensajes/*`, `services/mensajes.service.ts`, `services/reclamos.service.ts`
 * y `components/mensajes/*`.
 */

/** Un mensaje de una conversación. */
export interface MensajeChat {
  id: string
  conversacionId: string
  emisorId: string
  /** Nombre y apellido de quien lo mandó. */
  emisorNombre: string
  /** El texto; vacío si se eliminó (no se muestra lo que decía). */
  contenido: string
  /** Fecha y hora ISO de envío (US-24: "con precisión de minutos"). */
  enviadoEl: string
  /** Fecha y hora ISO en que se eliminó; `null` si sigue (US-24: "Mensaje eliminado" con la hora). */
  eliminadoEl: string | null
  /** `true` si lo mandó el usuario en sesión (solo esos se pueden eliminar). */
  esPropio: boolean
}

/** Una línea del sistema dentro del chat (ej. "Nicolás respondió · el reclamo pasó a en proceso"). */
export interface EventoChat {
  id: string
  /** Fecha y hora ISO, para ordenarla entre los mensajes. */
  fecha: string
  texto: string
}
