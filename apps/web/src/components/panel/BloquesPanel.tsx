'use client'

/**
 * BloquesPanel.tsx — los bloques de datos de `/panel`: próximos cobros,
 * reclamos recientes y contratos por vencer o ajustar, más sus estados de
 * carga y de error.
 *
 * Diseño: "Panel de inicio" · 01 (bloques con datos) y 03 (carga y error
 * parcial: "Si falla un bloque, falla solo ese bloque").
 * Quién lo usa: `PanelLocador`.
 */
import type { ReactNode } from 'react'
import { Button, Skeleton } from 'antd'
import Link from 'next/link'
import type { CobroPanel, EventoContratoPanel, ReclamoPanel, ResumenCobros, ResumenReclamos } from '@rentar/shared-types'
import { MoneyAmount, StatusTag } from '@rentar/ui'
import { formatARS } from '@rentar/ui/src/utils/formatARS'
import { formatDate } from '@rentar/ui/src/utils/formatDate'
import { INDICE_INFO, periodicidad } from '@/lib/catalogs/propiedad'
import { diasDesde, diasHasta, textoDias, textoEnDias, textoHaceDias } from '@/lib/utils/fechas'
import { USE_MOCKS } from '@/services/shared/config'
import styles from './Panel.module.css'

/** Formato corto de las filas: "05/09". */
const DIA_MES = 'DD/MM'

// ─── Marco y estados de un bloque ───────────────────────────────────────

interface BloqueProps {
  title: string
  /** Link "Ver todos" / "Ir a Contratos" de la cabecera. */
  link?: { href: string; label: string; testId: string }
  children: ReactNode
  'data-testid'?: string
}

/** Tarjeta de un bloque: título, link a la sección y contenido. */
export function Bloque({ title, link, children, ...rest }: BloqueProps) {
  return (
    <section className={styles.block} {...rest}>
      <div className={styles.blockHeader}>
        <h3 className={styles.blockTitle}>{title}</h3>
        {link && (
          <Link href={link.href} className={styles.blockLink} data-testid={link.testId}>
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** Esqueleto con la forma final de un bloque de filas (nunca un spinner centrado). */
export function BloqueCargando({ filas = 3 }: { filas?: number }) {
  return (
    <div className={styles.rows} aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, index) => (
        <Skeleton.Node key={index} active className={styles.skeletonRow}>
          <span />
        </Skeleton.Node>
      ))}
    </div>
  )
}

interface BloqueErrorProps {
  /** "No pudimos traer tus cobros". */
  title: string
  onReintentar: () => void
  'data-testid'?: string
}

/** Error parcial: falla solo este bloque, el resto del panel sigue andando. */
export function BloqueError({ title, onReintentar, ...rest }: BloqueErrorProps) {
  return (
    <div className={styles.blockError} role="alert" {...rest}>
      <span className={styles.blockErrorIcon} aria-hidden="true">
        !
      </span>
      <span className={styles.blockErrorTitle}>{title}</span>
      <span className={styles.blockErrorText}>El resto del panel funciona. Probá de nuevo; si sigue igual, en un rato vuelve solo.</span>
      <Button type="primary" onClick={onReintentar}>
        Reintentar
      </Button>
    </div>
  )
}

// ─── Próximos cobros ────────────────────────────────────────────────────

/** Segunda línea de un cobro: quién, cuándo y cuánto falta (o cuánto se atrasó). */
function detalleCobro(cobro: CobroPanel): string {
  if (cobro.status === 'pagado' && cobro.paidAt) return `${cobro.tenantName} · acreditado el ${formatDate(cobro.paidAt, DIA_MES)}`
  if (cobro.status === 'vencido') {
    return `${cobro.tenantName} · venció el ${formatDate(cobro.dueDate, DIA_MES)} · ${textoDias(diasDesde(cobro.dueDate))} de atraso`
  }
  return `${cobro.tenantName} · vence el ${formatDate(cobro.dueDate, DIA_MES)} · ${textoEnDias(diasHasta(cobro.dueDate))}`
}

/**
 * Filas de "Próximos cobros". Orden del diseño: vencidos primero, después
 * por vencimiento más cercano; el pagado queda al final como confirmación.
 */
export function ProximosCobros({ resumen }: { resumen: ResumenCobros }) {
  if (resumen.items.length === 0) {
    // NOTA: con el back real el módulo de cobros todavía no existe (el
    // service devuelve vacío, ver `panel.service.ts#getResumenCobros`): no se
    // puede decir que "no hay propiedades alquiladas". En modo mock el texto
    // queda como estaba.
    const texto = USE_MOCKS ? 'No tenés cobros este mes: todavía no hay propiedades alquiladas.' : 'Todavía no hay cobros registrados.'
    return <p className={styles.blockEmpty}>{texto}</p>
  }
  return (
    <ul className={styles.rows}>
      {resumen.items.map((cobro) => (
        <li key={cobro.id} className={`${styles.row} ${cobro.status === 'vencido' ? styles.rowOverdue : ''}`} data-testid="panel-cobro">
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>{cobro.propertyAddress}</span>
            <span className={styles.rowDetail}>{detalleCobro(cobro)}</span>
          </span>
          <span className={styles.rowAside}>
            <MoneyAmount amount={cobro.amount} size="sm" />
            <StatusTag domain="cobro" status={cobro.status} />
          </span>
        </li>
      ))}
    </ul>
  )
}

// ─── Reclamos recientes ─────────────────────────────────────────────────

/** Segunda línea de un reclamo: dónde, quién, cuándo y si falta responder. */
function detalleReclamo(reclamo: ReclamoPanel): string {
  const base = `${reclamo.propertyAddress} · ${reclamo.tenantName} · ${textoHaceDias(diasDesde(reclamo.createdAt))}`
  if (reclamo.status === 'resuelto' || reclamo.status === 'cerrado') return base
  return reclamo.answeredAt ? `${base} · respondiste el ${formatDate(reclamo.answeredAt, DIA_MES)}` : `${base} · sin responder`
}

/** Filas de "Reclamos recientes", del más nuevo al más viejo. */
export function ReclamosRecientes({ resumen }: { resumen: ResumenReclamos }) {
  if (resumen.recent.length === 0) {
    return <p className={styles.blockEmpty}>No hay reclamos de tus locatarios.</p>
  }
  return (
    <ul className={styles.rows}>
      {resumen.recent.map((reclamo) => {
        const abierto = reclamo.status === 'abierto' || reclamo.status === 'en_proceso'
        return (
          <li key={reclamo.id} className={`${styles.row} ${styles.rowStacked}`} data-testid="panel-reclamo">
            <span className={styles.rowTitleLine}>
              <span className={styles.rowTitle}>{reclamo.title}</span>
              <StatusTag domain="reclamo" status={reclamo.status} />
            </span>
            <span className={styles.rowDetail}>{detalleReclamo(reclamo)}</span>
            {abierto && (
              <Link href="/panel/reclamos" className={styles.rowLink}>
                {reclamo.answeredAt ? 'Ver conversación' : 'Responder'}
              </Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ─── Contratos por vencer o por ajustar ─────────────────────────────────

/** Texto de la tarjeta de un evento de contrato. Nunca inventa el monto futuro: sin índice publicado, no hay estimado. */
function textoEvento(evento: EventoContratoPanel): string {
  if (evento.kind === 'ajuste' && evento.index) {
    const cada = evento.everyMonths ? `${periodicidad(evento.everyMonths)} ` : ''
    return `Ajuste ${cada}por ${evento.index} el ${formatDate(evento.date)}. Hoy ${evento.tenantName} paga ${formatARS(evento.currentAmount)}; el monto nuevo se calcula con el índice que publica ${INDICE_INFO[evento.index].publica}.`
  }
  return `Termina el ${formatDate(evento.date)}. Conviene preguntarle a ${evento.tenantName} si renueva, para no quedar con la propiedad vacía.`
}


/** Tarjetas de "Contratos por vencer o por ajustar · próximos 60 días". */
export function ContratosProximos({ eventos }: { eventos: EventoContratoPanel[] }) {
  if (eventos.length === 0) {
    return <p className={styles.blockEmpty}>No hay contratos por vencer ni por ajustar en los próximos 60 días.</p>
  }
  return (
    <div className={styles.contractGrid}>
      {eventos.map((evento) => {
        const dias = diasHasta(evento.date)
        const esAjuste = evento.kind === 'ajuste'
        return (
          <article
            key={`${evento.contractId}-${evento.kind}`}
            className={`${styles.contractCard} ${esAjuste ? styles.contractCardAdjust : ''}`}
            data-testid="panel-contrato"
          >
            <span className={styles.contractHeader}>
              <span className={esAjuste ? styles.contractWhenAdjust : styles.contractWhen}>
                {esAjuste ? 'Ajuste' : 'Vence'} {textoEnDias(dias)}
              </span>
              <StatusTag domain="contrato" status={evento.contractStatus} />
            </span>
            <span className={styles.rowTitle}>{evento.propertyAddress}</span>
            <span className={styles.contractText}>{textoEvento(evento)}</span>
            <Link href="/panel/contratos" className={styles.rowLink}>
              {esAjuste ? 'Revisar el ajuste' : 'Proponer renovación'}
            </Link>
          </article>
        )
      })}
    </div>
  )
}
