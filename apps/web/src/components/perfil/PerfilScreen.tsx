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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import type { LegajoUsuario, PerfilUsuario } from '@rentar/shared-types'
import { ConfirmActionModal, PageHeader } from '@rentar/ui'
import { useAvisoCambiosSinGuardar } from '@/lib/hooks/useAvisoCambiosSinGuardar'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { estadoLegajo } from '@/lib/perfil/legajo'
import { getMiPerfil } from '@/services/perfil.service'
import { AccesoSeguridadBloque } from './AccesoSeguridadBloque'
import { CambioCorreo } from './CambioCorreo'
import { DatosPersonalesBloque } from './DatosPersonalesBloque'
import { LegajoBloque } from './LegajoBloque'
import { MisRolesBloque } from './MisRolesBloque'
import styles from './PerfilScreen.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Mi perfil' }]

/**
 * Lo que dice el aviso cuando se vuelve del enlace del correo
 * (`/auth/confirmar?…` redirige acá con `?correo=<resultado>`, US-21).
 */
const AVISO_CORREO: Record<'confirmado' | 'parcial' | 'error', { type: 'success' | 'info' | 'error'; texto: string }> = {
  confirmado: { type: 'success', texto: 'Confirmaste el enlace. Si ya confirmaste los dos, tu correo nuevo ya está activo.' },
  parcial: { type: 'info', texto: 'Confirmaste uno de los dos enlaces. Falta el que te mandamos al otro correo.' },
  error: { type: 'error', texto: 'El enlace venció o ya se usó. Pedí el cambio de correo de nuevo.' },
}

/** Lee `?correo=` de la URL (`null` del lado del servidor o si no viene). */
function leerResultadoDelEnlace(): keyof typeof AVISO_CORREO | null {
  if (typeof window === 'undefined') return null
  const valor = new URLSearchParams(window.location.search).get('correo')
  return valor === 'confirmado' || valor === 'parcial' || valor === 'error' ? valor : null
}

/** Los bloques que se editan por separado (US-21). */
type BloqueEditable = 'datos' | 'correo' | 'legajo' | 'contrasena'

/** Pantalla "Mi perfil y legajo". */
export function PerfilScreen() {
  const carga = useServiceCall(getMiPerfil)

  // ─── Estado local ───────────────────────────────────────────────────
  /** Lo guardado en esta visita (después de cada "Guardar"); `null` = lo que trajo la carga. */
  const [guardado, setGuardado] = useState<PerfilUsuario | null>(null)
  /** Qué bloques tienen cambios sin guardar (US-21: aviso al salir). */
  const [conCambios, setConCambios] = useState<Record<BloqueEditable, boolean>>({ datos: false, correo: false, legajo: false, contrasena: false })
  /** Resultado del enlace del correo, si se llegó desde `/auth/confirmar`. */
  // NOTA: se lee de `window` y no con `useSearchParams` para no obligar a
  // envolver la página en un <Suspense> (la página es estática). No cambia
  // la hidratación: del lado del servidor la pantalla está cargando.
  const [avisoCorreo, setAvisoCorreo] = useState<keyof typeof AVISO_CORREO | null>(leerResultadoDelEnlace)
  useEffect(() => {
    // Se saca `?correo=` de la URL para que el aviso no vuelva al recargar.
    const url = new URL(window.location.href)
    if (!url.searchParams.has('correo')) return
    url.searchParams.delete('correo')
    window.history.replaceState(window.history.state, '', url)
  }, [])
  const hayCambiosSinGuardar = useMemo(() => Object.values(conCambios).some(Boolean), [conCambios])
  // US-21: "se debe avisar si el usuario intenta salir de la pantalla con cambios sin guardar".
  const avisoSalida = useAvisoCambiosSinGuardar(hayCambiosSinGuardar)

  // ─── Handlers ───────────────────────────────────────────────────────
  // Callbacks estables por bloque: los bloques los usan en un `useEffect`.
  const marcarDatos = useCallback((hay: boolean) => setConCambios((actual) => (actual.datos === hay ? actual : { ...actual, datos: hay })), [])
  const marcarCorreo = useCallback((hay: boolean) => setConCambios((actual) => (actual.correo === hay ? actual : { ...actual, correo: hay })), [])
  const marcarContrasena = useCallback((hay: boolean) => setConCambios((actual) => (actual.contrasena === hay ? actual : { ...actual, contrasena: hay })), [])
  const marcarLegajo = useCallback((hay: boolean) => setConCambios((actual) => (actual.legajo === hay ? actual : { ...actual, legajo: hay })), [])

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
  const legajoActualizado = (legajo: LegajoUsuario) => setGuardado({ ...perfil, legajo })
  const legajoIncompleto = !estadoLegajo(perfil.legajo).completo

  return (
    <div className={styles.page} data-testid="perfil" data-cambios-sin-guardar={hayCambiosSinGuardar}>
      <PageHeader title="Mi perfil" subtitle={`${perfil.nombre} ${perfil.apellido}`} breadcrumb={MIGA} />
      {avisoCorreo && (
        <Alert
          type={AVISO_CORREO[avisoCorreo].type}
          showIcon
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          onClose={() => setAvisoCorreo(null)}
          title={AVISO_CORREO[avisoCorreo].texto}
          data-testid="perfil-email-enlace"
        />
      )}
      <div className={styles.layout}>
        <div className={styles.main}>
          <DatosPersonalesBloque perfil={perfil} onActualizado={setGuardado} onCambiosSinGuardar={marcarDatos}>
            <CambioCorreo perfil={perfil} onActualizado={setGuardado} onCambiosSinGuardar={marcarCorreo} />
          </DatosPersonalesBloque>
          {/* En móvil, el legajo incompleto va primero y abierto (diseño · 03). */}
          <div className={legajoIncompleto ? styles.primeroEnMovil : undefined}>
            <LegajoBloque legajo={perfil.legajo} defaultOpen={legajoIncompleto} onActualizado={legajoActualizado} onCambiosSinGuardar={marcarLegajo} />
          </div>
          <AccesoSeguridadBloque email={perfil.email} onCambiosSinGuardar={marcarContrasena} />
        </div>
        <aside className={styles.aside}>
          <MisRolesBloque roles={perfil.roles} />
        </aside>
      </div>

      <ConfirmActionModal
        open={avisoSalida.destinoPendiente !== null}
        title="Tenés cambios sin guardar"
        description="Si salís ahora, se pierden. Para no perderlos, quedate y tocá Guardar en el bloque que estabas editando."
        confirmLabel="Salir sin guardar"
        cancelLabel="Seguir editando"
        danger
        onConfirm={avisoSalida.confirmarSalida}
        onCancel={avisoSalida.cancelarSalida}
        data-testid="aviso-salida"
      />
    </div>
  )
}
