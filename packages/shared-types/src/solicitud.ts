/**
 * solicitud.ts — solicitudes de alquiler tal como las muestra el frontend.
 *
 * Qué es: TIPOS DE VISTA DEL FRONT. El back todavía no tiene el módulo de
 * solicitudes (ni tabla ni rutas): cuando exista, el adaptador
 * `apps/web/src/services/adapters/solicitud.adapter.ts` traduce su DTO a
 * estos tipos, y las pantallas no cambian.
 * Cubre: US-35 Enviar solicitud de alquiler, US-36 Consultar solicitudes,
 * US-37 Aceptar o rechazar y US-38 Cancelar solicitud (numeración de Jira).
 *
 * Quién lo usa: `services/solicitudes.service.ts`, el detalle público de la
 * propiedad (`/propiedad/[id]`) y, desde la tanda 2 del Sprint 2,
 * `/panel/mis-solicitudes` y `/panel/solicitudes`.
 */
import type { SolicitudStatus } from './status'

/**
 * Estado de una solicitud: `pendiente`, `aceptada`, `rechazada` o `cancelada`.
 * Alias de {@link SolicitudStatus} (el tipo que entiende `StatusTag`), con el
 * nombre en castellano que usan los services y las pantallas.
 * NOTA: US-36 dice "en espera"; acá es `pendiente` (así lo muestra el diseño
 * y el `StatusTag` del dominio `solicitud`).
 */
export type EstadoSolicitud = SolicitudStatus

/**
 * Situación ocupacional del postulante (US-35 actualizada: "-, relación de
 * dependencia, monotributista, autónoma, estudiante, jubilada").
 * `sin_informar` es el "-" de la US ("prefiero no decirlo") y es el valor
 * por defecto.
 */
export type OcupacionPostulante = 'sin_informar' | 'relacion_dependencia' | 'monotributista' | 'autonoma' | 'estudiante' | 'jubilada'

/** Garantía que ofrece el postulante o que exige el locador (US-35: "garantía propietaria, seguro de caución, otra"). */
export type GarantiaOfrecida = 'propietaria' | 'caucion' | 'otra'

/**
 * Datos de contacto que el postulante incluye en la solicitud (US-35: "se
 * puede modificar el teléfono e email a incluir en la solicitud"). Se
 * precargan del perfil pero viajan con la solicitud: editarlos acá NO
 * cambia el perfil (decisión del PO).
 */
export interface ContactoSolicitud {
  /**
   * Teléfono en su forma canónica E.164 (US-35): "+" + código de país +
   * número nacional, sin espacios, de 10 a 15 dígitos. Ej. "+543515550103".
   * Para mostrarlo con espacios (E.123), `formatoE123` de
   * `apps/web/src/lib/validation/solicitud.rules.ts`.
   */
  phone: string
  email: string
}

/**
 * El "legajo" de la solicitud: lo que el postulante cuenta de su situación
 * (US-35 actualizada). Lo ve solo el dueño de la propiedad, en el detalle
 * del postulante (nunca en listados).
 */
export interface LegajoSolicitud {
  occupation: OcupacionPostulante
  /**
   * Ingresos aproximados por mes, en pesos, entero. `0` = no los informa
   * (el valor por defecto; decisión del PO ante "mayor a 0" y "0 por
   * defecto" de la US, ver HANDOFF §7).
   */
  monthlyIncome: number
  /** Personas que van a vivir en la propiedad, incluido el postulante (US-35: mínimo 1). */
  residents: number
  /** Si tiene mascotas (US-35: "No" por defecto). */
  hasPets: boolean
  /** Detalle de las mascotas; solo si `hasPets` (US-35). `null` si no hay. */
  petsDetail: string | null
  /** Garantías que puede ofrecer (US-35: puede marcar varias). */
  guarantees: GarantiaOfrecida[]
}

/**
 * Una solicitud de alquiler, vista por quien la envió (US-36: dirección de la
 * propiedad) o por el locador que la recibe (US-36: nombre y apellido del
 * postulante). Las dos vistas comparten el tipo.
 */
export interface Solicitud {
  /** Id de la solicitud, ej. `SOL-2026-0031` en modo mock. */
  id: string
  property: {
    id: string
    /**
     * Dirección de la propiedad (US-36: la ve el locatario). Depende de quién
     * mira: EXACTA para el locador en Solicitudes recibidas ("Rondeau 480,
     * PB": es su propia propiedad) y APROXIMADA para el postulante en Mis
     * solicitudes ("Rondeau al 400"), igual que en la zona pública.
     */
    address: string
    /** Slug del barrio, para el atajo "Ver propiedades en <barrio>" (ej. `guemes`); `''` si no se conoce. */
    neighborhoodSlug: string
    /** Nombre visible del barrio (US-36), ej. "Güemes"; `''` si no se conoce. */
    neighborhoodName: string
    /** Foto principal (US-36: "la imagen principal de la propiedad"). */
    imageSrc: string
  }
  applicant: {
    id: string
    /** Nombre y apellido de quien la envió (US-36: lo ve el locador). */
    fullName: string
    /**
     * DNI del postulante (US-35). Solo en la vista del locador
     * (`/recibidas`); `null` si no se conoce. Dato sensible: solo en el
     * detalle del postulante, nunca en listados.
     */
    dni?: string | null
  }
  /**
   * Contacto que incluyó en la solicitud (US-35). Solo en la vista del
   * locador; `null` = la solicitud no lo trae (las enviadas antes de la US-35
   * actualizada).
   */
  contact?: ContactoSolicitud | null
  /**
   * Legajo de la solicitud (US-35). Solo en la vista del locador; `null` =
   * "Sin datos de legajo" (las enviadas antes de la US-35 actualizada).
   */
  legajo?: LegajoSolicitud | null
  /** Mensaje opcional al locador (US-35 actualizada: hasta 600 caracteres, ver `SOLICITUD_MENSAJE_MAX` en `apps/web/src/lib/validation/solicitud.rules.ts`); `null` si no escribió nada. */
  message: string | null
  status: EstadoSolicitud
  /** Fecha y hora ISO de envío. */
  createdAt: string
  /**
   * Fecha y hora ISO en que dejó de estar pendiente (se aceptó, se rechazó o
   * se canceló); `null` mientras está pendiente. Arma la línea que explica el
   * estado ("Aceptada el 14/09", "Te aceptaron hace 2 días").
   * NOTA: si una aceptada se cancela (US-38), pasa a ser la fecha de la
   * cancelación.
   */
  respondedAt: string | null
}

/**
 * Lo que manda el modal "Solicitar alquiler" (US-35 actualizada). El
 * postulante (nombre, apellido y DNI) sale de la sesión: no se editan.
 */
export interface SolicitudNueva {
  propertyId: string
  /** `null` o texto de hasta 600 caracteres (US-35 actualizada). */
  message: string | null
  /** Teléfono (E.164) y email que incluye en esta solicitud (no cambian el perfil). */
  contact: ContactoSolicitud
  legajo: LegajoSolicitud
  /** US-35: "se debe aceptar lo que implica el envío de la solicitud". Siempre `true`. */
  acceptedTerms: true
}
