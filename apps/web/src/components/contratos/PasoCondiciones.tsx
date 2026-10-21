'use client'

/**
 * PasoCondiciones.tsx — paso 2 del alta de contrato: "Condiciones".
 *
 * Cubre: US-05 Registrar contrato de alquiler, "Paso 2 · Condiciones":
 * - fecha de inicio (no anterior a hoy), duración en meses (entero > 0, 24
 *   por defecto) y fecha de fin calculada, no editable;
 * - monto inicial (entero > 0, el precio publicado por defecto), depósito
 *   (entero ≥ 0, un mes por defecto) y día de vencimiento (1 a 28, 10 por
 *   defecto);
 * - índice (Sin ajuste, ICL, IPC o CAC) y periodicidad solo si hay índice;
 * - cantidad de ajustes y fecha del primero;
 * - condiciones de cobro de la propiedad en solo lectura.
 * Las reglas y las cuentas están en `lib/contratos/` (validaciones y fechas).
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 03): "Plazo", "Dinero y
 * ajuste" con la caja de resumen de ajustes, y el cobro de la propiedad.
 * NOTA (diseño vs. US): el diseño usa un select de "36 meses" y "cada 6
 * meses"; manda la US (duración entera y trimestral, semestral o anual).
 *
 * Quién lo usa: `AltaContrato.tsx`.
 */
import { DatePicker, Form, InputNumber, Radio, Select } from 'antd'
import dayjs from 'dayjs'
import type { CondicionesNuevoContrato, ContratoBorrador, IndiceContrato, PeriodicidadAjuste } from '@rentar/shared-types'
import { DetailList, FormSection, MoneyAmount, MoneyInput } from '@rentar/ui'
import { MEDIO_PAGO_CORTO } from '@/lib/catalogs/propiedad'
import { cantidadAjustes, fechaCorta, fechaFin, fechaPrimerAjuste } from '@/lib/contratos/fechas'
import { DIA_VENCIMIENTO_MAX, DIA_VENCIMIENTO_MIN, erroresCondiciones } from '@/lib/contratos/validaciones'
import { hoy } from '@/lib/utils/fechas'
import { IndiceAjuste } from './IndiceAjuste'
import styles from './AltaContrato.module.css'

/** Props de {@link PasoCondiciones}. */
interface PasoCondicionesProps {
  borrador: ContratoBorrador
  onCondicionesChange: (condiciones: CondicionesNuevoContrato) => void
  /** `true` después de tocar "Siguiente" o "Enviar": se muestran todos los errores. */
  mostrarErrores: boolean
}

/** Opciones del índice, en el orden de la US. */
const INDICES: { value: IndiceContrato; label: string }[] = [
  { value: 'sin_ajuste', label: 'Sin ajuste' },
  { value: 'ICL', label: 'ICL' },
  { value: 'IPC', label: 'IPC' },
  { value: 'CAC', label: 'CAC' },
]

/** Opciones de la periodicidad (US-05: "trimestral, semestral o anual"). */
const PERIODOS: { value: PeriodicidadAjuste; label: string }[] = [
  { value: 'trimestral', label: 'Trimestral (cada 3 meses)' },
  { value: 'semestral', label: 'Semestral (cada 6 meses)' },
  { value: 'anual', label: 'Anual (cada 12 meses)' },
]

/**
 * `min` de los montos. NOTA: `MoneyInput` corrige solo un negativo a 0 (su
 * `min` por defecto); así, "depósito negativo" pasaría como 0 sin avisar. Con
 * esto el valor llega tal cual y lo frena la validación de la US con su mensaje.
 */
const SIN_MINIMO = Number.MIN_SAFE_INTEGER

/** Un número del campo: `null` si quedó vacío (antd manda `null`). */
function numeroDe(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  return Number.isNaN(numero) ? null : numero
}

/** Paso 2 del alta: plazo, dinero, ajuste y cobro. */
export function PasoCondiciones({ borrador, onCondicionesChange, mostrarErrores }: PasoCondicionesProps) {
  const { condiciones, propiedad } = borrador
  const hoyIso = hoy().format('YYYY-MM-DD')
  const errores = mostrarErrores ? erroresCondiciones(condiciones, hoyIso) : {}
  const fin = fechaFin(condiciones.startDate, condiciones.durationMonths)
  const ajustes = cantidadAjustes(condiciones.durationMonths, condiciones.adjustmentIndex, condiciones.adjustmentPeriod)
  const primero = fechaPrimerAjuste(condiciones.startDate, condiciones.durationMonths, condiciones.adjustmentIndex, condiciones.adjustmentPeriod)
  const conIndice = condiciones.adjustmentIndex !== 'sin_ajuste'

  /** Cambia un campo y avisa el resto como está. */
  function cambiar<K extends keyof CondicionesNuevoContrato>(campo: K, valor: CondicionesNuevoContrato[K]): void {
    onCondicionesChange({ ...condiciones, [campo]: valor })
  }

  /** "Sin ajuste" borra la periodicidad (US-05: "si es 'Sin ajuste', no se muestra el campo de periodicidad"). */
  function cambiarIndice(indice: IndiceContrato): void {
    onCondicionesChange({ ...condiciones, adjustmentIndex: indice, adjustmentPeriod: indice === 'sin_ajuste' ? null : condiciones.adjustmentPeriod })
  }

  /** Estado y ayuda de un `Form.Item`. */
  const item = (campo: keyof CondicionesNuevoContrato, ayuda?: string) => ({
    validateStatus: errores[campo] ? ('error' as const) : undefined,
    help: errores[campo] ?? ayuda,
  })

  const precioPublicado = propiedad.priceMonthly

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.paso} data-testid="contrato-paso-condiciones">
      <Form layout="vertical" component="div" requiredMark={false}>
        <FormSection title="Plazo" description="Desde cuándo y por cuánto tiempo.">
          <div className={styles.grid3}>
            <Form.Item label="Fecha de inicio" {...item('startDate', 'No puede ser anterior a hoy.')}>
              <DatePicker
                value={condiciones.startDate ? dayjs(condiciones.startDate) : null}
                onChange={(fecha) => cambiar('startDate', fecha ? fecha.format('YYYY-MM-DD') : null)}
                format="DD/MM/YYYY"
                placeholder="dd/mm/aaaa"
                disabledDate={(fecha) => fecha.isBefore(hoy(), 'day')}
                className={styles.fullWidth}
                data-testid="contrato-inicio"
              />
            </Form.Item>
            <Form.Item label="Duración (meses)" {...item('durationMonths', '24 meses por defecto.')}>
              <InputNumber<number>
                value={condiciones.durationMonths}
                onChange={(valor) => cambiar('durationMonths', numeroDe(valor))}
                controls={false}
                className={styles.fullWidth}
                data-testid="contrato-duracion"
              />
            </Form.Item>
            <Form.Item label="Fecha de fin" help="Se calcula sola: inicio + duración − 1 día.">
              <span className={styles.calculado} data-testid="contrato-fin">
                {fin ? fechaCorta(fin) : '—'}
              </span>
            </Form.Item>
          </div>
        </FormSection>

        <FormSection title="Dinero y ajuste" description="El monto inicial, el depósito, cuándo se paga y cómo se ajusta.">
          <div className={styles.grid3}>
            <Form.Item label="Monto inicial" {...item('initialAmount', precioPublicado === null ? undefined : `Publicaste ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(precioPublicado)}. Podés cambiarlo acá.`)}>
              <MoneyInput value={condiciones.initialAmount ?? undefined} onChange={(valor) => cambiar('initialAmount', numeroDe(valor))} min={SIN_MINIMO} placeholder="Alquiler mensual" data-testid="contrato-monto" />
            </Form.Item>
            <Form.Item label="Depósito en garantía" {...item('deposit', 'Por defecto, un mes de alquiler. Puede ser 0.')}>
              <MoneyInput value={condiciones.deposit ?? undefined} onChange={(valor) => cambiar('deposit', numeroDe(valor))} min={SIN_MINIMO} placeholder="Depósito" data-testid="contrato-deposito" />
            </Form.Item>
            <Form.Item label="Día de vencimiento del pago" {...item('paymentDueDay', `Del ${DIA_VENCIMIENTO_MIN} al ${DIA_VENCIMIENTO_MAX} de cada mes.`)}>
              <InputNumber<number>
                value={condiciones.paymentDueDay}
                onChange={(valor) => cambiar('paymentDueDay', numeroDe(valor))}
                controls={false}
                className={styles.fullWidth}
                data-testid="contrato-dia-vencimiento"
              />
            </Form.Item>
          </div>

          <div className={styles.grid2}>
            <Form.Item label="Índice de ajuste">
              <Radio.Group
                optionType="button"
                value={condiciones.adjustmentIndex}
                onChange={(evento) => cambiarIndice(INDICES.find((opcion) => opcion.value === evento.target.value)?.value ?? 'sin_ajuste')}
                options={INDICES.map((opcion) => ({ value: opcion.value, label: <span data-testid={`contrato-indice-${opcion.value}`}>{opcion.label}</span> }))}
              />
            </Form.Item>
            {conIndice && (
              <Form.Item label="Periodicidad del ajuste" {...item('adjustmentPeriod')}>
                <Select<PeriodicidadAjuste>
                  value={condiciones.adjustmentPeriod ?? undefined}
                  onChange={(valor) => cambiar('adjustmentPeriod', valor)}
                  options={PERIODOS}
                  placeholder="Elegí cada cuánto"
                  data-testid="contrato-periodicidad"
                />
              </Form.Item>
            )}
          </div>

          {/* US-05: "Se debe informar la cantidad de ajustes que tendrá el contrato y la fecha del primero." */}
          <div className={styles.resumenAjustes} data-testid="contrato-ajustes">
            {!conIndice ? (
              <span>
                <strong>Sin ajustes:</strong> el monto queda fijo durante todo el contrato.
              </span>
            ) : !condiciones.adjustmentPeriod ? (
              <span>Elegí la periodicidad para ver cuántos ajustes tiene el contrato.</span>
            ) : (
              <span>
                <strong>
                  Con estas condiciones, el contrato tiene {ajustes} {ajustes === 1 ? 'ajuste' : 'ajustes'}
                </strong>
                {primero ? (
                  <>
                    {' '}
                    por <IndiceAjuste indice={condiciones.adjustmentIndex} />. El primero cae el <strong>{fechaCorta(primero)}</strong>; el monto de cada ajuste se define con el índice de ese momento.
                  </>
                ) : (
                  '. El contrato termina antes del primer ajuste.'
                )}
              </span>
            )}
          </div>
        </FormSection>

        {/* US-05: "Se deben mostrar en solo lectura las condiciones de cobro cargadas en la propiedad." */}
        <FormSection title="Condiciones de cobro de la propiedad" description="Las cargaste al publicar. Se cambian desde la propiedad, no desde el contrato.">
          <div data-testid="contrato-cobro">
            <DetailList
              items={[
                {
                  label: 'Medios de pago',
                  value: propiedad.cobro.paymentMethods.length > 0 ? propiedad.cobro.paymentMethods.map((medio) => MEDIO_PAGO_CORTO[medio.method] + (medio.surchargePct > 0 ? ` (+${medio.surchargePct} %)` : '')).join(', ') : 'Sin cargar',
                },
                { label: 'Días de gracia', value: propiedad.cobro.graceDays === null ? 'Sin cargar' : `${propiedad.cobro.graceDays}` },
                {
                  label: 'Interés por mora',
                  value: propiedad.cobro.dailyInterestPct ? `${propiedad.cobro.dailyInterestPct.toLocaleString('es-AR')} % por día de atraso` : 'No se cobra',
                },
                ...(precioPublicado === null ? [] : [{ label: 'Precio publicado', value: <MoneyAmount amount={precioPublicado} /> }]),
              ]}
              column={1}
            />
          </div>
        </FormSection>
      </Form>
    </div>
  )
}
