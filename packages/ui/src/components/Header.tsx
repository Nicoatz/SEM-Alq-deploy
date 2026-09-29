'use client'

/**
 * Header.tsx — barra superior de la zona pública: logo, navegación y, según haya sesión o no,
 * "Iniciar sesión" + "Publicar propiedad" o "Ir a mi panel" + `UserMenu`. Menú Drawer en móvil.
 *
 * Diseño: Claude Design, "Header público · con sesión iniciada" (01 escritorio, 02 UserMenu
 * abierto, 03 móvil 390 px) y el Header sin sesión de siempre.
 * Quién lo usa: `PublicLayout` (sin props: la variante sin sesión) y, en `apps/web`,
 * `components/PublicHeader.tsx` (con `session` y `sessionPending`).
 */
import { useState } from 'react'
import { Avatar, Button, Drawer } from 'antd'
import { MenuOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons'
import type { UserRole } from '@rentar/shared-types'
import { seed } from '../tokens/primitives'
import { useNextBridge } from '../providers/NextBridge'
import { LOGO } from '../assets/logo'
import { UserMenu, type UserMenuItem } from './feedback/UserMenu'
import styles from './Header.module.css'

/**
 * El link a `/design-system` (catálogo vivo) solo se muestra en desarrollo,
 * igual que `RoleSwitcher`: no es una pantalla del producto.
 */
const SHOW_DESIGN_SYSTEM_LINK = process.env.NODE_ENV !== 'production'

const ROLE_LABEL: Record<UserRole, string> = {
  locador: 'Locador',
  locatario: 'Locatario',
  garante: 'Garante',
  admin: 'Administrador',
}

// ─── Tipos ─────────────────────────────────────────────────────────────────

/**
 * La sesión que muestra el Header ("Header público · con sesión iniciada").
 * La arma `apps/web` con el usuario y el rol ACTIVO de su `AuthProvider`: este
 * componente no sabe de sesiones ni de rutas de RentAR.
 */
export interface HeaderSession {
  name: string
  /** Rol activo (el mismo que muestra el panel), no el primero de la lista. */
  role: UserRole
  avatarUrl?: string
  /** A dónde lleva "Ir a mi panel". */
  panelHref: string
  /** A dónde lleva "Publicar propiedad" en el menú móvil. */
  publishHref: string
  /** Ítems del `UserMenu` por arriba de "Cerrar sesión" (Mi panel, Publicar propiedad, Mi perfil…). */
  menuItems: UserMenuItem[]
  onLogout: () => void
}

/** Props de {@link Header}. Las dos son opcionales: sin ellas, el Header sin sesión de siempre. */
interface HeaderProps {
  /** Usuario en sesión. `null`/`undefined` = sin sesión. */
  session?: HeaderSession | null
  /**
   * `true` mientras la app confirma si hay sesión. En vez de "Iniciar sesión"
   * (que después cambiaría) muestra un placeholder con la forma de la variante
   * con sesión, así no parpadea.
   */
  sessionPending?: boolean
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

// ─── Componente ────────────────────────────────────────────────────────────

/**
 * Encabezado fijo de RentAR: logo, navegación, CTAs de sesión y menú
 * hamburguesa en mobile (`Drawer` de antd). Lo usan la landing y todas las
 * páginas públicas vía `PublicLayout`.
 *
 * Destinos sin sesión (Sprint 1, ver `docs/MapaDePantallas.pdf`):
 * - Logo → `/`.
 * - "Buscar propiedades" → `/buscar` (US-34).
 * - "Cómo funciona" → la sección de la landing (`/#como-funciona`).
 * - "Iniciar sesión" → `/login` (US-39).
 * - "Publicar propiedad" → `/panel/propiedades/nueva` (US-01). Sin sesión,
 *   `proxy.ts` de apps/web lo manda a `/login?next=...` y vuelve después.
 *
 * Con sesión (`session`): "Ir a mi panel" (principal) y el `UserMenu`. En
 * móvil, el menú hamburguesa trae el usuario, "Ir a mi panel", "Publicar
 * propiedad", los links y "Cerrar sesión".
 *
 * NOTA: los botones usan `href` de antd (renderiza un `<a>` con el mismo
 * estilo de botón) en vez de envolverlos en un link: un `<button>` dentro
 * de un `<a>` es HTML inválido.
 */
export function Header({ session, sessionPending = false }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const { ImageComponent, LinkComponent } = useNextBridge()
  // Mientras se confirma la sesión no se muestra ninguna de las dos variantes.
  const conSesion = !sessionPending && Boolean(session)
  const sinSesion = !sessionPending && !session

  // ─── Acciones de escritorio ─────────────────────────────────────────
  let desktopActions = (
    <>
      <Button type="text" href="/login" style={{ color: seed.blue, fontWeight: 600 }} data-testid="header-login-button">
        Iniciar sesión
      </Button>
      <Button type="primary" href="/panel/propiedades/nueva" data-testid="header-publish-button">
        Publicar propiedad
      </Button>
    </>
  )
  if (sessionPending) {
    desktopActions = (
      <span className={styles.pending} role="status" data-testid="header-session-pending">
        <span className={styles.pendingButton} aria-hidden="true" />
        <span className={styles.pendingAvatar} aria-hidden="true" />
        <span className={styles.srOnly}>Cargando tu sesión</span>
      </span>
    )
  } else if (session) {
    desktopActions = (
      <>
        <Button type="primary" href={session.panelHref} className={styles.panelButton} data-testid="header-panel-button">
          Ir a mi panel
        </Button>
        <UserMenu
          name={session.name}
          role={session.role}
          avatarUrl={session.avatarUrl}
          items={session.menuItems}
          onLogout={session.onLogout}
          data-testid="header-user-menu"
        />
      </>
    )
  }

  const cerrarMenu = () => setMenuOpen(false)

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <LinkComponent href="/" className={styles.logoLink}>
          <ImageComponent src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="RentAR" style={{ height: '2.75rem', width: 'auto' }} priority />
          <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
            RentAR — inicio
          </span>
        </LinkComponent>

        <nav aria-label="Navegación principal" className={styles.nav}>
          <LinkComponent href="/buscar">Buscar propiedades</LinkComponent>
          <a href="/#como-funciona">Cómo funciona</a>
          {SHOW_DESIGN_SYSTEM_LINK && <LinkComponent href="/design-system">Sistema de diseño</LinkComponent>}
        </nav>

        <div className={styles.desktopActions}>{desktopActions}</div>

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setMenuOpen(true)}
          data-testid="header-menu-toggle"
        >
          <MenuOutlined style={{ fontSize: 20 }} />
        </button>
      </div>

      <Drawer
        id="mobile-menu"
        title={<ImageComponent src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="RentAR" style={{ height: '2.25rem', width: 'auto' }} />}
        placement="right"
        open={menuOpen}
        onClose={cerrarMenu}
        closeIcon={<CloseOutlined />}
        size={280}
      >
        <nav aria-label="Navegación móvil" className={styles.drawerNav}>
          {/* Con sesión (diseño 03): usuario, "Ir a mi panel", "Publicar propiedad", links y "Cerrar sesión". */}
          {conSesion && session && (
            <>
              <div className={styles.drawerUser}>
                <Avatar src={session.avatarUrl} size={36} className={styles.drawerAvatar}>
                  {!session.avatarUrl && (initials(session.name) || <UserOutlined />)}
                </Avatar>
                <span className={styles.drawerUserText}>
                  <span className={styles.drawerUserName}>{session.name}</span>
                  <span className={styles.drawerUserRole}>{ROLE_LABEL[session.role]}</span>
                </span>
              </div>
              <div className={styles.drawerSessionActions}>
                <Button type="primary" href={session.panelHref} block onClick={cerrarMenu} data-testid="header-drawer-panel">
                  Ir a mi panel
                </Button>
                <Button href={session.publishHref} block onClick={cerrarMenu} data-testid="header-drawer-publish-button">
                  Publicar propiedad
                </Button>
              </div>
            </>
          )}

          <LinkComponent href="/buscar" onClick={cerrarMenu}>
            Buscar propiedades
          </LinkComponent>
          <a href="/#como-funciona" onClick={cerrarMenu}>
            Cómo funciona
          </a>
          {SHOW_DESIGN_SYSTEM_LINK && (
            <LinkComponent href="/design-system" onClick={cerrarMenu}>
              Sistema de diseño
            </LinkComponent>
          )}

          {conSesion && session && (
            <div className={styles.drawerActions}>
              <Button
                type="text"
                danger
                block
                className={styles.drawerLogout}
                onClick={() => {
                  cerrarMenu()
                  session.onLogout()
                }}
                data-testid="header-drawer-logout"
              >
                Cerrar sesión
              </Button>
            </div>
          )}

          {sinSesion && (
            <div className={styles.drawerActions}>
              <Button type="text" href="/login" style={{ color: seed.blue, fontWeight: 600, textAlign: 'left' }} block data-testid="header-drawer-login-button">
                Iniciar sesión
              </Button>
              <Button type="primary" href="/panel/propiedades/nueva" block data-testid="header-drawer-publish-button">
                Publicar propiedad
              </Button>
            </div>
          )}
        </nav>
      </Drawer>
    </header>
  )
}
