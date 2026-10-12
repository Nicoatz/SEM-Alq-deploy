'use client'

/**
 * useAccionSolicitud.ts — el ciclo de una acción sobre una solicitud:
 * confirmar, ejecutar, y qué pasa si sale bien, si falla o si chocó con un
 * cambio de estado.
 *
 * Qué es: lo comparten Solicitudes recibidas (aceptar, rechazar y cancelar
 * una aceptada: US-37 y US-38) y Mis solicitudes (cancelar una pendiente:
 * sin US en Sprint 0, mapa US-39). Sigue a Claude Design, "Flujo de
 * solicitudes" · 06:
 * - "Falla la acción, no la pantalla": el error se muestra dentro del modal,
 *   que queda abierto con "Reintentar".
 * - "Conflicto de estado": si la solicitud ya no estaba en el estado que se
 *   veía (409), el modal se cierra, se avisa qué pasó y la lista se vuelve a
 *   pedir sola.
 *
 * Quién lo usa: `SolicitudesRecibidas` y `MisSolicitudes`.
 */
import { useState } from 'react'
import type { Solicitud } from '@rentar/shared-types'
import type { AccionSolicitud } from '@/lib/validation/solicitud.rules'
import { aceptarSolicitud, cancelarSolicitud, rechazarSolicitud } from '@/services/solicitudes.service'
import { ServiceError } from '@/services/shared/errors'

/** La función del service de cada acción. */
const SERVICIO_DE_ACCION: Record<AccionSolicitud, (solicitudId: string) => Promise<Solicitud>> = {
  aceptar: aceptarSolicitud,
  rechazar: rechazarSolicitud,
  cancelar: cancelarSolicitud,
}

/** La acción que el usuario pidió y todavía no confirmó (o que está en curso). */
export interface AccionPedida {
  accion: AccionSolicitud
  solicitud: Solicitud
}

/** El error de la última confirmación, para mostrarlo dentro del modal. */
export interface ErrorAccion {
  code: ServiceError['code'] | 'unknown'
  message: string
}

/** Qué hacer cuando la acción termina. */
interface OpcionesAccion {
  /** Salió bien: la pantalla aplica el estado nuevo. */
  onExito: (actualizada: Solicitud, pedida: AccionPedida) => void
  /** 409: la solicitud cambió mientras se miraba. La pantalla avisa y vuelve a pedir la lista. */
  onConflicto: (message: string, pedida: AccionPedida) => void
}

/** Estado del modal de confirmación y sus handlers. */
export interface EstadoAccionSolicitud {
  pedida: AccionPedida | null
  enCurso: boolean
  error: ErrorAccion | null
  /** Abre el modal de confirmación de esa acción. */
  pedir: (accion: AccionSolicitud, solicitud: Solicitud) => void
  /** Ejecuta la acción pedida (también es el "Reintentar"). */
  confirmar: () => Promise<void>
  /** Cierra el modal sin hacer nada (no mientras la acción está en curso). */
  cerrar: () => void
}

/**
 * Maneja la confirmación y la ejecución de una acción sobre una solicitud.
 * El modal no se cierra hasta que la acción termina bien o choca con un 409.
 */
export function useAccionSolicitud({ onExito, onConflicto }: OpcionesAccion): EstadoAccionSolicitud {
  // ─── Estado local ─────────────────────────────────────────────────────
  const [pedida, setPedida] = useState<AccionPedida | null>(null)
  const [enCurso, setEnCurso] = useState(false)
  const [error, setError] = useState<ErrorAccion | null>(null)

  // ─── Handlers ─────────────────────────────────────────────────────────
  function pedir(accion: AccionSolicitud, solicitud: Solicitud): void {
    setError(null)
    setPedida({ accion, solicitud })
  }

  function cerrar(): void {
    if (enCurso) return
    setPedida(null)
    setError(null)
  }

  async function confirmar(): Promise<void> {
    if (!pedida || enCurso) return
    setEnCurso(true)
    setError(null)
    try {
      const actualizada = await SERVICIO_DE_ACCION[pedida.accion](pedida.solicitud.id)
      setPedida(null)
      onExito(actualizada, pedida)
    } catch (causa: unknown) {
      const esServicio = causa instanceof ServiceError
      if (esServicio && causa.code === 'conflict') {
        setPedida(null)
        onConflicto(causa.message, pedida)
      } else {
        setError({ code: esServicio ? causa.code : 'unknown', message: esServicio ? causa.message : 'Ocurrió un error inesperado.' })
      }
    } finally {
      setEnCurso(false)
    }
  }

  return { pedida, enCurso, error, pedir, confirmar, cerrar }
}
