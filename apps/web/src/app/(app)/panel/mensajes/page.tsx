/**
 * /panel/mensajes — la bandeja de Mensajes (US-24 Enviar mensajes).
 *
 * La pantalla la monta el layout (`layout.tsx`); esta página solo existe para la
 * ruta y el título. Con `?con=<persona>&propiedad=<id>` (desde "Escribirle al
 * locador") abre la conversación con esa persona o una nueva.
 */
import type { Metadata } from 'next'

/** Título de la pestaña del navegador (el layout raíz le suma "— RentAR"). */
export const metadata: Metadata = { title: 'Mensajes' }

/** No dibuja nada: la bandeja está en el layout. */
export default function MensajesPage() {
  return null
}
