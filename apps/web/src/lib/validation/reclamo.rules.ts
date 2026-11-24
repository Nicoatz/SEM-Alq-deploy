/**
 * reclamo.rules.ts — validaciones del registro de un reclamo (US-14).
 *
 * Qué es: los límites y los textos de error del formulario
 * `/panel/reclamos/nuevo`. La rama mock del service los vuelve a aplicar, igual
 * que el back (`reclamo.service.ts` de `apps/api`).
 *
 * Criterios de US-14:
 * - "Se debe seleccionar una propiedad con la que se posea un contrato vigente."
 * - "Se debe seleccionar un tipo de reclamo."
 * - "Se debe redactar un mensaje de reclamo, de mínimo 50 caracteres y máximo 5000."
 * - "Se pueden adjuntar hasta 10 imágenes en formato JPG/PNG que no excedan los 350kb cada una."
 *
 * Quién lo usa: `components/reclamos/NuevoReclamo.tsx`, `FotosReclamoField.tsx` y `services/reclamos.service.ts`.
 */
import { esJpgOPng, pesoEnKbTexto } from '@/lib/imagenes/archivosFoto'

// ─── Límites ────────────────────────────────────────────────────────────

/** US-14: "mínimo 50 caracteres". Se cuentan sin los espacios del principio y del final (igual que el back). */
export const RECLAMO_MENSAJE_MIN = 50
/** US-14: "máximo 5000". El front no recorta (decisión del PO, 24/11). */
export const RECLAMO_MENSAJE_MAX = 5000
/** US-14: "hasta 10 imágenes". */
export const RECLAMO_FOTOS_MAX = 10
/** US-14: "que no excedan los 350kb cada una". */
export const RECLAMO_FOTO_PESO_MAX_BYTES = 350 * 1024

// ─── Mensajes ───────────────────────────────────────────────────────────

export const MENSAJES_RECLAMO = {
  propiedad: 'Elegí la propiedad del reclamo.',
  sinPropiedades: 'No tenés propiedades con un contrato vigente para registrar un reclamo.',
  tipo: 'Elegí el tipo de reclamo.',
  mensajeVacio: 'Contá qué pasa: el mensaje es obligatorio.',
  mensajeLargo: `El mensaje puede tener hasta ${RECLAMO_MENSAJE_MAX} caracteres.`,
  fotosDeMas: `Podés adjuntar hasta ${RECLAMO_FOTOS_MAX} fotos.`,
} as const

/** "Faltan 12 caracteres (mínimo 50)." */
export function textoFaltanCaracteres(largo: number): string {
  const faltan = RECLAMO_MENSAJE_MIN - largo
  return `Faltan ${faltan} ${faltan === 1 ? 'carácter' : 'caracteres'} (mínimo ${RECLAMO_MENSAJE_MIN}).`
}

/** Largo que cuenta para los límites: sin espacios al principio ni al final. */
export function largoMensaje(mensaje: string): number {
  return mensaje.trim().length
}

/** Error del mensaje, o `null` si cumple US-14. */
export function errorDeMensaje(mensaje: string): string | null {
  const largo = largoMensaje(mensaje)
  if (largo === 0) return MENSAJES_RECLAMO.mensajeVacio
  if (largo < RECLAMO_MENSAJE_MIN) return textoFaltanCaracteres(largo)
  if (largo > RECLAMO_MENSAJE_MAX) return MENSAJES_RECLAMO.mensajeLargo
  return null
}

/** "1,2 MB" o "210 KB", como en el diseño ("living.jpg: pesa 1,2 MB y el máximo es 350 KB"). */
function pesoTexto(bytes: number): string {
  if (bytes < 1024 * 1024) return pesoEnKbTexto(bytes)
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/**
 * Por qué no se adjunta un archivo, o `null` si cumple US-14. Textos del diseño
 * (Claude Design, "Reclamos" · 03): "solo se aceptan imágenes JPG o PNG" y
 * "pesa 1,2 MB y el máximo es 350 KB".
 */
export function motivoRechazoFotoReclamo(file: File): string | null {
  if (!esJpgOPng(file)) return 'solo se aceptan imágenes JPG o PNG'
  if (file.size > RECLAMO_FOTO_PESO_MAX_BYTES) return `pesa ${pesoTexto(file.size)} y el máximo es ${pesoTexto(RECLAMO_FOTO_PESO_MAX_BYTES)}`
  return null
}

/** Motivo de un archivo que no entra porque ya hay 10 fotos. */
export const MOTIVO_FOTOS_DE_MAS = `ya hay ${RECLAMO_FOTOS_MAX} fotos, el máximo`
