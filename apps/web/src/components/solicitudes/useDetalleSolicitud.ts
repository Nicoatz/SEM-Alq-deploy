'use client'

/**
 * useDetalleSolicitud.ts — los datos sensibles de la solicitud abierta en
 * Solicitudes recibidas: DNI, contacto y legajo del postulante.
 *
 * Qué es: un hook que pide `getSolicitudRecibida` para la solicitud elegida y
 * la vuelve a pedir cuando se le pide (después de aceptar o rechazar). La
 * lista (`listarSolicitudesRecibidas`) no trae estos datos: van solo en el
 * detalle del postulante (US-35 actualizada, regla del PO de la tanda 5).
 * Cubre: US-36 Consultar solicitudes (numeración de Jira).
 * Quién lo usa: `SolicitudesRecibidas` (panel del costado en escritorio y
 * Drawer en móvil, con la misma solicitud abierta).
 *
 * NOTA de privacidad: los datos viven solo en el estado de React mientras el
 * detalle está abierto; no se guardan en `localStorage`, `sessionStorage` ni
 * se loguean.
 */
import { useCallback } from 'react'
import type { Solicitud } from '@rentar/shared-types'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { getSolicitudRecibida } from '@/services/solicitudes.service'
import { ServiceError } from '@/services/shared/errors'

/** Lo que devuelve {@link useDetalleSolicitud}. */
export interface DetalleSolicitud {
  /** `cargando` también mientras se cambia de solicitud, para no mostrar los datos de la anterior. */
  estado: 'sin_solicitud' | 'cargando' | 'error' | 'listo'
  /** La solicitud con DNI, contacto y legajo; `null` salvo en `listo`. */
  solicitud: Solicitud | null
  /** El error ya traducido por el adaptador; `null` salvo en `error`. */
  message: string | null
  /** Vuelve a pedir el detalle (el "Reintentar", y después de aceptar o rechazar). */
  recargar: () => void
}

/** El resultado de un pedido, con el id que se pidió (ver la NOTA de {@link useDetalleSolicitud}). */
type Resultado = { id: string; ok: true; solicitud: Solicitud } | { id: string; ok: false; message: string }

/**
 * Pide el detalle de `abierta` (una fila de la lista) y lo vuelve a pedir
 * cada vez que cambia de solicitud o se llama a `recargar`.
 * NOTA: al cambiar de solicitud, `useServiceCall` devuelve un instante el
 * resultado de la anterior. Por eso el error se convierte en un resultado que
 * lleva el id pedido: si no es el de la abierta, se muestra como cargando
 * (ni los datos ni el error de otra solicitud).
 */
export function useDetalleSolicitud(abierta: Solicitud | null): DetalleSolicitud {
  const id = abierta?.id ?? null
  const propertyId = abierta?.property.id ?? null
  const pedir = useCallback(async (): Promise<Resultado | null> => {
    if (id === null || propertyId === null) return null
    try {
      return { id, ok: true, solicitud: await getSolicitudRecibida(id, propertyId) }
    } catch (error) {
      return { id, ok: false, message: error instanceof ServiceError ? error.message : 'Ocurrió un error inesperado.' }
    }
  }, [id, propertyId])
  const carga = useServiceCall(pedir)
  const recargar = carga.reintentar

  if (id === null) return { estado: 'sin_solicitud', solicitud: null, message: null, recargar }
  const resultado = carga.status === 'listo' ? carga.data : null
  if (!resultado || resultado.id !== id) return { estado: 'cargando', solicitud: null, message: null, recargar }
  if (!resultado.ok) return { estado: 'error', solicitud: null, message: resultado.message, recargar }
  return { estado: 'listo', solicitud: resultado.solicitud, message: null, recargar }
}
