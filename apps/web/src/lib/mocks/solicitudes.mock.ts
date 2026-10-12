/**
 * solicitudes.mock.ts — solicitudes de alquiler del elenco.
 *
 * Qué es: las solicitudes que ya existen el "hoy" del elenco (23/09/2026).
 * Las que se envían desde el modal "Solicitar alquiler" (US-35) se guardan
 * en el navegador encima de estas (`rentar:mock:solicitudes`, ver
 * `services/shared/mockStore.ts`), así la que se envía en el detalle aparece
 * después en Mis solicitudes y en el panel del locador.
 * Cubre: US-35 a US-38 (numeración de Jira).
 *
 * Reglas del elenco (ver `README.md` de esta carpeta):
 * - Rondeau 480, PB es la publicada de la narrativa y Julieta Peralta, la
 *   postulante: SOL-2026-0031 queda pendiente para mostrar el estado "ya la
 *   solicitaste" del detalle.
 * - Las demás (tanda 2 del Sprint 2) cubren los cuatro estados: Nicolás
 *   recibe 3 sobre Rondeau 480 y 2 sobre Fructuoso Rivera 785 (con una
 *   aceptada, para US-38 y la regla de una sola aceptada por propiedad), y
 *   Julieta ve los cuatro estados en Mis solicitudes.
 * - Julieta no tiene ninguna sobre Fructuoso Rivera 785: ahí se prueba el
 *   envío completo de US-35.
 * - Una propiedad alquilada (sin fecha de disponibilidad) o pausada no recibe
 *   solicitudes: no hay ninguna sobre esas.
 * - Prefijo de id: `SOL-2026-XXXX`.
 *
 * Quién lo usa: la rama mock de `services/solicitudes.service.ts` y de
 * `services/panel.service.ts`. Ninguna pantalla lo importa directo.
 *
 * TODO(db): son filas de la tabla de solicitudes, que todavía no existe.
 */
import type { ContactoSolicitud, EstadoSolicitud, LegajoSolicitud } from '@rentar/shared-types'

// ─── Tipos ──────────────────────────────────────────────────────────────

/**
 * Una solicitud de alquiler sobre una propiedad publicada, como la guardaría
 * el back. JSON puro, para poder guardarla en `localStorage`.
 */
export interface SolicitudMock {
  /** Prefijo `SOL-2026-`. */
  id: string
  propertyId: string
  /** `UsuarioSesion.id` de quien la envió. */
  applicantUserId: string
  /** Nombre y apellido de quien la envió (US-36: lo ve el locador). */
  applicantName: string
  /** Mensaje opcional al locador (US-35: hasta 1000 caracteres); `null` = sin mensaje. */
  message: string | null
  status: EstadoSolicitud
  /** Fecha (o fecha y hora) ISO en que se envió. */
  createdAt: string
  /** Fecha (o fecha y hora) ISO en que dejó de estar pendiente; `null` si sigue pendiente. */
  respondedAt: string | null
  /**
   * Contacto que incluyó en la solicitud (US-35 actualizada). Opcional: las
   * enviadas desde el navegador antes de esta tanda no lo tienen.
   */
  contact?: ContactoSolicitud
  /** Legajo de la solicitud (US-35 actualizada). Opcional, por lo mismo: sin él, "Sin datos de legajo". */
  legajo?: LegajoSolicitud
}

// ─── Contacto y legajo (US-35 actualizada) ──────────────────────────────
// Datos completados en la tanda 4 del Sprint 2 (ver README, "Datos
// completados"): el mapa no los define. El contacto es el de cada cuenta del
// elenco, con el teléfono en E.164.

const CONTACTO_JULIETA: ContactoSolicitud = { phone: '+543515550103', email: 'julieta.peralta@rentar.test' }
const CONTACTO_MATIAS: ContactoSolicitud = { phone: '+543515550104', email: 'matias.quiroga@rentar.test' }
const CONTACTO_DIEGO: ContactoSolicitud = { phone: '+543515550105', email: 'diego.ferreyra@rentar.test' }

/** Julieta: trabaja en relación de dependencia y se muda con su pareja; ofrece la garantía propietaria de su madre. */
const LEGAJO_JULIETA: LegajoSolicitud = {
  occupation: 'relacion_dependencia',
  monthlyIncome: 1250000,
  residents: 2,
  hasPets: false,
  petsDetail: null,
  guarantees: ['propietaria'],
}

/** Matías: estudiante de posgrado; prefiere no informar ingresos y ofrece seguro de caución. */
const LEGAJO_MATIAS: LegajoSolicitud = {
  occupation: 'estudiante',
  monthlyIncome: 0,
  residents: 1,
  hasPets: false,
  petsDetail: null,
  guarantees: ['caucion'],
}

// ─── Solicitudes del elenco ─────────────────────────────────────────────

export const solicitudes: SolicitudMock[] = [
  {
    id: 'SOL-2026-0031',
    propertyId: 'prop-rondeau-480',
    applicantUserId: 'usr-julieta',
    // Mapa: Julieta encuentra Rondeau 480 en /buscar y la solicita. Todavía
    // no se aceptó (después termina en CT-2026-0207).
    applicantName: 'Julieta Peralta',
    // NOTA: el mapa no define un mensaje; no se inventa uno.
    message: null,
    status: 'pendiente',
    createdAt: '2026-09-20',
    respondedAt: null,
    contact: CONTACTO_JULIETA,
    legajo: LEGAJO_JULIETA,
  },

  // ─── Tanda 2 del Sprint 2 (datos completados, ver README) ─────────────
  // Rondeau 480: dos pendientes (Julieta y Matías) y una rechazada.
  {
    id: 'SOL-2026-0032',
    propertyId: 'prop-rondeau-480',
    applicantUserId: 'usr-matias',
    applicantName: 'Matías Quiroga',
    message: 'Hola, soy estudiante de posgrado y trabajo medio tiempo. Me interesa para mudarme en octubre, con contrato por 3 años.',
    status: 'pendiente',
    createdAt: '2026-09-19T18:40:00',
    respondedAt: null,
    contact: CONTACTO_MATIAS,
    legajo: LEGAJO_MATIAS,
  },
  {
    id: 'SOL-2026-0033',
    propertyId: 'prop-rondeau-480',
    applicantUserId: 'usr-diego',
    applicantName: 'Diego Ferreyra',
    message: null,
    status: 'rechazada',
    createdAt: '2026-09-02T10:15:00',
    respondedAt: '2026-09-04T09:30:00',
    contact: CONTACTO_DIEGO,
    legajo: { occupation: 'relacion_dependencia', monthlyIncome: 900000, residents: 1, hasPets: false, petsDetail: null, guarantees: ['propietaria'] },
  },
  // Fructuoso Rivera 785: la aceptada de Diego (US-38: Nicolás la puede
  // cancelar; mientras esté, el "Aceptar" de otra pendiente queda
  // deshabilitado) y una que Matías canceló.
  {
    id: 'SOL-2026-0034',
    propertyId: 'prop-rivera-785',
    applicantUserId: 'usr-diego',
    applicantName: 'Diego Ferreyra',
    message: 'Buenas, trabajo en relación de dependencia y tengo garantía propietaria. Puedo coordinar una visita cuando te quede cómodo.',
    status: 'aceptada',
    createdAt: '2026-09-12T20:05:00',
    respondedAt: '2026-09-14T11:00:00',
    contact: CONTACTO_DIEGO,
    // Fructuoso Rivera 785 es apta mascotas: Diego declara su perro (la única del elenco con mascotas).
    legajo: {
      occupation: 'relacion_dependencia',
      monthlyIncome: 950000,
      residents: 2,
      hasPets: true,
      petsDetail: 'Un perro mediano, adulto, vacunado y castrado. Duerme adentro y no ladra cuando queda solo.',
      guarantees: ['propietaria'],
    },
  },
  {
    id: 'SOL-2026-0035',
    propertyId: 'prop-rivera-785',
    applicantUserId: 'usr-matias',
    applicantName: 'Matías Quiroga',
    message: null,
    status: 'cancelada',
    createdAt: '2026-09-08T16:20:00',
    respondedAt: '2026-09-10T08:45:00',
    contact: CONTACTO_MATIAS,
    legajo: LEGAJO_MATIAS,
  },
  // Mis solicitudes de Julieta: una de cada estado, sobre publicadas de
  // otros locadores (no aparecen en el panel de nadie del elenco).
  {
    id: 'SOL-2026-0036',
    propertyId: 'prop-otro-05',
    applicantUserId: 'usr-julieta',
    applicantName: 'Julieta Peralta',
    message: null,
    status: 'aceptada',
    createdAt: '2026-09-15T21:10:00',
    respondedAt: '2026-09-21T12:30:00',
    contact: CONTACTO_JULIETA,
    legajo: LEGAJO_JULIETA,
  },
  {
    id: 'SOL-2026-0037',
    propertyId: 'prop-otro-03',
    applicantUserId: 'usr-julieta',
    applicantName: 'Julieta Peralta',
    message: null,
    status: 'rechazada',
    createdAt: '2026-09-05T19:00:00',
    respondedAt: '2026-09-08T10:00:00',
    contact: CONTACTO_JULIETA,
    legajo: LEGAJO_JULIETA,
  },
  {
    id: 'SOL-2026-0038',
    propertyId: 'prop-otro-07',
    applicantUserId: 'usr-julieta',
    applicantName: 'Julieta Peralta',
    message: null,
    status: 'cancelada',
    createdAt: '2026-09-10T22:30:00',
    respondedAt: '2026-09-12T09:15:00',
    contact: CONTACTO_JULIETA,
    legajo: LEGAJO_JULIETA,
  },
]
