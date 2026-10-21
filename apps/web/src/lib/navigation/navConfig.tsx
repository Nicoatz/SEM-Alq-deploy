/**
 * navConfig.tsx — menú lateral de `/panel/*` según el rol activo.
 *
 * Qué es: los 9 ítems canónicos del locador, tal cual los fija
 * `docs/MapaDePantallas.pdf` ("Menú canónico"). Mi perfil y Notificaciones
 * NO van acá: viven en el UserMenu del header (ver `(app)/panel/layout.tsx`).
 *
 * NOTA: el panel completo del locatario no es del Sprint 1. Una cuenta
 * locataria (o Sofía, al cambiar de contexto) ve "Mi panel", con la versión
 * mínima (buscar o publicar, `PanelLocatario`), y desde la tanda 2 del
 * Sprint 2 "Mis solicitudes" (US-36, está en el menú canónico del mapa) y
 * desde la tanda 3 del Sprint 3 "Mi alquiler" (US-07: el locatario firma
 * ahí; US-27 completa la ficha en la tanda 4). El resto de su menú llega con
 * su sprint. No tiene "Propiedades": Mis
 * propiedades es solo para locadores (se gana al publicar la primera).
 * El locador no tiene "Mis solicitudes": una cuenta con los dos roles las ve
 * al cambiar al contexto locatario (decisión del PO).
 *
 * Quién lo usa: `(app)/panel/layout.tsx`, para armar los ítems del `AppShell`.
 */
import {
  BarChartOutlined,
  CreditCardOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  FileProtectOutlined,
  FileTextOutlined,
  HomeOutlined,
  KeyOutlined,
  MessageOutlined,
  ShopOutlined,
} from '@ant-design/icons'
import type { AppShellNavItem } from '@rentar/ui'

const navItemsLocador: AppShellNavItem[] = [
  { key: 'panel', label: 'Mi panel', href: '/panel', icon: <HomeOutlined /> },
  { key: 'propiedades', label: 'Propiedades', href: '/panel/propiedades', icon: <ShopOutlined /> },
  { key: 'solicitudes', label: 'Solicitudes', href: '/panel/solicitudes', icon: <FileTextOutlined /> },
  { key: 'contratos', label: 'Contratos', href: '/panel/contratos', icon: <FileProtectOutlined /> },
  { key: 'cobros', label: 'Cobros', href: '/panel/cobros', icon: <DollarOutlined /> },
  { key: 'reclamos', label: 'Reclamos', href: '/panel/reclamos', icon: <ExclamationCircleOutlined /> },
  { key: 'mensajes', label: 'Mensajes', href: '/panel/mensajes', icon: <MessageOutlined /> },
  { key: 'reportes', label: 'Reportes', href: '/panel/reportes', icon: <BarChartOutlined /> },
  { key: 'suscripcion', label: 'Suscripción', href: '/panel/suscripcion', icon: <CreditCardOutlined /> },
]

const navItemsLocatario: AppShellNavItem[] = [
  { key: 'panel', label: 'Mi panel', href: '/panel', icon: <HomeOutlined /> },
  { key: 'alquiler', label: 'Mi alquiler', href: '/panel/alquiler', icon: <KeyOutlined /> },
  { key: 'mis-solicitudes', label: 'Mis solicitudes', href: '/panel/mis-solicitudes', icon: <FileTextOutlined /> },
]

/**
 * US-27: con dos o más contratos, el ítem "Mi alquiler" pasa a "Mis
 * alquileres" y apunta al listado. Lo aplica el layout del panel cuando
 * sabe cuántos son (`useCantidadAlquileres`).
 */
export const ITEM_MIS_ALQUILERES = { label: 'Mis alquileres', href: '/panel/alquileres' } as const

/**
 * Rutas que marcan como activo un ítem además de su `href` (el ítem de
 * alquileres queda activo en la ficha y en el listado).
 */
export const RUTAS_DEL_ITEM: Record<string, readonly string[]> = {
  alquiler: ['/panel/alquiler', '/panel/alquileres'],
}

/** Roles que tienen panel propio con menú lateral (el garante nunca tiene cuenta). */
export type PanelRole = 'locador' | 'locatario'

/** Ítems del menú lateral por rol. */
export const navItemsByRole: Record<PanelRole, AppShellNavItem[]> = {
  locador: navItemsLocador,
  locatario: navItemsLocatario,
}
