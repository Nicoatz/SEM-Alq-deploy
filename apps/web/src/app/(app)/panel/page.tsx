'use client'

/**
 * /panel — Mi panel, el inicio de cada rol.
 *
 * Qué es: el locador ve su panel de inicio (`PanelLocador`: plata del mes,
 * reclamos y contratos, o el onboarding si no tiene propiedades). El
 * locatario ve la versión mínima de su panel (`PanelLocatario`: buscar o
 * publicar, diseño "Panel de inicio" · 05b); su panel completo es de otro sprint.
 * Cubre: sin US en Sprint 0 (inicio del locador, mapa A3); los conteos de
 * propiedades salen de US-02.
 *
 * `'use client'` porque depende del rol activo (`useAuth`), que puede cambiar
 * sin recargar (cambio de rol del UserMenu).
 * Entra desde: el login, el ítem "Mi panel" del menú y el cambio de rol.
 */
import { PanelLocador } from '@/components/panel/PanelLocador'
import { PanelLocatario } from '@/components/panel/PanelLocatario'
import { useAuth } from '@/lib/auth/AuthProvider'

/** Inicio del panel: el del locador o el mínimo del locatario, según el rol activo. */
export default function PanelInicioPage() {
  const { user, activeRole } = useAuth()
  // El layout ya esperó al usuario: acá siempre hay sesión.
  if (!user) return null

  if (activeRole === 'locador') {
    // `key`: si cambia la cuenta (otro login en la misma pestaña), el panel se vuelve a pedir.
    return <PanelLocador key={user.id} nombre={user.nombre} />
  }

  return <PanelLocatario nombre={user.nombre} />
}
