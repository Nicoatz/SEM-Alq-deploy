/**
 * redirect.ts — adónde volver después del login (US-39).
 *
 * Qué es: US-39 pide "redirigir al usuario a la página en la que se
 * encontraba antes de ingresar al portal de inicio de sesión". Esa página
 * viaja en `?next=` (la pone `proxy.ts`, o el link que lleva al login).
 *
 * Quién lo usa: `/login` y `/registro` (`safeNextPath`) y el Header público
 * (`loginHrefDesde`, en `components/PublicHeader.tsx`).
 */

/**
 * Devuelve `next` solo si es una ruta interna segura; si no, `null`.
 *
 * NOTA: por seguridad solo se aceptan rutas que empiezan con una sola `/`.
 * Así un link armado como `/login?next=https://sitio-falso.com` (o
 * `//sitio-falso.com`, que el navegador toma como otro dominio) no puede
 * mandar al usuario afuera de RentAR después de loguearse ("open redirect").
 * Tampoco se vuelve a `/login` ni a `/registro`, para no entrar en un bucle.
 */
export function safeNextPath(next: string | string[] | undefined | null): string | null {
  if (typeof next !== 'string') return null
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  if (next === '/login' || next.startsWith('/login?') || next === '/registro' || next.startsWith('/registro?')) return null
  return next
}

/**
 * Pantallas de autenticación: desde acá "Iniciar sesión" no lleva `next`
 * (volver a `/login` o a `/recuperar` después de loguearse no tiene sentido).
 */
const RUTAS_DE_AUTENTICACION = ['/login', '/registro', '/recuperar']

/**
 * El link de "Iniciar sesión" del Header público (US-39: "redirigir al usuario
 * a la página en la que se encontraba"): `/login?next=<ruta actual con su query>`.
 *
 * `pathname` y `search` salen de `usePathname()` y `useSearchParams()` (sin el
 * `?` inicial). El `next` va codificado entero, así la query de la página (por
 * ejemplo, los filtros de `/buscar`) no se mezcla con la del login y vuelve tal cual.
 *
 * NOTA: el `#` (por ejemplo, `/#como-funciona`) no llega: el navegador no lo
 * manda y `usePathname` no lo incluye. Se vuelve a la página, sin el ancla.
 */
export function loginHrefDesde(pathname: string, search: string): string {
  if (RUTAS_DE_AUTENTICACION.includes(pathname)) return '/login'
  const actual = search ? `${pathname}?${search}` : pathname
  return `/login?next=${encodeURIComponent(actual)}`
}
