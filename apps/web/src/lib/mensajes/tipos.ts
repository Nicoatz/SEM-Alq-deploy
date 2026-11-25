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

/** La otra persona de una conversación. */
export interface PersonaConversacion {
  id: string
  /** Nombre y apellido. */
  nombre: string
  /** TODO(db): sin foto de perfil en `usuario`; siempre `null` (se ven las iniciales). */
  fotoSrc: string | null
  /** Qué es en esta conversación: la otra punta del alquiler. */
  rol: 'locador' | 'locatario'
}

/** La propiedad de una conversación ("una conversación por persona y propiedad", decisión del PO). */
export interface PropiedadConversacion {
  id: string
  /**
   * "Obispo Trejo 1250, 7° B". `null` si el back no la manda: el listado de
   * conversaciones trae solo `id_inmueble` (brecha R-6) y la línea queda vacía.
   */
  direccion: string | null
  fotoSrc: string | null
}

/** Una conversación de Mensajes (US-24). Las de reclamos no llegan acá. */
export interface ConversacionVista {
  id: string
  otraPersona: PersonaConversacion
  propiedad: PropiedadConversacion | null
  /** El último mensaje, para la fila de la bandeja; `null` si todavía no hay. */
  ultimoMensaje: { contenido: string; enviadoEl: string; esPropio: boolean; eliminado: boolean } | null
  /** Fecha del último movimiento (el último mensaje o, sin mensajes, la creación). Ordena la bandeja. */
  actualizadaEl: string
}

/** A quién se le puede escribir desde "Nueva conversación". */
export interface DestinatarioConversacion {
  personaId: string
  nombre: string
  rol: 'locador' | 'locatario'
  propiedad: { id: string; direccion: string }
  /** "contrato vigente", "pendiente de firma". */
  detalle: string
}

/** Lo que necesita la bandeja para abrir una conversación nueva (o la que ya existe). */
export interface ConversacionNueva {
  destinatario: Pick<DestinatarioConversacion, 'personaId' | 'nombre' | 'rol'>
  propiedad: { id: string; direccion: string | null } | null
}
