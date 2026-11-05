'use client'

/**
 * MisPagos.tsx — `/panel/pagos`, los pagos del locatario.
 *
 * Cubre: US-09 Consultar cobro, "Mis pagos del locatario":
 * - "Arriba y separado del historial, se debe mostrar el período pendiente o
 *   vencido, con su monto, su fecha de vencimiento y acceso a su detalle."
 * - Indicadores del año: total pagado, pagos a término y recargos pagados.
 * - Historial del período más nuevo al más viejo, con período, monto, medio, fecha
 *   de pago, estado y comprobante. Con recargo, va aparte y con los días de atraso.
 * - Filtros por año, estado y medio, guardados en la URL.
 * - Con dos o más contratos, la propiedad es la primera columna.
 * US-11: el primer período después de un ajuste lleva la insignia del índice.
 *
 * NOTA: no se implementa aunque esté dibujado: el botón Pagar (US-13), "Descargar
 * el año en PDF" y las extraordinarias.
 *
 * De dónde saca los datos: `cobros.service#listarMisPagos`.
 * Quién lo usa: `app/(app)/panel/pagos/page.tsx`.
 */
import { useCallback, useMemo, useState } from 'react'
import { Button, Select, Skeleton } from 'antd'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { FiltroEstadoCobro, FiltrosPagos, MedioCobro, MisPagos as DatosMisPagos, PagoFila, PeriodoPendiente } from '@rentar/shared-types'
import { DataTable, EmptyState, formatARS, formatDate, formatPeriod, IndexBadge, MoneyAmount, PageHeader, StatCard, StatusTag, type DataTableColumn } from '@rentar/ui'
import { PestaniasSolicitudes } from '@/components/solicitudes/PestaniasSolicitudes'
import { ETIQUETA_MEDIO, OPCIONES_MEDIO } from '@/lib/cobros/medios'
import { FILTROS_PAGOS_PREDETERMINADOS, filtrosPagosDeUrl, urlDeFiltrosPagos } from '@/lib/cobros/misPagos'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { listarMisPagos } from '@/services/cobros.service'
import styles from './Cobros.module.css'

const MIGA = [{ label: 'Mi panel', href: '/panel' }, { label: 'Mis pagos' }]

const PESTANIAS: readonly { value: FiltroEstadoCobro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pagado', label: 'Pagados' },
  { value: 'vencido', label: 'Vencidos' },
  { value: 'pendiente', label: 'Pendientes' },
]

/** Ruta del detalle de un período. */
function detalleHref({ id }: { id: string }): string {
  return `/panel/cobros/${encodeURIComponent(id)}`
}

/** "Septiembre 2026" a partir de `AAAA-MM`. */
function nombreDeMes(mes: string): string {
  return formatPeriod(`${mes}-01`)
}

/** "14/07/2026 · +4 días" (US-09). */
function textoFechaPago(pago: PagoFila): string {
  const fecha = formatDate(pago.fechaPago)
  if (pago.diasAtraso === 0) return fecha
  return `${fecha} · +${pago.diasAtraso === 1 ? '1 día' : `${pago.diasAtraso} días`}`
}

/** Un período pendiente o vencido, en el bloque de arriba. */
function BloquePendiente({ item, conPropiedad }: { item: PeriodoPendiente; conPropiedad: boolean }) {
  return (
    <section className={styles.pendiente} data-testid="mis-pagos-pendiente" data-estado={item.estado}>
      <div className={styles.pendienteDatos}>
        <span className={styles.secundario}>
          {nombreDeMes(item.periodo)}
          {conPropiedad ? ` · ${item.propiedad}` : ''}
        </span>
        <MoneyAmount amount={item.monto} size="lg" />
        <span className={styles.secundario}>
          {item.estado === 'vencido' ? 'Venció' : 'Vence'} el {formatDate(item.vencimiento)}
          {item.recargo > 0 ? ` · incluye ${formatARS(item.recargo)} de recargo` : ''}
        </span>
      </div>
      <div className={styles.pendienteAcciones}>
        <StatusTag domain="cobro" status={item.estado} />
        <Link href={detalleHref(item)} data-testid="mis-pagos-pendiente-detalle">
          Ver el detalle
        </Link>
      </div>
    </section>
  )
}

/** Pendientes, indicadores, filtros e historial del locatario. */
export function MisPagos() {
  const router = useRouter()
  const parametros = useSearchParams()
  const filtros = useMemo(() => filtrosPagosDeUrl(parametros), [parametros])

  // ─── Estado local ───
  // Los datos anteriores siguen en pantalla mientras cargan los filtros nuevos.
  const [ultimo, setUltimo] = useState<DatosMisPagos | null>(null)

  const pedir = useCallback(async () => {
    const respuesta = await listarMisPagos(filtros)
    setUltimo(respuesta)
    return respuesta
  }, [filtros])
  const carga = useServiceCall(pedir)
  const datos = carga.status === 'listo' ? carga.data : ultimo

  // ─── Handlers ───
  /** Escribe los filtros en la URL. */
  function cambiarFiltros(cambios: Partial<FiltrosPagos>): void {
    const query = urlDeFiltrosPagos({ ...filtros, ...cambios })
    router.replace(query ? `/panel/pagos?${query}` : '/panel/pagos', { scroll: false })
  }

  // ─── Render ───
  const columnas: DataTableColumn<PagoFila>[] = [
    ...(datos?.variasPropiedades
      ? [{ key: 'propiedad', title: 'Propiedad', hideInCard: true, render: (pago: PagoFila) => <span className={styles.direccion}>{pago.propiedad}</span> }]
      : []),
    {
      key: 'periodo',
      title: 'Período',
      render: (pago) => (
        <span className={styles.periodo}>
          {nombreDeMes(pago.periodo)}
          {pago.indiceAjuste && <IndexBadge index={pago.indiceAjuste} data-testid="mis-pagos-indice" />}
        </span>
      ),
    },
    {
      key: 'monto',
      title: 'Monto',
      render: (pago) => (
        <span className={styles.estado}>
          <MoneyAmount amount={pago.monto} size="sm" />
          {pago.recargo > 0 && (
            <span className={styles.secundario} data-testid="mis-pagos-recargo">
              {formatARS(pago.recargo)} de recargo
            </span>
          )}
        </span>
      ),
    },
    { key: 'medio', title: 'Medio', render: (pago) => ETIQUETA_MEDIO[pago.medio] },
    { key: 'fecha', title: 'Fecha de pago', render: (pago) => <span data-testid="mis-pagos-fecha">{textoFechaPago(pago)}</span> },
    { key: 'estado', title: 'Estado', render: () => <StatusTag domain="cobro" status="pagado" /> },
    {
      key: 'comprobante',
      title: 'Comprobante',
      render: (pago) => (
        <Link href={`${detalleHref(pago)}/comprobante`} onClick={(evento) => evento.stopPropagation()} data-testid="mis-pagos-comprobante">
          {pago.numeroComprobante ?? 'Ver comprobante'}
        </Link>
      ),
    },
  ]

  const vacio = datos !== null && datos.totalPagos === 0 && datos.pendientes.length === 0 && filtros.estado === 'todos'
  const hayFiltros = urlDeFiltrosPagos(filtros) !== ''
  const conHistorial = filtros.estado === 'todos' || filtros.estado === 'pagado'

  return (
    <div className={styles.page} data-testid="mis-pagos">
      <PageHeader title="Mis pagos" breadcrumb={MIGA} />

      {carga.status === 'error' && (
        <div className={styles.errorBlock} role="alert" data-testid="mis-pagos-error">
          <span className={styles.errorTitle}>No pudimos traer tus pagos</span>
          <span className={styles.errorText}>{carga.message}</span>
          <Button type="primary" onClick={carga.reintentar} data-testid="mis-pagos-reintentar">
            Reintentar
          </Button>
        </div>
      )}

      {carga.status !== 'error' && !datos && (
        <div data-testid="mis-pagos-cargando">
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      )}

      {carga.status !== 'error' && vacio && (
        <EmptyState
          title="Todavía no tenés pagos"
          description="Cuando se registre tu primer pago, va a aparecer acá con su comprobante."
          action={<Link href="/panel/alquiler">Ver mi alquiler</Link>}
          data-testid="mis-pagos-vacio"
        />
      )}

      {carga.status !== 'error' && datos && !vacio && (
        <>
          {datos.pendientes.map((item) => (
            <BloquePendiente key={item.id} item={item} conPropiedad={datos.variasPropiedades} />
          ))}

          <div className={styles.indicadoresTres} data-testid="mis-pagos-indicadores">
            <StatCard title={`Pagado en ${datos.indicadores.anio}`} value={formatARS(datos.indicadores.totalPagado)} />
            <StatCard title="Pagos a término" value={datos.indicadores.aTermino} />
            <StatCard title="Recargos pagados" value={formatARS(datos.indicadores.recargos)} />
          </div>

          <div className={styles.toolbar}>
            <PestaniasSolicitudes
              opciones={PESTANIAS}
              value={filtros.estado}
              onChange={(estado) => cambiarFiltros({ estado })}
              contadores={null}
              testIdPrefix="mis-pagos"
              ariaLabel="Filtrar los pagos por estado"
              sinContador
            />
            <div className={styles.selects}>
              <Select
                className={styles.select}
                value={filtros.anio ?? 0}
                onChange={(anio) => cambiarFiltros({ anio: anio || null })}
                options={[{ value: 0, label: 'Todos los años' }, ...datos.anios.map((anio) => ({ value: anio, label: String(anio) }))]}
                popupMatchSelectWidth={false}
                aria-label="Año"
                data-testid="mis-pagos-filtro-anio"
              />
              <Select<MedioCobro | ''>
                className={styles.select}
                value={filtros.medio ?? ''}
                onChange={(medio) => cambiarFiltros({ medio: medio || null })}
                options={[{ value: '' as const, label: 'Todos los medios' }, ...OPCIONES_MEDIO]}
                popupMatchSelectWidth={false}
                aria-label="Medio"
                data-testid="mis-pagos-filtro-medio"
              />
              {hayFiltros && (
                <Button onClick={() => cambiarFiltros(FILTROS_PAGOS_PREDETERMINADOS)} data-testid="mis-pagos-limpiar">
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>

          {conHistorial && datos.pagos.length > 0 && (
            <DataTable
              columns={columnas}
              data={datos.pagos}
              rowKey={(pago) => pago.id}
              loading={carga.status === 'cargando'}
              onRowClick={(pago) => router.push(detalleHref(pago))}
              rowLabel={(pago) => `Ver el detalle de ${nombreDeMes(pago.periodo)}`}
              cardHeader={(pago) => <span className={styles.direccion}>{pago.propiedad}</span>}
              data-testid="mis-pagos-tabla"
            />
          )}

          {datos.pagos.length === 0 && datos.pendientes.length === 0 && (
            <EmptyState
              title="No hay pagos con estos filtros"
              action={
                <Button onClick={() => cambiarFiltros(FILTROS_PAGOS_PREDETERMINADOS)} data-testid="mis-pagos-limpiar-vacio">
                  Limpiar filtros
                </Button>
              }
              data-testid="mis-pagos-sin-resultados"
            />
          )}
        </>
      )}
    </div>
  )
}
