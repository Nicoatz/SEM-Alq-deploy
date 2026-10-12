'use client'

/**
 * CamposAlta.tsx — los campos compuestos del alta (US-01) que no son un
 * input de antd directo: el contador con botones ±, las características
 * como chips, los medios de pago con recargo y las tarjetas de índice.
 *
 * Todos siguen el contrato de antd `Form.Item` (`value` + `onChange`), así
 * se validan como cualquier otro campo.
 * NOTA: se componen acá (apps/web) y no en `@rentar/ui`: aprobado por
 * producto para esta tanda.
 * Quién lo usa: `PasosAlta.tsx`; `Stepper`, también el modal "Solicitar
 * alquiler" (personas a residir, US-35).
 */
import { Checkbox, InputNumber, Radio } from 'antd'
import { MinusOutlined, PlusOutlined } from '@ant-design/icons'
import type { AdjustmentIndex, CharacteristicKey, MedioPagoConRecargo, MedioPagoPreferido } from '@rentar/shared-types'
import { IndexBadge } from '@rentar/ui'
import { characteristicOptions } from '@/lib/catalogs/characteristics'
import { INDICE_INFO, MEDIOS_PAGO, RECARGO_MAXIMO_PCT } from '@/lib/catalogs/propiedad'
import styles from './Alta.module.css'

// ─── Contador ± ─────────────────────────────────────────────────────────

interface StepperProps {
  value?: number
  onChange?: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  /** Nombre del campo, para los textos accesibles de los botones ("Sumar un ambiente"). */
  label: string
  'data-testid'?: string
  id?: string
}

/** Número con botones − y + (Alta · 02: "nadie tipea 3 en un campo vacío"). */
export function Stepper({ value = 0, onChange, min = 0, max = 20, disabled, label, id, ...rest }: StepperProps) {
  return (
    <div className={`${styles.stepper} ${disabled ? styles.stepperDisabled : ''}`} data-testid={rest['data-testid']}>
      <button
        type="button"
        className={styles.stepperButton}
        onClick={() => onChange?.(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        aria-label={`Restar ${label}`}
        data-testid={rest['data-testid'] ? `${rest['data-testid']}-menos` : undefined}
      >
        <MinusOutlined />
      </button>
      <output id={id} className={styles.stepperValue} aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        className={styles.stepperButton}
        onClick={() => onChange?.(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        aria-label={`Sumar ${label}`}
        data-testid={rest['data-testid'] ? `${rest['data-testid']}-mas` : undefined}
      >
        <PlusOutlined />
      </button>
    </div>
  )
}

// ─── Características (chips) ────────────────────────────────────────────

interface CaracteristicasFieldProps {
  value?: CharacteristicKey[]
  onChange?: (value: CharacteristicKey[]) => void
}

/**
 * US-01: "Se pueden indicar tags de la propiedad". Las 5 del catálogo (las
 * mismas que filtra `/buscar`), como `Checkbox` de antd con forma de chip.
 */
export function CaracteristicasField({ value = [], onChange }: CaracteristicasFieldProps) {
  return (
    <Checkbox.Group
      className={styles.chips}
      value={value}
      onChange={(next) => onChange?.(next as CharacteristicKey[])}
      options={characteristicOptions.map((option) => ({ value: option.key, label: option.label }))}
      data-testid="alta-caracteristicas"
    />
  )
}

// ─── Medios de pago con recargo ─────────────────────────────────────────

interface MediosPagoFieldProps {
  value?: MedioPagoConRecargo[]
  onChange?: (value: MedioPagoConRecargo[]) => void
}

/**
 * US-01: "métodos de pago preferidos" (al menos uno). Cada medio habilitado
 * lleva un recargo opcional de 0 a 3 % (Alta · 04).
 */
export function MediosPagoField({ value = [], onChange }: MediosPagoFieldProps) {
  const habilitado = (method: MedioPagoPreferido) => value.find((medio) => medio.method === method)

  function alternar(method: MedioPagoPreferido, activo: boolean): void {
    const resto = value.filter((medio) => medio.method !== method)
    // Se conserva el orden del catálogo, no el del click.
    const siguiente = activo ? [...resto, { method, surchargePct: 0 }] : resto
    onChange?.(MEDIOS_PAGO.map((medio) => siguiente.find((item) => item.method === medio.method)).filter((medio): medio is MedioPagoConRecargo => !!medio))
  }

  function cambiarRecargo(method: MedioPagoPreferido, recargo: number | null): void {
    onChange?.(value.map((medio) => (medio.method === method ? { ...medio, surchargePct: recargo ?? 0 } : medio)))
  }

  return (
    <div className={styles.paymentList}>
      {MEDIOS_PAGO.map((medio) => {
        const actual = habilitado(medio.method)
        return (
          <div key={medio.method} className={`${styles.paymentCard} ${actual ? styles.paymentCardOn : ''}`} data-testid={`alta-medio-${medio.method}`}>
            <Checkbox
              checked={!!actual}
              onChange={(event) => alternar(medio.method, event.target.checked)}
              className={styles.paymentCheck}
              data-testid={`alta-medio-${medio.method}-check`}
            >
              <span className={styles.paymentText}>
                <span className={styles.paymentTitle}>
                  {medio.label}
                  {medio.simulado && <span className={styles.simulatedBadge}>Simulado</span>}
                </span>
                <span className={styles.paymentHelp}>{medio.ayuda}</span>
              </span>
            </Checkbox>
            {actual ? (
              <label className={styles.surcharge}>
                <span className={styles.surchargeLabel}>Recargo</span>
                <InputNumber
                  min={0}
                  max={RECARGO_MAXIMO_PCT}
                  step={0.5}
                  decimalSeparator=","
                  value={actual.surchargePct}
                  onChange={(recargo) => cambiarRecargo(medio.method, recargo)}
                  suffix="%"
                  className={styles.surchargeInput}
                  aria-label={`Recargo de ${medio.label}`}
                  data-testid={`alta-medio-${medio.method}-recargo`}
                />
              </label>
            ) : (
              <span className={styles.paymentOff}>No habilitado</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Índice de ajuste ───────────────────────────────────────────────────

interface IndiceFieldProps {
  value?: AdjustmentIndex | null
  onChange?: (value: AdjustmentIndex | null) => void
  /** Bloqueado: la edición (US-03) lo bloquea cuando lo fija el contrato vigente. */
  disabled?: boolean
}

/**
 * US-01: "Se puede indicar el índice de actualización" (opcional). Dos
 * tarjetas con la explicación de cada índice (Alta · 04: "Todo término
 * técnico se explica donde aparece") y la opción de dejarlo sin índice.
 */
export function IndiceField({ value = null, onChange, disabled = false }: IndiceFieldProps) {
  return (
    <div className={styles.indexField}>
      <Radio.Group value={value} disabled={disabled} onChange={(event) => onChange?.(event.target.value as AdjustmentIndex)} className={styles.indexGroup}>
        {(['ICL', 'IPC'] as const).map((index) => (
          <Radio key={index} value={index} className={`${styles.indexCard} ${value === index ? styles.indexCardOn : ''}`} data-testid={`alta-indice-${index}`}>
            <span className={styles.indexText}>
              <span className={styles.indexTitle}>
                <IndexBadge index={index} />
                {INDICE_INFO[index].nombre}
              </span>
              <span className={styles.indexHelp}>{INDICE_INFO[index].ayuda}</span>
            </span>
          </Radio>
        ))}
      </Radio.Group>
      {value && !disabled && (
        <button type="button" className={styles.linkButton} onClick={() => onChange?.(null)} data-testid="alta-indice-quitar">
          Sin índice por ahora
        </button>
      )}
    </div>
  )
}
