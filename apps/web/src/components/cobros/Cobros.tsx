'use client'

/**
 * Cobros.tsx — `/panel/cobros`, los períodos del locador.
 *
 * Cubre: US-09 Consultar cobro, "Cobros del locador":
 * - "Se deben mostrar indicadores del mes elegido: cobrado y vencido."
 * - Una fila por período con propiedad, locatario, período, monto, estado y
 *   "Ver detalle". Sin DNI ni contacto.
 * - Filtros por propiedad, mes y estado, guardados en la URL.
 * - "Si el locador no tiene contratos vigentes, se debe mostrar un mensaje con
 *   acceso a Contratos." El acceso lleva a Propiedades: los contratos se ven
 *   desde cada propiedad. Si hay contratos vigentes pero todos sus períodos son
 *   futuros (un contrato recién firmado que arranca el mes que viene), el
 *   mensaje dice cuándo empieza el primero.
 * El botón general abre el registro de un cobro (US-08). La fila solo lleva al
 * detalle: gana la US sobre el diseño.
 * NOTA: no se implementa aunque esté dibujado: gastos informados, pago informado
 * y anular (decisión del PO, 05/11).
 *
 * De dónde saca los datos: `cobros.service#listarCobrosLocador`.
 * Quién lo usa: `app/(app)/panel/cobros/page.tsx`.
 */
import { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Select, Skeleton } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { CobroCreado, FiltroEstadoCobro, FiltrosCobros, ListadoCobros, PeriodoFila } from '@rentar/shared-types'
import { DataTable, EmptyState, formatARS, formatDate, formatPeriod, MoneyAmount, PageHeader, StatCard, StatusTag, type DataTableColumn } from '@rentar/ui'
import { PestaniasSolicitudes } from '@/components/solicitudes/PestaniasSolicitudes'
import { FILTROS_PREDETERMINADOS, filtrosDeUrl, hayFiltros, urlDeFiltros } from '@/lib/cobros/filtrosUrl'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { listarCobrosLocador } from '@/services/cobros.service'
import { RegistrarCobroModal } from './RegistrarCobroModal'
import styles from './Cobros.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Cobros' }]

const PESTANIAS: readonly { value: FiltroEstadoCobro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'vencido', label: 'Vencidos' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'pagado', label: 'Pagados' },
]

/** Ruta del detalle de un período. */
function detalleHref(fila: Pick<PeriodoFila, 'id'>): string {
  return `/panel/cobros/${encodeURIComponent(fila.id)}`
}

/** "Septiembre 2026" a partir de `AAAA-MM`. */
function nombreDeMes(mes: string): string {
  return formatPeriod(`${mes}-01`)
}

/** Filtros, indicadores y listado de los cobros del locador. */
export function Cobros() {
  const router = useRouter()
  const parametros = useSearchParams()
  const filtros = useMemo(() => filtrosDeUrl(parametros), [parametros])

  // ─── Estado local ───
  const [modalAbierto, setModalAbierto] = useState(false)
  const [registrado, setRegistrado] = useState<CobroCreado | null>(null)
  // El último listado sigue en pantalla mientras cargan los filtros nuevos.
  const [ultimo, setUltimo] = useState<ListadoCobros | null>(null)

  const pedir = useCallback(async () => {
    const respuesta = await listarCobrosLocador(filtros)
    setUltimo(respuesta)
    return respuesta
  }, [filtros])
  const carga = useServiceCall(pedir)
  const listado = carga.status === 'listo' ? carga.data : ultimo

  // ─── Handlers ───
  /** Escribe los filtros en la URL (US-09: se pueden copiar y compartir). */
  function cambiarFiltros(cambios: Partial<FiltrosCobros>): void {
    const query = urlDeFiltros({ ...filtros, ...cambios })
    router.replace(query ? `/panel/cobros?${query}` : '/panel/cobros', { scroll: false })
  }

  /** Cierra el modal y refresca el listado. */
  function alRegistrar(creado: CobroCreado): void {
    setModalAbierto(false)
    setRegistrado(creado)
    carga.reintentar()
  }

  // ─── Render ───
  const columnas: DataTableColumn<PeriodoFila>[] = [
    {
      key: 'propiedad',
      title: 'Propiedad',
      hideInCard: true,
      render: (fila) => <span className={styles.direccion}>{fila.propiedad}</span>,
    },
    { key: 'locatario', title: 'Locatario', render: (fila) => fila.locatario ?? 'Sin dato' },
    { key: 'periodo', title: 'Período', render: (fila) => nombreDeMes(fila.periodo) },
    { key: 'monto', title: 'Monto', render: (fila) => <MoneyAmount amount={fila.monto} size="sm" /> },
    {
      key: 'estado',
      title: 'Estado',
      render: (fila) => (
        <span className={styles.estado}>
          <StatusTag domain="cobro" status={fila.estado} data-testid="cobros-fila-estado" />
          {fila.estado === 'vencido' && (
            <span className={styles.secundario} data-testid="cobros-fila-atraso">
              {fila.diasAtraso === 1 ? '1 día de atraso' : `${fila.diasAtraso} días de atraso`}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'accion',
      title: '',
      hideInCard: true,
      render: (fila) => (
        <Link href={detalleHref(fila)} onClick={(evento) => evento.stopPropagation()} data-testid="cobros-ver-detalle">
          Ver detalle
        </Link>
      ),
    },
  ]

  const accionRegistrar = (
    <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalAbierto(true)} data-testid="cobros-registrar">
      Registrar cobro
    </Button>
  )

  return (
    <div className={styles.page} data-testid="cobros">
      <PageHeader title="Cobros" breadcrumb={MIGA} actions={listado && listado.totalPeriodos > 0 ? accionRegistrar : undefined} />

      {registrado && (
        <Alert
          type="success"
          showIcon
          closable={{ 'aria-label': 'Cerrar el aviso' }}
          onClose={() => setRegistrado(null)}
          title={`Registraste el cobro por ${formatARS(registrado.monto)}.`}
          description={<Link href={`/panel/cobros/${encodeURIComponent(registrado.periodoId)}/comprobante`}>Ver el comprobante {registrado.numeroComprobante}</Link>}
          data-testid="cobros-aviso"
        />
      )}

      {carga.status === 'error' && (
        <div className={styles.errorBlock} role="alert" data-testid="cobros-error">
          <span className={styles.errorTitle}>No pudimos traer los cobros</span>
          <span className={styles.errorText}>{carga.message}</span>
          <Button type="primary" onClick={carga.reintentar} data-testid="cobros-reintentar">
            Reintentar
          </Button>
        </div>
      )}

      {carga.status !== 'error' && !listado && (
        <div data-testid="cobros-cargando">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      )}

      {carga.status !== 'error' && listado?.totalPeriodos === 0 && (
        <EmptyState
          title={listado.proximoInicio ? 'Todavía no hay períodos para cobrar' : 'Todavía no hay cobros'}
          description={
            listado.proximoInicio
              ? `Tu primer período empieza el ${formatDate(listado.proximoInicio)}.`
              : 'Los períodos aparecen acá cuando tenés un contrato vigente.'
          }
          action={
            <Link href="/panel/propiedades" data-testid="cobros-ir-contratos">
              Ir a Propiedades
            </Link>
          }
          data-testid={listado.proximoInicio ? 'cobros-vacio-proximo' : 'cobros-vacio'}
        />
      )}

      {carga.status !== 'error' && listado && listado.totalPeriodos > 0 && (
        <>
          <div className={styles.indicadores} data-testid="cobros-indicadores">
            <StatCard title={`Cobrado · ${nombreDeMes(listado.indicadores.mes)}`} value={formatARS(listado.indicadores.cobrado)} data-testid="cobros-indicador-cobrado" />
            <StatCard title={`Vencido · ${nombreDeMes(listado.indicadores.mes)}`} value={formatARS(listado.indicadores.vencido)} delta={{ label: 'Incluye intereses por mora', trend: 'neutral' }} data-testid="cobros-indicador-vencido" />
          </div>

          <div className={styles.toolbar}>
            <PestaniasSolicitudes
              opciones={PESTANIAS}
              value={filtros.estado}
              onChange={(estado) => cambiarFiltros({ estado })}
              contadores={listado.cantidades}
              testIdPrefix="cobros"
              ariaLabel="Filtrar los cobros por estado"
            />
            <div className={styles.selects}>
              <Select
                className={styles.select}
                value={filtros.propiedad ?? ''}
                onChange={(propiedad) => cambiarFiltros({ propiedad: propiedad || null })}
                options={[{ value: '', label: 'Todas las propiedades' }, ...listado.propiedades.map(({ id, nombre }) => ({ value: id, label: nombre }))]}
                popupMatchSelectWidth={false}
                aria-label="Propiedad"
                data-testid="cobros-filtro-propiedad"
              />
              <Select
                className={styles.select}
                value={filtros.mes ?? ''}
                onChange={(mes) => cambiarFiltros({ mes: mes || null })}
                options={[{ value: '', label: 'Todos los meses' }, ...listado.meses.map((mes) => ({ value: mes, label: nombreDeMes(mes) }))]}
                popupMatchSelectWidth={false}
                aria-label="Mes"
                data-testid="cobros-filtro-mes"
              />
              {hayFiltros(filtros) && (
                <Button onClick={() => cambiarFiltros(FILTROS_PREDETERMINADOS)} data-testid="cobros-limpiar">
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>

          {listado.filas.length === 0 ? (
            <EmptyState
              title="No hay cobros con estos filtros"
              action={
                <Button onClick={() => cambiarFiltros(FILTROS_PREDETERMINADOS)} data-testid="cobros-limpiar-vacio">
                  Limpiar filtros
                </Button>
              }
              data-testid="cobros-sin-resultados"
            />
          ) : (
            <DataTable
              columns={columnas}
              data={listado.filas}
              rowKey={(fila) => fila.id}
              loading={carga.status === 'cargando'}
              onRowClick={(fila) => router.push(detalleHref(fila))}
              rowLabel={(fila) => `Ver el detalle de ${fila.propiedad}, ${nombreDeMes(fila.periodo)}`}
              cardHeader={(fila) => <span className={styles.direccion}>{fila.propiedad}</span>}
              cardActions={(fila) => <Link href={detalleHref(fila)}>Ver detalle</Link>}
              data-testid="cobros-tabla"
            />
          )}
        </>
      )}

      {modalAbierto && <RegistrarCobroModal periodo={null} onCerrar={() => setModalAbierto(false)} onRegistrado={alRegistrar} />}
    </div>
  )
}
