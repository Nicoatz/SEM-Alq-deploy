/**
 * shared/mockStore.ts — persistencia de los datos de prueba en el navegador.
 *
 * Qué es: lo que crea el usuario en modo mock (una cuenta en `/registro`,
 * una propiedad en el alta, una solicitud desde el detalle) se guarda en
 * `localStorage`, así sobrevive a una recarga y el recorrido "registro →
 * login → publicar → verla en Mis propiedades y en /buscar" funciona
 * completo sin backend.
 *
 * Cómo guarda: el elenco (`lib/mocks/`) es la base fija, en código. En
 * `localStorage` solo va lo que el usuario agregó o modificó, por `id`. Al
 * leer se combinan las dos cosas: un registro guardado reemplaza al del
 * elenco con el mismo `id`, y los nuevos se agregan al final. Así, si
 * alguien corrige el elenco en el código, el cambio se ve aunque el
 * navegador tenga datos viejos guardados.
 *
 * Quién lo usa: la rama mock de los services. Nunca las pantallas.
 *
 * NOTA: todo esto es solo para el modo mock. Con el backend real
 * (`NEXT_PUBLIC_USE_MOCKS=false`) no se usa.
 */

/** Prefijo de todas las claves, para no pisar nada más del navegador y poder borrarlas juntas. */
export const MOCK_KEY_PREFIX = 'rentar:mock:'

/** Colecciones que se pueden persistir. Cada una se guarda en `rentar:mock:<nombre>`. */
export type MockCollection = 'usuarios' | 'propiedades' | 'solicitudes'

/**
 * `true` solo en el navegador.
 *
 * NOTA: del lado del servidor (Server Components, como la landing) no existe
 * `localStorage`: ahí estas funciones trabajan solo con el elenco. Por eso la
 * landing muestra únicamente propiedades del elenco, mientras que `/buscar`
 * (que carga del lado del cliente) también ve las que se crearon en el alta.
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/** Lee lo guardado de una colección. Ante cualquier problema (sin permisos, JSON roto) devuelve `[]`. */
function readStored<T>(collection: MockCollection): T[] {
  if (!isBrowser()) return []
  try {
    const raw = window.localStorage.getItem(MOCK_KEY_PREFIX + collection)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

/**
 * Devuelve la colección completa: el elenco (`seed`) con lo guardado en el
 * navegador aplicado encima (ver el encabezado de este archivo).
 */
export function readMockCollection<T extends { id: string }>(collection: MockCollection, seed: readonly T[]): T[] {
  const stored = readStored<T>(collection)
  const storedById = new Map(stored.map((item) => [item.id, item]))
  const seedIds = new Set(seed.map((item) => item.id))

  const merged = seed.map((item) => storedById.get(item.id) ?? item)
  const added = stored.filter((item) => !seedIds.has(item.id))
  return [...merged, ...added]
}

/**
 * Guarda (o reemplaza, si ya existe ese `id`) un registro de la colección.
 * Devuelve `false` si no se pudo guardar (por ejemplo, `localStorage` lleno o
 * bloqueado): el service decide si eso es un error o se sigue sin persistir.
 */
export function saveMockRecord<T extends { id: string }>(collection: MockCollection, record: T): boolean {
  if (!isBrowser()) return false
  try {
    const stored = readStored<T>(collection).filter((item) => item.id !== record.id)
    window.localStorage.setItem(MOCK_KEY_PREFIX + collection, JSON.stringify([...stored, record]))
    return true
  } catch {
    return false
  }
}

/**
 * Borra todo lo guardado con el prefijo `rentar:mock:` (las colecciones de
 * cuentas, propiedades y solicitudes) y deja solo el elenco
 * original. Lo usa el botón "Reiniciar datos de prueba" de las herramientas
 * de desarrollo (`components/dev/DevTools.tsx`).
 */
export function resetMockData(): void {
  if (!isBrowser()) return
  try {
    const keys = Object.keys(window.localStorage).filter((key) => key.startsWith(MOCK_KEY_PREFIX))
    keys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Sin acceso a localStorage no hay nada guardado que borrar.
  }
}
