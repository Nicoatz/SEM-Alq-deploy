/**
 * mensajes.mock.ts — los mensajes del elenco (US-18 chat del reclamo; US-24 Mensajes, Tanda C).
 *
 * Qué es: los mensajes de cada conversación. La conversación de un reclamo tiene
 * el id `CNV-<código del reclamo>` (en el back se crea al registrar el reclamo:
 * todo reclamo tiene la suya, aunque esté vacía hasta que responde el locador).
 *
 * Casos (pruebas de usuario de US-18 y US-24):
 * - RCL-2026-0041 (en proceso): los tres mensajes de Claude Design ("Reclamos" · 03).
 * - RCL-2026-0032 (resuelto): dos mensajes; el chat queda de solo lectura.
 * - RCL-2026-0039 (en proceso, Sofía y Camila): exactamente 100 mensajes, para
 *   probar que con el 101 se descarta el más viejo y el mensaje original del
 *   reclamo sigue arriba (US-18 y US-24).
 * - Los abiertos (0043, 0040) y el cancelado (0035) no tienen mensajes.
 *
 * Lo que se manda o elimina en el navegador se guarda en `rentar:mock:mensajes`; las
 * conversaciones nuevas, en `rentar:mock:conversaciones`.
 */

// ─── Tipos ──────────────────────────────────────────────────────────────

/** Un mensaje de una conversación. */
export interface MensajeMock {
  id: string
  conversationId: string
  /** `UsuarioSesion.id` de quien lo mandó. */
  senderId: string
  content: string
  /** Fecha y hora ISO de envío. */
  sentAt: string
  /** Fecha y hora ISO de eliminación; `null` si sigue. */
  deletedAt: string | null
}

/**
 * Una conversación general de Mensajes (US-24): una por persona y propiedad
 * (decisión del PO, 24/11). Las de reclamos no están acá: cada reclamo tiene la
 * suya, con id `CNV-<código>` (ver {@link conversacionDeReclamo}).
 */
export interface ConversacionMock {
  id: string
  /** `UsuarioSesion.id` del locador. */
  landlordId: string
  /** `UsuarioSesion.id` del locatario; `null` si no tiene cuenta (Tomás Bianchi). */
  tenantId: string | null
  tenantName: string
  /** Quién la inició (US-24: el locador solo con contrato vigente). */
  startedBy: string
  propertyId: string
  /** Fecha y hora ISO de creación. */
  createdAt: string
}

/** Id de la conversación de un reclamo. */
export function conversacionDeReclamo(reclamoId: string): string {
  return `CNV-${reclamoId}`
}

// ─── Mensajes ───────────────────────────────────────────────────────────

/** Un mensaje del elenco, con id correlativo dentro de su conversación. */
function mensaje(conversationId: string, numero: number, senderId: string, sentAt: string, content: string): MensajeMock {
  return { id: `${conversationId}-M${String(numero).padStart(3, '0')}`, conversationId, senderId, content, sentAt, deletedAt: null }
}

/** Frases para el chat largo de RCL-2026-0039 (se repiten con su número de visita). */
const FRASES_PERSIANA: readonly [string, string][] = [
  ['usr-sofia', 'Camila, ¿pudo pasar el técnico hoy?'],
  ['usr-camila', 'Sí, miró la caja y dice que hay que cambiar la cinta y una polea.'],
  ['usr-sofia', 'Perfecto, avisame cuándo te queda cómodo que vuelva.'],
  ['usr-camila', 'Mañana a la tarde estoy, desde las 15.'],
]

/** Exactamente 100 mensajes, uno cada 20 minutos desde el 15/09 a las 18:05. */
function chatLargoPersiana(): MensajeMock[] {
  const conversacion = conversacionDeReclamo('RCL-2026-0039')
  const inicio = Date.parse('2026-09-15T18:05:00-03:00')
  return Array.from({ length: 100 }, (_, indice) => {
    const [emisor, frase] = FRASES_PERSIANA[indice % FRASES_PERSIANA.length] ?? ['usr-sofia', '']
    const fecha = new Date(inicio + indice * 20 * 60 * 1000)
    // Hora de Córdoba (UTC-3), sin depender de la zona de la máquina.
    const local = new Date(fecha.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 19)
    const texto = indice === 0 ? 'Hola Camila, gracias por avisar. Mañana paso con el técnico de persianas.' : `${frase} (${Math.floor(indice / 4) + 1})`
    return mensaje(conversacion, indice + 1, emisor, `${local}-03:00`, texto)
  })
}

// ─── Conversaciones generales (US-24) ───────────────────────────────────
// Las de Nicolás son las de Claude Design ("Mensajes" · 01), con las fechas
// antes del 23/09. Julieta, Matías y Diego no tienen contrato vigente con él:
// le escribieron ellos, así que Nicolás les responde igual (US-24).

export const conversaciones: ConversacionMock[] = [
  { id: 'CNV-0001', landlordId: 'usr-nicolas', tenantId: 'usr-sofia', tenantName: 'Sofía Ledesma', startedBy: 'usr-sofia', propertyId: 'prop-obispo-trejo-1250', createdAt: '2026-09-15T09:12:00-03:00' },
  { id: 'CNV-0002', landlordId: 'usr-nicolas', tenantId: 'usr-julieta', tenantName: 'Julieta Peralta', startedBy: 'usr-julieta', propertyId: 'prop-rondeau-480', createdAt: '2026-09-22T19:40:00-03:00' },
  { id: 'CNV-0003', landlordId: 'usr-nicolas', tenantId: 'usr-matias', tenantName: 'Matías Quiroga', startedBy: 'usr-matias', propertyId: 'prop-rivera-785', createdAt: '2026-09-21T10:15:00-03:00' },
  { id: 'CNV-0004', landlordId: 'usr-nicolas', tenantId: null, tenantName: 'Tomás Bianchi', startedBy: 'usr-nicolas', propertyId: 'prop-laprida-340', createdAt: '2026-09-12T16:20:00-03:00' },
  { id: 'CNV-0005', landlordId: 'usr-nicolas', tenantId: 'usr-diego', tenantName: 'Diego Ferreyra', startedBy: 'usr-diego', propertyId: 'prop-rondeau-480', createdAt: '2026-09-08T11:00:00-03:00' },
  { id: 'CNV-0006', landlordId: 'usr-sofia', tenantId: 'usr-camila', tenantName: 'Camila Ríos', startedBy: 'usr-sofia', propertyId: 'prop-mariano-moreno-285', createdAt: '2026-09-10T12:00:00-03:00' },
]

/** Id del "locatario" sin cuenta de una conversación (nunca coincide con una sesión). */
export const SIN_CUENTA_PREFIJO = 'sin-cuenta:'

export const mensajes: MensajeMock[] = [
  mensaje('CNV-0001', 1, 'usr-sofia', '2026-09-15T09:12:00-03:00', 'Hola Nicolás, ¿me confirmás el CBU para transferir las expensas de este mes?'),
  mensaje('CNV-0001', 2, 'usr-nicolas', '2026-09-15T10:41:00-03:00', 'Hola Sofía, es el mismo de siempre, el que figura en el contrato. Cualquier cosa avisame.'),
  mensaje('CNV-0001', 3, 'usr-sofia', '2026-09-18T11:24:00-03:00', 'Listo, ya está transferido. El comprobante te lo paso por Mis pagos.'),
  mensaje('CNV-0001', 4, 'usr-nicolas', '2026-09-18T11:31:00-03:00', 'Dale, gracias. Que tengas buen finde.'),
  mensaje('CNV-0002', 1, 'usr-julieta', '2026-09-22T19:40:00-03:00', '¿Se aceptan mascotas chicas?'),
  mensaje('CNV-0003', 1, 'usr-matias', '2026-09-21T10:15:00-03:00', '¿Puedo ir a verlo el sábado a la mañana?'),
  mensaje('CNV-0004', 1, 'usr-nicolas', '2026-09-12T16:20:00-03:00', 'Tomás, el lunes pasa el gasista a revisar el calefón. ¿Te queda bien a la tarde?'),
  mensaje('CNV-0004', 2, 'sin-cuenta:Tomás Bianchi', '2026-09-12T17:05:00-03:00', 'Sí, después de las 15 estoy.'),
  mensaje('CNV-0004', 3, 'usr-nicolas', '2026-09-12T17:10:00-03:00', 'Gracias, quedamos así entonces.'),
  mensaje('CNV-0005', 1, 'usr-diego', '2026-09-08T11:00:00-03:00', '¿Sigue disponible Rondeau 480? Me interesa para octubre.'),
  mensaje('CNV-0005', 2, 'usr-nicolas', '2026-09-08T12:30:00-03:00', 'Te aviso apenas tenga novedades.'),
  mensaje('CNV-0006', 1, 'usr-sofia', '2026-09-10T12:00:00-03:00', 'Hola Camila, la semana que viene pasa el gasista a revisar el calefón.'),
  mensaje('CNV-0006', 2, 'usr-camila', '2026-09-10T12:20:00-03:00', 'Perfecto, avisame el día.'),
  mensaje(
    conversacionDeReclamo('RCL-2026-0041'),
    1,
    'usr-nicolas',
    '2026-09-14T10:41:00-03:00',
    'Hola Sofía, gracias por avisar. Ya hablé con el plomero: puede pasar el martes entre 9 y 11. ¿Te sirve?',
  ),
  mensaje(conversacionDeReclamo('RCL-2026-0041'), 2, 'usr-sofia', '2026-09-14T11:24:00-03:00', 'Perfecto, el martes a las 10 estoy en casa.'),
  mensaje(conversacionDeReclamo('RCL-2026-0041'), 3, 'usr-nicolas', '2026-09-14T11:31:00-03:00', 'Listo, ya le confirmé. Cuando termine contame si quedó bien.'),
  mensaje(conversacionDeReclamo('RCL-2026-0032'), 1, 'usr-nicolas', '2026-07-03T09:15:00-03:00', 'Hola Sofía, el jueves pasa el pintor a ver el techo del baño.'),
  mensaje(conversacionDeReclamo('RCL-2026-0032'), 2, 'usr-sofia', '2026-07-21T18:00:00-03:00', 'Quedó perfecto, gracias. Lo marco como resuelto.'),
  ...chatLargoPersiana(),
]
