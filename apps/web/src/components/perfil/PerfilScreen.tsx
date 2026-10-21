'use client'

/**
 * PerfilScreen.tsx — `/panel/perfil`, "Mi perfil y legajo".
 *
 * Cubre: US-20 Consultar usuario y US-21 Modificar usuario.
 * Qué muestra (Claude Design, "Mi perfil y legajo" · 01 y 03): los bloques
 * Datos personales, Mi legajo y Acceso y seguridad, y al costado Mis roles.
 * En móvil cada bloque se pliega y el legajo incompleto va primero.
 * Solo el perfil propio: no hay un id en la ruta (US-20).
 *
 * NOTA (diseño vs. US): el diseño suma "Cómo te avisamos", "Resumen de la
 * cuenta", "Dar de baja", documentación y verificación de teléfono. No están
 * en US-20 ni en US-21: quedan fuera. El botón global "Guardar cambios" del
 * diseño tampoco: US-21 pide guardar cada bloque por separado.
 *
 * De dónde saca los datos: `perfil.service#getMiPerfil`.
 * Quién lo usa: `app/(app)/panel/perfil/page.tsx`.
 */
import { Button, Skeleton } from 'antd'
import { PageHeader } from '@rentar/ui'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { estadoLegajo } from '@/lib/perfil/legajo'
import { getMiPerfil } from '@/services/perfil.service'
import { AccesoSeguridadBloque } from './AccesoSeguridadBloque'
import { DatosPersonalesBloque } from './DatosPersonalesBloque'
import { LegajoBloque } from './LegajoBloque'
import { MisRolesBloque } from './MisRolesBloque'
import styles from './PerfilScreen.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Mi perfil' }]

/** Pantalla "Mi perfil y legajo". */
export function PerfilScreen() {
  const carga = useServiceCall(getMiPerfil)

  // ─── Error ──────────────────────────────────────────────────────────
  if (carga.status === 'error') {
    return (
      <div className={styles.page}>
        <PageHeader title="Mi perfil" breadcrumb={MIGA} />
        <div className={styles.errorBlock} role="alert" data-testid="perfil-error">
          <span className={styles.errorTitle}>No pudimos traer tu perfil</span>
          <span className={styles.errorText}>{carga.message}</span>
          <Button type="primary" onClick={carga.reintentar} data-testid="perfil-reintentar">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  // ─── Cargando ───────────────────────────────────────────────────────
  if (carga.status === 'cargando') {
    return (
      <div className={styles.page} data-testid="perfil-cargando">
        <PageHeader title="Mi perfil" breadcrumb={MIGA} />
        <div className={styles.layout}>
          <div className={styles.main}>
            {[0, 1, 2].map((bloque) => (
              <div key={bloque} className={styles.skeletonCard}>
                <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 3 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const perfil = carga.data
  const legajoIncompleto = !estadoLegajo(perfil.legajo).completo

  return (
    <div className={styles.page} data-testid="perfil">
      <PageHeader title="Mi perfil" subtitle={`${perfil.nombre} ${perfil.apellido}`} breadcrumb={MIGA} />
      <div className={styles.layout}>
        <div className={styles.main}>
          <DatosPersonalesBloque perfil={perfil} />
          {/* En móvil, el legajo incompleto va primero y abierto (diseño · 03). */}
          <div className={legajoIncompleto ? styles.primeroEnMovil : undefined}>
            <LegajoBloque legajo={perfil.legajo} defaultOpen={legajoIncompleto} />
          </div>
          <AccesoSeguridadBloque email={perfil.email} />
        </div>
        <aside className={styles.aside}>
          <MisRolesBloque roles={perfil.roles} />
        </aside>
      </div>
    </div>
  )
}
