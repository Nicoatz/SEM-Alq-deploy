'use client'

/**
 * PanelInicio.tsx — el contenido de `/panel` (Mi panel), según el rol activo.
 *
 * Qué es: el locador ve su panel de inicio (`PanelLocador`); el locatario, la
 * versión mínima de su panel (`PanelLocatario`, diseño "Panel de inicio" · 05b).
 * Cubre: sin US en Sprint 0 (inicio del locador, mapa A3); los conteos de
 * propiedades salen de US-02.
 *
 * `'use client'` porque depende del rol activo (`useAuth`), que puede cambiar
 * sin recargar (cambio de rol del UserMenu).
 * Quién lo usa: `app/(app)/panel/page.tsx`.
 */
import { PanelLocador } from './PanelLocador'
import { PanelLocatario } from './PanelLocatario'
import { useAuth } from '@/lib/auth/AuthProvider'

/** Inicio del panel: el del locador o el mínimo del locatario, según el rol activo. */
export function PanelInicio() {
  const { user, activeRole } = useAuth()
  // El layout ya esperó al usuario: acá siempre hay sesión.
  if (!user) return null

  if (activeRole === 'locador') {
    // `key`: si cambia la cuenta (otro login en la misma pestaña), el panel se vuelve a pedir.
    return <PanelLocador key={user.id} nombre={user.nombre} />
  }

  return <PanelLocatario nombre={user.nombre} />
}
