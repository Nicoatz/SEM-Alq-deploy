'use client'

/**
 * (app)/panel/layout.tsx — AppShell de todas las rutas `/panel/*`.
 *
 * Qué es: una sola raíz autenticada para locador y locatario; el rol activo
 * de `useAuth()` decide el menú (`lib/navigation/navConfig.tsx`), no la ruta.
 * También arma los ítems del UserMenu (Claude Design, "Mi perfil y legajo" ·
 * 02): "Mi perfil y legajo" y "Mis notificaciones". El último ítem, "Cerrar
 * sesión", lo agrega el propio UserMenu (US-39: desvincula la sesión y vuelve
 * a la landing). "Administración" no va: el panel de admin no es del Sprint 1.
 *
 * Cuentas con dos roles (Sofía): la sección "Viendo como" del UserMenu y, en
 * móvil, el chip del rol activo en la barra (Claude Design, "Cambio de rol" ·
 * 04). Reemplazan al viejo ítem "Cambiar a mi panel de…" de la tanda 2. En
 * escritorio sigue además el selector del header (`RoleContextSwitcher`).
 *
 * "Publicar propiedad" (Claude Design, Paneles · 05b): acción del encabezado
 * para cualquier usuario con sesión, locatario o locador, porque cualquiera
 * puede publicar (regla del equipo, 27/09/2026: al publicar la primera se
 * vuelve locador). En móvil pasa al menú hamburguesa y a la hoja del UserMenu
 * (lo resuelve `AppShell#headerAction`). No se muestra en el alta misma.
 *
 * Barra móvil: el título sale del ítem activo del menú; el alta
 * (`/panel/propiedades/nueva`) tiene su propia barra, "‹ Publicar propiedad ·
 * Salir" (Alta de propiedad · 09).
 *
 * De dónde saca los datos: `useAuth()` (`lib/auth/AuthProvider.tsx`) y, para
 * "Viendo como", `services/panel.service.ts#getResumenRoles`.
 *
 * `'use client'` porque necesita hooks (`useAuth`, `usePathname`). La
 * pregunta "¿hay sesión?" ya la respondió `proxy.ts` antes de llegar acá.
 *
 * Quién lo usa: Next.js, para todas las páginas de `(app)/panel/*`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { BellOutlined, LeftOutlined, UserOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ResumenContextoRol, UserRole } from '@rentar/shared-types'
import { AppShell, RoleContextSwitcher, type AppShellHeaderAction, type UserMenuItem, type UserMenuRoleOption } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'
import { readSessionFromDocument } from '@/lib/auth/session-cookie'
import { navItemsByRole, type PanelRole } from '@/lib/navigation/navConfig'
import { getResumenRoles } from '@/services/panel.service'
import styles from './PanelLayout.module.css'

const ROLE_LABEL: Record<PanelRole, string> = {
  locador: 'Locador',
  locatario: 'Locatario',
}

/** Reduce un `UserRole` a los dos roles que tienen panel propio. */
function isPanelRole(role: UserRole): role is PanelRole {
  return role === 'locador' || role === 'locatario'
}

/** Ruta del alta: en móvil tiene su propia barra (Alta de propiedad · 09). */
const ALTA_PATH = '/panel/propiedades/nueva'

/** "Publicar propiedad" del encabezado (Paneles · 05b), para cualquier rol. */
const PUBLICAR_ACTION: AppShellHeaderAction = { label: 'Publicar propiedad', href: ALTA_PATH, 'data-testid': 'panel-publicar' }

/** Títulos de la barra móvil para las rutas que no están en el menú lateral. */
const MOBILE_TITLE_BY_PATH: Record<string, string> = {
  '/panel/perfil': 'Mi perfil y legajo',
  '/panel/notificaciones': 'Mis notificaciones',
}

/**
 * Barra móvil del alta: "‹ Publicar propiedad · Salir". "Salir" vuelve a Mis
 * propiedades (locador) o al panel (locatario, que todavía no la tiene).
 */
function AltaMobileBar({ onBack, exitHref }: { onBack: () => void; exitHref: string }) {
  return (
    <div className={styles.altaBar}>
      <button type="button" className={styles.altaBack} onClick={onBack} aria-label="Volver" data-testid="alta-mobile-volver">
        <LeftOutlined />
      </button>
      <span className={styles.altaTitle}>Publicar propiedad</span>
      <Link href={exitHref} className={styles.altaExit} data-testid="alta-mobile-salir">
        Salir
      </Link>
    </div>
  )
}

/** AppShell del panel: menú por rol, UserMenu y cambio de contexto. */
export default function PanelLayout({ children }: { children: ReactNode }) {
  const { user, roles, activeRole, isLoading, logout, switchRole } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [resumenRoles, setResumenRoles] = useState<ResumenContextoRol[]>([])

  // ─── Sesión inválida ────────────────────────────────────────────────
  // Hay cookie (el proxy dejó pasar) pero AuthProvider no pudo resolver el
  // usuario: la sesión no sirve, se vuelve al login.
  // NOTA: si NO hay cookie es porque la persona tocó "Cerrar sesión": ahí no
  // se redirige al login, porque el logout ya está llevando a la landing
  // (US-39) y las dos navegaciones competirían.
  useEffect(() => {
    if (!isLoading && !user && readSessionFromDocument()) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [isLoading, user, router, pathname])

  // ─── Menú y UserMenu ────────────────────────────────────────────────
  const panelRoles = useMemo(() => roles.filter(isPanelRole), [roles])
  const navItems = useMemo(() => (activeRole && isPanelRole(activeRole) ? navItemsByRole[activeRole] : []), [activeRole])

  const activeKey = useMemo(() => {
    const matches = navItems.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    // Gana el match más específico (href más largo): así "/panel" no le
    // gana a "/panel/propiedades" cuando la ruta activa es esta última.
    const mostSpecific = [...matches].sort((a, b) => b.href.length - a.href.length)[0]
    return mostSpecific?.key ?? navItems[0]?.key ?? ''
  }, [navItems, pathname])

  const userMenuItems = useMemo<UserMenuItem[]>(() => {
    if (!user || !activeRole) return []
    return [
      { key: 'perfil', label: 'Mi perfil y legajo', href: '/panel/perfil', icon: <UserOutlined /> },
      // NOTA: sin contador de no leídas: las notificaciones no son del Sprint 1
      // (el UserMenu lo soporta con `badgeCount`).
      { key: 'notificaciones', label: 'Mis notificaciones', href: '/panel/notificaciones', icon: <BellOutlined /> },
    ]
  }, [user, activeRole])

  // ─── "Viendo como" (solo cuentas con dos roles) ─────────────────────
  const hasTwoRoles = panelRoles.length > 1
  useEffect(() => {
    if (!hasTwoRoles) return
    let cancelled = false
    getResumenRoles(panelRoles)
      .then((resumen) => {
        if (!cancelled) setResumenRoles(resumen)
      })
      .catch(() => {
        // Sin el resumen, las filas se muestran igual, sin segunda línea ni contador.
        if (!cancelled) setResumenRoles([])
      })
    return () => {
      cancelled = true
    }
  }, [hasTwoRoles, panelRoles, activeRole])

  const roleOptions = useMemo<UserMenuRoleOption[]>(
    () =>
      hasTwoRoles
        ? panelRoles.map((role) => {
            const resumen = resumenRoles.find((item) => item.role === role)
            // Genérico, sin género: no hay un dato para elegir "locadora"/"locador".
            return { role, label: ROLE_LABEL[role], description: resumen?.description, badgeCount: resumen?.pendingCount }
          })
        : [],
    [hasTwoRoles, panelRoles, resumenRoles],
  )

  /** Cambia el rol activo y vuelve al inicio del panel de ese rol. */
  function handleRoleChange(role: UserRole): void {
    if (!isPanelRole(role)) return
    switchRole(role)
    router.push('/panel')
  }

  // ─── Barra móvil ────────────────────────────────────────────────────
  const mobileTitle = MOBILE_TITLE_BY_PATH[pathname] ?? navItems.find((item) => item.key === activeKey)?.label

  // ─── Render ─────────────────────────────────────────────────────────
  // Hueco breve mientras se lee la cookie y se resuelve el usuario (o
  // mientras corre el redirect a /login): no hay nada consistente que mostrar.
  if (isLoading || !user || !activeRole) {
    return null
  }

  return (
    <AppShell
      navItems={navItems}
      activeKey={activeKey}
      user={{ name: `${user.nombre} ${user.apellido}`, role: activeRole, avatarUrl: user.avatarUrl, subtitle: isPanelRole(activeRole) ? ROLE_LABEL[activeRole] : undefined }}
      userMenuItems={userMenuItems}
      onLogout={logout}
      mobileTitle={mobileTitle}
      activeRoleLabel={hasTwoRoles && isPanelRole(activeRole) ? ROLE_LABEL[activeRole] : undefined}
      roleOptions={roleOptions}
      onRoleChange={handleRoleChange}
      mobileHeader={pathname === ALTA_PATH ? <AltaMobileBar onBack={() => router.back()} exitHref={activeRole === 'locador' ? '/panel/propiedades' : '/panel'} /> : undefined}
      headerAction={pathname === ALTA_PATH ? undefined : PUBLICAR_ACTION}
      contextSwitcher={
        hasTwoRoles ? (
          <RoleContextSwitcher
            roles={panelRoles.map((role) => ({ role, label: ROLE_LABEL[role] }))}
            activeRole={activeRole}
            onChange={handleRoleChange}
            data-testid="role-context-switcher"
          />
        ) : undefined
      }
      data-testid="app-shell-panel"
    >
      {children}
    </AppShell>
  )
}
