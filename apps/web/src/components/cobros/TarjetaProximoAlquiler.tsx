'use client'

/**
 * TarjetaProximoAlquiler.tsx — el monto a pagar de un contrato.
 *
 * Cubre: US-12 Consultar el monto del alquiler, "Variantes de la tarjeta":
 * - Al día: "Vence en N días".
 * - Faltan 3 días o menos: se destaca y suma "Pagá antes del dd/mm para evitar el
 *   recargo".
 * - Vencido: "Vencido hace N días"; con mora, el total y su desglose.
 * - Pagado: el período siguiente, con acceso al comprobante del último pago.
 * - Pendiente de firma: el monto inicial, con la aclaración.
 * Mientras no venció, dice desde cuándo y con qué interés se suma el recargo.
 *
 * NOTA: no se implementa aunque esté dibujado: "Incluye expensas fijas" ni el botón
 * Pagar (US-13). El monto va sin decimales (US-12).
 *
 * De dónde saca los datos: props (`cobros.service#getProximoAlquiler`).
 * Quién lo usa: `PanelLocatario.tsx` y `MontoAlquiler.tsx`.
 */
import Link from 'next/link'
import type { ProximoItem } from '@rentar/shared-types'
import { formatARS, formatDate, formatPeriod, MoneyAmount } from '@rentar/ui'
import styles from './TarjetaProximoAlquiler.module.css'

/** Props de {@link TarjetaProximoAlquiler}. */
interface TarjetaProximoAlquilerProps {
  item: ProximoItem
  /** Título de la tarjeta. */
  titulo?: string
  /** `true` si es el monto principal de la pantalla: va en dorado (una sola vez). */
  destacado?: boolean
  /** Muestra la propiedad: con dos o más contratos, toda plata dice de cuál es. */
  conPropiedad?: boolean
}

/** "1 día" o "N días". */
function textoDias(dias: number): string {
  return dias === 1 ? '1 día' : `${dias} días`
}

/** Texto del aviso principal de cada variante. */
function textoChip({ variante, dias }: ProximoItem): string {
  if (variante === 'pendiente_firma') return 'Pendiente de firma'
  if (variante === 'vence_hoy') return 'Vence hoy'
  if (variante === 'vencido_gracia' || variante === 'vencido_mora') return `Vencido hace ${textoDias(dias)}`
  return `Vence en ${textoDias(dias)}`
}

/** Fecha sin año, para los avisos. */
function diaMes(fecha: string): string {
  return formatDate(fecha, 'DD/MM')
}

/** La tarjeta de un contrato. */
export function TarjetaProximoAlquiler({ item, titulo = 'Tu próximo alquiler', destacado = true, conPropiedad = false }: TarjetaProximoAlquilerProps) {
  const { variante, vencimiento, periodo, tasaDiariaPct, sinRecargoHasta } = item
  const vencido = variante === 'vencido_gracia' || variante === 'vencido_mora'
  const porVencer = variante === 'por_vencer' || variante === 'vence_hoy'
  const claseChip = vencido ? styles.chipVencido : porVencer ? styles.chipPorVencer : styles.chip
  const distancia = vencimiento && !vencido && variante !== 'vence_hoy' ? ` · en ${textoDias(item.dias)}` : ''

  return (
    <section className={styles.tarjeta} data-testid="proximo-alquiler" data-variante={variante}>
      <div className={styles.encabezado}>
        <h2 className={styles.titulo}>{titulo}</h2>
        <span className={claseChip} data-testid="proximo-alquiler-chip">
          {textoChip(item)}
        </span>
      </div>

      {conPropiedad && <span className={styles.propiedad}>{item.propiedad}</span>}

      <MoneyAmount amount={item.total} size="lg" emphasis={destacado} data-testid="proximo-alquiler-monto" />

      {periodo && vencimiento && (
        <span className={styles.secundario} data-testid="proximo-alquiler-periodo">
          {formatPeriod(`${periodo}-01`)} · {vencido ? 'venció' : 'vence'} el {formatDate(vencimiento)}
          {distancia}
        </span>
      )}

      {variante === 'pendiente_firma' && (
        <span className={styles.secundario} data-testid="proximo-alquiler-aclaracion">
          Es el monto inicial del contrato. El primer período se habilita cuando firmen todas las partes.
        </span>
      )}

      {porVencer && vencimiento && (
        <span className={styles.aviso} data-testid="proximo-alquiler-aviso">
          Pagá antes del {diaMes(vencimiento)} para evitar el recargo.
        </span>
      )}

      {variante === 'vencido_gracia' && (
        <span className={styles.aviso} data-testid="proximo-alquiler-aviso">
          Todavía sin recargo{sinRecargoHasta ? `: tenés hasta el ${diaMes(sinRecargoHasta)}.` : '.'}
        </span>
      )}

      {item.mora > 0 && (
        <dl className={styles.desglose} data-testid="proximo-alquiler-desglose">
          <div>
            <dt>Alquiler</dt>
            <dd>{formatARS(item.alquiler)}</dd>
          </div>
          <div>
            <dt>Intereses por mora</dt>
            <dd>{formatARS(item.mora)}</dd>
          </div>
          <div>
            <dt>Días de mora</dt>
            <dd>{item.diasMora}</dd>
          </div>
        </dl>
      )}

      {!vencido && tasaDiariaPct !== null && tasaDiariaPct > 0 && sinRecargoHasta && (
        <span className={styles.secundario} data-testid="proximo-alquiler-recargo">
          Después del {diaMes(sinRecargoHasta)} se suma {String(tasaDiariaPct).replace('.', ',')} % por día de atraso.
        </span>
      )}

      <div className={styles.acciones}>
        {item.periodoId && (
          <Link href={`/panel/cobros/${encodeURIComponent(item.periodoId)}`} data-testid="proximo-alquiler-detalle">
            Ver el detalle
          </Link>
        )}
        {variante === 'pagado' && item.ultimoPagoPeriodoId && (
          <Link href={`/panel/cobros/${encodeURIComponent(item.ultimoPagoPeriodoId)}/comprobante`} data-testid="proximo-alquiler-comprobante">
            Ver el comprobante del último pago
          </Link>
        )}
      </div>
    </section>
  )
}
