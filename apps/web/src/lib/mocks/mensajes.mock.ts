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
 * Lo que se manda o elimina en el navegador se guarda en `rentar:mock:mensajes`.
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

export const mensajes: MensajeMock[] = [
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
