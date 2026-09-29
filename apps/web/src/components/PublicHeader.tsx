'use client'

/**
 * PublicHeader.tsx — el Header de la zona pública con la sesión del usuario.
 *
 * Qué es: arma la sesión para el `Header` de `@rentar/ui` a partir de
 * `useAuth()`. Diseño: Claude Design, "Header público · con sesión iniciada".
 * - Sin sesión: el Header de siempre ("Iniciar sesión" y "Publicar propiedad").
 * - Con sesión: "Ir a mi panel" y el `UserMenu` (Mi panel, Publicar propiedad,
 *   Mi perfil y legajo y, al final, Cerrar sesión). El rol que muestra es el
 *   ACTIVO del `AuthProvider`, el mismo que el panel.
 * - Mientras el `AuthProvider` carga, si la cookie de sesión existe
 *   (`sesionProbable`), un placeholder con la forma de la variante con sesión:
 *   nunca se ve "Iniciar sesión" para después cambiarlo (ver
 *   `app/(public)/layout.tsx`).
 * Cubre: US-39 Iniciar y cerrar sesión (la sesión se ve y se cierra desde
 * cualquier página pública).
 *
 * NOTA: "Cerrar sesión" acá se queda en la página pública (`logout({ quedarse:
 * true })`): el Header pasa a la variante sin sesión, sin recargar.
 * NOTA: no muestra "Viendo como": el diseño del Header no lo tiene (el cambio
 * de rol vive en el panel).
 *
 * De dónde saca los datos: `useAuth()` (`lib/auth/AuthProvider.tsx`).
 * Quién lo usa: `app/(public)/layout.tsx`.
 */
import { HomeOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons'
import { Header, type HeaderSession, type UserMenuItem } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'

/** Rutas del panel a las que lleva el Header con sesión. */
const PANEL_PATH = '/panel'
const ALTA_PATH = '/panel/propiedades/nueva'

/** Ítems del UserMenu del Header (diseño, 02): "Cerrar sesión" lo agrega el componente al final. */
const MENU_ITEMS: UserMenuItem[] = [
  { key: 'panel', label: 'Mi panel', href: PANEL_PATH, icon: <HomeOutlined /> },
  { key: 'publicar', label: 'Publicar propiedad', href: ALTA_PATH, icon: <PlusOutlined /> },
  { key: 'perfil', label: 'Mi perfil y legajo', href: '/panel/perfil', icon: <UserOutlined /> },
]

interface PublicHeaderProps {
  /**
   * `true` si el navegador mandó una cookie de sesión (la lee el layout, del
   * lado del servidor). No la valida: solo dice qué mostrar mientras el
   * `AuthProvider` confirma la sesión.
   */
  sesionProbable: boolean
}

/** Header público con la variante de sesión según `useAuth()`. */
export function PublicHeader({ sesionProbable }: PublicHeaderProps) {
  const { user, activeRole, isLoading, logout } = useAuth()

  const session: HeaderSession | null =
    user && activeRole
      ? {
          name: `${user.nombre} ${user.apellido}`.trim(),
          role: activeRole,
          avatarUrl: user.avatarUrl,
          panelHref: PANEL_PATH,
          publishHref: ALTA_PATH,
          menuItems: MENU_ITEMS,
          onLogout: () => logout({ quedarse: true }),
        }
      : null

  // Sin cookie de sesión no se espera nada: la variante sin sesión sale de entrada.
  return <Header session={session} sessionPending={isLoading && sesionProbable} />
}
