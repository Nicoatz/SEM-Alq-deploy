/**
 * shared/errors.ts — el error tipado que tiran todos los services.
 *
 * Qué es: `ServiceError` lleva un `code` para que las pantallas distingan
 * el caso ("credenciales inválidas" vs. "mail ya registrado" vs. "sin
 * conexión") sin mirar textos. Lo tiran igual la rama mock y la rama real,
 * así la pantalla no sabe (ni le importa) de dónde vino el error.
 *
 * Quién lo usa: todos los `services/*.service.ts`, `shared/apiClient.ts` y
 * las pantallas que muestran estados de error.
 */

/**
 * Motivo del error. Cada uno se corresponde con un status HTTP del backend
 * (ver {@link errorCodeFromHttpStatus}); `network` es "no hubo respuesta".
 */
export type ServiceErrorCode =
  | 'validation' // 400 / 422
  | 'unauthorized' // 401
  | 'forbidden' // 403
  | 'not_found' // 404
  | 'conflict' // 409
  | 'too_many_requests' // 429 (ej. reenviar la invitación a firmar antes de la hora, US-07)
  | 'server' // 5xx o cualquier otro status inesperado
  | 'network' // el backend no respondió (apagado, CORS, sin red)

/** Error tipado de un service. `message` ya está en español, listo para mostrar. */
export class ServiceError extends Error {
  code: ServiceErrorCode
  /**
   * Código de negocio que manda el back en el sobre (`codigo`), si lo manda.
   * Sirve para distinguir dos errores con el mismo status (ej. los dos 409 de
   * `PATCH /usuarios/me`, US-21). Solo lo leen los adaptadores.
   */
  apiCode?: string

  constructor(code: ServiceErrorCode, message: string, apiCode?: string) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.apiCode = apiCode
  }
}

/** Traduce un status HTTP de `apps/api` al `ServiceErrorCode` correspondiente. */
export function errorCodeFromHttpStatus(status: number): ServiceErrorCode {
  if (status === 400 || status === 422) return 'validation'
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 429) return 'too_many_requests'
  return 'server'
}
