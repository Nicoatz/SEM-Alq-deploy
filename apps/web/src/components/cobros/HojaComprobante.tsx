'use client'

/**
 * HojaComprobante.tsx — `/panel/cobros/[id]/comprobante`, el comprobante de pago.
 *
 * Cubre: US-10 Emitir comprobante de pago:
 * - Encabezado, las dos partes, propiedad y período, detalle línea por línea, total
 *   en números y en letras, medio y fecha del pago, y la leyenda.
 * - "Se imprime solo la hoja, sin el menú, los filtros ni los botones, en una hoja
 *   A4." Ver el bloque `@media print` de `globals.css`.
 * - "En móvil, el comprobante se muestra como una tarjeta": la misma hoja, en una
 *   columna y sin scroll horizontal.
 * - "No encontramos este comprobante" si no existe o es ajeno.
 *
 * NOTA (decisión del PO, 05/11): la hoja arma el total en letras en el front, en
 * mock y en real. El PDF descargable en real es el del back; en mock, "Descargar"
 * abre la impresión. No se manda por mail ni se anula, aunque esté dibujado.
 *
 * De dónde saca los datos: `cobros.service#getComprobanteDePeriodo`.
 * Quién lo usa: `app/(app)/panel/cobros/[id]/comprobante/page.tsx`.
 */
import { useCallback, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { DownloadOutlined, PrinterOutlined } from '@ant-design/icons'
import Image from 'next/image'
import Link from 'next/link'
import type { Comprobante, ParteComprobante } from '@rentar/shared-types'
import { EmptyState, formatDate, formatPeriod, PageHeader } from '@rentar/ui'
import { LOGO } from '@rentar/ui/src/assets/logo'
import { ETIQUETA_MEDIO } from '@/lib/cobros/medios'
import { montoEnLetras } from '@/lib/cobros/montoEnLetras'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { descargarComprobantePdf, getComprobanteDePeriodo, PDF_COMPROBANTE_DISPONIBLE } from '@/services/cobros.service'
import { ServiceError } from '@/services/shared/errors'
import styles from './HojaComprobante.module.css'

/** Props de {@link HojaComprobante}. */
interface HojaComprobanteProps {
  periodoId: string
}

/** Con centavos: un comprobante muestra el importe exacto. */
const importe = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })

/** Bloque de una de las partes. Un dato que falta se ve "Sin dato". */
function Parte({ titulo, parte, testId }: { titulo: string; parte: ParteComprobante; testId: string }) {
  return (
    <div className={styles.parte} data-testid={testId}>
      <span className={styles.rotulo}>{titulo}</span>
      <strong>{parte.nombre || 'Sin dato'}</strong>
      <span>DNI {parte.documento ?? 'Sin dato'}</span>
      <span>{parte.email ?? 'Sin dato'}</span>
      <span>{parte.telefono ?? 'Sin dato'}</span>
    </div>
  )
}

/** La hoja. Es lo único que se imprime. */
function Hoja({ comprobante }: { comprobante: Comprobante }) {
  const mes = formatPeriod(`${comprobante.periodo}-01`)
  return (
    <article className={styles.hoja} data-comprobante-hoja data-testid="comprobante-hoja">
      <header className={styles.encabezado}>
        <div>
          <Image src={LOGO.src} width={LOGO.width} height={LOGO.height} alt="RentAR" className={styles.logo} unoptimized />
          <span className={styles.rotulo}>Plataforma de alquileres · Córdoba, Argentina</span>
        </div>
        <div className={styles.numero}>
          <span className={styles.rotulo}>Comprobante de pago de alquiler</span>
          <strong data-testid="comprobante-numero">{comprobante.numero}</strong>
          <span>Emitido el {formatDate(comprobante.emitidoEl, 'DD/MM/YYYY [a las] HH:mm')}</span>
          <span className={styles.pagado}>Pagado</span>
        </div>
      </header>

      <div className={styles.partes}>
        <Parte titulo="Locatario" parte={comprobante.locatario} testId="comprobante-locatario" />
        <Parte titulo="Locador" parte={comprobante.locador} testId="comprobante-locador" />
      </div>

      <div className={styles.datos}>
        <div>
          <span className={styles.rotulo}>Propiedad</span>
          <span data-testid="comprobante-domicilio">{comprobante.domicilio}</span>
        </div>
        <div>
          <span className={styles.rotulo}>Contrato</span>
          <span>{comprobante.contratoCodigo ?? 'Sin dato'}</span>
          {comprobante.contratoInicio && comprobante.contratoFin && (
            <span>
              {formatDate(comprobante.contratoInicio)} al {formatDate(comprobante.contratoFin)}
            </span>
          )}
        </div>
        <div>
          <span className={styles.rotulo}>Período imputado</span>
          <span data-testid="comprobante-periodo">{mes}</span>
          <span>
            {formatDate(comprobante.periodoInicio)} al {formatDate(comprobante.periodoFin)} · vencía el {formatDate(comprobante.vencimiento)}
          </span>
        </div>
      </div>

      <table className={styles.tabla}>
        <thead>
          <tr>
            <th scope="col">Concepto</th>
            <th scope="col">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Alquiler {mes}</td>
            <td>{importe.format(comprobante.alquiler)}</td>
          </tr>
          <tr data-testid="comprobante-mora">
            <td>Intereses por mora{comprobante.diasMora > 0 ? ` · ${comprobante.diasMora === 1 ? '1 día' : `${comprobante.diasMora} días`}` : ''}</td>
            <td>{importe.format(comprobante.mora)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total pagado</th>
            <td data-testid="comprobante-total">{importe.format(comprobante.total)}</td>
          </tr>
        </tfoot>
      </table>
      <p className={styles.letras} data-testid="comprobante-letras">
        {montoEnLetras(comprobante.total)}.
      </p>

      <div className={styles.datos}>
        <div>
          <span className={styles.rotulo}>Medio de pago</span>
          <span data-testid="comprobante-medio">{ETIQUETA_MEDIO[comprobante.medio]}</span>
        </div>
        <div>
          <span className={styles.rotulo}>Fecha del pago</span>
          <span data-testid="comprobante-fecha-pago">{formatDate(comprobante.fechaPago)}</span>
        </div>
      </div>

      <p className={styles.leyenda} data-testid="comprobante-leyenda">
        Comprobante emitido por la plataforma RentAR. No válido como factura.
      </p>
    </article>
  )
}

/** Baja un archivo con su nombre. */
function guardarArchivo(archivo: Blob, nombre: string): void {
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  URL.revokeObjectURL(url)
}

/** El comprobante con sus acciones. */
export function HojaComprobante({ periodoId }: HojaComprobanteProps) {
  const pedir = useCallback(() => getComprobanteDePeriodo(periodoId), [periodoId])
  const carga = useServiceCall(pedir)

  // ─── Estado local ───
  const [descargando, setDescargando] = useState(false)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  // ─── Render ───
  if (carga.status === 'cargando') {
    return (
      <div data-testid="comprobante-cargando">
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    )
  }

  if (carga.status === 'error' && carga.code === 'not_found') {
    return (
      <EmptyState
        title="No encontramos este comprobante"
        action={<Link href="/panel">Volver a mi panel</Link>}
        data-testid="comprobante-no-encontrado"
      />
    )
  }

  if (carga.status === 'error') {
    return (
      <div className={styles.errorBlock} role="alert" data-testid="comprobante-error">
        <span className={styles.errorTitle}>No pudimos traer el comprobante</span>
        <span className={styles.errorText}>{carga.message}</span>
        <Button type="primary" onClick={carga.reintentar} data-testid="comprobante-reintentar">
          Reintentar
        </Button>
      </div>
    )
  }

  const comprobante = carga.data

  /** En real baja el PDF del back; en mock abre la impresión. */
  async function descargar(): Promise<void> {
    if (!PDF_COMPROBANTE_DISPONIBLE) {
      window.print()
      return
    }
    setDescargando(true)
    setErrorDescarga(null)
    try {
      guardarArchivo(await descargarComprobantePdf(comprobante.cobroId), `${comprobante.numero}.pdf`)
    } catch (error) {
      setErrorDescarga(error instanceof ServiceError ? error.message : 'No pudimos descargar el PDF. Probá de nuevo.')
    } finally {
      setDescargando(false)
    }
  }

  const acciones = (
    <div className={styles.acciones}>
      <Button icon={<PrinterOutlined />} onClick={() => window.print()} data-testid="comprobante-imprimir">
        Imprimir
      </Button>
      <Button type="primary" icon={<DownloadOutlined />} loading={descargando} onClick={() => void descargar()} data-testid="comprobante-descargar">
        Descargar PDF
      </Button>
    </div>
  )

  return (
    <div className={styles.page} data-testid="comprobante">
      <PageHeader
        title={comprobante.numero}
        breadcrumb={[
          { label: 'Período', href: `/panel/cobros/${encodeURIComponent(periodoId)}` },
          { label: 'Comprobante' },
        ]}
        actions={acciones}
      />
      {errorDescarga && <Alert type="error" showIcon title={errorDescarga} data-testid="comprobante-descargar-error" />}
      <Hoja comprobante={comprobante} />
    </div>
  )
}
