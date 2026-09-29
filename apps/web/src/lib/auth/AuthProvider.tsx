'use client'

/**
 * AuthProvider.tsx — sesión y rol activo, en un solo contexto.
 *
 * Qué es: quién está logueado, sus roles y cuál está activo ahora mismo.
 * El rol activo vive en el mismo provider que la sesión: es lo que usa el
 * cambio de contexto del UserMenu para cuentas con dos roles (hoy, solo
 * Sofía Ledesma: locadora de Mariano Moreno 285 y locataria de Obispo Trejo
 * 1250).
 * Cubre: US-39 Iniciar y cerrar sesión ("vincular la sesión al navegador";
 * "desvincularla" al cerrar sesión).
 *
 * Dos ramas, según `NEXT_PUBLIC_USE_MOCKS`:
 * - Modo mock: la sesión ES la cookie `rentar_session` (`session-cookie.ts`).
 * - Modo real: la sesión es la de Supabase Auth (cookies `sb-…`, que maneja
 *   `@supabase/ssr`). La cookie `rentar_session` se sigue escribiendo, pero
 *   solo para recordar el rol activo y para que el layout del panel sepa que
 *   había una sesión (ver `app/(app)/panel/layout.tsx`); no autentica nada.
 *
 * De dónde saca los datos: `services/auth.service.ts` (login/logout) y
 * `services/usuarios.service.ts#getUsuarioActual` (el perfil al recargar).
 *
 * Quién lo usa: `useAuth()` desde cualquier Client Component (layout del
 * panel, pantallas de login y registro). Se monta una sola vez, en
 * `lib/AppProviders.tsx`.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { UserRole, UsuarioSesion } from '@rentar/shared-types'
import { login as loginRequest, logout as logoutRequest, type LoginCredentials } from '@/services/auth.service'
import { USE_MOCKS } from '@/services/shared/config'
import { getUsuarioActual } from '@/services/usuarios.service'
import { clearSessionFromDocument, readSessionFromDocument, writeSessionToDocument } from './session-cookie'
import { getSupabaseBrowserClient } from './supabase/client'

interface AuthContextValue {
  user: UsuarioSesion | null
  roles: UserRole[]
  activeRole: UserRole | null
  /** `true` mientras se resuelve la sesión al montar. */
  isLoading: boolean
  /**
   * Valida credenciales y guarda la sesión (dura hasta cerrarla: no hay
   * "Recordarme"). Devuelve el usuario para que la pantalla decida adónde ir.
   */
  login: (credentials: LoginCredentials) => Promise<UsuarioSesion>
  /**
   * US-39: cierra la sesión. Por defecto termina en la landing con una recarga
   * completa (desde el panel). Con `{ quedarse: true }` se queda en la página
   * pública actual y solo pasa a "sin sesión" (desde el Header público).
   */
  logout: (opciones?: { quedarse?: boolean }) => void
  switchRole: (role: UserRole) => void
  /**
   * Vuelve a pedir el perfil y los roles sin cerrar sesión (después de
   * publicar la primera propiedad, la cuenta suma el rol locador). Si el
   * usuario tiene `rolPreferido`, queda como rol activo. Devuelve el usuario
   * actualizado, o `null` si ya no hay sesión (no toca el estado).
   */
  refrescarUsuario: (rolPreferido?: UserRole) => Promise<UsuarioSesion | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Rol con el que arranca la sesión. Si la cuenta es locadora, arranca como
 * locador (su panel es el que existe en el Sprint 1); si no, con el primero.
 */
function initialRole(user: UsuarioSesion): UserRole {
  return user.roles.includes('locador') ? 'locador' : user.roles[0]
}

/**
 * Rol activo al recargar: el guardado en la cookie si sigue siendo de este
 * usuario y todavía tiene ese rol; si no, el inicial.
 */
function restoredRole(user: UsuarioSesion): UserRole {
  const saved = readSessionFromDocument()
  return saved && saved.userId === user.id && user.roles.includes(saved.activeRole) ? saved.activeRole : initialRole(user)
}

/**
 * Resuelve el usuario en sesión al montar, en modo real.
 * Sin sesión de Supabase, ni siquiera se llama a la API.
 * @throws {ServiceError} si hay sesión pero `/usuarios/me` falla.
 */
async function resolveRealUser(): Promise<UsuarioSesion | null> {
  const { data } = await getSupabaseBrowserClient().auth.getSession()
  if (!data.session) return null
  return getUsuarioActual()
}

/** Provider de sesión. Envuelve toda la app (ver `lib/AppProviders.tsx`). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  // ─── Estado local ───────────────────────────────────────────────────
  const [user, setUser] = useState<UsuarioSesion | null>(null)
  const [activeRole, setActiveRole] = useState<UserRole | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ─── Carga de datos: hidratar la sesión al montar ────────────────────
  // Todos los setState corren dentro de .then()/.finally() para que ninguno
  // se ejecute de forma síncrona en el cuerpo del efecto.
  useEffect(() => {
    let cancelled = false
    const saved = readSessionFromDocument()
    // En modo mock, sin cookie no hay nada que resolver (igual que antes de
    // conectar el back: sin espera simulada).
    const resolveUser = USE_MOCKS ? (saved ? getUsuarioActual() : Promise.resolve(null)) : resolveRealUser()

    resolveUser
      .then((usuario) => {
        if (cancelled) return
        if (usuario && USE_MOCKS && saved && usuario.roles.includes(saved.activeRole)) {
          setUser(usuario)
          setActiveRole(saved.activeRole)
        } else if (usuario && !USE_MOCKS) {
          const role = restoredRole(usuario)
          writeSessionToDocument({ userId: usuario.id, activeRole: role })
          setUser(usuario)
          setActiveRole(role)
        } else if (saved) {
          // Cookie corrupta, sesión vencida, o usuario que ya no existe o
          // perdió ese rol: se descarta en vez de dejar la app en un estado
          // inconsistente.
          clearSessionFromDocument()
        }
      })
      .catch(() => {
        // NOTA: si `/usuarios/me` falla al recargar (back caído o error 5xx),
        // se sigue como "sin sesión" y la cookie queda: el layout del panel
        // manda a /login, y ahí el login vuelve a pedir el perfil y muestra
        // el error del servidor con "Reintentar". Es a propósito: mostrar el
        // error sin pasar por el login obligaría a tocar el layout del panel.
        // Nunca se inventan roles cuando `/usuarios/me` falla.
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ─── Modo real: el caché de rutas de Next ───────────────────────────
  // NOTA: Next guarda en el navegador las respuestas de las rutas ya
  // visitadas, INCLUIDOS los redirects del proxy. Si la sesión venció, el
  // proxy respondió "/panel → /login" y eso quedó guardado: después del
  // login, ir a /panel reusaba ese redirect y la persona quedaba en /login.
  // Cuando la sesión cambia (login o sesión perdida) se vacía ese caché con
  // `router.refresh()`, como recomienda la guía de @supabase/ssr. El logout
  // hace algo más fuerte: recarga la página entera (ver `logout`).
  const refreshRoutes = useCallback(() => router.refresh(), [router])

  // `true` mientras corre un logout propio: su SIGNED_OUT no tiene que hacer
  // refresh (pediría de nuevo la ruta del panel, el proxy la mandaría a
  // /login y eso le ganaría a la salida hacia la landing).
  const loggingOutRef = useRef(false)

  // ─── Modo real: la sesión de Supabase se cerró por fuera ────────────
  // Por ejemplo, el refresh token venció o se cerró sesión en otra pestaña.
  // NOTA: dentro del callback de onAuthStateChange no se llama a Supabase
  // (lo desaconseja supabase-js: puede trabar el cliente); solo se limpia el
  // estado local.
  useEffect(() => {
    if (USE_MOCKS) return
    const { data } = getSupabaseBrowserClient().auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' || loggingOutRef.current) return
      setUser(null)
      setActiveRole(null)
      refreshRoutes()
    })
    return () => data.subscription.unsubscribe()
  }, [refreshRoutes])

  // ─── Modo real: "atrás" después de cerrar sesión ────────────────────
  // NOTA: el navegador puede restaurar la página anterior desde su caché de
  // historial (bfcache) sin pedirle nada al servidor: después del logout,
  // "atrás" mostraba /panel en blanco sin pasar por el proxy. Si la página
  // vuelve de ese caché, se recarga: así el proxy decide (panel o /login).
  useEffect(() => {
    if (USE_MOCKS) return
    function onPageShow(event: PageTransitionEvent): void {
      if (event.persisted) window.location.reload()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  // ─── Modo real: revisar la sesión en cada cambio de ruta ────────────
  // Si el proxy encontró la sesión vencida, borró las cookies de Supabase y
  // mandó a /login; pero este provider vive en el layout raíz y seguiría
  // "creyendo" que hay usuario (y el login lo mandaría de vuelta al panel).
  // `getSession()` lee la cookie (sin red, salvo que haya que renovar el
  // token): si ya no hay sesión, se limpia el estado.
  const pathname = usePathname()
  useEffect(() => {
    if (USE_MOCKS || !user) return
    let cancelled = false
    getSupabaseBrowserClient()
      .auth.getSession()
      .then(({ data }) => {
        if (cancelled || data.session) return
        setUser(null)
        setActiveRole(null)
        refreshRoutes()
      })
      .catch(() => {
        // Si no se puede leer la sesión, se deja como está: la próxima
        // llamada a la API responde 401 y la pantalla lo muestra.
      })
    return () => {
      cancelled = true
    }
  }, [pathname, user, refreshRoutes])

  // ─── Handlers ───────────────────────────────────────────────────────

  async function login(credentials: LoginCredentials): Promise<UsuarioSesion> {
    const usuario = await loginRequest(credentials)
    const role = initialRole(usuario)
    writeSessionToDocument({ userId: usuario.id, activeRole: role })
    setUser(usuario)
    setActiveRole(role)
    if (!USE_MOCKS) refreshRoutes()
    return usuario
  }

  /** Borra la sesión del navegador y vuelve a la landing (modo mock). */
  function endSession(): void {
    clearSessionFromDocument()
    setUser(null)
    setActiveRole(null)
    router.push('/')
  }

  /**
   * Cierra la sesión sin salir de la página pública en la que está (Header
   * público, "Cerrar sesión"). La página queda en su variante sin sesión, sin
   * recargar.
   * NOTA: desde lo público no hay links al panel que usen navegación del
   * cliente ("Publicar propiedad" y los botones de antd son `<a>` comunes), así
   * que la próxima entrada al panel pasa por el proxy y pide login. Por eso
   * acá no hace falta la recarga completa del logout del panel.
   */
  function logoutQuedandose(): void {
    clearSessionFromDocument()
    const terminar = () => {
      setUser(null)
      setActiveRole(null)
      refreshRoutes()
    }
    if (USE_MOCKS) {
      void logoutRequest().catch(() => {
        // Aunque el back no responda, la sesión del navegador se cierra igual.
      })
      terminar()
      return
    }
    void logoutRequest()
      .catch(() => {
        // Igual se cierra la sesión de este navegador.
      })
      .finally(terminar)
  }

  /** US-39: cerrar sesión desvincula la sesión del navegador y vuelve a la landing. */
  function logout(opciones?: { quedarse?: boolean }): void {
    if (opciones?.quedarse) {
      logoutQuedandose()
      return
    }
    if (USE_MOCKS) {
      void logoutRequest().catch(() => {
        // Aunque el back no responda, la sesión del navegador se cierra igual.
      })
      endSession()
      return
    }
    // NOTA: en modo real se espera a Supabase antes de salir, para que el
    // proxy no vea todavía las cookies de sesión si la persona vuelve al
    // panel enseguida. `logout` no tira errores de red (ver auth.service).
    // La cookie del rol se borra ANTES: `signOut` dispara SIGNED_OUT, y con
    // la cookie todavía puesta el layout del panel mandaría a /login en vez
    // de dejar que se vaya a la landing.
    // NOTA: al final se recarga la página entera en la landing (no
    // `router.push`): así se descarta todo lo que Next guardó de las rutas
    // del panel (son estáticas y quedan 5 minutos en el caché del
    // navegador). Si no, volver al panel sin recargar podía mostrarlo sin
    // pasar por el proxy.
    loggingOutRef.current = true
    clearSessionFromDocument()
    void logoutRequest()
      .catch(() => {
        // Igual se cierra la sesión de este navegador.
      })
      .finally(() => {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa a propósito (ver la NOTA de arriba)
        window.location.assign('/')
      })
  }

  /**
   * Relee `/usuarios/me` (en mock, la cuenta guardada) y actualiza usuario y
   * rol activo, sin pasar por el login.
   * Regla del equipo (27/09/2026): al publicar la primera propiedad el back
   * le suma el rol locador a la cuenta. El alta llama a esto después del 201
   * con `'locador'`, así "Viendo como" y Mis propiedades aparecen enseguida.
   * NOTA: termina con `router.refresh()` (en real y en mock), para que Next
   * no reuse una respuesta vieja de la ruta actual. `/buscar` no guarda la
   * lista en el navegador (se sacó el caché de 30 s), así que la propiedad
   * nueva aparece en la próxima búsqueda sin hacer nada más.
   * @throws {ServiceError} si `/usuarios/me` falla por otra cosa que la sesión.
   */
  async function refrescarUsuario(rolPreferido?: UserRole): Promise<UsuarioSesion | null> {
    const usuario = await getUsuarioActual()
    if (!usuario) return null
    const role =
      rolPreferido && usuario.roles.includes(rolPreferido)
        ? rolPreferido
        : activeRole && usuario.roles.includes(activeRole)
          ? activeRole
          : initialRole(usuario)
    writeSessionToDocument({ userId: usuario.id, activeRole: role })
    setUser(usuario)
    setActiveRole(role)
    refreshRoutes()
    return usuario
  }

  /** Cambio de contexto (cuentas con dos roles). Ignora un rol que el usuario no tiene. */
  function switchRole(role: UserRole): void {
    if (!user || !user.roles.includes(role)) return
    writeSessionToDocument({ userId: user.id, activeRole: role })
    setActiveRole(role)
  }

  // ─── Render ─────────────────────────────────────────────────────────

  const value: AuthContextValue = {
    user,
    roles: user?.roles ?? [],
    activeRole,
    isLoading,
    login,
    logout,
    switchRole,
    refrescarUsuario,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Acceso al contexto de {@link AuthProvider}. Tira un error si se usa afuera del provider. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>.')
  }
  return context
}
