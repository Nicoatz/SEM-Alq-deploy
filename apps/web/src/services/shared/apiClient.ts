/**
 * shared/apiClient.ts — el único cliente HTTP del frontend.
 *
 * Qué es: la función que usa la rama real de cada service para hablar con
 * `apps/api`. Se encarga de tres cosas, para que ningún service las repita:
 * 1. Armar la URL: `API_BASE_URL` + ruta + query params.
 * 2. Identificar al usuario: `Authorization: Bearer <access_token>`, con el
 *    token de la sesión de Supabase Auth. El back lo valida contra las
 *    claves públicas del proyecto (JWKS) y resuelve el usuario por
 *    `usuario.auth_user_id` (ver `apps/api/src/gateway/middlewares/auth.middleware.ts`).
 * 3. Desarmar el sobre de respuesta del back, `{ success, message?, data?, error? }`
 *    (`ApiResponse<T>` de `@rentar/shared-types`): devuelve `data` o tira un
 *    `ServiceError`.
 *
 * Quién lo usa: solo `services/*.service.ts` (rama real). Las pantallas
 * nunca lo importan.
 *
 * Status HTTP que espera el front (para backend):
 * - 400 / 422 → `validation`: un dato vino mal. El `error` del sobre se
 *   muestra tal cual arriba del formulario, así que tiene que estar en
 *   español y decir qué hacer.
 * - 401 → `unauthorized`: sin token, token vencido o inválido, o usuario
 *   sin perfil. Se muestra "Tu sesión venció…" (US-39); el detalle técnico
 *   del back no le sirve a quien usa la app.
 * - 403 → `forbidden`: hay sesión pero no el rol necesario.
 * - 404 → `not_found`: el recurso (o la RUTA) no existe. NOTA: nunca se
 *   interpreta como "credenciales incorrectas": un endpoint que todavía no
 *   existe se ve como error del servidor, con "Reintentar".
 * - 409 → `conflict`: ya existe (ej. mail registrado, US-19).
 * - 5xx → `server`; sin respuesta → `network`.
 */
import type { ApiResponse } from '@rentar/shared-types'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase/client'
import { API_BASE_URL } from './config'
import { errorCodeFromHttpStatus, ServiceError } from './errors'
import { SESSION_EXPIRED_MESSAGE } from './session'

/** Valor aceptado en un query param. Los arrays se mandan repetidos (`?tags=a&tags=b`). */
export type QueryValue = string | number | boolean | string[] | undefined

/** Opciones de {@link apiRequest}: método, query params y cuerpo. */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Query params. Los `undefined` se omiten. */
  query?: Record<string, QueryValue>
  /** Cuerpo del request; se manda como JSON. */
  body?: unknown
  /**
   * `false` = no mandar el token aunque haya sesión. Solo para los endpoints
   * públicos donde el token no tiene sentido (el registro, US-19).
   * Por defecto `true`: si hay sesión, va el token.
   */
  auth?: boolean
}

// ─── Helpers ────────────────────────────────────────────────────────────

/** Arma la URL completa con sus query params. */
function buildUrl(path: string, query: ApiRequestOptions['query']): string {
  const url = new URL(`${API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item))
    } else {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

/**
 * Token de acceso de la sesión de Supabase, o `null` si no hay sesión.
 *
 * NOTA: se pide en CADA request y no se guarda aparte. El token dura 1 hora:
 * `getSession()` devuelve el vigente y, si ya venció, primero lo renueva con
 * el refresh token. Así nunca viaja un token vencido guardado en memoria.
 * NOTA: en el servidor no hay sesión del navegador; hoy todos los services
 * se llaman desde el navegador (ver `propiedades.service.ts`).
 */
async function getAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const { data } = await getSupabaseBrowserClient().auth.getSession()
  return data.session?.access_token ?? null
}

/**
 * Headers del request. Con sesión (y `auth` distinto de `false`), va
 * `Authorization: Bearer <token>`. Sin sesión, el request sale sin token: los
 * endpoints públicos responden igual y los protegidos devuelven 401.
 */
async function buildHeaders(hasBody: boolean, auth: boolean): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (hasBody) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = await getAccessToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  return headers
}

/** Lee el cuerpo como JSON; `null` si viene vacío o no es JSON (por ejemplo, un 502 con HTML). */
async function readJson(response: Response): Promise<ApiResponse<unknown> | null> {
  try {
    return (await response.json()) as ApiResponse<unknown>
  } catch {
    return null
  }
}

// ─── Request ────────────────────────────────────────────────────────────

/**
 * Hace un request a `apps/api` y devuelve el `data` del sobre de respuesta.
 *
 * @param path Ruta relativa a `API_BASE_URL`, empezando con `/` (ej. `/inmuebles/disponibles`).
 * @throws {ServiceError} `network` si el back no respondió; el código que
 *   corresponda al status HTTP si respondió con error o con `success: false`.
 *
 * @example
 * const inmuebles = await apiRequest<Inmueble[]>('/inmuebles/disponibles')
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, auth = true } = options
  const headers = await buildHeaders(body !== undefined, auth)

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      // NOTA: los datos de la API son en vivo. Sin `no-store`, un Server
      // Component que llame a un service (la landing) se prerenderiza en el
      // build: Next hace el pedido UNA vez en `next build` y las propiedades
      // quedan congeladas (o vacías, si la API no estaba levantada). Con
      // `no-store`, Next pide en cada request (y la ruta pasa a ser dinámica).
      cache: 'no-store',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ServiceError('network', 'No pudimos conectarnos con el servidor. Probá de nuevo en unos minutos.')
  }

  const envelope = await readJson(response)

  if (!response.ok || !envelope || envelope.success === false) {
    // El back pone el detalle en `error` (y a veces un resumen en `message`).
    const message = envelope?.error ?? envelope?.message ?? 'Ocurrió un error inesperado. Probá de nuevo.'
    const code = response.ok ? 'server' : errorCodeFromHttpStatus(response.status)
    // NOTA: el 401 del back trae un texto técnico ("el token de Supabase no es
    // válido"). Para quien usa la app, es que la sesión venció.
    throw new ServiceError(code, code === 'unauthorized' ? SESSION_EXPIRED_MESSAGE : message)
  }

  // NOTA: algunos endpoints responden `success: true` sin `data` (ej. un
  // DELETE). En ese caso se devuelve `undefined`; el service que llama sabe
  // si espera datos o no, y lo tipa con `apiRequest<void>`.
  return envelope.data as T
}
