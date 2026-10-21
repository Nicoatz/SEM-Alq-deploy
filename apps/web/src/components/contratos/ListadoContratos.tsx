'use client'

/**
 * ListadoContratos.tsx — `/panel/contratos`, los contratos del locador.
 *
 * Cubre: US-05 Registrar contrato de alquiler, "Listado de contratos":
 * - columnas propiedad, código, locatario, estado, monto actual, vigencia y
 *   próximo ajuste;
 * - filtro por estado con contador (todos, borradores, pendientes de firma,
 *   vigentes y finalizados) y búsqueda por dirección o locatario;
 * - orden por defecto: pendientes de firma primero, el resto por fecha de fin;
 * - sin contratos: mensaje con acceso a las solicitudes aceptadas;
 * - borradores con "Continuar" y "Eliminar" (con confirmación).
 * Pendientes, vigentes y finalizados linkean a su detalle
 * (`/panel/contratos/[id]`, US-07, tanda 3): el código y "Ver contrato".
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 01): PageHeader con
 * "Ver solicitudes aceptadas" y "Nuevo contrato", pestañas con contador,
 * buscador y DataTable (tarjetas en móvil).
 * NOTA (diseño vs. US): el diseño tiene "Por vencer" y no "Borradores";
 * mandan las pestañas de la US.
 *
 * De dónde saca los datos: `contratos.service#listarContratos`.
 * Quién lo usa: `app/(app)/panel/contratos/page.tsx`.
 */
import { useMemo, useState } from 'react'
import { Alert, Button, Input, Skeleton } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ContratoResumen } from '@rentar/shared-types'
import { ConfirmActionModal, DataTable, EmptyState, IndexBadge, MoneyAmount, PageHeader, StatusTag, type DataTableColumn } from '@rentar/ui'
import { fechaCorta } from '@/lib/contratos/fechas'
import { coincideBusqueda, contarPorPestania, estaEnPestania, ordenarContratos, PESTANIAS_CONTRATOS, subtituloContratos, type PestaniaContratos } from '@/lib/contratos/listado'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { eliminarBorrador, listarContratos } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import { PestaniasSolicitudes } from '@/components/solicitudes/PestaniasSolicitudes'
import styles from './Contratos.module.css'

/** Detalle de un contrato (US-07). */
function detalleHref(contrato: Pick<ContratoResumen, 'id'>): string {
  return `/panel/contratos/${encodeURIComponent(contrato.id)}`
}

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Contratos' }]

/** A dónde lleva "Ver solicitudes aceptadas". */
export const SOLICITUDES_ACEPTADAS_HREF = '/panel/solicitudes?pestania=aceptadas'

/** "Pendientes de firma" → "pendientes de firma", para el vacío de una pestaña. */
const NOMBRE_PESTANIA: Record<PestaniaContratos, string> = {
  todos: '',
  borradores: 'en borrador',
  pendientes: 'pendientes de firma',
  vigentes: 'vigentes',
  finalizados: 'finalizados',
}

/** Vigencia "01/10/2026 → 30/09/2029", o "—" si falta una fecha (un borrador incompleto). */
function vigencia(contrato: ContratoResumen): string {
  return contrato.startDate && contrato.endDate ? `${fechaCorta(contrato.startDate)} → ${fechaCorta(contrato.endDate)}` : '—'
}

/** Filas de skeleton mientras carga. */
function FilasCargando() {
  return (
    <div className={styles.skeletonList} data-testid="contratos-cargando">
      {[0, 1, 2].map((fila) => (
        <Skeleton key={fila} active title={{ width: '40%' }} paragraph={{ rows: 1, width: '80%' }} />
      ))}
    </div>
  )
}

/** Listado de contratos del locador. */
export function ListadoContratos() {
  const router = useRouter()
  const carga = useServiceCall(listarContratos)

  // ─── Estado local ───────────────────────────────────────────────────
  const [pestania, setPestania] = useState<PestaniaContratos>('todos')
  const [busqueda, setBusqueda] = useState('')
  /** Ids de los borradores eliminados en esta visita (se sacan de la lista sin recargar). */
  const [eliminados, setEliminados] = useState<ReadonlySet<string>>(() => new Set())
  const [aEliminar, setAEliminar] = useState<ContratoResumen | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const [avisoEliminado, setAvisoEliminado] = useState<string | null>(null)

  const todos = useMemo(() => (carga.status === 'listo' ? carga.data.filter((item) => !eliminados.has(item.id)) : []), [carga, eliminados])
  const contadores = useMemo(() => contarPorPestania(todos), [todos])
  const visibles = useMemo(
    () => ordenarContratos(todos.filter((item) => estaEnPestania(item, pestania) && coincideBusqueda(item, busqueda))),
    [todos, pestania, busqueda],
  )

  // ─── Handlers ───────────────────────────────────────────────────────
  async function confirmarEliminar(): Promise<void> {
    if (!aEliminar) return
    setEliminando(true)
    setErrorEliminar(null)
    try {
      await eliminarBorrador(aEliminar.id)
      setEliminados((actual) => new Set(actual).add(aEliminar.id))
      setAvisoEliminado(`Eliminaste el borrador de ${aEliminar.propertyAddress}.`)
      setAEliminar(null)
    } catch (error) {
      setErrorEliminar(error instanceof ServiceError ? error.message : 'No pudimos eliminar el borrador. Probá de nuevo.')
    } finally {
      setEliminando(false)
    }
  }

  // ─── Columnas ───────────────────────────────────────────────────────
  const columnas: DataTableColumn<ContratoResumen>[] = [
    {
      key: 'propiedad',
      title: 'Propiedad',
      hideInCard: true,
      render: (contrato) => (
        <span className={styles.propiedad}>
          <span className={styles.direccion}>{contrato.propertyAddress}</span>
          {contrato.status === 'borrador' ? (
            <span className={styles.codigo} data-testid="contratos-fila-codigo">
              {contrato.code ?? 'Borrador sin código'}
            </span>
          ) : (
            <Link href={detalleHref(contrato)} className={styles.codigoLink} data-testid="contratos-fila-codigo">
              {contrato.code}
            </Link>
          )}
        </span>
      ),
    },
    { key: 'locatario', title: 'Locatario', render: (contrato) => contrato.tenantName || '—' },
    { key: 'estado', title: 'Estado', render: (contrato) => <StatusTag domain="contrato" status={contrato.status} /> },
    {
      key: 'monto',
      title: 'Alquiler actual',
      render: (contrato) => (contrato.currentAmount === null ? '—' : <MoneyAmount amount={contrato.currentAmount} />),
    },
    { key: 'vigencia', title: 'Vigencia', render: vigencia },
    {
      key: 'ajuste',
      title: 'Próximo ajuste',
      render: (contrato) =>
        contrato.adjustmentIndex === 'sin_ajuste' ? (
          <IndexBadge index="sin_ajuste" />
        ) : contrato.adjustmentIndex && contrato.nextAdjustmentDate ? (
          <span className={styles.ajuste}>
            <IndexBadge index={contrato.adjustmentIndex} />
            {fechaCorta(contrato.nextAdjustmentDate)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'acciones',
      title: '',
      hideInCard: true,
      // Borradores: continuar o eliminar. El resto: su detalle (US-07).
      render: (contrato) =>
        contrato.status !== 'borrador' ? (
          <Button size="small" onClick={() => router.push(detalleHref(contrato))} data-testid="contratos-ver">
            Ver contrato
          </Button>
        ) : (
          <span className={styles.acciones}>
            <Button size="small" type="primary" onClick={() => router.push(`/panel/contratos/${encodeURIComponent(contrato.id)}/editar`)} data-testid="contratos-continuar">
              Continuar
            </Button>
            <Button size="small" danger onClick={() => setAEliminar(contrato)} data-testid="contratos-eliminar">
              Eliminar
            </Button>
          </span>
        ),
    },
  ]

  const acciones = (
    <div className={styles.headerActions}>
      <Button onClick={() => router.push(SOLICITUDES_ACEPTADAS_HREF)} data-testid="contratos-ver-solicitudes">
        Ver solicitudes aceptadas
      </Button>
      <Button type="primary" onClick={() => router.push('/panel/contratos/nuevo')} data-testid="contratos-nuevo">
        Nuevo contrato
      </Button>
    </div>
  )

  // ─── Error ──────────────────────────────────────────────────────────
  if (carga.status === 'error') {
    return (
      <div className={styles.page}>
        <PageHeader title="Contratos" breadcrumb={MIGA} actions={acciones} />
        <div className={styles.errorBlock} role="alert" data-testid="contratos-error">
          <span className={styles.errorTitle}>No pudimos traer tus contratos</span>
          <span className={styles.errorText}>{carga.message}</span>
          <Button type="primary" onClick={carga.reintentar} data-testid="contratos-reintentar">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const cargando = carga.status === 'cargando'

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page} data-testid="contratos">
      <PageHeader title="Contratos" subtitle={cargando ? undefined : subtituloContratos(contadores) || undefined} breadcrumb={MIGA} actions={acciones} />

      {avisoEliminado && (
        <Alert type="success" showIcon closable={{ 'aria-label': 'Cerrar el aviso' }} onClose={() => setAvisoEliminado(null)} title={avisoEliminado} data-testid="contratos-eliminado" />
      )}

      {/* Vacío (US-05): "Si el locador no tiene contratos, se debe mostrar un mensaje con acceso a las solicitudes aceptadas." */}
      {!cargando && todos.length === 0 ? (
        <div className={styles.emptyBlock} data-testid="contratos-vacio">
          <EmptyState
            title="Todavía no tenés contratos"
            description="Los contratos nacen de una solicitud aceptada: aceptá a un postulante y tocá Iniciar contrato."
            action={
              <Button type="primary" onClick={() => router.push(SOLICITUDES_ACEPTADAS_HREF)} data-testid="contratos-vacio-solicitudes">
                Ver solicitudes aceptadas
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className={styles.filtros}>
            <PestaniasSolicitudes
              opciones={PESTANIAS_CONTRATOS}
              value={pestania}
              onChange={setPestania}
              contadores={cargando ? null : contadores}
              testIdPrefix="contratos"
              ariaLabel="Estado del contrato"
            />
            <Input
              className={styles.buscar}
              prefix={<SearchOutlined aria-hidden />}
              placeholder="Buscar por dirección o locatario"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              allowClear
              aria-label="Buscar por dirección o locatario"
              data-testid="contratos-buscar"
            />
          </div>

          {cargando ? (
            <FilasCargando />
          ) : visibles.length === 0 ? (
            <div className={styles.emptyBlock} data-testid="contratos-sin-resultados">
              <EmptyState
                title={busqueda.trim() ? 'No hay contratos que coincidan con la búsqueda' : `No tenés contratos ${NOMBRE_PESTANIA[pestania]}`}
                description={busqueda.trim() ? 'Probá con otra dirección o con el nombre del locatario.' : 'Probá con otra pestaña.'}
              />
            </div>
          ) : (
            <DataTable<ContratoResumen>
              columns={columnas}
              data={visibles}
              rowKey={(contrato) => contrato.id}
              cardHeader={(contrato) => (
                <span className={styles.propiedad}>
                  <span className={styles.direccion}>{contrato.propertyAddress}</span>
                  <span className={styles.codigo}>{contrato.code ?? 'Borrador sin código'}</span>
                </span>
              )}
              cardActions={(contrato) =>
                contrato.status !== 'borrador' ? (
                  <Button onClick={() => router.push(detalleHref(contrato))} data-testid="contratos-ver-movil">
                    Ver contrato
                  </Button>
                ) : (
                  <span className={styles.acciones}>
                    <Button type="primary" onClick={() => router.push(`/panel/contratos/${encodeURIComponent(contrato.id)}/editar`)} data-testid="contratos-continuar-movil">
                      Continuar
                    </Button>
                    <Button danger onClick={() => setAEliminar(contrato)} data-testid="contratos-eliminar-movil">
                      Eliminar
                    </Button>
                  </span>
                )
              }
              data-testid="contratos-tabla"
            />
          )}
        </>
      )}

      {/* US-05: "Se puede eliminar un borrador, previa confirmación." */}
      <ConfirmActionModal
        open={aEliminar !== null}
        title="¿Eliminar este borrador?"
        description={aEliminar ? `Se borra el contrato en borrador de ${aEliminar.propertyAddress} con ${aEliminar.tenantName}. La solicitud aceptada queda como está y podés iniciar otro contrato.` : undefined}
        confirmLabel="Eliminar borrador"
        cancelLabel="Cancelar"
        danger
        confirmLoading={eliminando}
        onConfirm={() => void confirmarEliminar()}
        onCancel={() => {
          setAEliminar(null)
          setErrorEliminar(null)
        }}
        data-testid="contratos-eliminar-modal"
      >
        {errorEliminar && <Alert type="error" showIcon title={errorEliminar} data-testid="contratos-eliminar-error" />}
      </ConfirmActionModal>
    </div>
  )
}
