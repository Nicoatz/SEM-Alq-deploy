'use client'

/**
 * PerfilScreen.tsx — `/panel/perfil`, "Mi perfil".
 *
 * Cubre: US-20 Consultar usuario y US-21 Modificar usuario.
 * Qué muestra (Claude Design, "Mi perfil y legajo" · 01 y 03): los bloques
 * Datos personales y Acceso y seguridad, y al costado Mis roles. En móvil
 * cada bloque se pliega.
 * NOTA: el bloque "Mi legajo" del diseño salió de US-20 y US-21 el 06/11
 * (8d2a46c). La situación, los ingresos y las garantías se cargan en cada
 * solicitud (US-35).
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
import { useCallback, useMemo, useState } from 'react'
import { Button, Skeleton } from 'antd'
import type { PerfilUsuario } from '@rentar/shared-types'
import { PageHeader } from '@rentar/ui'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { useAvisoCambiosSinGuardar } from '@/lib/navigation/AvisoCambiosProvider'
import { getMiPerfil } from '@/services/perfil.service'
import { AccesoSeguridadBloque } from './AccesoSeguridadBloque'
import { DatosPersonalesBloque } from './DatosPersonalesBloque'
import { MisRolesBloque } from './MisRolesBloque'
import styles from './PerfilScreen.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Mi perfil' }]

/** Los bloques que se editan por separado (US-21). */
type BloqueEditable = 'datos' | 'contrasena'

/** Pantalla "Mi perfil". */
export function PerfilScreen() {
  const carga = useServiceCall(getMiPerfil)

  // ─── Estado local ───────────────────────────────────────────────────
  /** Lo guardado en esta visita (después de cada "Guardar"); `null` = lo que trajo la carga. */
  const [guardado, setGuardado] = useState<PerfilUsuario | null>(null)
  /** Qué bloques tienen cambios sin guardar (US-21: aviso al salir). */
  const [conCambios, setConCambios] = useState<Record<BloqueEditable, boolean>>({ datos: false, contrasena: false })
  const hayCambiosSinGuardar = useMemo(() => Object.values(conCambios).some(Boolean), [conCambios])
  // US-21: "se debe avisar si el usuario intenta salir de la pantalla con
  // cambios sin guardar". El modal lo muestra `AvisoCambiosProvider` (panel).
  useAvisoCambiosSinGuardar(hayCambiosSinGuardar)

  // ─── Handlers ───────────────────────────────────────────────────────
  // Callbacks estables por bloque: los bloques los usan en un `useEffect`.
  const marcarDatos = useCallback((hay: boolean) => setConCambios((actual) => (actual.datos === hay ? actual : { ...actual, datos: hay })), [])
  const marcarContrasena = useCallback((hay: boolean) => setConCambios((actual) => (actual.contrasena === hay ? actual : { ...actual, contrasena: hay })), [])

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
  const perfil = guardado ?? carga.data

  return (
    <div className={styles.page} data-testid="perfil" data-cambios-sin-guardar={hayCambiosSinGuardar}>
      <PageHeader title="Mi perfil" subtitle={`${perfil.nombre} ${perfil.apellido}`} breadcrumb={MIGA} />
      <div className={styles.layout}>
        <div className={styles.main}>
          <DatosPersonalesBloque perfil={perfil} onActualizado={setGuardado} onCambiosSinGuardar={marcarDatos} />
          <AccesoSeguridadBloque email={perfil.email} onCambiosSinGuardar={marcarContrasena} />
        </div>
        <aside className={styles.aside}>
          <MisRolesBloque roles={perfil.roles} />
        </aside>
      </div>

    </div>
  )
}
