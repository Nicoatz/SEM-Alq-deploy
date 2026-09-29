/**
 * (public)/layout.tsx — zona pública (arquetipo A1): Header y Footer.
 *
 * Qué es: envuelve `/`, `/buscar` y `/propiedad/[id]` con `PublicLayout`, con
 * el Header que muestra la sesión (`components/PublicHeader.tsx`).
 * Quién lo usa: Next.js, para todas las rutas de `app/(public)/`.
 */
import type { ReactNode } from 'react'
import { cookies } from 'next/headers'
// Import directo (no del barrel @rentar/ui): ese barrel también re-exporta
// statusMeta (usa @ant-design/icons, que llama createContext a nivel de
// módulo) — createContext no existe en el runtime "react-server" que usa
// este layout (Server Component). Mismo motivo que en app/layout.tsx.
import { PublicLayout } from '@rentar/ui/src/components/layouts/PublicLayout'
import { PublicHeader } from '@/components/PublicHeader'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session-cookie'
import { USE_MOCKS } from '@/services/shared/config'

/** Cookies de sesión de Supabase: `sb-<proyecto>-auth-token`, a veces partida en `.0`, `.1`… */
const SUPABASE_SESSION_COOKIE = /^sb-.+-auth-token(\.\d+)?$/

/**
 * `true` si el pedido trae una cookie de sesión: `rentar_session` en modo mock,
 * la de Supabase Auth en modo real. Solo mira que exista, no la valida.
 *
 * NOTA: es una pista para que el Header no parpadee. Con la cookie, mientras
 * el `AuthProvider` confirma la sesión, el Header muestra un placeholder con la
 * forma de la variante con sesión, en vez de "Iniciar sesión". Sin la cookie
 * (la mayoría de las visitas) sale la variante sin sesión de entrada. Si la
 * cookie estaba vencida, se pasa del placeholder a "sin sesión": no se muestra
 * nada falso.
 *
 * NOTA: leer las cookies acá hace DINÁMICAS todas las páginas de este grupo:
 * `/buscar` y `/propiedad/[id]` pasan a renderizarse en cada pedido (la landing
 * ya lo era, porque trae las propiedades del back en cada pedido). Es barato:
 * las dos son Client Components livianos que piden sus datos en el navegador.
 *
 * NOTA: no se resuelve toda la sesión del lado del servidor (nombre y rol ya
 * en el HTML) por dos motivos:
 * - Modo real: habría que validar el token y llamar a `GET /usuarios/me` en
 *   cada página pública, sumando un viaje a la API antes de mostrar nada.
 * - Modo mock: las cuentas creadas en el registro viven en el `localStorage`
 *   del navegador, que el servidor no puede leer.
 */
async function haySesionProbable(): Promise<boolean> {
  const cookieStore = await cookies()
  if (USE_MOCKS) return cookieStore.has(SESSION_COOKIE_NAME)
  return cookieStore.getAll().some((cookie) => SUPABASE_SESSION_COOKIE.test(cookie.name))
}

/**
 * layout.tsx — arquetipo A1 (zona pública), compartido por `/`, `/buscar`,
 * `/propiedad/[id]`. Layout anidado (no root): el root layout
 * (`app/layout.tsx`) ya pone `<html>`/`<body>`/`AntdRegistry`/
 * `ConfigProvider` una sola vez — duplicarlos acá causaría el
 * "full page reload" que Next 16 documenta entre root layouts distintos.
 *
 * Quién lo usa: todas las pantallas de la zona pública, sin sesión
 * obligatoria (ver `docs/MapaDePantallas.pdf`, sección "1 Zona pública").
 */
export default async function PublicRouteGroupLayout({ children }: { children: ReactNode }) {
  const sesionProbable = await haySesionProbable()
  return <PublicLayout header={<PublicHeader sesionProbable={sesionProbable} />}>{children}</PublicLayout>
}
