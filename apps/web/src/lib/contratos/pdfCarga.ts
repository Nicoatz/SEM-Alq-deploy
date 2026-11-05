/**
 * pdfCarga.ts — valida el PDF del contrato antes de subirlo.
 *
 * Qué es: reglas puras del paso 3 del alta (tipo, tamaño y firma del archivo).
 * Cubre: US-05 Registrar contrato de alquiler, "Paso 3 · Carga".
 * Quién lo usa: `components/contratos/PasoCarga.tsx` y la rama mock de
 * `services/contratos.service.ts`.
 */

/** US-05: "con un tamaño no superior a 5MB". Es el límite del bucket `contratos-pdf`. */
export const PDF_MAX_BYTES = 5 * 1024 * 1024

/** Los primeros bytes de todo PDF real: `%PDF-`. */
const FIRMA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]

export const MENSAJES_PDF = {
  noEsPdf: 'El contrato tiene que estar en formato PDF.',
  muyGrande: 'El archivo supera los 5 MB. Probá con uno más liviano.',
  firmaInvalida: 'Ese archivo no es un PDF, aunque su nombre termine en .pdf.',
  vacio: 'El archivo está vacío.',
} as const

/** Lo que hace falta saber del archivo para validarlo. */
export type ArchivoPdf = Pick<File, 'name' | 'type' | 'size'>

/**
 * US-05: "Si el archivo no es un PDF o supera los 5MB, se debe rechazar e
 * informar el motivo". El rechazo no toca el PDF anterior: la pantalla solo
 * sube lo que pasa esta validación.
 *
 * Casos verificados:
 * - 5 MB exactos: pasa.
 * - 5 MB + 1 byte: `muyGrande`.
 * - Un Word o una imagen: `noEsPdf`.
 * - Un `.pdf` que no lo es (extensión cambiada): `firmaInvalida`.
 * - Rechazo con un PDF previo cargado: esta función no lo ve; `PasoCarga` lo conserva.
 *
 * @param cabecera Los primeros bytes del archivo ({@link cabeceraDe}).
 * @returns el motivo del rechazo, o `null` si el archivo sirve.
 */
export function errorDeArchivoPdf(archivo: ArchivoPdf, cabecera: Uint8Array): string | null {
  const esPdfPorNombre = archivo.name.toLowerCase().endsWith('.pdf')
  if (!esPdfPorNombre || (archivo.type !== '' && archivo.type !== 'application/pdf')) return MENSAJES_PDF.noEsPdf
  if (archivo.size === 0) return MENSAJES_PDF.vacio
  if (archivo.size > PDF_MAX_BYTES) return MENSAJES_PDF.muyGrande
  if (!FIRMA_PDF.every((byte, posicion) => cabecera[posicion] === byte)) return MENSAJES_PDF.firmaInvalida
  return null
}

/** Los primeros bytes de un archivo, para mirar su firma. */
export async function cabeceraDe(archivo: Blob): Promise<Uint8Array> {
  return new Uint8Array(await archivo.slice(0, FIRMA_PDF.length).arrayBuffer())
}

/** `1468006` → "1,4 MB"; menos de un mega, en KB. */
export function tamanoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
