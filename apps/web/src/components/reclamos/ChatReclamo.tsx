'use client'

/**
 * ChatReclamo.tsx — la caja "Chat del reclamo", abajo del detalle.
 *
 * Qué es: la conversación del reclamo (`conversacion.tipo_tema = 'reclamo'`) con
 * `ConversacionChat`, el mismo componente de Mensajes. Decide quién escribe:
 * - Locador con el reclamo abierto: la caja dice "Responder". La primera
 *   respuesta lo pasa a "en proceso" en el mismo paso (US-18; lo hace el back) y
 *   el detalle se refresca.
 * - Locatario con el reclamo abierto: no escribe; ve "Esperando la respuesta de
 *   <locador>" (decisión del PO, 24/11). Se habilita cuando responde el locador.
 * - En proceso: escriben los dos (US-18: "si el reclamo ya se encuentra en
 *   proceso, … se debe mostrar la conversación ya existente").
 * - Resuelto o cancelado: solo lectura para los dos (decisión del PO, 24/11),
 *   sin caja ni "Eliminar".
 * - Respuesta vacía o solo con espacios: Enviar queda deshabilitado (US-18 y US-24).
 * - Si el back responde que el estado cambió (400 `ESTADO_INVALIDO`, otra
 *   pestaña), se avisa en español y el detalle se refresca.
 * Las reglas están en `lib/reclamos/reglas.ts` (`puedeEscribirEnChat`).
 *
 * Qué muestra (Claude Design, "Reclamos" · 03 y US-18 01): "Chat del reclamo"
 * con la otra parte; en mock, la línea "Nicolás respondió · el reclamo pasó a en
 * proceso · 14/09 · 10:41" (en real no hay fecha del cambio de estado, R-9).
 *
 * De dónde saca los datos: `getMensajes`, `enviarMensaje`, `eliminarMensaje`
 * (`mensajes.service.ts`) y `responderReclamo` (`reclamos.service.ts`).
 * Quién lo usa: `DetalleReclamo`.
 */
import { useCallback, useEffect, useMemo } from 'react'
import { formatDate } from '@rentar/ui'
import { useServiceCall } from '@/lib/hooks/useServiceCall'
import type { EventoChat } from '@/lib/mensajes/tipos'
import { esEstadoFinal, esLocadorDelReclamo, esLocatarioDelReclamo } from '@/lib/reclamos/reglas'
import type { Reclamo } from '@/lib/reclamos/tipos'
import { eliminarMensaje, enviarMensaje, getMensajes } from '@/services/mensajes.service'
import { responderReclamo } from '@/services/reclamos.service'
import { ServiceError } from '@/services/shared/errors'
import { ConversacionChat, type EscrituraChat } from '@/components/mensajes/ConversacionChat'
import styles from './DetalleReclamo.module.css'

/** Props de {@link ChatReclamo}. */
interface ChatReclamoProps {
  reclamo: Reclamo
  usuarioId: string
  /** El reclamo cambió (la primera respuesta lo pasó a en proceso, o cambió en otra pestaña). */
  onCambio: (resultado: { reclamo?: Reclamo; aviso?: string }) => void
  /** Se incrementa cuando la pantalla vuelve a estar visible: relee los mensajes. */
  recarga: number
}

/** Primer nombre: "Nicolás". */
function primerNombre(nombre: string): string {
  return nombre.split(' ')[0] ?? nombre
}

/** Las líneas del sistema, solo cuando se sabe la fecha del cambio (mock; en real no hay, R-9). */
function eventosDelReclamo(reclamo: Reclamo): EventoChat[] {
  const eventos: EventoChat[] = []
  const hora = (fecha: string) => `${formatDate(fecha, 'DD/MM')} · ${formatDate(fecha, 'HH:mm')}`
  if (reclamo.enProcesoDesde) {
    eventos.push({ id: 'en-proceso', fecha: reclamo.enProcesoDesde, texto: `${primerNombre(reclamo.locador.nombre)} respondió · el reclamo pasó a en proceso · ${hora(reclamo.enProcesoDesde)}` })
  }
  if (reclamo.cerradoEl && esEstadoFinal(reclamo.estado)) {
    const accion = reclamo.estado === 'resuelto' ? 'lo marcó como resuelto' : 'lo canceló'
    eventos.push({ id: 'cierre', fecha: reclamo.cerradoEl, texto: `${primerNombre(reclamo.locatario.nombre)} ${accion} · ${hora(reclamo.cerradoEl)}` })
  }
  return eventos
}

/** El chat del reclamo. */
export function ChatReclamo({ reclamo, usuarioId, onCambio, recarga }: ChatReclamoProps) {
  const conversacionId = reclamo.conversacionId
  const cargar = useCallback(() => (conversacionId ? getMensajes(conversacionId) : Promise.resolve([])), [conversacionId])
  const carga = useServiceCall(cargar)
  const { reintentar } = carga

  // Al volver a la pestaña (visibilitychange, decisión del PO: sin polling), se releen los mensajes.
  useEffect(() => {
    if (recarga > 0) reintentar()
  }, [recarga, reintentar])

  const esLocador = esLocadorDelReclamo(reclamo, usuarioId)
  const otra = esLocador ? reclamo.locatario : reclamo.locador
  const eventos = useMemo(() => eventosDelReclamo(reclamo), [reclamo])

  // ─── Quién escribe ──────────────────────────────────────────────────
  let escritura: EscrituraChat
  if (esEstadoFinal(reclamo.estado)) {
    escritura = { permitida: false, aviso: `El reclamo está ${reclamo.estado}: el chat quedó de solo lectura.` }
  } else if (reclamo.estado === 'abierto' && esLocatarioDelReclamo(reclamo, usuarioId)) {
    escritura = { permitida: false, aviso: `Esperando la respuesta de ${otra.nombre}.` }
  } else if (reclamo.estado === 'abierto' && esLocador) {
    escritura = { permitida: true, placeholder: 'Escribí tu respuesta…', etiqueta: 'Responder' }
  } else {
    escritura = { permitida: true, placeholder: `Escribile a ${primerNombre(otra.nombre)}…`, etiqueta: 'Enviar' }
  }

  // ─── Handlers ───────────────────────────────────────────────────────
  async function enviar(texto: string): Promise<void> {
    try {
      if (esLocador && reclamo.estado === 'abierto') {
        // US-18: la primera respuesta pasa el reclamo a en proceso; se trae el reclamo actualizado.
        const actualizado = await responderReclamo(reclamo, texto)
        onCambio({ reclamo: actualizado })
      } else {
        await enviarMensaje(conversacionId ?? '', texto)
      }
      reintentar()
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'conflict') onCambio({ aviso: error.message })
      throw error
    }
  }

  async function eliminar(mensajeId: string): Promise<void> {
    await eliminarMensaje(mensajeId)
    reintentar()
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const sub = esEstadoFinal(reclamo.estado) ? `Con ${otra.nombre} · solo lectura` : `Con ${otra.nombre}`
  const vacio =
    reclamo.estado === 'abierto'
      ? esLocador
        ? 'Todavía no respondiste. Tu primera respuesta pasa el reclamo a en proceso.'
        : `${primerNombre(otra.nombre)} todavía no respondió.`
      : 'No hay mensajes en este chat.'

  return (
    <section className={`${styles.tarjeta} ${styles.tarjetaChat}`} aria-label="Chat del reclamo" data-testid="reclamo-chat-caja">
      <header className={styles.chatCabecera}>
        <h2 className={styles.chatTitulo}>
          <span className={styles.soloEscritorio}>Chat del reclamo</span>
          <span className={styles.soloMovil}>Chat con {otra.nombre}</span>
        </h2>
        <span className={`${styles.chatSub} ${styles.soloEscritorio}`}>{sub}</span>
      </header>
      <ConversacionChat
        mensajes={carga.status === 'listo' ? carga.data : null}
        errorCarga={carga.status === 'error' ? { mensaje: carga.message, reintentar } : null}
        eventos={eventos}
        vacio={vacio}
        escritura={escritura}
        onEnviar={enviar}
        onEliminar={eliminar}
        otraPersona={otra.nombre}
        // Resuelto o cancelado: solo lectura, también para eliminar (decisión del PO, 24/11).
        permitirEliminar={!esEstadoFinal(reclamo.estado)}
        testIdPrefix="reclamo"
      />
    </section>
  )
}
