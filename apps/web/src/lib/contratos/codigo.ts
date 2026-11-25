/**
 * codigo.ts — el código visible de un contrato ("CT-2026-0148").
 *
 * Qué es: el back no siempre manda el código con la forma `CT-AAAA-NNNN`. Hoy
 * `GET /alquileres-locatario` manda el id del contrato como texto ("17", HANDOFF
 * §7, US-27 y R-13). Un id crudo no le dice nada a quien lo lee, así que solo se
 * muestra un código con la forma correcta; si no la tiene, no se muestra nada.
 *
 * Quién lo usa: el selector de propiedad del registro de un reclamo (US-14,
 * `adapters/reclamo.adapter.ts`) y todas las pantallas que muestran el código de
 * un contrato: el detalle y el alta (US-05 a US-07), la pestaña Contratos de la
 * propiedad (US-43) y Mi alquiler (US-27).
 * NOTA: se aplica al mostrar, no en los adaptadores: `code` sigue llegando tal
 * cual para las reglas que lo usan (firma, descartar un borrador).
 */

/** Forma del código de un contrato firmado: `CT-2026-0148`. */
const FORMA_CODIGO_CONTRATO = /^CT-\d{4}-\d{4}$/

/** El código si tiene la forma `CT-AAAA-NNNN`; si no (un id crudo, vacío), `null`. */
export function codigoContratoVisible(codigo: string | null | undefined): string | null {
  const limpio = codigo?.trim() ?? ''
  return FORMA_CODIGO_CONTRATO.test(limpio) ? limpio : null
}
