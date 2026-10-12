'use client'

/**
 * DetallePropiedad.tsx — la pantalla `/propiedad/[id]`: fotos, precio,
 * características, descripción, condiciones, ubicación (exacta con sesión,
 * aproximada sin sesión: decisión del PO con la US-35 actualizada), la
 * tarjeta del dueño con "Solicitar alquiler" y las propiedades similares.
 *
 * Diseño: Claude Design, "Detalle de propiedad" · 01 (escritorio), · 02
 * (estados del botón), · 03 (móvil) y · 04 (estados alternativos).
 * Cubre: US-41 Consultar detalle de propiedad y US-35 Enviar solicitud
 * (numeración de Jira).
 * NOTA: US-41 todavía no tiene criterios escritos en `Documentación/md/US/`:
 * el criterio es la vista de diseño (los supuestos están en el resumen de la
 * tanda y en `HANDOFF-BACKEND.md` §7, US-41).
 * Datos: `propiedades.service#getPropiedad` y `#listarSimilares`,
 * `solicitudes.service#getMiSolicitudParaPropiedad` y la sesión de `useAuth`.
 * Quién lo usa: `app/(public)/propiedad/[id]/page.tsx`. Se entra desde la
 * tarjeta de `/buscar`, de la landing y de "Propiedades similares".
 *
 * NOTA: es un Client Component: la rama mock lee `localStorage` (propiedades
 * creadas en el alta, solicitudes enviadas) y el botón depende de la sesión.
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Breadcrumb } from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import type { CharacteristicKey, PropiedadDetalle, Solicitud } from '@rentar/shared-types'
import { DetailList, IndexBadge, MoneyAmount, PhotoGallery } from '@rentar/ui'
import { formatARS } from '@rentar/ui/src/utils/formatARS'
import { useAuth } from '@/lib/auth/AuthProvider'
import { characteristicOptions } from '@/lib/catalogs/characteristics'
import { MEDIO_PAGO_CORTO, PROPERTY_TYPE_LABEL, periodicidad } from '@/lib/catalogs/propiedad'
import { hrefBuscarEnBarrio } from '@/lib/search/busquedaParams'
import { diasDesde, diasHasta, textoHaceDias } from '@/lib/utils/fechas'
import { getPropiedad } from '@/services/propiedades.service'
import { getMiSolicitudParaPropiedad } from '@/services/solicitudes.service'
import { ServiceError } from '@/services/shared/errors'
import { AccionSolicitar } from './AccionSolicitar'
import { DetalleCargando, DetalleNoDisponible } from './EstadosDetalle'
import { estadoAccion, PARAM_SOLICITAR } from './estadoAccion'
import { OwnerCard } from './OwnerCard'
import { PropiedadesSimilares } from './PropiedadesSimilares'
import { SolicitarAlquilerModal } from './SolicitarAlquilerModal'
import styles from './DetallePropiedad.module.css'

// ─── Tipos y helpers ────────────────────────────────────────────────────

/** Estado de la carga de la propiedad. */
type CargaPropiedad =
  | { estado: 'cargando' }
  | { estado: 'lista'; propiedad: PropiedadDetalle }
  | { estado: 'no_encontrada' }
  | { estado: 'error' }

/** Cómo se dice la falta de cada característica (Detalle · 01: "✕ Sin cochera"). */
const CARACTERISTICA_AUSENTE: Record<CharacteristicKey, string> = {
  amoblado: 'Sin amoblar',
  mascotas: 'No acepta mascotas',
  cochera: 'Sin cochera',
  balcon: 'Sin balcón',
  'apto-profesional': 'No apto profesional',
}

/** "1 dormitorio" / "2 dormitorios". */
function cantidad(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`
}

/** Fecha larga en castellano: "1 de octubre de 2026". */
function fechaDisponible(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Props de {@link DetallePropiedad}. */
interface DetallePropiedadProps {
  /** Id de la publicación (segmento `[id]` de la URL). */
  id: string
}

/** Detalle público de una propiedad (US-41) con la acción de solicitarla (US-35). */
export function DetallePropiedad({ id }: DetallePropiedadProps) {
  const { user, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // ─── Estado local ───────────────────────────────────────────────────────
  // NOTA: cada resultado se guarda con la `key` del pedido al que pertenece
  // (mismo patrón que `BuscarPropiedades`): "cargando" se deriva de que la
  // key no coincida, sin poner estado a mano dentro de un efecto.
  const [intento, setIntento] = useState(0)
  // La dirección depende de la sesión (exacta con sesión, aproximada sin): se
  // espera a que el AuthProvider la resuelva, así no se pide dos veces ni se ve
  // la aproximada un instante (decisión del PO con la US-35 actualizada).
  const conSesion = isLoading ? undefined : user !== null
  const cargaKey = conSesion === undefined ? null : `${id}:${intento}:${conSesion ? 'con-sesion' : 'sin-sesion'}`
  const [cargaGuardada, setCargaGuardada] = useState<{ key: string; carga: CargaPropiedad } | null>(null)
  const carga: CargaPropiedad = cargaKey !== null && cargaGuardada?.key === cargaKey ? cargaGuardada.carga : { estado: 'cargando' }

  const userId = isLoading ? undefined : (user?.id ?? null)
  // Sube después de enviar una solicitud, para volver a pedir "mi solicitud".
  const [versionSolicitud, setVersionSolicitud] = useState(0)
  const solicitudKey = `${id}:${userId ?? ''}:${versionSolicitud}`
  const [solicitudGuardada, setSolicitudGuardada] = useState<{ key: string; solicitud: Solicitud | null } | null>(null)
  // `undefined` = cargando; `null` = nunca la solicitó (o no hay sesión).
  const miSolicitud: Solicitud | null | undefined =
    userId === undefined ? undefined : userId === null ? null : solicitudGuardada?.key === solicitudKey ? solicitudGuardada.solicitud : undefined

  /**
   * Quién pidió abrir el modal "Solicitar alquiler" (US-35): `click` (el
   * botón) o `url` (la vuelta del login con `?solicitar=1`, leída una sola vez
   * al montar). `null` = cerrado.
   */
  const [modalPedido, setModalPedido] = useState<'click' | 'url' | null>(() => (searchParams.has(PARAM_SOLICITAR) ? 'url' : null))

  // ─── Datos ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (cargaKey === null) return
    let vigente = true
    getPropiedad(id, { conSesion: conSesion === true })
      .then((propiedad) => {
        if (vigente) setCargaGuardada({ key: cargaKey, carga: { estado: 'lista', propiedad } })
      })
      .catch((error: unknown) => {
        if (!vigente) return
        const estado = error instanceof ServiceError && error.code === 'not_found' ? 'no_encontrada' : 'error'
        setCargaGuardada({ key: cargaKey, carga: { estado } })
      })
    return () => {
      vigente = false
    }
  }, [id, cargaKey, conSesion])

  useEffect(() => {
    if (!userId) return
    let vigente = true
    getMiSolicitudParaPropiedad(id)
      .then((solicitud) => {
        if (vigente) setSolicitudGuardada({ key: solicitudKey, solicitud })
      })
      // Si no se puede saber (por ejemplo, la ruta todavía no existe en el back), se ofrece
      // solicitar: el back responde 409 si ya la había solicitado y el modal lo explica.
      .catch(() => {
        if (vigente) setSolicitudGuardada({ key: solicitudKey, solicitud: null })
      })
    return () => {
      vigente = false
    }
  }, [id, userId, solicitudKey])

  const propiedad = carga.estado === 'lista' ? carga.propiedad : null
  const estado = propiedad ? estadoAccion({ propiedad, usuario: userId === undefined ? undefined : user, miSolicitud }) : null
  const tipoAccion = estado?.tipo ?? null

  // ─── Vuelta del login con ?solicitar=1 ──────────────────────────────────
  // US-35: "al volver se abre el modal". Solo si al volver puede solicitar;
  // si es el dueño o ya la había solicitado, se muestra ese estado y el modal
  // no se abre. En cualquier caso se limpia el parámetro de la URL apenas se
  // sabe el estado del botón, para que recargar no lo vuelva a abrir.
  const accionResuelta = carga.estado !== 'cargando' && tipoAccion !== 'cargando'
  const modalAbierto = modalPedido === 'click' || (modalPedido === 'url' && tipoAccion === 'puede_solicitar')
  useEffect(() => {
    if (accionResuelta && searchParams.has(PARAM_SOLICITAR)) router.replace(pathname, { scroll: false })
  }, [accionResuelta, searchParams, router, pathname])

  // ─── Handlers ───────────────────────────────────────────────────────────

  const abrirModal = () => setModalPedido('click')

  /** Al cerrar el modal: si ya hay una solicitud (enviada o 409), se vuelve a pedir para mostrar su estado. */
  const cerrarModal = (cambioElEstado: boolean) => {
    setModalPedido(null)
    if (cambioElEstado) setVersionSolicitud((version) => version + 1)
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  if (carga.estado === 'cargando') return <DetalleCargando />
  if (carga.estado === 'no_encontrada') return <DetalleNoDisponible motivo="no_encontrada" />
  if (carga.estado === 'error') return <DetalleNoDisponible motivo="error" onReintentar={() => setIntento((n) => n + 1)} />
  if (!propiedad || !estado) return null

  const disponible = propiedad.availability === 'disponible'
  const disponibleMasAdelante = propiedad.availableFrom !== null && diasHasta(propiedad.availableFrom) > 0
  const { conditions, paymentMethods } = propiedad
  const accion = (variant: 'tarjeta' | 'barra') => <AccionSolicitar estado={estado} propiedad={propiedad} onSolicitar={abrirModal} variant={variant} />

  return (
    <div className={styles.page} data-testid="detalle-propiedad">
      <div className={styles.inner}>
        <Breadcrumb
          className={styles.breadcrumb}
          items={[
            { title: <Link href="/buscar">Propiedades</Link> },
            ...(propiedad.neighborhoodName ? [{ title: <Link href={hrefBuscarEnBarrio(propiedad.neighborhoodSlug)}>{propiedad.neighborhoodName}</Link> }] : []),
            { title: propiedad.title },
          ]}
        />

        <div className={styles.layout}>
          <div className={styles.main}>
            <PhotoGallery
              images={propiedad.photoSrcs.map((src, index) => ({ src, alt: `${propiedad.title}, foto ${index + 1} de ${propiedad.photoSrcs.length}` }))}
              data-testid="detalle-propiedad-galeria"
            />

            {/* ─── Título ─── */}
            <header className={styles.titleBlock}>
              <h1 className={styles.title}>
                {/* Con sesión, la exacta con el piso; sin sesión, la aproximada (ver `getPropiedad`). */}
                <span data-testid="detalle-propiedad-direccion" data-precision={propiedad.addressPrecision}>
                  {propiedad.address}
                </span>
                {propiedad.neighborhoodName && <span className={styles.titleBarrio}> · {propiedad.neighborhoodName}</span>}
              </h1>
              <p className={styles.subtitle}>
                {propiedad.title} · {propiedad.city}
                {propiedad.publishedAt && ` · Publicada ${textoHaceDias(diasDesde(propiedad.publishedAt))}`}
              </p>
            </header>

            {/* ─── Precio, expensas, ajuste y disponibilidad ─── */}
            <dl className={styles.priceStrip} data-testid="detalle-propiedad-precio">
              <div className={styles.priceItem}>
                <dt className={styles.priceLabel}>Alquiler mensual</dt>
                <dd className={styles.priceValue}>
                  {propiedad.priceMonthly === null ? (
                    // TODO(backend): sin contrato el detalle no trae precio (ver el adaptador).
                    <span className={styles.consultar}>Consultar</span>
                  ) : (
                    <>
                      <MoneyAmount amount={propiedad.priceMonthly} size="lg" emphasis /> <span className={styles.priceUnit}>por mes</span>
                    </>
                  )}
                </dd>
              </div>
              {propiedad.expenses !== null && (
                <div className={styles.priceItem}>
                  <dt className={styles.priceLabel}>Expensas</dt>
                  <dd className={styles.priceValue}>{propiedad.expenses === 0 ? 'Sin expensas' : <MoneyAmount amount={propiedad.expenses} />}</dd>
                </div>
              )}
              {propiedad.adjustmentIndex && (
                <div className={styles.priceItem}>
                  <dt className={styles.priceLabel}>Ajuste</dt>
                  <dd className={styles.priceValue}>
                    <IndexBadge index={propiedad.adjustmentIndex} />
                  </dd>
                </div>
              )}
              {disponible && (
                <div className={styles.priceItem}>
                  <dt className={styles.priceLabel}>Disponible desde</dt>
                  <dd className={styles.priceValue} data-testid="detalle-propiedad-disponible-desde">
                    {disponibleMasAdelante && propiedad.availableFrom ? fechaDisponible(propiedad.availableFrom) : 'Ya disponible'}
                  </dd>
                </div>
              )}
            </dl>

            {/* ─── Características ─── */}
            <section className={styles.section} aria-labelledby="detalle-caracteristicas">
              <h2 id="detalle-caracteristicas" className={styles.sectionTitle}>
                Características
              </h2>
              <ul className={styles.features}>
                <li className={styles.feature}>
                  <span className={styles.featureValue}>{propiedad.areaM2} m²</span>
                  <span className={styles.featureLabel}>Totales · {propiedad.coveredAreaM2} m² cubiertos</span>
                </li>
                <li className={styles.feature}>
                  <span className={styles.featureValue}>{cantidad(propiedad.rooms, 'ambiente', 'ambientes')}</span>
                  <span className={styles.featureLabel}>{PROPERTY_TYPE_LABEL[propiedad.type]}</span>
                </li>
                <li className={styles.feature}>
                  <span className={styles.featureValue}>{cantidad(propiedad.bedrooms, 'dormitorio', 'dormitorios')}</span>
                  <span className={styles.featureLabel}>{cantidad(propiedad.bathrooms, 'baño', 'baños')}</span>
                </li>
              </ul>
              <ul className={styles.tags} data-testid="detalle-propiedad-caracteristicas">
                {characteristicOptions.map((opcion) => {
                  const tiene = propiedad.characteristics.includes(opcion.key)
                  return (
                    <li key={opcion.key} className={tiene ? styles.tagOn : styles.tagOff}>
                      {tiene ? <CheckOutlined aria-hidden="true" /> : <CloseOutlined aria-hidden="true" />}
                      {tiene ? opcion.label : CARACTERISTICA_AUSENTE[opcion.key]}
                    </li>
                  )
                })}
              </ul>
            </section>

            {/* ─── Descripción ─── */}
            {propiedad.description && (
              <section className={styles.section} aria-labelledby="detalle-descripcion">
                <h2 id="detalle-descripcion" className={styles.sectionTitle}>
                  Descripción
                </h2>
                <p className={styles.description}>{propiedad.description}</p>
              </section>
            )}

            {/* ─── Ubicación (exacta con sesión, aproximada sin) ─── */}
            <section className={styles.section} aria-labelledby="detalle-ubicacion">
              <h2 id="detalle-ubicacion" className={styles.sectionTitle}>
                {propiedad.addressPrecision === 'exacta' ? 'Ubicación' : 'Ubicación aproximada'}
              </h2>
              <p className={styles.sectionSubtitle}>
                {[propiedad.neighborhoodName, propiedad.address].filter(Boolean).join(' · ')}
              </p>
              {/* NOTA: placeholder de mapa (no hay mapas en el MVP): marca la zona, no el punto exacto. */}
              <div className={styles.map} role="img" aria-label={`Zona aproximada: ${propiedad.neighborhoodName || propiedad.city}`}>
                <span className={styles.mapRadius} />
                <span className={styles.mapDot} />
              </div>
              <p className={styles.mapNote}>
                {propiedad.addressPrecision === 'exacta'
                  ? 'Ves la dirección exacta porque iniciaste sesión.'
                  : 'Mostramos la cuadra, no la altura. Iniciá sesión para ver la dirección exacta.'}
              </p>
            </section>
          </div>

          {/* ─── Tarjeta del dueño (sticky en escritorio) ─── */}
          <aside className={styles.aside}>
            <OwnerCard owner={propiedad.owner} action={accion('tarjeta')} data-testid="detalle-propiedad-dueno-card">
              {conditions && (
                <DetailList
                  title="Condiciones del contrato"
                  data-testid="detalle-propiedad-condiciones"
                  items={[
                    ...(conditions.contractMonths !== null ? [{ label: 'Plazo', value: `${conditions.contractMonths} ${conditions.contractMonths === 1 ? 'mes' : 'meses'}` }] : []),
                    ...(conditions.adjustmentEveryMonths !== null
                      ? [{ label: 'Ajuste', value: `${propiedad.adjustmentIndex ?? 'Índice'} ${periodicidad(conditions.adjustmentEveryMonths)}` }]
                      : []),
                    ...(conditions.depositAmount !== null ? [{ label: 'Depósito', value: formatARS(conditions.depositAmount) }] : []),
                  ]}
                />
              )}
              {paymentMethods && (
                <div className={styles.payments} data-testid="detalle-propiedad-medios-pago">
                  <h3 className={styles.paymentsTitle}>Cómo se paga</h3>
                  <ul className={styles.paymentList}>
                    {paymentMethods.map((medio) => (
                      <li key={medio.method} className={styles.payment}>
                        {MEDIO_PAGO_CORTO[medio.method]}
                        {medio.surchargePct > 0 && <span className={styles.surcharge}> · +{medio.surchargePct}%</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </OwnerCard>
          </aside>
        </div>

        <PropiedadesSimilares propiedad={propiedad} />
      </div>

      {/* ─── Barra fija de móvil (Detalle · 03): precio y acción principal ─── */}
      <div className={styles.mobileBar} data-testid="detalle-propiedad-barra-movil">
        <div className={styles.mobileBarPrice}>
          {propiedad.priceMonthly === null ? (
            <span className={styles.consultar}>Consultar</span>
          ) : (
            <>
              <MoneyAmount amount={propiedad.priceMonthly} emphasis />
              {propiedad.expenses ? <span className={styles.mobileBarHint}>+ expensas</span> : null}
            </>
          )}
        </div>
        <div className={styles.mobileBarAction}>{accion('barra')}</div>
      </div>

      {/* Se monta solo mientras está abierto: cada vez arranca con el formulario vacío. */}
      {modalAbierto && <SolicitarAlquilerModal open propiedad={propiedad} onClose={cerrarModal} />}
    </div>
  )
}
