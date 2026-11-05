'use client'

/**
 * DetallePeriodo.tsx — `/panel/cobros/[id]`, el detalle de un período.
 *
 * Cubre: US-09 Consultar cobro, "Detalle del período":
 * - Propiedad, locatario, código del contrato con acceso, período y vencimiento.
 * - Cargos línea por línea y total. Sin línea de saldo: no hay pago parcial
 *   (decisión del PO, 05/11).
 * - Cobros registrados con fecha, monto, medio, quién lo cargó, adjunto y acceso
 *   al comprobante (US-10).
 * - Historial con fecha y hora. Si no está disponible, se dice ahí y el resto de
 *   la pantalla se ve igual (decisión del PO, 05/11).
 * - "Registrar un pago a mano" (US-08), solo para el locador. Sin `RequireRole`:
 *   el locatario ve el mismo detalle sin esa acción.
 * - "No encontramos este cobro" si no existe o es ajeno, sin distinguir.
 *
 * De dónde saca los datos: `cobros.service#getPeriodo`.
 * Quién lo usa: `app/(app)/panel/cobros/[id]/page.tsx`.
 */
import { useCallback, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import Link from 'next/link'
import type { CobroCreado, CobroRegistrado, DetallePeriodo as Detalle, PeriodoRegistrable } from '@rentar/shared-types'
import { ActivityTimeline, DetailList, EmptyState, formatARS, formatDate, formatPeriod, MoneyAmount, PageHeader, StatusTag } from '@rentar/ui'
import { BotonPdf } from '@/components/contratos/BotonPdf'
import { useAuth } from '@/lib/auth/AuthProvider'
import { ETIQUETA_MEDIO } from '@/lib/cobros/medios'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { hoy } from '@/lib/utils/fechas'
import { getPeriodo, urlAdjuntoDeCobro } from '@/services/cobros.service'
import { RegistrarCobroModal } from './RegistrarCobroModal'
import styles from './DetallePeriodo.module.css'

/** Props de {@link DetallePeriodo}. */
interface DetallePeriodoProps {
  periodoId: string
}

/** Los datos que necesita el modal, a partir del detalle. */
function registrableDe(detalle: Detalle): PeriodoRegistrable {
  return {
    id: detalle.id,
    contratoId: detalle.contratoId,
    propiedadId: detalle.propiedadId,
    propiedad: detalle.propiedad,
    locatario: detalle.locatario,
    periodo: detalle.periodo,
    vencimiento: detalle.vencimiento,
    alquiler: detalle.alquiler,
  }
}

/** Una fila de la lista de cobros. */
function FilaCobro({ cobro, periodoId }: { cobro: CobroRegistrado; periodoId: string }) {
  const pedirAdjunto = useCallback(() => urlAdjuntoDeCobro(periodoId, cobro.id), [periodoId, cobro.id])
  return (
    <li className={styles.cobro} data-testid="cobro-detalle-cobro">
      <div className={styles.cobroFila}>
        <span className={styles.cobroMedio}>
          {ETIQUETA_MEDIO[cobro.medio]} · {formatDate(cobro.fecha)}
        </span>
        <MoneyAmount amount={cobro.monto} size="sm" />
      </div>
      {cobro.nota && <span className={styles.secundario}>{cobro.nota}</span>}
      <span className={styles.secundario}>
        Cargado por {cobro.registradoPor ?? 'Sin dato'} el {formatDate(cobro.registradoEl, 'DD/MM/YYYY [a las] HH:mm')}
      </span>
      <div className={styles.cobroAcciones}>
        <Link href={`/panel/cobros/${encodeURIComponent(periodoId)}/comprobante`} data-testid="cobro-detalle-comprobante">
          Comprobante {cobro.numeroComprobante}
        </Link>
        {cobro.adjuntoNombre && <span className={styles.secundario} data-testid="cobro-detalle-adjunto">Adjunto: {cobro.adjuntoNombre}</span>}
        {cobro.tieneAdjunto && !cobro.adjuntoNombre && (
          <BotonPdf obtenerUrl={pedirAdjunto} data-testid="cobro-detalle-adjunto">
            Ver adjunto
          </BotonPdf>
        )}
      </div>
    </li>
  )
}

/** El detalle del período, con sus estados de carga y error. */
export function DetallePeriodo({ periodoId }: DetallePeriodoProps) {
  const { user } = useAuth()
  const pedir = useCallback(() => getPeriodo(periodoId), [periodoId])
  const carga = useServiceCall(pedir)

  // ─── Estado local ───
  const [modalAbierto, setModalAbierto] = useState(false)
  const [registrado, setRegistrado] = useState<CobroCreado | null>(null)

  // ─── Handlers ───
  /** Cierra el modal y refresca el detalle. */
  function alRegistrar(creado: CobroCreado): void {
    setModalAbierto(false)
    setRegistrado(creado)
    carga.reintentar()
  }

  // ─── Render ───
  if (carga.status === 'cargando') {
    return (
      <div className={styles.page} data-testid="cobro-detalle-cargando">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (carga.status === 'error' && carga.code === 'not_found') {
    return (
      <EmptyState
        title="No encontramos este cobro"
        action={<Link href="/panel">Volver a mi panel</Link>}
        data-testid="cobro-no-encontrado"
      />
    )
  }

  if (carga.status === 'error') {
    return (
      <div className={styles.errorBlock} role="alert" data-testid="cobro-detalle-error">
        <span className={styles.errorTitle}>No pudimos traer este cobro</span>
        <span className={styles.errorText}>{carga.message}</span>
        <Button type="primary" onClick={carga.reintentar} data-testid="cobro-detalle-reintentar">
          Reintentar
        </Button>
      </div>
    )
  }

  const detalle = carga.data
  // `locadorId` en `null`: vino del listado del locador (ver `detalleDeResumen`).
  const esLocador = detalle.locadorId === null || detalle.locadorId === user?.id
  // US-08: no se cobran períodos pagados ni futuros.
  const cobrable = detalle.estado !== 'pagado' && detalle.inicio <= hoy().format('YYYY-MM-DD')
  const mes = formatPeriod(`${detalle.periodo}-01`)
  const contratoHref = esLocador
    ? `/panel/propiedades/${encodeURIComponent(detalle.propiedadId)}?tab=contratos`
    : `/panel/alquiler?contrato=${encodeURIComponent(detalle.contratoId)}`
  const miga = esLocador
    ? [{ label: 'Cobros', href: '/panel/cobros' }, { label: mes }]
    : [{ label: 'Mi panel', href: '/panel' }, { label: mes }]

  const acciones = (
    <div className={styles.acciones}>
      {detalle.comprobanteCobroId && (
        <Link href={`/panel/cobros/${encodeURIComponent(detalle.id)}/comprobante`} data-testid="cobro-detalle-ver-comprobante">
          <Button>Ver comprobante</Button>
        </Link>
      )}
      {esLocador && cobrable && (
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalAbierto(true)} data-testid="cobro-detalle-registrar">
          Registrar un pago a mano
        </Button>
      )}
    </div>
  )

  return (
    <div className={styles.page} data-testid="cobro-detalle" data-estado={detalle.estado}>
      <PageHeader title={mes} subtitle={detalle.propiedad} breadcrumb={miga} actions={acciones} />

      {registrado && (
        <Alert
          type="success"
          showIcon
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          onClose={() => setRegistrado(null)}
          title={`Registraste el cobro por ${formatARS(registrado.monto)}. Se emitió el comprobante ${registrado.numeroComprobante}.`}
          data-testid="cobro-detalle-aviso"
        />
      )}

      <div className={styles.grid}>
        <div className={styles.columna}>
          <section className={styles.card} data-testid="cobro-detalle-datos">
            <h2 className={styles.cardTitle}>Datos del período</h2>
            <DetailList
              items={[
                { label: 'Estado', value: <StatusTag domain="cobro" status={detalle.estado} data-testid="cobro-detalle-estado" /> },
                { label: 'Propiedad', value: [detalle.propiedad, detalle.barrio].filter(Boolean).join(' · ') },
                { label: 'Locatario', value: detalle.locatario ?? 'Sin dato' },
                {
                  label: 'Contrato',
                  value: (
                    <Link href={contratoHref} data-testid="cobro-detalle-contrato">
                      {detalle.contratoCodigo ?? 'Ver contrato'}
                    </Link>
                  ),
                },
                { label: 'Período', value: `${formatDate(detalle.inicio)} al ${formatDate(detalle.fin)}` },
                { label: 'Vencimiento', value: formatDate(detalle.vencimiento) },
              ]}
            />
          </section>

          <section className={styles.card} data-testid="cobro-detalle-cargos">
            <h2 className={styles.cardTitle}>Cargos</h2>
            <div className={styles.linea}>
              <span>Alquiler</span>
              <MoneyAmount amount={detalle.alquiler} size="sm" data-testid="cobro-detalle-alquiler" />
            </div>
            <div className={styles.linea}>
              <span>Intereses por mora{detalle.diasMora > 0 ? ` · ${detalle.diasMora === 1 ? '1 día' : `${detalle.diasMora} días`}` : ''}</span>
              <MoneyAmount amount={detalle.mora} size="sm" data-testid="cobro-detalle-mora" />
            </div>
            <div className={`${styles.linea} ${styles.lineaTotal}`}>
              <span>Total</span>
              <MoneyAmount amount={detalle.total} emphasis data-testid="cobro-detalle-total" />
            </div>
          </section>
        </div>

        <div className={styles.columna}>
          <section className={styles.card} data-testid="cobro-detalle-cobros">
            <h2 className={styles.cardTitle}>Cobros</h2>
            {!detalle.cobrosDisponibles && <p className={styles.secundario} data-testid="cobro-detalle-cobros-no-disponible">No disponible por ahora.</p>}
            {detalle.cobrosDisponibles && detalle.cobros.length === 0 && <p className={styles.secundario}>Todavía no hay cobros registrados.</p>}
            {detalle.cobros.length > 0 && (
              <ul className={styles.cobros}>
                {detalle.cobros.map((cobro) => (
                  <FilaCobro key={cobro.id} cobro={cobro} periodoId={detalle.id} />
                ))}
              </ul>
            )}
          </section>

          <section className={styles.card} data-testid="cobro-detalle-historial">
            <h2 className={styles.cardTitle}>Historial</h2>
            {detalle.historial === null ? (
              <p className={styles.secundario} data-testid="cobro-detalle-historial-no-disponible">No disponible por ahora.</p>
            ) : (
              <ActivityTimeline
                dateFormat="absolute"
                events={detalle.historial.map((evento) => ({
                  id: evento.id,
                  title: evento.titulo,
                  date: evento.fecha,
                  description: evento.quien ? `Por ${evento.quien}` : undefined,
                }))}
              />
            )}
          </section>
        </div>
      </div>

      {modalAbierto && <RegistrarCobroModal periodo={registrableDe(detalle)} onCerrar={() => setModalAbierto(false)} onRegistrado={alRegistrar} />}
    </div>
  )
}
