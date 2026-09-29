/**
 * shared/config.ts — el interruptor de mocks, la URL del backend y Supabase.
 *
 * Qué es: las variables de entorno del front. `NEXT_PUBLIC_USE_MOCKS` decide
 * si los services hablan con `apps/api` o devuelven datos de prueba; las de
 * Supabase las usa la sesión real (`lib/auth/supabase/`). Conectar el backend es cambiar
 * `NEXT_PUBLIC_USE_MOCKS` a `false`, no reescribir services (ver
 * `docs/HANDOFF-BACKEND.md`, "Cómo conectar un endpoint").
 *
 * Quién lo usa: cada función de `services/*.service.ts` (rama mock o rama
 * real) y `shared/apiClient.ts`.
 *
 * NOTA: se lee `process.env.NEXT_PUBLIC_...` escrito así, literal. Next.js
 * reemplaza esas expresiones por su valor al compilar; si se leyeran de forma
 * dinámica (`process.env[nombre]`) llegarían `undefined` al navegador.
 */

/**
 * `true` (por defecto): los services devuelven datos del elenco
 * (`lib/mocks/`) con latencia simulada. `false`: llaman a `apps/api`.
 * Solo el texto exacto `'false'` apaga los mocks, así un valor vacío o mal
 * escrito nunca conecta el backend por accidente.
 */
export const USE_MOCKS: boolean = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false'

/** URL base de la API versionada. `apps/api` corre en el puerto 3000 (la web, en el 3001). */
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1'

/**
 * URL del proyecto de Supabase (US-39: la sesión la maneja Supabase Auth).
 * Solo hace falta con `USE_MOCKS = false`; en modo mock no se usa Supabase.
 */
export const SUPABASE_URL: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

/**
 * Clave publicable de Supabase (`sb_publishable_…`). Es pública a propósito:
 * con RLS activo y sin políticas, no da acceso a ninguna tabla; el front la
 * usa solo para Auth (y, más adelante, Storage).
 * NOTA: la `SUPABASE_SECRET_KEY` NUNCA va en `apps/web`: saltea RLS y es solo
 * del back.
 */
export const SUPABASE_PUBLISHABLE_KEY: string = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
