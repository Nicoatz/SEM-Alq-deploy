'use client'

/**
 * DataTable.tsx — tabla que en móvil se convierte en tarjetas, con fila clickeable opcional.
 *
 * Diseño: "Listado de propiedades" · 01-03.
 * Quién lo usa: `/panel/propiedades` (US-02) y el catálogo `/design-system`.
 */
import type { KeyboardEvent, ReactNode } from 'react'
import { Empty, Skeleton, Table, type TableColumnsType } from 'antd'
import styles from './DataTable.module.css'

/** Una columna: su título y cómo se dibuja la celda para cada fila. */
export interface DataTableColumn<T> {
  key: string
  title: string
  /**
   * Dibuja la celda a partir de la fila entera: la firma es `render(record)`.
   *
   * NOTA: **no es la firma de antd** (`render(value, record, index)`). Acá la
   * columna no tiene `dataIndex`, así que no hay `value` que pasar, y la misma
   * función dibuja la celda de la tabla y el valor de la tarjeta móvil. Si se
   * escribe al estilo antd, `(value, record) => …`, el primer parámetro recibe
   * la fila y `record` llega `undefined`.
   *
   * @example
   * { key: 'estado', title: 'Estado', render: (propiedad) => <StatusTag domain="propiedad" status={propiedad.status} /> }
   */
  render: (record: T) => ReactNode
  /**
   * `true` = la columna no se repite como par label/valor en la tarjeta
   * móvil (porque ya la muestra `cardHeader`, ej. la foto y la dirección).
   */
  hideInCard?: boolean
}

/**
 * Props de {@link DataTable}. `T` lleva default (`= unknown`) por el mismo
 * motivo que `StatusTagProps<D>` en `StatusTag.tsx`: sin default, el
 * extractor de `.d.ts` de `/design-sync` no puede resolver `T` y emite
 * `DataTableColumn<T>[]` con `T` sin declarar — no afecta la inferencia real
 * en los call sites (`T` siempre se infiere de `columns`/`data` como antes).
 */
interface DataTableProps<T = unknown> {
  columns: DataTableColumn<T>[]
  data: T[]
  rowKey: (record: T) => string
  loading?: boolean
  emptyDescription?: string
  /**
   * Si se pasa, la fila entera abre el detalle (Claude Design, "Listado de
   * propiedades" · 02): cursor de link, fondo al pasar el mouse, foco con Tab
   * y Enter para abrir. Los links y botones de adentro de la fila tienen que
   * cortar la propagación del click si van a otro lado.
   */
  onRowClick?: (record: T) => void
  /** Texto accesible de la fila clickeable (ej. "Ver detalle de Laprida 340"). */
  rowLabel?: (record: T) => string
  /** Encabezado de la tarjeta móvil (ej. foto + dirección). Sin valor, la tarjeta arranca con los pares label/valor. */
  cardHeader?: (record: T) => ReactNode
  /** Pie de la tarjeta móvil (ej. "Ver detalle" + "⋯"). */
  cardActions?: (record: T) => ReactNode
  'data-testid'?: string
}

/**
 * Tabla que en mobile (<640px) se convierte en una lista de tarjetas
 * (una por fila, pares label/valor) en vez de forzar scroll horizontal —
 * se renderizan ambas vistas y el CSS decide cuál mostrar según el ancho,
 * para no depender de detectar el breakpoint en JS (evita el parpadeo de
 * hidratación de medir `window` en el cliente).
 */
export function DataTable<T = unknown>({
  columns,
  data,
  rowKey,
  loading,
  emptyDescription,
  onRowClick,
  rowLabel,
  cardHeader,
  cardActions,
  ...rest
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div {...rest}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div {...rest}>
        <Empty description={emptyDescription ?? 'Sin resultados'} />
      </div>
    )
  }

  const antdColumns: TableColumnsType<T> = columns.map((col) => ({
    key: col.key,
    title: col.title,
    render: (_value, record) => col.render(record),
  }))

  /** Enter (o espacio) sobre la fila enfocada abre el detalle, como un link. */
  const handleRowKeyDown = (record: T) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onRowClick?.(record)
    }
  }

  const cardColumns = columns.filter((col) => !col.hideInCard)

  return (
    <div {...rest}>
      <div className={styles.tableView}>
        <Table<T>
          columns={antdColumns}
          dataSource={data}
          rowKey={rowKey}
          pagination={false}
          rowClassName={onRowClick ? styles.clickableRow : undefined}
          onRow={
            onRowClick
              ? (record) => ({
                  onClick: () => onRowClick(record),
                  onKeyDown: handleRowKeyDown(record),
                  tabIndex: 0,
                  role: 'link',
                  'aria-label': rowLabel?.(record),
                  'data-testid': 'data-table-row',
                })
              : undefined
          }
        />
      </div>
      <ul className={styles.cardList}>
        {data.map((record) => (
          <li key={rowKey(record)} className={styles.cardItem} data-testid="data-table-card">
            {cardHeader && <div className={styles.cardHeader}>{cardHeader(record)}</div>}
            {cardColumns.map((col) => (
              <div key={col.key} className={styles.cardRow}>
                <span className={styles.cardLabel}>{col.title}</span>
                <span className={styles.cardValue}>{col.render(record)}</span>
              </div>
            ))}
            {cardActions && <div className={styles.cardActions}>{cardActions(record)}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}
