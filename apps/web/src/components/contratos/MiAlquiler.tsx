'use client'

/**
 * MiAlquiler.tsx — `/panel/alquiler`, el contrato del locatario.
 *
 * Cubre: US-07 Firmar contrato de alquiler, del lado del locatario: "el
 * locatario firma desde Mi alquiler (/panel/alquiler)" y "puede rechazar la
 * firma, indicando un motivo opcional de hasta 300 caracteres". Después de
 * rechazar, ve su rechazo y no el botón de firmar (decisión del PO).
 * Es la BASE de la ficha de US-27 Consultar mis alquileres (tanda 4): la
 * misma vista del contrato (`VistaContrato`), con el mismo `FirmaContrato`
 * que usa el locador. Lo que falta de la ficha (condiciones, "Lo que viene"
 * y el listado cuando tiene varios) llega en la tanda 4.
 * - Sin contrato pendiente ni vigente: un estado vacío con salida a la búsqueda.
 * - `?contrato=<id>` ajeno o inexistente: "No encontramos este alquiler", sin distinguir.
 *
 * De dónde saca los datos: `contratos.service#getMiAlquiler`.
 * Quién lo usa: `app/(app)/panel/alquiler/page.tsx`.
 */
import { useCallback } from 'react'
import { Button, Skeleton } from 'antd'
import { useRouter } from 'next/navigation'
import { EmptyState, PageHeader } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { getMiAlquiler } from '@/services/contratos.service'
import { rolEnContrato, VistaContrato } from './DetalleContrato'
import styles from './DetalleContrato.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Mi alquiler' }]

/** Props de {@link MiAlquiler}. */
interface MiAlquilerProps {
  /** Un contrato puntual (`?contrato=`); sin él, el pendiente de firma o el vigente. */
  contratoId?: string
}

/** Mi alquiler: carga, vacío, "no encontrado" y la vista del contrato. */
export function MiAlquiler({ contratoId }: MiAlquilerProps) {
  const router = useRouter()
  const { user } = useAuth()
  const cargar = useCallback(() => getMiAlquiler(contratoId), [contratoId])
  const carga = useServiceCall(cargar)

  if (carga.status === 'cargando') {
    return (
      <div className={styles.page} data-testid="mi-alquiler-cargando">
        <PageHeader title="Mi alquiler" breadcrumb={MIGA} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (carga.status === 'error') {
    const noEncontrado = carga.code === 'not_found'
    return (
      <div className={styles.page}>
        <PageHeader title="Mi alquiler" breadcrumb={MIGA} />
        <div className={styles.bloqueado} data-testid={noEncontrado ? 'mi-alquiler-no-encontrado' : 'mi-alquiler-error'}>
          <EmptyState
            title={noEncontrado ? 'No encontramos este alquiler' : 'No pudimos abrir tu alquiler'}
            description={noEncontrado ? 'Puede que no exista o que no sea tuyo.' : carga.message}
            action={
              <span className={styles.acciones}>
                <Button type="primary" onClick={() => router.push('/panel/alquiler')} data-testid="mi-alquiler-ir">
                  Ir a Mi alquiler
                </Button>
                {!noEncontrado && (
                  <Button onClick={carga.reintentar} data-testid="mi-alquiler-reintentar">
                    Reintentar
                  </Button>
                )}
              </span>
            }
          />
        </div>
      </div>
    )
  }

  const contrato = carga.data
  if (!contrato) {
    return (
      <div className={styles.page}>
        <PageHeader title="Mi alquiler" breadcrumb={MIGA} />
        <div className={styles.bloqueado} data-testid="mi-alquiler-vacio">
          <EmptyState
            title="Todavía no tenés un alquiler"
            description="Cuando un locador te envíe un contrato para firmar, lo vas a ver acá."
            action={
              <span className={styles.acciones}>
                <Button type="primary" onClick={() => router.push('/buscar')} data-testid="mi-alquiler-buscar">
                  Buscar propiedades
                </Button>
                <Button onClick={() => router.push('/panel/mis-solicitudes')} data-testid="mi-alquiler-solicitudes">
                  Ver mis solicitudes
                </Button>
              </span>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <VistaContrato
      key={`${contrato.id}-${contrato.status}`}
      inicial={contrato}
      miRol={rolEnContrato(contrato, user?.id)}
      miga={MIGA}
      titulo="Mi alquiler"
    />
  )
}
