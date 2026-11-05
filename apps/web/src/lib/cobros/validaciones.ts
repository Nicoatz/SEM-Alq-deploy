/**
 * validaciones.ts — reglas del formulario de US-08.
 *
 * Qué es: fecha del cobro, nota y adjunto. Las usan el modal, para avisar antes
 * de mandar, y la rama mock del service, que responde como el back.
 * Quién lo usa: `RegistrarCobroModal` y `services/cobros.service.ts`.
 */
import type { MedioCobro } from '@rentar/shared-types'

/**
 * Límite del adjunto: 4,5 MB, el más chico de los tres (decisión del PO, 05/11).
 * TODO(backend): la US dice 8 MB, el back y el bucket 5 MB y Vercel 4,5 MB. El
 * equipo define uno (issue del Sprint 4, punto 8).
 */
export const ADJUNTO_MAX_BYTES = 4_500_000

/** Tipos de adjunto que acepta US-08. */
export const ADJUNTO_TIPOS: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png']

/** Atributo `accept` del selector de archivos. */
export const ADJUNTO_ACCEPT = '.pdf,.jpg,.jpeg,.png'

/** US-08: nota de hasta 200 caracteres. */
export const NOTA_MAX = 200

/**
 * Error de la fecha del cobro; `null` si está bien. US-08: no puede ser futura
 * ni anterior al inicio del contrato. Las fechas son ISO, así que se comparan
 * como texto.
 *
 * @example
 * errorDeFechaCobro('2026-09-24', '2026-09-23', '2026-04-01') // → "La fecha del cobro no puede ser futura."
 * errorDeFechaCobro('2026-03-31', '2026-09-23', '2026-04-01') // → "La fecha … anterior al inicio del contrato."
 * errorDeFechaCobro('2026-09-23', '2026-09-23', '2026-04-01') // → null
 */
export function errorDeFechaCobro(fecha: string | null, hoyIso: string, inicioContrato: string | null): string | null {
  if (!fecha) return 'Elegí la fecha del cobro.'
  if (fecha > hoyIso) return 'La fecha del cobro no puede ser futura.'
  if (inicioContrato && fecha < inicioContrato) return 'La fecha del cobro no puede ser anterior al inicio del contrato.'
  return null
}

/** Error de la nota; `null` si está bien. US-08: es obligatoria con el medio "otro". */
export function errorDeNota(medio: MedioCobro | null, nota: string): string | null {
  if (nota.length > NOTA_MAX) return `La nota puede tener hasta ${NOTA_MAX} caracteres.`
  if (medio === 'otro' && nota.trim() === '') return 'Contá cuál fue el medio de pago.'
  return null
}

/** Error del adjunto; `null` si está bien. */
export function errorDeAdjunto(archivo: Pick<File, 'type' | 'size'>): string | null {
  if (!ADJUNTO_TIPOS.includes(archivo.type)) return 'El comprobante tiene que ser PDF, JPG o PNG.'
  if (archivo.size > ADJUNTO_MAX_BYTES) return 'El comprobante puede pesar hasta 4,5 MB.'
  return null
}
