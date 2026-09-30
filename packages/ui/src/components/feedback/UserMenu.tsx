'use client'

/**
 * UserMenu.tsx — menú de usuario: cabecera, "Viendo como", ítems y "Cerrar sesión"; hoja desde
 * abajo en móvil.
 *
 * Diseño: "Mi perfil y legajo" · 02 y "Cambio de rol" · 04.
 * Quién lo usa: `AppShell` y el catálogo.
 */
import { useState, type ReactNode } from 'react'
import { CheckOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Drawer, Dropdown, Grid, type MenuProps } from 'antd'
import type { UserRole } from '@rentar/shared-types'
import { useNextBridge } from '../../providers/NextBridge'
import styles from './UserMenu.module.css'

const ROLE_LABEL: Record<UserRole, string> = {
  locador: 'Locador',
  locatario: 'Locatario',
  garante: 'Garante',
  admin: 'Administrador',
}

/**
 * Ítem configurable del menú (Mi perfil, Notificaciones, cambio de
 * contexto, Administración...). `href` navega, `onClick` ejecuta una
 * acción — un ítem usa uno u otro, no los dos.
 */
export interface UserMenuItem {
  key: string
  label: string
  icon?: ReactNode
  href?: string
  onClick?: () => void
  danger?: boolean
  /** Contador rojo a la derecha del ítem (ej. notificaciones sin leer). Sin valor o en 0, no se muestra. */
  badgeCount?: number
}

/**
 * Una fila de "Viendo como" (Claude Design, "Cambio de rol" · 04): un rol
 * del usuario, con una segunda línea de contexto y, si no es el activo, un
 * contador de pendientes.
 */
export interface UserMenuRoleOption {
  role: UserRole
  /** Texto de la fila, ej. "Locador". */
  label: string
  /** Segunda línea, ej. "1 propiedad · 1 cobro vencido". */
  description?: string
  /** Contador rojo; se muestra solo en el rol que NO está activo. */
  badgeCount?: number
}

/** Props de {@link UserMenu}. */
interface UserMenuProps {
  name: string
  role: UserRole
  avatarUrl?: string
  /**
   * Segunda línea de la cabecera del menú desplegado, debajo del nombre (ej.
   * "Locatario · Obispo Trejo 1250"). Si no se pasa, se muestra el rol.
   */
  subtitle?: string
  /**
   * Ítems por arriba de "Cerrar sesión" (que siempre es el último, fijo).
   * Los arma `apps/web` según el usuario en sesión — ver
   * `(app)/panel/layout.tsx`: "Mi perfil"/"Notificaciones" siempre,
   * "Administración" solo con rol admin. El cambio de rol va aparte, en
   * `roleOptions`.
   */
  items?: UserMenuItem[]
  onLogout?: () => void
  /**
   * Roles para la sección "Viendo como" (Cambio de rol · 04). Se muestra solo
   * con dos o más roles; el activo es `role`. Reemplaza al viejo ítem
   * "Cambiar a mi panel de…".
   */
  roleOptions?: UserMenuRoleOption[]
  /** Se llama al tocar un rol que no es el activo. */
  onRoleChange?: (role: UserRole) => void
  /**
   * Ítem destacado que va PRIMERO en la hoja móvil, en azul (Claude Design,
   * Paneles · 05b: "Publicar propiedad"). Solo en la hoja, no en el dropdown
   * de escritorio: ahí la acción ya está en el encabezado. Lo pasa `AppShell`
   * desde su `headerAction`. Opcional.
   */
  sheetLeadingItem?: UserMenuItem
  /**
   * Apertura controlada (opcional). La usa `AppShell` para que el chip del
   * rol de la barra móvil abra la misma hoja que el avatar. Sin estas props,
   * el menú maneja su propio estado, como antes.
   */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  'data-testid'?: string
}

/** Iniciales para el avatar sin foto: "Sofía Ledesma" → "SL". */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Menú de usuario del `AppShell`: el botón con avatar, nombre y rol abre la
 * "puerta de todo lo que no está en el menú lateral" (Claude Design, "Mi
 * perfil y legajo" · 02): cabecera con avatar, nombre y subtítulo; los ítems
 * configurables (con contador opcional); un separador y "Cerrar sesión", en
 * rojo, siempre último.
 *
 * Con dos roles suma la sección "Viendo como" (Cambio de rol · 04): una fila
 * de 52px por rol, con ✓ en el activo y el contador de pendientes en el
 * otro.
 *
 * En escritorio se despliega como dropdown. En móvil (debajo de 768px) sube
 * como una hoja desde abajo, con ítems de 48px de alto para el dedo, y el
 * botón muestra solo el avatar.
 */
export function UserMenu({
  name,
  role,
  avatarUrl,
  subtitle,
  items = [],
  onLogout,
  roleOptions = [],
  onRoleChange,
  sheetLeadingItem,
  open,
  onOpenChange,
  ...rest
}: UserMenuProps) {
  const { LinkComponent } = useNextBridge()
  const screens = Grid.useBreakpoint()
  // NOTA: en el primer render (y en el servidor) `screens` viene vacío; se
  // asume escritorio hasta saber el ancho real, para no abrir una hoja
  // móvil en escritorio.
  const isMobile = screens.md === false
  const [ownOpen, setOwnOpen] = useState(false)
  const isOpen = open ?? ownOpen
  const setOpen = (next: boolean) => {
    setOwnOpen(next)
    onOpenChange?.(next)
  }

  const secondLine = subtitle ?? ROLE_LABEL[role]
  const avatar = (size: number) => (
    <Avatar src={avatarUrl} size={size} className={styles.avatar}>
      {!avatarUrl && (initials(name) || <UserOutlined />)}
    </Avatar>
  )

  /** Texto del ítem con su contador, si tiene. */
  const itemLabel = (item: UserMenuItem) => (
    <span className={styles.itemLabel}>
      <span>{item.label}</span>
      {item.badgeCount ? (
        <span className={styles.badge} aria-label={`${item.badgeCount} sin leer`}>
          {item.badgeCount}
        </span>
      ) : null}
    </span>
  )

  // ─── "Viendo como" (Cambio de rol · 04) ─────────────────────────────
  const showRoles = roleOptions.length > 1
  const roleSection = showRoles ? (
    <div className={styles.roles} role="group" aria-label="Viendo como">
      <span className={styles.rolesTitle}>Viendo como</span>
      {roleOptions.map((option) => {
        const active = option.role === role
        return (
          <button
            key={option.role}
            type="button"
            className={`${styles.roleRow} ${active ? styles.roleRowActive : ''}`}
            aria-pressed={active}
            onClick={() => {
              setOpen(false)
              if (!active) onRoleChange?.(option.role)
            }}
            data-testid={`user-menu-role-${option.role}`}
          >
            <Avatar size={34} className={`${styles.roleAvatar} ${active ? '' : styles.roleAvatarInactive}`}>
              {initials(name)}
            </Avatar>
            <span className={styles.roleText}>
              <span className={styles.roleLabel}>{option.label}</span>
              {option.description && <span className={styles.roleDescription}>{option.description}</span>}
            </span>
            {active ? (
              <CheckOutlined className={styles.roleCheck} aria-label="Rol activo" />
            ) : option.badgeCount ? (
              <span className={styles.badge} aria-label={`${option.badgeCount} pendientes`}>
                {option.badgeCount}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  ) : null

  // ─── Escritorio: dropdown ───────────────────────────────────────────
  const menuItems: MenuProps['items'] = [
    ...items.map((item) => ({
      key: item.key,
      icon: item.icon,
      danger: item.danger,
      label: item.href ? <LinkComponent href={item.href}>{itemLabel(item)}</LinkComponent> : itemLabel(item),
      onClick: item.onClick,
      'data-testid': `user-menu-item-${item.key}`,
    })),
    { type: 'divider' as const },
    {
      key: 'logout',
      label: <span data-testid="user-menu-logout">Cerrar sesión</span>,
      icon: <LogoutOutlined />,
      danger: true,
      onClick: onLogout,
    },
  ]

  const header = (
    <div className={styles.header}>
      {avatar(36)}
      <span className={styles.headerText}>
        <span className={styles.headerName}>{name}</span>
        <span className={styles.headerSubtitle}>{secondLine}</span>
      </span>
    </div>
  )

  const trigger = (
    <button
      type="button"
      className={styles.trigger}
      data-testid="user-menu-trigger"
      // En móvil el nombre y el rol se ocultan y queda solo el avatar: sin
      // este label, el botón no tiene nombre para un lector de pantalla. Arranca
      // con el texto visible en escritorio (nombre y rol), en el mismo orden.
      aria-label={`${name}, ${ROLE_LABEL[role]}. Menú de la cuenta`}
      aria-haspopup="menu"
      onClick={isMobile ? () => setOpen(true) : undefined}
      {...rest}
    >
      <Avatar src={avatarUrl} icon={!avatarUrl && <UserOutlined />} size="small" />
      <span className={styles.info}>
        <span className={styles.name}>{name}</span>
        <span className={styles.role}>{ROLE_LABEL[role]}</span>
      </span>
    </button>
  )

  if (!isMobile) {
    return (
      <Dropdown
        trigger={['click']}
        open={isOpen}
        onOpenChange={(next) => setOpen(next)}
        menu={{ items: menuItems, onClick: () => setOpen(false) }}
        popupRender={(menu) => (
          <div className={styles.popup} data-testid="user-menu-popup">
            {header}
            {roleSection}
            {menu}
          </div>
        )}
      >
        {trigger}
      </Dropdown>
    )
  }

  // ─── Móvil: hoja desde abajo ────────────────────────────────────────
  /** Cierra la hoja y después ejecuta la acción del ítem. */
  const run = (action?: () => void) => () => {
    setOpen(false)
    action?.()
  }

  return (
    <>
      {trigger}
      <Drawer
        placement="bottom"
        open={isOpen}
        onClose={() => setOpen(false)}
        closable={false}
        size="auto"
        className={styles.sheet}
        styles={{ body: { padding: 0 } }}
        data-testid="user-menu-sheet"
      >
        <div className={styles.sheetBody}>
          <span className={styles.handle} aria-hidden="true" />
          <div className={styles.sheetHeader}>
            {avatar(44)}
            <span className={styles.headerText}>
              <span className={styles.sheetName}>{name}</span>
              <span className={styles.headerSubtitle}>{secondLine}</span>
            </span>
          </div>
          {roleSection}
          <nav aria-label="Menú de usuario" className={styles.sheetList}>
            {sheetLeadingItem?.href && (
              <LinkComponent
                href={sheetLeadingItem.href}
                className={`${styles.sheetItem} ${styles.sheetItemLeading}`}
                onClick={run(sheetLeadingItem.onClick)}
                data-testid={`user-menu-item-${sheetLeadingItem.key}`}
              >
                <span className={styles.sheetIcon}>{sheetLeadingItem.icon}</span>
                {itemLabel(sheetLeadingItem)}
              </LinkComponent>
            )}
            {items.map((item) =>
              item.href ? (
                <LinkComponent
                  key={item.key}
                  href={item.href}
                  className={styles.sheetItem}
                  onClick={run(item.onClick)}
                  data-testid={`user-menu-item-${item.key}`}
                >
                  <span className={styles.sheetIcon}>{item.icon}</span>
                  {itemLabel(item)}
                </LinkComponent>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  className={styles.sheetItem}
                  onClick={run(item.onClick)}
                  data-testid={`user-menu-item-${item.key}`}
                >
                  <span className={styles.sheetIcon}>{item.icon}</span>
                  {itemLabel(item)}
                </button>
              ),
            )}
            <button type="button" className={`${styles.sheetItem} ${styles.sheetLogout}`} onClick={run(onLogout)} data-testid="user-menu-logout">
              <span className={styles.sheetIcon}>
                <LogoutOutlined />
              </span>
              Cerrar sesión
            </button>
          </nav>
        </div>
      </Drawer>
    </>
  )
}
