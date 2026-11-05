'use client'

/**
 * useServiceCall.ts — pide datos a un service y devuelve su estado de carga.
 *
 * Qué es: el patrón de `/buscar` empaquetado para las pantallas del panel,
 * que piden varios bloques por separado (Claude Design, "Panel de inicio" ·
 * 03: "Si falla un bloque, falla solo ese bloque"). Cada bloque tiene su
 * propio "cargando / error / listo" y su botón "Reintentar".
 *
 * NOTA: no hay `setState` sincrónico dentro del efecto: "cargando" se deduce
 * de que el último resultado guardado es de un intento anterior. Así cumple
 * la regla de hooks de React 19 y no parpadea.
 *
 * Quién lo usa: `components/panel/*` y `components/mis-propiedades/*`.
 */
import { useCallback, useEffect, useState } from 'react'
import { ServiceError } from '@/services/shared/errors'

/** Estado de un pedido a un service. */
export type EstadoServicio<T> =
  | { status: 'cargando' }
  | { status: 'error'; message: string; code: ServiceError['code'] | 'unknown'; apiCode?: string }
  | { status: 'listo'; data: T }

/** Resultado guardado de un intento. */
type Resultado<T> = { intento: number } & ({ ok: true; data: T } | { ok: false; message: string; code: ServiceError['code'] | 'unknown'; apiCode?: string })

/**
 * Llama a `fn` al montar y cada vez que se pide `reintentar()`.
 * @param fn Función del service. Tiene que ser estable (una función de
 *   módulo, como `getResumenCobros`, o memorizada con `useCallback`).
 */
export function useServiceCall<T>(fn: () => Promise<T>): EstadoServicio<T> & { reintentar: () => void } {
  const [intento, setIntento] = useState(0)
  const [resultado, setResultado] = useState<Resultado<T> | null>(null)

  useEffect(() => {
    let cancelado = false
    fn()
      .then((data) => {
        if (!cancelado) setResultado({ intento, ok: true, data })
      })
      .catch((error: unknown) => {
        if (cancelado) return
        const esServicio = error instanceof ServiceError
        setResultado({
          intento,
          ok: false,
          message: esServicio ? error.message : 'Ocurrió un error inesperado.',
          code: esServicio ? error.code : 'unknown',
          apiCode: esServicio ? error.apiCode : undefined,
        })
      })
    return () => {
      cancelado = true
    }
  }, [fn, intento])

  const reintentar = useCallback(() => setIntento((actual) => actual + 1), [])

  if (!resultado || resultado.intento !== intento) return { status: 'cargando', reintentar }
  if (!resultado.ok) return { status: 'error', message: resultado.message, code: resultado.code, apiCode: resultado.apiCode, reintentar }
  return { status: 'listo', data: resultado.data, reintentar }
}
