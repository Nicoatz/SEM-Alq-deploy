'use client'

/**
 * MoneyInput.tsx — campo numérico con formato de pesos.
 *
 * Quién lo usa: el paso Condiciones del alta de contrato (monto y depósito) y
 * el catálogo `/design-system`.
 */
import { useId, useState } from 'react'
import type { ClipboardEvent, FormEvent } from 'react'
import { InputNumber } from 'antd'

/** Mensaje cuando se intenta cargar un monto con centavos. */
const AVISO_SIN_CENTAVOS = 'Ingresá un monto entero, sin centavos'

/** Da formato de miles al valor mostrado (ej. `550000` -> "$ 550.000"). */
function formatDisplay(value: number | string | undefined): string {
  if (value === undefined || value === '') return ''
  return `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Revierte {@link formatDisplay} a un número editable.
 *
 * NOTA: un campo vacío devuelve `''`, no 0. Con 0 se mostraba "$ 0" con el cursor
 * adelante del cero, y lo que se tipeaba después quedaba multiplicado por 10.
 */
function parseDisplay(displayValue: string | undefined): number | string {
  const digitos = (displayValue ?? '').replace(/\$\s?|(\.)/g, '')
  return digitos === '' ? '' : Number(digitos)
}

/**
 * `true` si el texto que entra trae un separador que no es de miles.
 *
 * Lo pegado puede traer miles bien escritos: "1.500" pasa, "1000.5" y
 * "1.500,00" no. Un punto suelto no llega acá: ver {@link MoneyInput}.
 */
function traeCentavos(texto: string): boolean {
  const limpio = texto.replace(/[$\s]/g, '')
  if (!/[.,]/.test(limpio)) return false
  return !/^-?\d{1,3}(\.\d{3})+$/.test(limpio)
}

/** Props de {@link MoneyInput}. */
interface MoneyInputProps {
  value?: number
  onChange?: (value: number) => void
  placeholder?: string
  min?: number
  max?: number
  'data-testid'?: string
}

/**
 * `InputNumber` con formato de pesos argentinos ya aplicado — mismo
 * formatter/parser que usa el buscador de la landing (`SearchBar`), acá
 * reutilizable para cualquier campo de monto del panel (precio de
 * publicación, monto de un cobro, etc.).
 *
 * Solo acepta montos enteros. La coma es el separador decimal: el valor no
 * cambia y aparece el aviso. Mientras el aviso está, tampoco entran más dígitos,
 * para que "1000,5" no se convierta en 10.005. El aviso se va al borrar, al
 * reemplazar el monto o al volver a entrar al campo.
 *
 * NOTA: un punto tipeado es un separador de miles y se descarta: "150.000" tiene
 * que quedar en $ 150.000. Frenarlo dejaba $ 150, un monto mil veces menor.
 */
export function MoneyInput({ value, onChange, placeholder, min = 0, max, ...rest }: MoneyInputProps) {
  const [conAviso, setConAviso] = useState(false)
  // `onChange` manda 0 al vaciar el campo: esto lo mantiene vacío en pantalla.
  const [vacio, setVacio] = useState(false)
  const avisoId = useId()

  /** Frena lo que traiga centavos y lo que se tipee mientras está el aviso. */
  function filtrar(evento: { preventDefault: () => void; currentTarget: HTMLInputElement }, texto: string | undefined): void {
    if (!texto) return
    if (texto === '.') {
      evento.preventDefault()
    } else if (traeCentavos(texto)) {
      evento.preventDefault()
      setConAviso(true)
    } else if (conAviso) {
      // Con texto seleccionado se está reemplazando el monto, no siguiéndolo.
      const { selectionStart, selectionEnd } = evento.currentTarget
      if (selectionStart === selectionEnd) evento.preventDefault()
      else setConAviso(false)
    }
  }

  return (
    <>
      <InputNumber<number | string>
        style={{ width: '100%' }}
        controls={false}
        min={min}
        max={max}
        step={5000}
        value={vacio && !value ? null : value}
        onChange={(next) => {
          setConAviso(false)
          setVacio(next === null)
          onChange?.(Number(next ?? 0))
        }}
        onBeforeInput={(evento: FormEvent<HTMLInputElement>) => {
          // `data` no está en el tipo de `FormEvent`: es el texto que va a entrar.
          filtrar(evento, (evento as unknown as { data?: string }).data)
        }}
        onPaste={(evento: ClipboardEvent<HTMLInputElement>) => filtrar(evento, evento.clipboardData.getData('text'))}
        onKeyDown={(evento) => {
          if (evento.key === 'Backspace' || evento.key === 'Delete') setConAviso(false)
        }}
        onFocus={() => setConAviso(false)}
        formatter={formatDisplay}
        parser={parseDisplay}
        placeholder={placeholder}
        status={conAviso ? 'error' : undefined}
        aria-describedby={conAviso ? avisoId : undefined}
        {...rest}
      />
      {conAviso && (
        <div id={avisoId} role="alert" style={{ color: 'var(--rentar-color-error)', fontSize: 'var(--rentar-font-size-label)' }}>
          {AVISO_SIN_CENTAVOS}
        </div>
      )}
    </>
  )
}
