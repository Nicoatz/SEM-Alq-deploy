'use client'

/**
 * RequireRole.tsx — muestra su contenido solo si el rol activo es el pedido.
 *
 * Qué es: la guarda de las pantallas del locador dentro de `/panel`. Si el
 * rol activo es otro (una cuenta locataria, o Sofía después de cambiar de
 * contexto), redirige a `/panel`. Ver `proxy.ts` para la guarda de sesión,
 * que es otra cosa: el proxy pregunta "¿hay sesión?", esto pregunta "¿con qué
 * rol?".
 *
 * Quién lo usa: las páginas del locador: Mis propiedades
 * (`(app)/panel/propiedades/page.tsx`), su detalle (`[id]/page.tsx`) y
 * Solicitudes recibidas (`(app)/panel/solicitudes/page.tsx`). El
 * alta (`/panel/propiedades/nueva`) no: la puede usar cualquier usuario con sesión.
 */
import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@rentar/shared-types'
import { useAuth } from '@/lib/auth/AuthProvider'

interface RequireRoleProps {
  role: UserRole
  children: ReactNode
}

/** Renderiza `children` solo con el rol activo pedido; si no, redirige a `/panel`. */
export function RequireRole({ role, children }: RequireRoleProps) {
  const { user, activeRole, isLoading } = useAuth()
  const router = useRouter()
  const allowed = activeRole === role

  // Solo redirige si HAY sesión con otro rol. Sin sesión (por ejemplo, justo
  // después de "Cerrar sesión") no hace nada: de eso se ocupa el layout del panel.
  useEffect(() => {
    if (!isLoading && user && !allowed) {
      router.replace('/panel')
    }
  }, [isLoading, user, allowed, router])

  if (isLoading || !allowed) return null
  return <>{children}</>
}
