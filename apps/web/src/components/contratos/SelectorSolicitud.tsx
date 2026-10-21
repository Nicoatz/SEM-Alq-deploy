'use client'

/**
 * SelectorSolicitud.tsx — "Nuevo contrato" sin una solicitud elegida:
 * `/panel/contratos/nuevo`.
 *
 * Qué es: la lista de solicitudes aceptadas que todavía no originaron un
 * contrato (propiedad y postulante), para elegir de cuál nace. Decisión del
 * PO: nada de carga manual de partes; si no hay ninguna, el mismo vacío del
 * listado, con acceso a las solicitudes.
 * Cubre: US-05 Registrar contrato de alquiler ("Se debe poder iniciar el
 * contrato desde una solicitud aceptada").
 * NOTA (diseño vs. PO): el diseño dice que sin solicitud "el paso 1 arranca
 * vacío y pide elegir propiedad y locatario a mano"; no se hace.
 *
 * De dónde saca los datos: `solicitudes.service#listarSolicitudesRecibidas`
 * (aceptadas), filtradas con `contrato` y `propiedadConContrato`. En real esos
 * dos campos no llegan todavía (TODO(backend)): se listan todas las
 * aceptadas y, si alguna no corresponde, lo frena `/contratos/preparar`.
 * Quién lo usa: `app/(app)/panel/contratos/nuevo/page.tsx`.
 */
import { useCallback } from 'react'
import { Button, Skeleton } from 'antd'
import { useRouter } from 'next/navigation'
import type { Solicitud } from '@rentar/shared-types'
import { EmptyState, PageHeader } from '@rentar/ui'
import { fechaCorta } from '@/lib/contratos/fechas'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { listarSolicitudesRecibidas } from '@/services/solicitudes.service'
import { SOLICITUDES_ACEPTADAS_HREF } from './ListadoContratos'
import styles from './Contratos.module.css'

const MIGA = [
  { label: 'Mi panel', href: '/panel' },
  { label: 'Contratos', href: '/panel/contratos' },
  { label: 'Nuevo contrato' },
]

/** `true` si de esta aceptada todavía se puede iniciar un contrato (US-05). */
function sinContrato(solicitud: Solicitud): boolean {
  return !solicitud.contrato && !solicitud.propiedadConContrato
}

/** Elegir la solicitud aceptada de la que nace el contrato. */
export function SelectorSolicitud() {
  const router = useRouter()
  const cargar = useCallback(() => listarSolicitudesRecibidas({ estado: 'aceptada' }), [])
  const carga = useServiceCall(cargar)
  const disponibles = carga.status === 'listo' ? carga.data.filter(sinContrato) : []

  const vacio = (
    <div className={styles.emptyBlock} data-testid="contrato-selector-vacio">
      <EmptyState
        title="No tenés solicitudes aceptadas sin contrato"
        description="Los contratos nacen de una solicitud aceptada. Aceptá a un postulante y volvé acá, o tocá Iniciar contrato desde la solicitud."
        action={
          <span className={styles.acciones}>
            <Button type="primary" onClick={() => router.push(SOLICITUDES_ACEPTADAS_HREF)} data-testid="contrato-selector-solicitudes">
              Ver solicitudes aceptadas
            </Button>
            <Button onClick={() => router.push('/panel/contratos')} data-testid="contrato-selector-volver">
              Volver a Contratos
            </Button>
          </span>
        }
      />
    </div>
  )

  return (
    <div className={styles.page} data-testid="contrato-selector">
      <PageHeader title="Nuevo contrato" subtitle="Elegí la solicitud aceptada de la que nace el contrato." breadcrumb={MIGA} />

      {carga.status === 'cargando' ? (
        <div className={styles.skeletonList} data-testid="contrato-selector-cargando">
          <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2 }} />
        </div>
      ) : carga.status === 'error' ? (
        <div className={styles.errorBlock} role="alert" data-testid="contrato-selector-error">
          <span className={styles.errorTitle}>No pudimos traer tus solicitudes aceptadas</span>
          <span className={styles.errorText}>{carga.message}</span>
          <Button type="primary" onClick={carga.reintentar} data-testid="contrato-selector-reintentar">
            Reintentar
          </Button>
        </div>
      ) : disponibles.length === 0 ? (
        vacio
      ) : (
        <ul className={styles.selector} aria-label="Solicitudes aceptadas sin contrato">
          {disponibles.map((solicitud) => (
            <li key={solicitud.id} className={styles.selectorItem} data-testid="contrato-selector-solicitud">
              <span className={styles.propiedad}>
                <span className={styles.direccion}>{solicitud.property.address}</span>
                <span className={styles.codigo}>
                  {solicitud.applicant.fullName}
                  {solicitud.respondedAt ? ` · aceptada el ${fechaCorta(solicitud.respondedAt)}` : ''}
                </span>
              </span>
              <Button
                type="primary"
                onClick={() => router.push(`/panel/contratos/nuevo?solicitud=${encodeURIComponent(solicitud.id)}`)}
                data-testid="contrato-selector-iniciar"
              >
                Iniciar contrato
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
