/**
 * serverError.ts — textos del estado "Error del servidor" (Autenticación · 05).
 *
 * Qué es: cuando un service falla por algo que no es culpa de la persona
 * (el back no respondió o respondió 5xx), el formulario se reemplaza por un
 * bloque con "Reintentar". Acá se decide qué texto va según el error.
 * Quién lo usa: `LoginForm` y `RegistroForm`.
 */
import { ServiceError } from '@/services/shared/errors'

/** Título y texto del bloque de error del servidor ("No pudimos…"). */
export interface ServerErrorCopy {
  title: string
  description: string
}

/**
 * `true` si el error es "del servidor o de la conexión" (se muestra el
 * bloque con Reintentar) y no un error de los datos (que va en el formulario).
 * `not_found` entra acá: en login y registro significa que la ruta del back
 * todavía no existe, no que la persona escribió algo mal.
 */
export function isServerError(error: unknown): boolean {
  return (
    !(error instanceof ServiceError) || error.code === 'server' || error.code === 'network' || error.code === 'not_found'
  )
}

/**
 * `true` si el navegador dice que no hay red. `navigator.onLine === false` es
 * confiable (el dispositivo no tiene conexión); `true` no garantiza que
 * haya internet, por eso solo se usa el caso negativo.
 */
function sinConexion(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

/**
 * Título y texto del bloque (siempre con "Reintentar"). Dos casos:
 * - Sin conexión en el dispositivo (`navigator.onLine === false`): "Parece
 *   que te quedaste sin internet". El problema es de la red de la persona.
 * - Cualquier otro error de servidor: el back no respondió (apagado, caído,
 *   CORS) o respondió 5xx, o la ruta no existe (404). La red de la persona
 *   anda: el problema es nuestro, por eso "No pudimos conectarnos con RentAR".
 *
 * NOTA: antes "sin internet" se mostraba para cualquier error de red
 * (`network`), también cuando el que no respondía era el back.
 */
export function serverErrorCopy(error: unknown): ServerErrorCopy {
  void error // el texto depende del estado de la red, no del tipo de error
  if (sinConexion()) {
    return {
      title: 'Parece que te quedaste sin internet',
      description: 'Revisá tu conexión y probá de nuevo; tus datos quedaron escritos.',
    }
  }
  return {
    title: 'No pudimos conectarnos con RentAR',
    description: 'Probá de nuevo en unos minutos.',
  }
}
