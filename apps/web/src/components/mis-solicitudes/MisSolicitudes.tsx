'use client'

/**
 * MisSolicitudes.tsx — `/panel/mis-solicitudes`, las solicitudes que envió
 * el usuario en sesión.
 *
 * Cubre (numeración de Jira):
 * - US-36 Consultar solicitudes: estado, dirección de la propiedad (la
 *   APROXIMADA: decisión del PO), imagen principal y la línea que explica el
 *   estado.
 * - Cancelar una solicitud pendiente: sin US en Sprint 0 (mapa US-39). La
 *   aceptada no la cancela el postulante: la cancela el locador (US-38).
 *
 * Qué muestra (Claude Design, "Flujo de solicitudes" · 04, 05 y 06):
 * pestañas Todas, Pendientes, Aceptadas y Cerradas con su contador, una fila
 * por solicitud, el modal "¿Cancelar tu solicitud…?", el vacío que devuelve
 * a la búsqueda, skeleton y error.
 *
 * De dónde saca los datos: `listarMisSolicitudes`.
 * Quién lo usa: `app/(app)/panel/mis-solicitudes/page.tsx`.
 */
import { useMemo, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { useRouter } from 'next/navigation'
import type { Solicitud } from '@rentar/shared-types'
import { EmptyState, PageHeader } from '@rentar/ui'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import {
  aplicarCambios,
  contarPorPestania,
  estaEnPestania,
  ordenarSolicitudes,
  PESTANIAS_MIS,
  type CambiosSolicitudes,
  type PestaniaSolicitudes,
} from '@/lib/solicitudes/filtros'
import { listarMisSolicitudes } from '@/services/solicitudes.service'
import { ModalAccionSolicitud } from '@/components/solicitudes/ModalAccionSolicitud'
import { PestaniasSolicitudes } from '@/components/solicitudes/PestaniasSolicitudes'
import { useAccionSolicitud } from '@/components/solicitudes/useAccionSolicitud'
import { FilaMiSolicitud } from './FilaMiSolicitud'
import styles from './MisSolicitudes.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Mis solicitudes' }]

/** Subtítulo (· 04): "4 solicitudes enviadas · 1 aceptada". */
function subtitulo(todas: readonly Solicitud[]): string {
  const enviadas = `${todas.length} ${todas.length === 1 ? 'solicitud enviada' : 'solicitudes enviadas'}`
  const aceptadas = todas.filter((item) => item.status === 'aceptada').length
  return aceptadas > 0 ? `${enviadas} · ${aceptadas} ${aceptadas === 1 ? 'aceptada' : 'aceptadas'}` : enviadas
}

/** Nombre de cada pestaña en minúscula, para el vacío "sin resultados". */
const NOMBRE_PESTANIA: Record<PestaniaSolicitudes, string> = {
  todas: '',
  pendientes: 'pendientes',
  aceptadas: 'aceptadas',
  cerradas: 'cerradas',
}

/** Tres filas de skeleton con la forma real (· 06). */
function FilasCargando() {
  return (
    <div className={styles.list} data-testid="mis-solicitudes-cargando">
      {[0, 1, 2].map((fila) => (
        <div key={fila} className={styles.row}>
          <Skeleton.Image active className={styles.skeletonPhoto} />
          <Skeleton active title={{ width: '50%' }} paragraph={{ rows: 1, width: '80%' }} className={styles.rowBody} />
        </div>
      ))}
    </div>
  )
}

/** Solicitudes enviadas por el usuario en sesión. */
export function MisSolicitudes() {
  const router = useRouter()
  const carga = useServiceCall(listarMisSolicitudes)

  // ─── Estado local ───────────────────────────────────────────────────
  const [cambios, setCambios] = useState<CambiosSolicitudes>({})
  const [pestania, setPestania] = useState<PestaniaSolicitudes>('todas')
  /** Aviso del 409 (la solicitud cambió mientras se miraba, ej. el dueño la aceptó). */
  const [conflicto, setConflicto] = useState<{ titulo: string; detalle: string } | null>(null)

  const datos = carga.status === 'listo' ? carga.data : null
  const todas = useMemo(() => aplicarCambios(datos ?? [], cambios), [datos, cambios])
  const contadores = useMemo(() => contarPorPestania(todas), [todas])
  const visibles = useMemo(() => ordenarSolicitudes(todas.filter((item) => estaEnPestania(item, pestania)), 'recientes'), [todas, pestania])

  // ─── Cancelar (sin US en Sprint 0, mapa US-39) ──────────────────────
  const accion = useAccionSolicitud({
    onExito: (actualizada) => {
      setConflicto(null)
      setCambios((actual) => ({ ...actual, [actualizada.id]: { status: actualizada.status, respondedAt: actualizada.respondedAt } }))
    },
    onConflicto: (message, pedida) => {
      const direccion = pedida.solicitud.property.address
      setConflicto({ titulo: `Tu solicitud${direccion ? ` de ${direccion}` : ''} cambió mientras la mirabas`, detalle: message })
      setCambios({})
      carga.reintentar()
    },
  })

  // ─── Handlers ───────────────────────────────────────────────────────
  function reintentarCarga(): void {
    setCambios({})
    carga.reintentar()
  }

  const buscarBoton = (
    <Button type="primary" onClick={() => router.push('/buscar')} data-testid="mis-solicitudes-vacio-buscar">
      Buscar propiedades
    </Button>
  )

  // ─── Error (· 06) ───────────────────────────────────────────────────
  if (carga.status === 'error') {
    const sinRed = carga.code === 'network'
    return (
      <div className={styles.page}>
        <PageHeader title="Mis solicitudes" breadcrumb={MIGA} />
        <div className={styles.errorBlock} role="alert" data-testid="mis-solicitudes-error">
          <span className={styles.errorTitle}>No pudimos traer tus solicitudes</span>
          <span className={styles.errorText}>
            {sinRed ? 'Revisá tu conexión y probá de nuevo. Nada se perdió: tus solicitudes siguen guardadas.' : carga.message}
          </span>
          <Button type="primary" onClick={reintentarCarga} data-testid="mis-solicitudes-reintentar">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const cargando = carga.status === 'cargando'

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page} data-testid="mis-solicitudes">
      <PageHeader title="Mis solicitudes" subtitle={cargando || todas.length === 0 ? undefined : subtitulo(todas)} breadcrumb={MIGA} />

      {conflicto && (
        <Alert
          type="warning"
          showIcon
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          onClose={() => setConflicto(null)}
          title={conflicto.titulo}
          description={`${conflicto.detalle} Actualizamos la lista con el estado de ahora.`}
          data-testid="mis-solicitudes-conflicto"
        />
      )}

      {/* Vacío (· 06): siempre devuelve a la búsqueda. */}
      {!cargando && todas.length === 0 ? (
        <div className={styles.emptyBlock} data-testid="mis-solicitudes-vacio">
          <EmptyState
            title="Todavía no solicitaste ninguna propiedad"
            description="Cuando encuentres una que te guste, tocá Solicitar alquiler y la vas a seguir desde acá."
            action={buscarBoton}
          />
        </div>
      ) : (
        <>
          <PestaniasSolicitudes opciones={PESTANIAS_MIS} value={pestania} onChange={setPestania} contadores={cargando ? null : contadores} testIdPrefix="mis-solicitudes" />

          {cargando ? (
            <FilasCargando />
          ) : visibles.length === 0 ? (
            <div className={styles.emptyBlock} data-testid="mis-solicitudes-sin-resultados">
              <EmptyState title={`No tenés solicitudes ${NOMBRE_PESTANIA[pestania]}`} description="Probá con otra pestaña." />
            </div>
          ) : (
            <div className={styles.list}>
              {visibles.map((solicitud) => (
                <FilaMiSolicitud key={solicitud.id} solicitud={solicitud} onCancelar={(item) => accion.pedir('cancelar', item)} />
              ))}
            </div>
          )}
        </>
      )}

      <ModalAccionSolicitud estado={accion} actor="postulante" testIdPrefix="mis-solicitudes" />
    </div>
  )
}
