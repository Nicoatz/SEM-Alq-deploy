/**
 * eventoFirma.ts — el `?event=` con que DocuSign devuelve a la persona a RentAR.
 *
 * Qué es: lógica pura (sin React ni services). Cubre US-07 Firmar contrato de
 * alquiler: "al volver de DocuSign" (guía del back, §4 y §6).
 * - El valor se valida con una lista blanca: lo que no está en la lista es
 *   `'otro'` y se muestra un mensaje genérico. NUNCA se muestra el valor crudo
 *   del query (se puede escribir cualquier cosa en la URL).
 * - `signing_complete` solo dice que la persona volvió de firmar: la pantalla
 *   no muestra "firmado" hasta que el back lo confirma (`useRegresoDeFirma`).
 *
 * Quién lo usa: `lib/contratos/useRegresoDeFirma.ts`, `components/contratos/DetalleContrato.tsx`
 * y `components/contratos/MiAlquiler.tsx`.
 */
import type { EventoFirma } from '@rentar/shared-types'

/** Nombre del parámetro que agrega DocuSign a la URL de regreso. */
export const PARAMETRO_EVENTO = 'event'

/** Los valores que la pantalla sabe tratar (guía del back, §4). */
const EVENTOS_CONOCIDOS: readonly Exclude<EventoFirma, 'otro'>[] = ['signing_complete', 'decline', 'cancel', 'session_timeout', 'ttl_expired', 'exception']

/**
 * El `?event=` de la URL → evento de la vista.
 * @returns `null` sin `event` (o vacío); `'otro'` si el valor no está en la lista blanca.
 */
export function leerEventoFirma(valor: string | null | undefined): EventoFirma | null {
  if (!valor) return null
  return (EVENTOS_CONOCIDOS as readonly string[]).includes(valor) ? (valor as EventoFirma) : 'otro'
}

/**
 * Mensaje de un regreso sin firma (guía del back, §4): la persona no firmó y
 * puede volver a intentarlo. `null` para `signing_complete` y `decline`, que
 * esperan el aviso del back (`useRegresoDeFirma`).
 */
export function mensajeSinFirma(evento: EventoFirma): string | null {
  switch (evento) {
    case 'cancel':
      return 'No firmaste. Podés volver a intentarlo cuando quieras.'
    case 'session_timeout':
    case 'ttl_expired':
      return 'La sesión de firma venció. Probá de nuevo.'
    case 'exception':
      return 'Hubo un problema al firmar. Probá de nuevo.'
    case 'otro':
      return 'No se completó la firma. Podés volver a intentarlo.'
    default:
      return null
  }
}

/**
 * La URL actual sin `?event=` (conserva el resto del query y el fragmento).
 * Sirve para limpiar la barra de direcciones después de leer el evento, así
 * recargar no repite la espera.
 */
export function urlSinEvento(href: string): string {
  const url = new URL(href)
  url.searchParams.delete(PARAMETRO_EVENTO)
  return `${url.pathname}${url.search}${url.hash}`
}
