/**
 * archivosFoto.ts — utilidades para las fotos que elige el usuario en un formulario.
 *
 * Qué es: lo que comparten los campos de fotos de la app (el alta de propiedad,
 * US-01, y el registro de un reclamo, US-14): leer el archivo como data URL,
 * escribir su peso y decidir si es JPG o PNG. Los límites (cuántas fotos, cuánto
 * pesan) y los textos de cada rechazo son de cada US y viven en sus reglas
 * (`lib/validation/propiedad.rules.ts` y `lib/validation/reclamo.rules.ts`).
 *
 * Quién lo usa: `components/alta/FotosField.tsx` y `components/reclamos/FotosReclamoField.tsx`.
 */

/** Tipos MIME aceptados en las dos US: "formato JPG o PNG" (US-01 y US-14). */
export const TIPOS_FOTO_ACEPTADOS = ['image/jpeg', 'image/png']

/** Formatos que ofrece el selector de archivos del sistema (`<input accept>`). */
export const FORMATOS_SELECTOR_FOTO = '.jpg,.jpeg,.png,image/jpeg,image/png'

/** Lee un archivo como data URL (así lo guardan los formularios hasta que se sube). */
export function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/** Peso en KB, redondeado: "512 KB". */
export function pesoEnKbTexto(bytes: number): string {
  return `${Math.round(bytes / 1024)} KB`
}

/**
 * `true` si el archivo es JPG o PNG. Se mira el tipo MIME **y** la extensión, y
 * tienen que cumplir los dos: un `.png` renombrado a `.pdf` (o al revés) se rechaza.
 */
export function esJpgOPng(file: File): boolean {
  return TIPOS_FOTO_ACEPTADOS.includes(file.type) && /\.(jpe?g|png)$/i.test(file.name)
}
