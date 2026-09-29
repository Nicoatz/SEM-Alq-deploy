'use client'

/**
 * AppShell.tsx — layout de los paneles autenticados: menú lateral, header con campanita y UserMenu,
 * y barra móvil.
 *
 * Quién lo usa: el layout del panel (`app/(app)/panel/layout.tsx`) y el catálogo.
 */
import { useState, type ReactNode } from 'react'
import { Drawer, Layout, Menu } from 'antd'
import { MenuOutlined, PlusOutlined } from '@ant-design/icons'
import type { UserRole } from '@rentar/shared-types'
import { useNextBridge } from '../../providers/NextBridge'
import { LOGO } from '../../assets/logo'
import { NotificationBell, type NotificationItem } from '../feedback/NotificationBell'
import { UserMenu, type UserMenuItem, type UserMenuRoleOption } from '../feedback/UserMenu'
import styles from './AppShell.module.css'

const { Sider, Header: LayoutHeader, Content } = Layout

// ─── Tipos ─────────────────────────────────────────────────────────────────

/** Un ítem del menú lateral (lo arma `apps/web` en `lib/navigation/navConfig.tsx`). */
export interface AppShellNavItem {
  key: string
  label: string
  href: string
  icon?: ReactNode
}

/**
 * Acción principal del encabezado (ej. "Publicar propiedad"): un link, no un
 * `ReactNode`, porque el `AppShell` la dibuja en tres lugares distintos según
 * el ancho (ver `AppShellProps#headerAction`).
 */
export interface AppShellHeaderAction {
  label: string
  href: string
  /** Ícono a la izquierda del texto; por defecto, un "+". */
  icon?: ReactNode
  /**
   * `data-testid` del botón del encabezado. El del menú hamburguesa es el
   * mismo con `-drawer` al final; el de la hoja del `UserMenu`,
   * `user-menu-item-header-action`.
   */
  'data-testid'?: string
}

interface AppShellUser {
  name: string
  role: UserRole
  avatarUrl?: string
  /** Segunda línea de la cabecera del `UserMenu` desplegado (opcional, ver `UserMenu`). */
  subtitle?: string
}

/** Props de {@link AppShell}. */
interface AppShellProps {
  /** Ítems de navegación — armados por rol en `apps/web` (ver `navConfig`). */
  navItems: AppShellNavItem[]
  /** `key` del ítem de navegación activo. */
  activeKey: string
  user: AppShellUser
  notifications?: NotificationItem[]
  /** Ítems de `UserMenu` por arriba de "Cerrar sesión" (Mi perfil, Notificaciones, cambio de contexto, Administración...). */
  userMenuItems?: UserMenuItem[]
  onLogout?: () => void
  children: ReactNode
  /** Igual que en `AuthLayout`: `min-height: 100%` en vez de `100vh`, para previsualizarlo acotado. */
  compact?: boolean
  /**
   * Selector "Viendo como..." del header (`RoleContextSwitcher`), para
   * cuentas con más de un rol — se monta entre el toggle mobile y las
   * acciones del header. `undefined`/`null` no ocupa espacio.
   */
  contextSwitcher?: ReactNode
  /**
   * `'admin'` aplica el header oscuro del rol admin (panel de administración: sin US en Sprint 0, mapa US-44/US-45): setea
   * `data-rentar-theme="dark"` sobre el header, reusando la paleta dark ya
   * calibrada de `tokens/css-vars.css` (la misma que usa el toggle de tema
   * de `/design-system`) en vez de inventar tokens nuevos. NOTA: los
   * paneles flotantes de `NotificationBell`/`UserMenu` se renderizan en un
   * portal fuera de este subárbol, así que siguen viéndose claros — alcance
   * de esta tanda es solo la barra del header.
   */
  variant?: 'default' | 'admin'
  /**
   * Título de la barra superior en móvil y tablet (debajo de 1024px), entre
   * ☰ y la campanita (ej. "Mi panel", "Propiedades"). Opcional.
   */
  mobileTitle?: string
  /**
   * Para cuentas con dos roles: debajo de 768px la barra muestra un chip con
   * el rol activo en vez del título (y en vez de `contextSwitcher`), y
   * tocarlo abre la misma hoja que el avatar (Cambio de rol · 04).
   */
  activeRoleLabel?: string
  /** Filas de "Viendo como" del `UserMenu` (ver `UserMenu#roleOptions`). */
  roleOptions?: UserMenuRoleOption[]
  /** Se llama al elegir otro rol en "Viendo como". */
  onRoleChange?: (role: UserRole) => void
  /**
   * Barra propia para flujos enfocados (ej. el alta: "‹ Publicar propiedad ·
   * Salir"). Debajo de 768px reemplaza a toda la barra superior. Opcional.
   */
  mobileHeader?: ReactNode
  /**
   * Acción secundaria del encabezado (Claude Design, Paneles · 05b:
   * "Publicar propiedad" para cualquier usuario con sesión). Opcional.
   * - Desde 768px: botón blanco con borde, antes de la campanita.
   * - Debajo de 1024px (menú en `Drawer`): primer elemento del menú hamburguesa.
   * - Debajo de 768px: sale de la barra y pasa a ser el primer ítem de la
   *   hoja del `UserMenu` (ver `UserMenu#sheetLeadingItem`).
   */
  headerAction?: AppShellHeaderAction
  /**
   * A dónde lleva el logo del menú lateral (y del menú móvil). Por defecto, a
   * la landing (`/`): pedido del PO, el logo siempre saca del panel al sitio
   * público.
   */
  logoHref?: string
  'data-testid'?: string
}

// ─── Componente ────────────────────────────────────────────────────────────

/**
 * Layout base de los paneles autenticados (locador, locatario, garante,
 * admin): sidebar con el menú (fijo en desktop, `Drawer` en mobile) +
 * header con campanita de notificaciones y menú de usuario + área de
 * contenido. La navegación se recibe por props — este componente no sabe
 * nada de rutas de RentAR en particular.
 *
 * En móvil (Cambio de rol · 04) la barra es ☰ · título (o el chip del rol
 * activo, en cuentas con dos roles) · campanita · avatar.
 */
export function AppShell({
  navItems,
  activeKey,
  user,
  notifications = [],
  userMenuItems,
  onLogout,
  children,
  compact = false,
  contextSwitcher,
  variant = 'default',
  mobileTitle,
  activeRoleLabel,
  roleOptions,
  onRoleChange,
  mobileHeader,
  headerAction,
  logoHref = '/',
  ...rest
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  // Controla la hoja del UserMenu desde afuera: la abre el avatar o el chip del rol.
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const { ImageComponent, LinkComponent } = useNextBridge()

  const actionIcon = headerAction ? (headerAction.icon ?? <PlusOutlined />) : null
  const actionTestId = headerAction?.['data-testid']

  const menuItems = navItems.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: (
      <LinkComponent href={item.href} onClick={() => setMobileOpen(false)}>
        {item.label}
      </LinkComponent>
    ),
  }))

  return (
    <Layout className={`${styles.layout} ${compact ? styles.layoutCompact : ''}`} {...rest}>
      <Sider width={240} className={styles.sider}>
        <div className={styles.logoWrap}>
          <LinkComponent href={logoHref} className={styles.logoLink} aria-label="RentAR — ir al inicio" data-testid="app-shell-logo-link">
            {/* `priority`: el logo del sider está siempre arriba del pliegue. Con lazy-loading, bajo
                1024px (sider en `display: none`) el `<img>` nunca carga y su `decode()` queda
                pendiente para siempre — colgaba la captura de previews de /design-sync. */}
            <ImageComponent src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="RentAR" style={{ height: '2rem', width: 'auto' }} priority />
          </LinkComponent>
        </div>
        <Menu mode="inline" selectedKeys={[activeKey]} items={menuItems} style={{ borderInlineEnd: 'none' }} />
      </Sider>

      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        closable={false}
        size={240}
        styles={{ body: { padding: 0 } }}
      >
        <div className={styles.logoWrap}>
          <LinkComponent href={logoHref} className={styles.logoLink} onClick={() => setMobileOpen(false)} aria-label="RentAR — ir al inicio">
            <ImageComponent src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="RentAR" style={{ height: '2rem', width: 'auto' }} />
          </LinkComponent>
        </div>
        {headerAction && (
          <div className={styles.drawerAction}>
            <LinkComponent
              href={headerAction.href}
              className={`${styles.headerAction} ${styles.headerActionBlock}`}
              onClick={() => setMobileOpen(false)}
              data-testid={actionTestId ? `${actionTestId}-drawer` : undefined}
            >
              <span className={styles.headerActionIcon} aria-hidden="true">{actionIcon}</span>
              {headerAction.label}
            </LinkComponent>
          </div>
        )}
        <Menu mode="inline" selectedKeys={[activeKey]} items={menuItems} style={{ borderInlineEnd: 'none' }} />
      </Drawer>

      <Layout>
        <LayoutHeader
          className={`${styles.header} ${mobileHeader ? styles.headerWithMobileBar : ''}`}
          {...(variant === 'admin' ? { 'data-rentar-theme': 'dark' } : {})}
        >
          <button
            type="button"
            className={styles.menuButton}
            aria-label="Abrir menú"
            onClick={() => setMobileOpen(true)}
            data-testid="app-shell-menu-toggle"
          >
            <MenuOutlined />
          </button>
          {(mobileTitle || activeRoleLabel) && (
            <div className={`${styles.mobileCenter} ${activeRoleLabel ? styles.mobileCenterWithRole : ''}`}>
              {mobileTitle && <span className={styles.mobileTitle}>{mobileTitle}</span>}
              {activeRoleLabel && (
                <button
                  type="button"
                  className={styles.roleChip}
                  onClick={() => setUserMenuOpen(true)}
                  aria-label={`Viendo como ${activeRoleLabel}. Cambiar de rol`}
                  data-testid="app-shell-role-chip"
                >
                  <span className={styles.roleChipDot} aria-hidden="true" />
                  {activeRoleLabel}
                </button>
              )}
            </div>
          )}
          {contextSwitcher && (
            <div className={`${styles.contextSwitcherSlot} ${activeRoleLabel ? styles.contextSwitcherDesktopOnly : ''}`}>{contextSwitcher}</div>
          )}
          <div className={styles.headerActions}>
            {headerAction && (
              <LinkComponent href={headerAction.href} className={`${styles.headerAction} ${styles.headerActionBar}`} data-testid={actionTestId}>
                <span className={styles.headerActionIcon} aria-hidden="true">{actionIcon}</span>
                {headerAction.label}
              </LinkComponent>
            )}
            <NotificationBell notifications={notifications} />
            <UserMenu
              name={user.name}
              role={user.role}
              avatarUrl={user.avatarUrl}
              subtitle={user.subtitle}
              items={userMenuItems}
              onLogout={onLogout}
              roleOptions={roleOptions}
              onRoleChange={onRoleChange}
              sheetLeadingItem={headerAction ? { key: 'header-action', label: headerAction.label, href: headerAction.href, icon: actionIcon } : undefined}
              open={userMenuOpen}
              onOpenChange={setUserMenuOpen}
            />
          </div>
          {mobileHeader && <div className={styles.mobileBar}>{mobileHeader}</div>}
        </LayoutHeader>
        <Content className={styles.content}>{children}</Content>
      </Layout>
    </Layout>
  )
}
