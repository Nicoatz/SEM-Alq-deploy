'use client'

/**
 * MiAlquiler.tsx — `/panel/alquiler`, la ficha del alquiler del locatario.
 *
 * Cubre: US-27 Consultar mis alquileres y US-07 Firmar contrato de alquiler
 * (del lado del locatario):
 * - Con un solo contrato (pendiente de firma, vigente o finalizado;
 *   decisión del PO), su ficha directa. Con dos o más, va al listado
 *   `/panel/alquileres` (`router.replace`).
 * - Sin contratos: "Todavía no tenés un contrato activo", con acceso a
 *   buscar propiedades.
 * - `?contrato=<id>` (desde el listado): la ficha de ese contrato; si no es
 *   suyo o no existe, "No encontramos este alquiler", sin distinguir.
 * - La ficha (`VistaContrato` con `vista="locatario"`): propiedad con foto,
 *   estado y código, locador con su contacto, condiciones, "Lo que viene",
 *   firmas (y la firma, si falta la suya: `FirmaContrato`), documento, PDF e
 *   historial. Un finalizado, en solo lectura y sin "Lo que viene".
 *
 * De dónde saca los datos: `contratos.service#getMiAlquiler`.
 * Quién lo usa: `app/(app)/panel/alquiler/page.tsx`.
 */
import { useCallback, useEffect } from 'react'
import { Button, Skeleton } from 'antd'
import { useRouter } from 'next/navigation'
import { EmptyState, PageHeader } from '@rentar/ui'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { getMiAlquiler } from '@/services/contratos.service'
import { rolEnContrato, VistaContrato } from './DetalleContrato'
import styles from './DetalleContrato.module.css'

/** Props de {@link MiAlquiler}. */
interface MiAlquilerProps {
  /** Un contrato puntual (`?contrato=`, desde el listado); sin él, el único que tenga. */
  contratoId?: string
}

/** Mi alquiler: carga, vacío, "no encontrado", varios → listado, y la ficha. */
export function MiAlquiler({ contratoId }: MiAlquilerProps) {
  const router = useRouter()
  const { user } = useAuth()
  const cargar = useCallback(() => getMiAlquiler(contratoId), [contratoId])
  const carga = useServiceCall(cargar)
  const varios = carga.status === 'listo' && carga.data.tipo === 'varios'
  // Con un contrato elegido del listado, la miga vuelve a "Mis alquileres".
  const miga = contratoId
    ? [{ label: 'Mi panel', href: '/panel' }, { label: 'Mis alquileres', href: '/panel/alquileres' }, { label: 'Alquiler' }]
    : [{ label: 'Mi panel', href: '/panel' }, { label: 'Mi alquiler' }]

  // US-27: "si tiene dos o más … se debe mostrar el listado en /panel/alquileres".
  useEffect(() => {
    if (varios) router.replace('/panel/alquileres')
  }, [varios, router])

  if (carga.status === 'cargando' || varios) {
    return (
      <div className={styles.page} data-testid="mi-alquiler-cargando">
        <PageHeader title="Mi alquiler" breadcrumb={miga} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (carga.status === 'error') {
    const noEncontrado = carga.code === 'not_found'
    return (
      <div className={styles.page}>
        <PageHeader title="Mi alquiler" breadcrumb={miga} />
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

  const resultado = carga.data
  if (resultado.tipo !== 'uno') {
    // US-27: "Si el usuario no tiene contratos, se debe mostrar el mensaje
    // 'Todavía no tenés un contrato activo' con acceso a buscar propiedades."
    return (
      <div className={styles.page}>
        <PageHeader title="Mi alquiler" breadcrumb={miga} />
        <div className={styles.bloqueado} data-testid="mi-alquiler-vacio">
          <EmptyState
            title="Todavía no tenés un contrato activo"
            description="Cuando un locador te envíe un contrato para firmar, lo vas a ver acá."
            action={
              <Button type="primary" onClick={() => router.push('/buscar')} data-testid="mi-alquiler-buscar">
                Buscar propiedades en Córdoba
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const { contrato } = resultado
  return (
    <VistaContrato
      key={`${contrato.id}-${contrato.status}`}
      inicial={contrato}
      miRol={rolEnContrato(contrato, user?.id)}
      miga={miga}
      titulo="Mi alquiler"
      vista="locatario"
    />
  )
}
