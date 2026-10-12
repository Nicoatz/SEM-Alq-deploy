'use client'

/**
 * MiPropiedad.tsx — `/panel/propiedades/[id]`, el detalle de una propiedad
 * del locador en sesión.
 *
 * Cubre (numeración de Jira): US-03 Modificar mis propiedades (entrada a la
 * edición) y US-04 Eliminar mis propiedades. US-03 y US-04 no tienen
 * criterios escritos todavía: se usó el diseño como criterio (decisión del
 * PO, como con US-41).
 *
 * Qué muestra (Claude Design, "Detalle de propiedad del locador" · 01, 05,
 * 07 y 08):
 * - Encabezado: dirección EXACTA, barrio, tipo y fecha de publicación; la
 *   foto con "Ver las N fotos"; estado; si está alquilada, locatario, fin del
 *   contrato y próximo ajuste; el alquiler y las expensas. Acción primaria
 *   "Editar publicación" y, en el "⋯", "Ver la publicación pública" y
 *   "Eliminar propiedad".
 * - El Resumen (`ResumenPropiedad`).
 * - Eliminar (`ModalEliminar`): con contrato vigente, el botón NO se
 *   deshabilita: abre el aviso de bloqueo (decisión del PO, ver NOTES.md).
 * - Móvil: las acciones van en una barra fija abajo y una hoja inferior; en
 *   la hoja, "Eliminar" bloqueado muestra el motivo al costado (· 07).
 * - Carga con la forma real, error con "Reintentar" y "No encontramos esta
 *   propiedad" (eliminada o ajena: el mismo mensaje, · 08).
 *
 * De dónde saca los datos: `getMiPropiedad`.
 * Quién lo usa: `app/(app)/panel/propiedades/[id]/page.tsx`.
 */
import { useCallback, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button, Drawer, Dropdown, Modal, Skeleton } from 'antd'
import { DeleteOutlined, EditOutlined, EllipsisOutlined, EyeOutlined, PictureOutlined } from '@ant-design/icons'
import type { PropiedadLocadorDetalle, PropertyStatus } from '@rentar/shared-types'
import { EmptyState, MoneyAmount, PageHeader, PhotoGallery, StatusTag, formatARS } from '@rentar/ui'
import { tipoCorto } from '@/lib/catalogs/propiedad'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { useFotoConRespaldo } from '@/lib/imagenes/fotoConRespaldo'
import { hrefTrasEliminar } from '@/lib/mis-propiedades/eliminada'
import { puedeEliminar } from '@/lib/validation/propiedad.rules'
import { getMiPropiedad } from '@/services/propiedades.service'
import { ModalEliminar } from './ModalEliminar'
import { ResumenPropiedad } from './ResumenPropiedad'
import { fecha } from './textosPropiedad'
import styles from './MiPropiedad.module.css'

/** Props de {@link MiPropiedad}. */
interface MiPropiedadProps {
  id: string
}

/** Las que aparecen en `/buscar` (y tienen detalle público). */
function seVePublicada(status: PropertyStatus): boolean {
  return status === 'publicada' || status === 'alquilada_publicada'
}

/** Miga: Mi panel / Propiedades / <dirección>. */
function miga(direccion: string) {
  return [
    { label: 'Mi panel', href: '/panel' },
    { label: 'Propiedades', href: '/panel/propiedades' },
    { label: direccion },
  ]
}

/** "Nueva Córdoba · Depto 2 amb · publicada el 12/03/2026". */
function subtitulo(detalle: PropiedadLocadorDetalle): string {
  const partes = [detalle.neighborhoodName, tipoCorto(detalle.values.type, detalle.values.rooms)]
  if (detalle.publishedAt) partes.push(`publicada el ${fecha(detalle.publishedAt)}`)
  return partes.filter(Boolean).join(' · ')
}

/** Skeleton con la forma real: foto, título, estado y ficha (· 08). */
function Cargando() {
  return (
    <div className={styles.page} data-testid="mi-propiedad-cargando">
      <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 1, width: '60%' }} />
      <div className={styles.hero}>
        <Skeleton.Image active className={styles.heroSkeleton} />
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
      <Skeleton active paragraph={{ rows: 6 }} />
    </div>
  )
}

/** La foto principal del encabezado, con "Ver las N fotos". */
function FotoPrincipal({ detalle, onVer }: { detalle: PropiedadLocadorDetalle; onVer: () => void }) {
  const { photos, mainPhotoIndex } = detalle.values
  const foto = useFotoConRespaldo(photos[mainPhotoIndex]?.src ?? photos[0]?.src ?? '')
  return (
    <div className={styles.heroPhoto}>
      {/* Las fotos del alta son data URLs guardadas en el navegador: no pasan por el optimizador. */}
      <Image src={foto.src} onError={foto.onError} alt="" fill sizes="(max-width: 767px) 100vw, 260px" unoptimized className={styles.heroImg} />
      {photos.length > 0 && (
        <button type="button" className={styles.heroFotos} onClick={onVer} data-testid="mi-propiedad-ver-fotos">
          <PictureOutlined aria-hidden="true" /> {photos.length === 1 ? 'Ver la foto' : `Ver las ${photos.length} fotos`}
        </button>
      )}
    </div>
  )
}

/** Detalle de una propiedad del locador en sesión. */
export function MiPropiedad({ id }: MiPropiedadProps) {
  const router = useRouter()
  const pedir = useCallback(() => getMiPropiedad(id), [id])
  const carga = useServiceCall(pedir)

  // ─── Estado local ───────────────────────────────────────────────────
  const [fotosAbiertas, setFotosAbiertas] = useState(false)
  const [eliminarAbierto, setEliminarAbierto] = useState(false)
  const [accionesAbiertas, setAccionesAbiertas] = useState(false)

  // ─── Error y no encontrada (· 08) ───────────────────────────────────
  if (carga.status === 'cargando') return <Cargando />
  if (carga.status === 'error') {
    if (carga.code === 'not_found') {
      return (
        <div className={styles.page}>
          <div className={styles.emptyBlock} data-testid="mi-propiedad-no-encontrada">
            <EmptyState
              title="No encontramos esta propiedad"
              description="Puede que la hayas eliminado o que el link sea de otra cuenta."
              action={
                <Button type="primary" onClick={() => router.push('/panel/propiedades')}>
                  Ir a mis propiedades
                </Button>
              }
            />
          </div>
        </div>
      )
    }
    return (
      <div className={styles.page}>
        <PageHeader title="Detalle de propiedad" breadcrumb={miga('Detalle')} />
        <div className={styles.errorBlock} role="alert" data-testid="mi-propiedad-error">
          <span className={styles.errorTitle}>No pudimos traer esta propiedad</span>
          <span className={styles.errorText}>{carga.code === 'network' ? 'Revisá tu conexión y probá de nuevo.' : carga.message}</span>
          <Button type="primary" onClick={carga.reintentar} data-testid="mi-propiedad-reintentar">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const detalle = carga.data
  const { values, activeContract } = detalle
  const hrefEditar = `/panel/propiedades/${encodeURIComponent(detalle.id)}/editar`
  const hrefPublica = seVePublicada(detalle.status) ? `/propiedad/${encodeURIComponent(detalle.id)}` : null
  const alquiler = activeContract?.currentAmount ?? values.priceMonthly

  // ─── Handlers ───────────────────────────────────────────────────────
  function irAEditar(): void {
    router.push(hrefEditar)
  }

  function eliminada(): void {
    // El aviso "Eliminaste <dirección>." de Mis propiedades (decisión del PO: por query param).
    router.push(hrefTrasEliminar(detalle.id, detalle.address))
  }

  const menuItems = [
    ...(hrefPublica
      ? [{ key: 'publica', icon: <EyeOutlined />, label: <span data-testid="mi-propiedad-ver-publica">Ver la publicación pública</span>, onClick: () => router.push(hrefPublica) }]
      : []),
    { key: 'eliminar', icon: <DeleteOutlined />, danger: true, label: <span data-testid="mi-propiedad-menu-eliminar">Eliminar propiedad</span>, onClick: () => setEliminarAbierto(true) },
  ]

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page} data-testid="mi-propiedad">
      <PageHeader
        title={detalle.address}
        subtitle={subtitulo(detalle)}
        breadcrumb={miga(detalle.address)}
        actions={
          <span className={styles.desktopActions}>
            <Button type="primary" size="large" icon={<EditOutlined />} onClick={irAEditar} data-testid="mi-propiedad-editar-button">
              Editar publicación
            </Button>
            <Dropdown trigger={['click']} menu={{ items: menuItems }}>
              <Button size="large" icon={<EllipsisOutlined />} aria-label="Más acciones" data-testid="mi-propiedad-mas" />
            </Dropdown>
          </span>
        }
      />

      {/* Encabezado: foto, estado, contrato y alquiler (· 01). */}
      <section className={styles.hero}>
        <FotoPrincipal detalle={detalle} onVer={() => setFotosAbiertas(true)} />
        <div className={styles.heroBody}>
          <div className={styles.heroTags}>
            <StatusTag domain="propiedad" status={detalle.status} />
            {activeContract && (
              <span className={styles.chipContrato} data-testid="mi-propiedad-contrato">
                {/* Sin fecha de fin (el back real no la manda todavía), solo "Contrato vigente". */}
                {activeContract.endDate ? `Contrato vigente hasta ${fecha(activeContract.endDate)}` : 'Contrato vigente'}
              </span>
            )}
            {activeContract?.nextAdjustmentDate && (
              <span className={styles.chipAjuste}>
                Ajuste{values.adjustmentIndex ? ` ${values.adjustmentIndex}` : ''} el {fecha(activeContract.nextAdjustmentDate)}
              </span>
            )}
          </div>
          <div className={styles.heroDatos}>
            <div className={styles.dato} data-testid="mi-propiedad-precio">
              <span className={styles.datoLabel}>{activeContract ? 'Alquiler actual' : 'Precio publicado'}</span>
              <span className={styles.precio}>
                <MoneyAmount amount={alquiler} size="lg" emphasis />
                <span className={styles.expensas}>{values.expenses > 0 ? `+ ${formatARS(values.expenses)} expensas` : 'Sin expensas'}</span>
              </span>
            </div>
            {activeContract && (
              <div className={styles.dato}>
                <span className={styles.datoLabel}>Locatario</span>
                <span className={styles.datoValor}>{activeContract.tenantName ?? '—'}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <ResumenPropiedad detalle={detalle} hrefPublica={hrefPublica} hrefEditar={hrefEditar} onEliminar={() => setEliminarAbierto(true)} />

      {/* Móvil (· 07): barra fija con la primaria y "Acciones". */}
      <div className={styles.mobileBar}>
        <Button type="primary" size="large" icon={<EditOutlined />} onClick={irAEditar} className={styles.mobileBarMain} data-testid="mi-propiedad-editar-movil">
          Editar publicación
        </Button>
        <Button size="large" onClick={() => setAccionesAbiertas(true)} data-testid="mi-propiedad-acciones-button">
          Acciones
        </Button>
      </div>

      <Drawer placement="bottom" size="auto" open={accionesAbiertas} onClose={() => setAccionesAbiertas(false)} title={detalle.address} data-testid="mi-propiedad-acciones-movil">
        <div className={styles.sheet}>
          <button type="button" className={styles.sheetItem} onClick={irAEditar}>
            Editar publicación
          </button>
          {hrefPublica && (
            <button type="button" className={styles.sheetItem} onClick={() => router.push(hrefPublica)}>
              Ver la publicación pública
            </button>
          )}
          <button
            type="button"
            className={`${styles.sheetItem} ${styles.sheetDanger}`}
            onClick={() => {
              setAccionesAbiertas(false)
              setEliminarAbierto(true)
            }}
            data-testid="mi-propiedad-acciones-eliminar"
          >
            Eliminar propiedad
            {/* · 07: en la hoja, la bloqueada muestra el motivo al costado en vez de un tooltip. */}
            {!puedeEliminar(detalle) && <span className={styles.sheetMotivo}>contrato vigente</span>}
          </button>
          <Button size="large" block onClick={() => setAccionesAbiertas(false)}>
            Cancelar
          </Button>
        </div>
      </Drawer>

      <Modal open={fotosAbiertas} onCancel={() => setFotosAbiertas(false)} footer={null} width={880} title={`Fotos · ${values.photos.length}`} data-testid="mi-propiedad-fotos-modal">
        <PhotoGallery images={values.photos.map((foto, index) => ({ src: foto.src, alt: `Foto ${index + 1} de ${detalle.address}` }))} />
      </Modal>

      {eliminarAbierto && <ModalEliminar detalle={detalle} onCerrar={() => setEliminarAbierto(false)} onEliminada={eliminada} />}
    </div>
  )
}
