'use client'

/**
 * ListadoAlquileres.tsx — `/panel/alquileres`, Mis alquileres (dos o más contratos).
 *
 * Cubre: US-27 Consultar mis alquileres, "Uno o varios alquileres":
 * - "Si tiene dos o más … se debe mostrar el listado en /panel/alquileres."
 *   Con uno o ninguno, se va a `/panel/alquiler` (la ficha o el vacío).
 * - "El listado se ordena así: pendientes de firma, después vigentes y al
 *   final finalizados, que se muestran atenuados y sin acciones."
 * - "Cada alquiler del listado debe mostrar dirección, barrio, nombre del
 *   locador, estado, monto actual, vigencia y fecha del próximo ajuste."
 * Cada fila abre su ficha (`/panel/alquiler?contrato=<id>`, decisión del
 * PO). En los finalizados, abrirla es lo único que se puede hacer: no tienen
 * botones (la ficha se ve en solo lectura).
 * NOTA (diseño vs. US): el diseño (Paneles · 07) muestra pagos y expensas en
 * cada tarjeta; eso es del módulo de cobros (otra US): acá, lo de la US.
 *
 * De dónde saca los datos: `contratos.service#listarMisAlquileres`.
 * Quién lo usa: `app/(app)/panel/alquileres/page.tsx`.
 */
import { useEffect, type ReactNode } from 'react'
import { Button, Skeleton } from 'antd'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AlquilerResumen } from '@rentar/shared-types'
import { DataTable, IndexBadge, MoneyAmount, PageHeader, StatusTag, type DataTableColumn } from '@rentar/ui'
import { fechaCorta } from '@/lib/contratos/fechas'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { listarMisAlquileres } from '@/services/contratos.service'
import styles from './Contratos.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Mis alquileres' }]

/** La ficha de un alquiler (decisión del PO: la misma ruta con `?contrato=`). */
function fichaHref(alquiler: Pick<AlquilerResumen, 'id'>): string {
  return `/panel/alquiler?contrato=${encodeURIComponent(alquiler.id)}`
}

/** `true` si ya terminó: se muestra atenuado y sin acciones. */
function terminado(alquiler: AlquilerResumen): boolean {
  return alquiler.status === 'finalizado' || alquiler.status === 'rescindido'
}

/** Vigencia "01/04/2026 → 31/03/2029". */
function vigencia(alquiler: AlquilerResumen): string {
  return alquiler.startDate && alquiler.endDate ? `${fechaCorta(alquiler.startDate)} → ${fechaCorta(alquiler.endDate)}` : '—'
}

/** "Subtítulo": cuántos hay de cada estado. */
function subtitulo(alquileres: readonly AlquilerResumen[]): string {
  const contar = (estado: AlquilerResumen['status']) => alquileres.filter((item) => item.status === estado).length
  const partes: string[] = []
  const agregar = (cantidad: number, singular: string, plural: string) => {
    if (cantidad > 0) partes.push(`${cantidad} ${cantidad === 1 ? singular : plural}`)
  }
  agregar(contar('pendiente_firma'), 'pendiente de firma', 'pendientes de firma')
  agregar(contar('vigente'), 'vigente', 'vigentes')
  agregar(contar('finalizado') + contar('rescindido'), 'finalizado', 'finalizados')
  return partes.join(' · ')
}

/** Mis alquileres: el listado, o la redirección a `/panel/alquiler` si hay uno o ninguno. */
export function ListadoAlquileres() {
  const router = useRouter()
  const carga = useServiceCall(listarMisAlquileres)
  const pocos = carga.status === 'listo' && carga.data.length < 2

  // US-27: con un solo contrato (o ninguno) no hay listado: la ficha o el vacío.
  useEffect(() => {
    if (pocos) router.replace('/panel/alquiler')
  }, [pocos, router])

  if (carga.status === 'cargando' || pocos) {
    return (
      <div className={styles.page} data-testid="mis-alquileres-cargando">
        <PageHeader title="Mis alquileres" breadcrumb={MIGA} />
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    )
  }

  if (carga.status === 'error') {
    return (
      <div className={styles.page}>
        <PageHeader title="Mis alquileres" breadcrumb={MIGA} />
        <div className={styles.errorBlock} role="alert" data-testid="mis-alquileres-error">
          <span className={styles.errorTitle}>No pudimos traer tus alquileres</span>
          <span className={styles.errorText}>{carga.message}</span>
          <Button type="primary" onClick={carga.reintentar} data-testid="mis-alquileres-reintentar">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const alquileres = carga.data
  /** Los finalizados, atenuados (US-27). */
  const celda = (alquiler: AlquilerResumen, contenido: ReactNode) => (
    <span className={terminado(alquiler) ? styles.atenuado : undefined}>{contenido}</span>
  )

  const columnas: DataTableColumn<AlquilerResumen>[] = [
    {
      key: 'propiedad',
      title: 'Propiedad',
      hideInCard: true,
      render: (alquiler) =>
        celda(
          alquiler,
          <span className={styles.propiedad}>
            <span className={styles.direccion} data-testid="mis-alquileres-direccion">
              {alquiler.propertyAddress}
            </span>
            <span className={styles.codigo}>{alquiler.neighborhoodName}</span>
          </span>,
        ),
    },
    { key: 'locador', title: 'Locador', render: (alquiler) => celda(alquiler, alquiler.landlordName || '—') },
    { key: 'estado', title: 'Estado', render: (alquiler) => celda(alquiler, <StatusTag domain="contrato" status={alquiler.status} data-testid="mis-alquileres-estado" />) },
    {
      key: 'monto',
      title: 'Monto actual',
      render: (alquiler) => celda(alquiler, alquiler.currentAmount === null ? '—' : <MoneyAmount amount={alquiler.currentAmount} />),
    },
    { key: 'vigencia', title: 'Vigencia', render: (alquiler) => celda(alquiler, vigencia(alquiler)) },
    {
      key: 'ajuste',
      title: 'Próximo ajuste',
      render: (alquiler) =>
        celda(
          alquiler,
          alquiler.adjustmentIndex === 'sin_ajuste' ? (
            <IndexBadge index="sin_ajuste" />
          ) : alquiler.adjustmentIndex && alquiler.nextAdjustmentDate && !terminado(alquiler) ? (
            <span className={styles.ajuste}>
              <IndexBadge index={alquiler.adjustmentIndex} />
              {fechaCorta(alquiler.nextAdjustmentDate)}
            </span>
          ) : (
            '—'
          ),
        ),
    },
  ]

  return (
    <div className={styles.page} data-testid="mis-alquileres">
      <PageHeader title="Mis alquileres" subtitle={subtitulo(alquileres)} breadcrumb={MIGA} />
      <DataTable<AlquilerResumen>
        columns={columnas}
        data={alquileres}
        rowKey={(alquiler) => alquiler.id}
        onRowClick={(alquiler) => router.push(fichaHref(alquiler))}
        rowLabel={(alquiler) => `Ver el alquiler de ${alquiler.propertyAddress}`}
        cardHeader={(alquiler) =>
          celda(
            alquiler,
            <span className={styles.propiedad}>
              {/* En móvil la tarjeta no es clickeable: la dirección es el link a la ficha. */}
              <Link href={fichaHref(alquiler)} className={styles.direccion} data-testid="mis-alquileres-ficha-movil">
                {alquiler.propertyAddress}
              </Link>
              <span className={styles.codigo}>{alquiler.neighborhoodName}</span>
            </span>,
          )
        }
        cardActions={(alquiler) =>
          // US-27: los finalizados, sin acciones (su ficha se abre desde la dirección).
          terminado(alquiler) ? null : (
            <Button onClick={() => router.push(fichaHref(alquiler))} data-testid="mis-alquileres-ver-movil">
              Ver alquiler
            </Button>
          )
        }
        data-testid="mis-alquileres-tabla"
      />
    </div>
  )
}
