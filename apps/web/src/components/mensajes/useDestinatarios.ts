'use client'

/**
 * useDestinatarios.ts — a quién se le puede escribir desde "Nueva conversación" (US-24).
 *
 * Qué es: pide los destinatarios recién cuando se abre el modal y guarda la
 * respuesta mientras la página esté abierta (decisión del PO, 25/11): para el
 * locador salen de `GET /mis-alquileres`, que tarda entre 13 y 15 segundos.
 * La caché vive en el módulo (no en el componente), así sobrevive a pasar de la
 * bandeja a una conversación; se pierde al recargar. La clave es usuario + rol.
 *
 * Quién lo usa: `NuevaConversacionModal`.
 */
import { useEffect, useState } from 'react'
import type { DestinatarioConversacion } from '@/lib/mensajes/tipos'
import { getDestinatarios } from '@/services/mensajes.service'
import { ServiceError } from '@/services/shared/errors'

/** Pedidos ya hechos, por `<usuario>:<rol>`. Uno que falla se borra, para poder reintentar. */
const cache = new Map<string, Promise<DestinatarioConversacion[]>>()

/** Estado de la carga de los destinatarios. */
export type EstadoDestinatarios = { status: 'cargando' } | { status: 'error'; message: string } | { status: 'listo'; data: DestinatarioConversacion[] }

/**
 * Los destinatarios del usuario con ese rol. No pide nada mientras `activo` sea `false`.
 * @returns el estado y `reintentar`.
 */
export function useDestinatarios(usuarioId: string, rol: 'locador' | 'locatario', activo: boolean): EstadoDestinatarios & { reintentar: () => void } {
  const clave = `${usuarioId}:${rol}`
  const [resultado, setResultado] = useState<{ clave: string; intento: number; estado: EstadoDestinatarios } | null>(null)
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    if (!activo) return undefined
    let cancelado = false
    let pedido = cache.get(clave)
    if (!pedido) {
      pedido = getDestinatarios(rol)
      cache.set(clave, pedido)
    }
    pedido
      .then((data) => {
        if (!cancelado) setResultado({ clave, intento, estado: { status: 'listo', data } })
      })
      .catch((error: unknown) => {
        cache.delete(clave)
        if (!cancelado) {
          setResultado({ clave, intento, estado: { status: 'error', message: error instanceof ServiceError ? error.message : 'No pudimos cargar los contactos.' } })
        }
      })
    return () => {
      cancelado = true
    }
  }, [activo, clave, rol, intento])

  const reintentar = () => setIntento((actual) => actual + 1)
  if (!resultado || resultado.clave !== clave || resultado.intento !== intento) return { status: 'cargando', reintentar }
  return { ...resultado.estado, reintentar }
}
