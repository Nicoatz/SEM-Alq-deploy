'use client'

/**
 * MisRolesBloque.tsx — el bloque "Mis roles" de "Mi perfil".
 *
 * Qué es: los roles de la cuenta, de solo lectura. Regla del equipo
 * (27/09/2026) y US-20: "todo usuario es locatario, y es también locador si
 * publicó al menos una propiedad". Si no es locador, el aviso "Para ser
 * locador, publicá tu primera propiedad" con acceso a publicar.
 * Cubre: US-20 Consultar usuario.
 * De dónde saca los datos: `PerfilUsuario.roles` (lo pasa `PerfilScreen`).
 * Quién lo usa: `PerfilScreen.tsx`.
 */
import Link from 'next/link'
import type { UserRole } from '@rentar/shared-types'
import { BloquePerfil } from './BloquePerfil'
import styles from './BloquesPerfil.module.css'

/** Props de {@link MisRolesBloque}. */
interface MisRolesBloqueProps {
  roles: UserRole[]
}

/** Qué dice cada rol debajo del nombre. */
const DETALLE_ROL: Record<'locador' | 'locatario', { nombre: string; inicial: string; detalle: string }> = {
  locatario: { nombre: 'Locatario', inicial: 'L', detalle: 'Podés buscar propiedades y enviar solicitudes.' },
  locador: { nombre: 'Locador', inicial: 'P', detalle: 'Publicaste al menos una propiedad.' },
}

/** Roles de la cuenta y el acceso para ser locador. */
export function MisRolesBloque({ roles }: MisRolesBloqueProps) {
  const esLocador = roles.includes('locador')
  // Todo usuario es locatario (US-20): se muestra aunque el back no lo mande.
  const visibles: ('locador' | 'locatario')[] = esLocador ? ['locatario', 'locador'] : ['locatario']

  return (
    <BloquePerfil testId="perfil-roles" title="Mis roles">
      <div className={styles.roles}>
        {visibles.map((rol) => (
          <div key={rol} className={styles.role} data-testid={`perfil-rol-${rol}`}>
            <span className={styles.roleInitial} aria-hidden>
              {DETALLE_ROL[rol].inicial}
            </span>
            <span className={styles.roleText}>
              <span className={styles.roleName}>{DETALLE_ROL[rol].nombre}</span>
              <span className={styles.roleDetail}>{DETALLE_ROL[rol].detalle}</span>
            </span>
          </div>
        ))}
        {!esLocador && (
          <p className={styles.hint} data-testid="perfil-ser-locador">
            Para ser locador, publicá tu primera propiedad.{' '}
            <Link href="/panel/propiedades/nueva" data-testid="perfil-ser-locador-link">
              Publicar propiedad
            </Link>
          </p>
        )}
      </div>
    </BloquePerfil>
  )
}
