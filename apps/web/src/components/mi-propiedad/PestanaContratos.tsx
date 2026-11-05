'use client'

/**
 * PestanaContratos.tsx — la pestaña Contratos de `/panel/propiedades/[id]`.
 *
 * Cubre: US-43 Consultar contratos locador:
 * - "Contrato actual": código, estado, locatario, vigencia, alquiler actual y
 *   próximo ajuste con su índice; firmas; PDF salvo en los borradores; y los
 *   accesos según el estado.
 * - "Sin contrato actual": el mensaje, con "Iniciar contrato" o el acceso a
 *   las solicitudes de la propiedad.
 * - "Contratos anteriores": plegados, con su cantidad y "Ver contrato".
 * - "En la pestaña nunca se muestran el DNI ni los datos de contacto".
 * - "El error se debe mostrar dentro de la pestaña con la opción de
 *   reintentar": el encabezado y Resumen siguen funcionando.
 *
 * Qué muestra (Claude Design, "Detalle de propiedad del locador" · 02, 02b y
 * 02c): la tarjeta del actual, destacada salvo en borrador, y los anteriores
 * atenuados en un `DataTable`.
 * NOTA (diseño vs. US, gana la US): el diseño deja los anteriores desplegados,
 * dice "Ver contrato" o "Ver firmas" en el actual, no ofrece acción sin
 * solicitud aceptada y muestra rescindidos. Acá van plegados, con "Ver
 * contrato completo", con el acceso a las solicitudes, y sin rescindidos.
 *
 * De dónde saca los datos: `contratos.service#listarContratosDePropiedad`.
 * Quién lo usa: `components/mi-propiedad/MiPropiedad.tsx`.
 */
import { useCallback, useState, type ReactNode } from 'react'
import { Alert, Button, Collapse, Skeleton } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ContratoDePropiedad } from '@rentar/shared-types'
import { ConfirmActionModal, DataTable, EmptyState, IndexBadge, MoneyAmount, StatusTag, type DataTableColumn } from '@rentar/ui'
import { fechaCorta } from '@/lib/contratos/fechas'
import { fechaYHora, NOMBRE_ROL } from '@/lib/contratos/firmas'
import { subtituloContratosDePropiedad, vigenciaDeContrato } from '@/lib/contratos/propiedad'
import { contratoHref, editarContratoHref, iniciarContratoHref, solicitudesDePropiedadHref } from '@/lib/contratos/rutas'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { eliminarBorrador, listarContratosDePropiedad, urlPdfDeContrato } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import { BotonPdf } from '@/components/contratos/BotonPdf'
import styles from './PestanaContratos.module.css'

/** Props de {@link PestanaContratos}. */
interface PestanaContratosProps {
  propiedadId: string
}

/** Iniciales para el avatar del locatario. */
function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}

/** Un dato de la tarjeta: etiqueta arriba, valor abajo. */
function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.dato}>
      <span className={styles.datoLabel}>{label}</span>
      <span className={styles.datoValor}>{children}</span>
    </div>
  )
}

/**
 * US-43: "el próximo ajuste con su índice"; "Sin ajuste" en lugar de la fecha.
 * "—" si el borrador todavía no lo tiene.
 */
function ProximoAjuste({ contrato }: { contrato: ContratoDePropiedad }) {
  if (contrato.adjustmentIndex === 'sin_ajuste') return <>Sin ajuste</>
  if (!contrato.nextAdjustmentDate || !contrato.adjustmentIndex) return <>—</>
  return (
    <span className={styles.ajuste}>
      {fechaCorta(contrato.nextAdjustmentDate)} <IndexBadge index={contrato.adjustmentIndex} />
    </span>
  )
}

/** US-43: "se debe indicar quién firmó (con fecha y hora) y quién falta firmar"; vigente: "Firmado el dd/mm/aaaa". */
function FirmasDelContrato({ contrato }: { contrato: ContratoDePropiedad }) {
  if (contrato.status === 'vigente') {
    if (!contrato.firmadoPorTodasEl) return null
    return (
      <p className={styles.firmado} data-testid="propiedad-contrato-firmado">
        Firmado el {fechaCorta(contrato.firmadoPorTodasEl)}
      </p>
    )
  }
  if (contrato.status !== 'pendiente_firma') return null
  if (!contrato.firmasRegistradas) {
    return (
      <p className={styles.secundario} data-testid="propiedad-contrato-sin-firmas">
        Todavía no hay registro del estado de cada firma.
      </p>
    )
  }
  return (
    <ul className={styles.firmas} data-testid="propiedad-contrato-firmas">
      {contrato.firmantes.map((firmante) => (
        <li key={firmante.rol} className={styles.firma}>
          <span>
            <strong>{firmante.nombre || NOMBRE_ROL[firmante.rol]}</strong> · {NOMBRE_ROL[firmante.rol]}
          </span>
          <span className={styles.secundario}>
            {firmante.estado === 'firmado' && firmante.firmadoEl
              ? `firmó el ${fechaYHora(firmante.firmadoEl)}`
              : firmante.estado === 'rechazado'
                ? 'rechazó la firma'
                : 'falta firmar'}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** US-43: 'Cada contrato anterior tiene el acceso "Ver contrato"'. */
function VerAnterior({ contrato }: { contrato: ContratoDePropiedad }) {
  return (
    <Link href={contratoHref(contrato.id)} className={styles.verContrato} data-testid="propiedad-contrato-anterior-ver">
      Ver contrato
    </Link>
  )
}

/** Columnas de los contratos anteriores (diseño, §02). Sin DNI ni contacto (US-43). */
const COLUMNAS_ANTERIORES: DataTableColumn<ContratoDePropiedad>[] = [
  { key: 'codigo', title: 'Código', render: (contrato) => contrato.code ?? '—' },
  { key: 'locatario', title: 'Locatario', render: (contrato) => contrato.tenantName || 'Sin dato' },
  { key: 'estado', title: 'Estado', render: (contrato) => <StatusTag domain="contrato" status={contrato.status} /> },
  { key: 'vigencia', title: 'Vigencia', render: vigenciaDeContrato },
  {
    key: 'acciones',
    title: '',
    hideInCard: true,
    render: (contrato) => <VerAnterior contrato={contrato} />,
  },
]

/** La pestaña Contratos de una propiedad del locador en sesión. */
export function PestanaContratos({ propiedadId }: PestanaContratosProps) {
  const router = useRouter()
  const pedir = useCallback(() => listarContratosDePropiedad(propiedadId), [propiedadId])
  const carga = useServiceCall(pedir)

  // ─── Estado local ───────────────────────────────────────────────────
  const [confirmarEliminar, setConfirmarEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  // ─── Carga y error ──────────────────────────────────────────────────
  if (carga.status === 'cargando') {
    return (
      <div className={styles.pestania} data-testid="propiedad-contratos-cargando">
        <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 3 }} />
      </div>
    )
  }
  if (carga.status === 'error') {
    return (
      <div className={styles.error} role="alert" data-testid="propiedad-contratos-error">
        <span className={styles.errorTitulo}>{carga.code === 'not_found' ? carga.message : 'No pudimos traer los contratos'}</span>
        {carga.code !== 'not_found' && (
          <>
            <span className={styles.secundario}>{carga.message}</span>
            <Button type="primary" onClick={carga.reintentar} data-testid="propiedad-contratos-reintentar">
              Reintentar
            </Button>
          </>
        )}
      </div>
    )
  }

  const contratos = carga.data
  const { actual, anteriores, solicitudParaContrato } = contratos
  const subtitulo = subtituloContratosDePropiedad(contratos)

  // ─── Handlers ───────────────────────────────────────────────────────
  /** US-43: "'Eliminar', que descarta el borrador previa confirmación (US-06)". */
  async function eliminar(): Promise<void> {
    if (!actual) return
    setEliminando(true)
    setErrorAccion(null)
    try {
      await eliminarBorrador(actual.id)
      setConfirmarEliminar(false)
      setAviso('Eliminaste el borrador.')
      carga.reintentar()
    } catch (error) {
      setErrorAccion(error instanceof ServiceError ? error.message : 'No pudimos eliminar el borrador. Probá de nuevo.')
      setConfirmarEliminar(false)
    } finally {
      setEliminando(false)
    }
  }

  // ─── Render: PDF ────────────────────────────────────────────────────
  /** US-43: "Se debe poder descargar el contrato en PDF, salvo que sea un borrador." */
  function botonPdf(contrato: ContratoDePropiedad) {
    if (contrato.status === 'borrador') return null
    if (contrato.tienePdf) {
      return (
        <BotonPdf obtenerUrl={() => urlPdfDeContrato(contrato.id, 'locador')} icon={<DownloadOutlined />} data-testid="propiedad-contrato-pdf">
          Descargar PDF
        </BotonPdf>
      )
    }
    return (
      <span className={styles.pdfNoDisponible}>
        <Button icon={<DownloadOutlined />} disabled data-testid="propiedad-contrato-pdf">
          Descargar PDF
        </Button>
        <span className={styles.secundario}>El PDF todavía no está disponible</span>
      </span>
    )
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.pestania} data-testid="propiedad-contratos">
      <header className={styles.encabezado}>
        <h2 className={styles.titulo}>Contratos de esta propiedad</h2>
        {subtitulo && <span className={styles.secundario}>{subtitulo}</span>}
      </header>

      {aviso && <Alert type="success" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setAviso(null)} title={aviso} data-testid="propiedad-contratos-aviso" />}
      {errorAccion && <Alert type="error" showIcon closable={{ 'aria-label': 'Cerrar el error' }} onClose={() => setErrorAccion(null)} title={errorAccion} data-testid="propiedad-contratos-error-accion" />}

      {actual ? (
        <article className={actual.status === 'borrador' ? styles.actual : `${styles.actual} ${styles.actualDestacado}`} data-testid="propiedad-contrato-actual" data-estado={actual.status}>
          <div className={styles.actualFila}>
            <div className={styles.actualCodigo}>
              <span className={styles.eyebrow}>Contrato actual</span>
              <span className={styles.codigo}>{actual.code ?? 'Borrador sin código'}</span>
            </div>
            <div className={styles.locatario}>
              {actual.tenantName && (
                <span className={styles.avatar} aria-hidden>
                  {iniciales(actual.tenantName)}
                </span>
              )}
              <span className={styles.locatarioDatos}>
                <strong>{actual.tenantName || '—'}</strong>
                <span className={styles.secundario}>Locatario</span>
              </span>
            </div>
            <StatusTag domain="contrato" status={actual.status} />
          </div>

          <div className={styles.datos}>
            <Dato label="Vigencia">{vigenciaDeContrato(actual)}</Dato>
            <Dato label="Alquiler actual">{actual.currentAmount === null ? '—' : <MoneyAmount amount={actual.currentAmount} emphasis />}</Dato>
            <Dato label="Próximo ajuste">
              <ProximoAjuste contrato={actual} />
            </Dato>
          </div>

          <FirmasDelContrato contrato={actual} />

          <div className={styles.acciones}>
            {actual.status === 'borrador' ? (
              <>
                <Button type="primary" onClick={() => router.push(editarContratoHref(actual.id))} data-testid="propiedad-contrato-continuar">
                  Continuar
                </Button>
                <Button danger onClick={() => setConfirmarEliminar(true)} data-testid="propiedad-contrato-eliminar">
                  Eliminar
                </Button>
              </>
            ) : (
              <>
                <Button type="primary" onClick={() => router.push(contratoHref(actual.id))} data-testid="propiedad-contrato-ver">
                  Ver contrato completo
                </Button>
                {botonPdf(actual)}
              </>
            )}
          </div>
        </article>
      ) : (
        <div className={styles.vacio} data-testid="propiedad-sin-contrato">
          <EmptyState
            title="Esta propiedad todavía no tiene contrato"
            description={solicitudParaContrato ? 'Ya aceptaste una solicitud: podés iniciar el contrato.' : 'El contrato nace de una solicitud aceptada.'}
            action={
              solicitudParaContrato ? (
                <Button type="primary" onClick={() => router.push(iniciarContratoHref(solicitudParaContrato, propiedadId))} data-testid="propiedad-contrato-iniciar">
                  Iniciar contrato
                </Button>
              ) : (
                <Button onClick={() => router.push(solicitudesDePropiedadHref(propiedadId))} data-testid="propiedad-ver-solicitudes">
                  Ver solicitudes de esta propiedad
                </Button>
              )
            }
          />
        </div>
      )}

      {/* US-43: "Si la propiedad no tuvo contratos anteriores, no se muestra la sección." */}
      {anteriores.length > 0 && (
        <Collapse
          className={styles.anteriores}
          data-testid="propiedad-contratos-anteriores"
          items={[
            {
              key: 'anteriores',
              label: <span data-testid="propiedad-contratos-anteriores-toggle">Contratos anteriores · {anteriores.length}</span>,
              extra: <span className={styles.secundario}>Solo lectura</span>,
              children: <DataTable<ContratoDePropiedad> columns={COLUMNAS_ANTERIORES} data={anteriores} rowKey={(contrato) => contrato.id} cardHeader={(contrato) => contrato.code ?? '—'} cardActions={(contrato) => <VerAnterior contrato={contrato} />} />,
            },
          ]}
        />
      )}

      <ConfirmActionModal
        open={confirmarEliminar}
        title="¿Eliminar el borrador?"
        description="Se descarta el borrador y la propiedad queda sin contrato actual. Esta acción no se puede deshacer."
        confirmLabel="Eliminar borrador"
        cancelLabel="Volver"
        danger
        confirmLoading={eliminando}
        onConfirm={() => void eliminar()}
        onCancel={() => setConfirmarEliminar(false)}
        data-testid="propiedad-contrato-eliminar-modal"
      />
    </div>
  )
}
