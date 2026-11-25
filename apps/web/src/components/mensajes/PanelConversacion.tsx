'use client'

/**
 * PanelConversacion.tsx — una conversación abierta en Mensajes (US-24).
 *
 * Qué es: el encabezado y `ConversacionChat` (el mismo del chat del reclamo).
 * En una conversación general escriben los dos siempre: "si un locatario ya
 * inició una conversación, el locador puede responder … independientemente de
 * si existe un alquiler vigente" (US-24).
 * Se relee al enviar, al eliminar y al volver a la pestaña (sin polling, decisión del PO).
 *
 * De dónde saca los datos: `getConversacion`, `getMensajes`, `enviarMensaje` y
 * `eliminarMensaje` (`services/mensajes.service.ts`).
 * Quién lo usa: `BandejaMensajes`.
 */
import { useCallback, useEffect } from 'react'
import { Button, Skeleton } from 'antd'
import Link from 'next/link'
import { EmptyState } from '@rentar/ui'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import { eliminarMensaje, enviarMensaje, getConversacion, getMensajes } from '@/services/mensajes.service'
import { CabeceraConversacion } from './CabeceraConversacion'
import { ConversacionChat } from './ConversacionChat'
import styles from './Mensajes.module.css'

/** Props de {@link PanelConversacion}. */
interface PanelConversacionProps {
  conversacionId: string
  usuarioId: string
  /** Se incrementa al volver a la pestaña: relee la conversación. */
  recarga: number
  /** Algo cambió (se envió o eliminó un mensaje): la bandeja se relee. */
  onCambio: () => void
}

/** La conversación abierta. */
export function PanelConversacion({ conversacionId, usuarioId, recarga, onCambio }: PanelConversacionProps) {
  const cargarConversacion = useCallback(() => getConversacion(conversacionId, usuarioId), [conversacionId, usuarioId])
  const cargarMensajes = useCallback(() => getMensajes(conversacionId), [conversacionId])
  const conversacion = useServiceCall(cargarConversacion)
  const mensajes = useServiceCall(cargarMensajes)
  const reintentarMensajes = mensajes.reintentar

  useEffect(() => {
    if (recarga > 0) reintentarMensajes()
  }, [recarga, reintentarMensajes])

  // ─── Handlers ───────────────────────────────────────────────────────
  async function enviar(texto: string): Promise<void> {
    await enviarMensaje(conversacionId, texto)
    reintentarMensajes()
    onCambio()
  }

  async function eliminar(mensajeId: string): Promise<void> {
    await eliminarMensaje(mensajeId)
    reintentarMensajes()
    onCambio()
  }

  // ─── Render ─────────────────────────────────────────────────────────
  if (conversacion.status === 'error' && conversacion.code === 'not_found') {
    return (
      <div className={styles.panelVacio} data-testid="mensajes-no-encontrada">
        <EmptyState
          title="No encontramos esta conversación"
          description="Puede que el link esté mal o que la conversación no sea tuya. Los chats de los reclamos se ven en cada reclamo."
          action={
            <Link href="/panel/mensajes">
              <Button>Volver a Mensajes</Button>
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className={styles.panel} data-testid="mensajes-panel">
      {conversacion.status === 'listo' ? (
        <CabeceraConversacion persona={conversacion.data.otraPersona} propiedad={conversacion.data.propiedad} />
      ) : (
        <div className={styles.cabecera}>
          <Skeleton active avatar title={{ width: '50%' }} paragraph={false} />
        </div>
      )}
      <ConversacionChat
        mensajes={mensajes.status === 'listo' ? mensajes.data : null}
        errorCarga={mensajes.status === 'error' ? { mensaje: mensajes.message, reintentar: reintentarMensajes } : null}
        vacio="Todavía no hay mensajes en esta conversación."
        escritura={{ permitida: true, placeholder: 'Escribí tu mensaje…', etiqueta: 'Enviar' }}
        onEnviar={enviar}
        onEliminar={eliminar}
        otraPersona={conversacion.status === 'listo' ? conversacion.data.otraPersona.nombre : undefined}
        testIdPrefix="mensajes"
      />
    </div>
  )
}
