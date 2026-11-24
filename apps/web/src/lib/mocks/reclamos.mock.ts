/**
 * reclamos.mock.ts — los reclamos del elenco (US-14 a US-18).
 *
 * Qué es: los reclamos que registraron los locatarios del elenco sobre las
 * propiedades que alquilan. Los de Nicolás son los de Claude Design ("Reclamos" ·
 * 02 y 03: mismos códigos, tipos, estados y mensajes), con las fechas corridas
 * antes del "hoy" del elenco (23/09/2026). De acá salen también los reclamos del
 * inicio del locador (`panel.service.ts`) y los "N abiertos" de Mis propiedades.
 *
 * Casos que cubren (pruebas de usuario de US-15 a US-18):
 * - Sofía (locataria de Obispo Trejo, de Nicolás): uno abierto (0043, no puede
 *   resolverlo), uno en proceso (0041, con fotos: resuelve o cancela) y uno
 *   resuelto (0032, sin botones).
 * - Tomás Bianchi (Laprida 340, sin cuenta): uno cancelado (0035).
 * - Camila (locataria de Mariano Moreno 285, de Sofía): uno abierto (0040, lo
 *   cancela desde abierto) y uno en proceso (0039, lo resuelve). Sofía los ve
 *   como locadora y responde el abierto (pasa a en proceso).
 * - Julieta, Matías y Diego no tienen contrato vigente: no pueden registrar
 *   reclamos y cualquier reclamo de otro les da "no encontrado".
 *
 * Lo que se registra en el navegador se guarda en `rentar:mock:reclamos` (ver
 * `services/shared/mockStore.ts`).
 *
 * TODO(db): las fotos del elenco son las de la propiedad (no hay fotos de
 * reclamos entre los assets); en real son las que sube el locatario.
 */
import type { ClaimStatus, TipoReclamoNombre } from '@rentar/shared-types'
import altaCordoba2 from '@/assets/properties/alta-cordoba-2.jpg'
import centro2 from '@/assets/properties/centro-2.jpg'
import guemes2 from '@/assets/properties/guemes-2.jpg'
import nuevaCordoba4 from '@/assets/properties/nueva-cordoba-4.jpg'

// ─── Tipos ──────────────────────────────────────────────────────────────

/** Una foto adjunta. `src` es una URL (en el elenco, un asset; lo registrado en el navegador, una data URL). */
export interface FotoReclamoMock {
  src: string
  name: string
}

/** Un reclamo de un locatario sobre la propiedad que alquila. */
export interface ReclamoMock {
  /** "RCL-2026-0041": en el mock, el id y el código son lo mismo. */
  id: string
  propertyId: string
  /** `UsuarioSesion.id` del locatario, si tiene cuenta en el elenco (Tomás Bianchi no tiene). */
  tenantUserId: string | null
  tenantName: string
  type: TipoReclamoNombre
  status: ClaimStatus
  /** El mensaje completo (de 50 a 5000 caracteres, US-14). */
  message: string
  photos: FotoReclamoMock[]
  /** Fecha y hora ISO del registro. */
  createdAt: string
  /** Primera respuesta del locador (pasó a en proceso); `null` = sin responder. */
  inProgressAt: string | null
  /** Cuándo se resolvió o se canceló. */
  closedAt: string | null
}

// ─── Reclamos ───────────────────────────────────────────────────────────

export const reclamos: ReclamoMock[] = [
  {
    id: 'RCL-2026-0043',
    propertyId: 'prop-obispo-trejo-1250',
    tenantUserId: 'usr-sofia',
    tenantName: 'Sofía Ledesma',
    type: 'reparacion_artefactos',
    status: 'abierto',
    message:
      'El portero eléctrico no suena desde el lunes. Probé con el timbre de abajo y tampoco anda: la gente tiene que llamarme al celular para que baje a abrir.',
    photos: [],
    createdAt: '2026-09-16T08:05:00-03:00',
    inProgressAt: null,
    closedAt: null,
  },
  {
    id: 'RCL-2026-0041',
    propertyId: 'prop-obispo-trejo-1250',
    tenantUserId: 'usr-sofia',
    tenantName: 'Sofía Ledesma',
    type: 'reparacion_inmueble',
    status: 'en_proceso',
    message:
      'Desde el viernes gotea la conexión de abajo de la bacha de la cocina. Puse un balde y lo vacío dos veces por día. Cerré la llave de paso de la cocina y sigue goteando un poco. El mueble de abajo ya está hinchado en una esquina.',
    photos: [
      { src: centro2.src, name: 'bacha-1.jpg' },
      { src: guemes2.src, name: 'balde.png' },
    ],
    createdAt: '2026-09-13T09:12:00-03:00',
    inProgressAt: '2026-09-14T10:41:00-03:00',
    closedAt: null,
  },
  {
    id: 'RCL-2026-0032',
    propertyId: 'prop-obispo-trejo-1250',
    tenantUserId: 'usr-sofia',
    tenantName: 'Sofía Ledesma',
    type: 'pintura',
    status: 'resuelto',
    message:
      'Con la humedad del invierno se descascaró la pintura del techo del baño, justo arriba de la ducha. Se caen pedacitos cuando me baño y quedó una mancha oscura en la esquina.',
    photos: [{ src: nuevaCordoba4.src, name: 'techo-bano.jpg' }],
    createdAt: '2026-07-02T19:30:00-03:00',
    inProgressAt: '2026-07-03T09:15:00-03:00',
    closedAt: '2026-07-21T18:02:00-03:00',
  },
  {
    id: 'RCL-2026-0035',
    propertyId: 'prop-laprida-340',
    tenantUserId: null,
    tenantName: 'Tomás Bianchi',
    type: 'cobros',
    status: 'cancelado',
    message:
      'Me llegó dos veces el cobro de septiembre. Ya pagué el primero el 05/09 y te mando el comprobante por acá para que lo revises.',
    photos: [],
    createdAt: '2026-09-06T11:20:00-03:00',
    inProgressAt: null,
    closedAt: '2026-09-07T08:45:00-03:00',
  },
  {
    id: 'RCL-2026-0040',
    propertyId: 'prop-mariano-moreno-285',
    tenantUserId: 'usr-camila',
    tenantName: 'Camila Ríos',
    type: 'reparacion_artefactos',
    status: 'abierto',
    message:
      'El calefón se apaga solo a los cinco minutos de abrir el agua caliente. Lo prendí de nuevo varias veces y pasa lo mismo, también con la ducha.',
    photos: [],
    createdAt: '2026-09-21T20:10:00-03:00',
    inProgressAt: null,
    closedAt: null,
  },
  {
    id: 'RCL-2026-0039',
    propertyId: 'prop-mariano-moreno-285',
    tenantUserId: 'usr-camila',
    tenantName: 'Camila Ríos',
    type: 'reparacion_inmueble',
    status: 'en_proceso',
    message:
      'La persiana del dormitorio se trabó a mitad de camino y no sube ni baja. La cinta parece cortada adentro de la caja y no me animo a forzarla.',
    photos: [{ src: altaCordoba2.src, name: 'persiana.jpg' }],
    createdAt: '2026-09-15T10:30:00-03:00',
    inProgressAt: '2026-09-15T18:05:00-03:00',
    closedAt: null,
  },
]
