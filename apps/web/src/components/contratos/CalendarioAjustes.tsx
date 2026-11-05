/**
 * CalendarioAjustes.tsx — el calendario de ajustes del detalle del contrato.
 *
 * Cubre: US-42 Consultar detalle del contrato, "Calendario de ajustes": la
 * fecha de inicio, cada ajuste con su índice y el monto "a definir".
 * Decisión del PO (05/11): el monto de los ajustes es SIEMPRE "a definir"
 * hasta que exista US-11 en el back.
 * NOTA (diseño vs. US, gana la US): el diseño vivo sacó el calendario de
 * "Flujo de contratos" · 04. Se dibuja como en el export del 13/10, sin el
 * monto estimado.
 *
 * De dónde saca los datos: props; las fechas, de `calendarioAjustes`.
 * Quién lo usa: `components/contratos/DetalleContrato.tsx`.
 */
import type { IndiceContrato } from '@rentar/shared-types'
import { IndexBadge, MoneyAmount } from '@rentar/ui'
import { calendarioAjustes } from '@/lib/contratos/ajustes'
import { fechaCorta } from '@/lib/contratos/fechas'
import { hoy } from '@/lib/utils/fechas'
import styles from './CalendarioAjustes.module.css'

/** Props de {@link CalendarioAjustes}. */
interface CalendarioAjustesProps {
  inicio: string | null
  fin: string | null
  /** Cada cuántos meses ajusta; `null` si es "Sin ajuste". */
  cadaMeses: number | null
  indice: IndiceContrato
  montoInicial: number | null
}

/** El calendario. Sin ajuste (o sin fechas), no muestra nada. */
export function CalendarioAjustes({ inicio, fin, cadaMeses, indice, montoInicial }: CalendarioAjustesProps) {
  const fechas = calendarioAjustes(inicio, fin, cadaMeses)
  if (fechas.length === 0) return null
  // US-11: "Se debe destacar el próximo ajuste."
  const hoyIso = hoy().format('YYYY-MM-DD')
  const proximo = fechas.find((item) => item.tipo === 'ajuste' && item.fecha >= hoyIso)?.fecha
  return (
    <section className={styles.tarjeta} aria-labelledby="contrato-calendario-titulo" data-testid="contrato-detalle-calendario">
      <h2 id="contrato-calendario-titulo" className={styles.titulo}>
        Calendario de ajustes
      </h2>
      <ol className={styles.lista}>
        {fechas.map(({ fecha, tipo }, posicion) => (
          <li key={fecha} data-proximo={fecha === proximo || undefined} className={tipo === 'inicio' ? `${styles.fila} ${styles.filaInicio}` : styles.fila} data-testid="contrato-calendario-fila" data-tipo={tipo}>
            <span className={styles.fecha}>
              <strong>{fechaCorta(fecha)}</strong>
              {tipo === 'inicio' ? (
                <span className={styles.detalle}>Inicio · monto inicial</span>
              ) : (
                <span className={styles.detalle}>
                  {fecha === proximo ? 'Próximo ajuste' : `Ajuste ${posicion}`} <IndexBadge index={indice} />
                </span>
              )}
            </span>
            {tipo === 'inicio' && montoInicial !== null ? <MoneyAmount amount={montoInicial} /> : <span className={styles.aDefinir}>{tipo === 'inicio' ? 'Sin dato' : 'a definir'}</span>}
          </li>
        ))}
      </ol>
    </section>
  )
}
