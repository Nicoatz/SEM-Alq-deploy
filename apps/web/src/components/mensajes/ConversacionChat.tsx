'use client'

/**
 * ConversacionChat.tsx — el chat de una conversación: mensajes y caja para escribir.
 *
 * Qué es: un solo componente para el chat del reclamo (US-18) y para Mensajes
 * (US-24, Tanda C). Decisión del PO del 24/11: "por debajo, el chat de un reclamo
 * también es una conversación: mismo modelo, mismo componente y mismas reglas".
 *
 * Qué muestra (Claude Design, "Reclamos" · 03 y "Mensajes" · 01):
 * - Separador por día ("Martes 15 de septiembre") y, entre los mensajes, las
 *   líneas del sistema (ej. "Nicolás respondió · el reclamo pasó a en proceso").
 * - Burbujas: las propias a la derecha, en azul; las de la otra persona a la
 *   izquierda, con sus iniciales. Debajo, fecha y hora con minutos (US-24).
 * - Mensajes propios: menú "⋯" con una sola opción, Eliminar, con confirmación
 *   (US-24). Queda "Mensaje eliminado · hh:mm". No hay editar (US-24).
 * - Caja: Enviar deshabilitado si está vacía o solo tiene espacios (US-24).
 *   Enter envía; Shift+Enter, salto de línea. Si falla el envío por red o
 *   servidor, el texto queda escrito con "Reintentar" y "Descartar" (Mensajes · 04).
 * - Sin permiso para escribir, en lugar de la caja va el aviso (ej. "Esperando
 *   la respuesta de Nicolás", o el chat de solo lectura de un reclamo cerrado).
 *
 * Quién lo usa: `components/reclamos/ChatReclamo.tsx` (y Mensajes, en la Tanda C).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Alert, Button, Dropdown, Input, Skeleton } from 'antd'
import { EllipsisOutlined, SendOutlined } from '@ant-design/icons'
import { ConfirmActionModal } from '@rentar/ui'
import { diaDe, fechaHoraMensaje, puedeEliminar, textoDia, textoEnviable, textoMensajeEliminado } from '@/lib/mensajes/reglas'
import type { EventoChat, MensajeChat } from '@/lib/mensajes/tipos'
import { ServiceError } from '@/services/shared/errors'
import { AvatarPersona } from '@/components/personas/AvatarPersona'
import styles from './ConversacionChat.module.css'

/** Si se puede escribir y cómo se ve la caja. */
export type EscrituraChat =
  | { permitida: true; placeholder: string; etiqueta: string }
  | { permitida: false; aviso: ReactNode }

/** Props de {@link ConversacionChat}. */
interface ConversacionChatProps {
  /** `null` mientras carga. */
  mensajes: MensajeChat[] | null
  /** Error al cargar los mensajes, con su reintento. */
  errorCarga?: { mensaje: string; reintentar: () => void } | null
  eventos?: readonly EventoChat[]
  /** Qué se ve cuando no hay ningún mensaje. */
  vacio?: ReactNode
  escritura: EscrituraChat
  /** Manda el texto. Si falla, tira el `ServiceError` del service. */
  onEnviar: (texto: string) => Promise<void>
  /** Elimina un mensaje propio. Si falla, tira el `ServiceError`. */
  onEliminar: (mensajeId: string) => Promise<void>
  /** `false` = sin el menú "Eliminar" (un chat de solo lectura, como el de un reclamo cerrado). */
  permitirEliminar?: boolean
  /** Prefijo de los `data-testid`: `<prefijo>-mensaje`, `<prefijo>-enviar`… */
  testIdPrefix: string
}

/** Un elemento de la línea de tiempo: un separador de día, un mensaje o una línea del sistema. */
type Item =
  | { tipo: 'dia'; id: string; texto: string }
  | { tipo: 'mensaje'; id: string; mensaje: MensajeChat }
  | { tipo: 'evento'; id: string; evento: EventoChat }

/** Ordena mensajes y eventos por fecha y mete un separador cada vez que cambia el día. */
function lineaDeTiempo(mensajes: readonly MensajeChat[], eventos: readonly EventoChat[]): Item[] {
  // Los eventos van primero: con la misma hora, la línea del sistema queda antes del mensaje
  // (la respuesta del locador es la que pasó el reclamo a en proceso). El orden es estable.
  const todos = [
    ...eventos.map((evento) => ({ fecha: evento.fecha, item: { tipo: 'evento' as const, id: evento.id, evento } })),
    ...mensajes.map((mensaje) => ({ fecha: mensaje.enviadoEl, item: { tipo: 'mensaje' as const, id: mensaje.id, mensaje } })),
  ].sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
  const items: Item[] = []
  let diaAnterior = ''
  for (const { fecha, item } of todos) {
    const dia = diaDe(fecha)
    if (dia !== diaAnterior) {
      items.push({ tipo: 'dia', id: `dia-${dia}`, texto: textoDia(fecha) })
      diaAnterior = dia
    }
    items.push(item)
  }
  return items
}

/** Skeleton del chat: burbujas que alternan lado y ancho (Mensajes · 04). */
function ChatCargando({ testId }: { testId: string }) {
  return (
    <div className={styles.cargando} data-testid={testId} aria-busy="true">
      <Skeleton.Button active shape="round" className={`${styles.burbujaSkeleton} ${styles.skeletonAncha}`} />
      <Skeleton.Button active shape="round" className={`${styles.burbujaSkeleton} ${styles.skeletonDerecha}`} />
      <Skeleton.Button active shape="round" className={`${styles.burbujaSkeleton} ${styles.skeletonMedia}`} />
    </div>
  )
}

/** Chat de una conversación. */
export function ConversacionChat({ mensajes, errorCarga = null, eventos = [], vacio, escritura, onEnviar, onEliminar, permitirEliminar = true, testIdPrefix }: ConversacionChatProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  /** Error de envío: por red o servidor (con Reintentar) o cualquier otro (solo el texto). */
  const [errorEnvio, setErrorEnvio] = useState<{ mensaje: string; reintentable: boolean } | null>(null)
  const [aEliminar, setAEliminar] = useState<MensajeChat | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const lista = useRef<HTMLDivElement>(null)

  const items = useMemo(() => (mensajes ? lineaDeTiempo(mensajes, eventos) : []), [mensajes, eventos])

  // Al cargar o llegar un mensaje nuevo, la lista baja al último.
  useEffect(() => {
    const nodo = lista.current
    if (nodo) nodo.scrollTop = nodo.scrollHeight
  }, [items.length])

  // ─── Handlers ───────────────────────────────────────────────────────

  async function enviar(): Promise<void> {
    if (!textoEnviable(texto) || enviando) return
    setEnviando(true)
    setErrorEnvio(null)
    try {
      await onEnviar(texto)
      setTexto('')
    } catch (error) {
      const servicio = error instanceof ServiceError ? error : null
      setErrorEnvio({
        mensaje: servicio?.message ?? 'No se pudo enviar. Probá de nuevo.',
        reintentable: !servicio || servicio.code === 'network' || servicio.code === 'server',
      })
    } finally {
      setEnviando(false)
    }
  }

  /** Enter envía; Shift+Enter hace un salto de línea (Mensajes · 01). */
  function alTeclear(evento: KeyboardEvent<HTMLTextAreaElement>): void {
    if (evento.key === 'Enter' && !evento.shiftKey && !evento.nativeEvent.isComposing) {
      evento.preventDefault()
      void enviar()
    }
  }

  async function confirmarEliminar(): Promise<void> {
    if (!aEliminar) return
    setEliminando(true)
    setErrorEliminar(null)
    try {
      await onEliminar(aEliminar.id)
      setAEliminar(null)
    } catch (error) {
      setErrorEliminar(error instanceof ServiceError ? error.message : 'No pudimos eliminar el mensaje. Probá de nuevo.')
    } finally {
      setEliminando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.chat} data-testid={`${testIdPrefix}-chat`}>
      <div className={styles.lista} ref={lista} role="log" aria-label="Mensajes" aria-live="polite">
        {mensajes === null && !errorCarga && <ChatCargando testId={`${testIdPrefix}-cargando`} />}

        {errorCarga && (
          <Alert
            type="error"
            title={errorCarga.mensaje}
            action={
              <Button size="small" onClick={errorCarga.reintentar} data-testid={`${testIdPrefix}-reintentar`}>
                Reintentar
              </Button>
            }
            data-testid={`${testIdPrefix}-error`}
          />
        )}

        {mensajes !== null && items.length === 0 && vacio && <div className={styles.vacio}>{vacio}</div>}

        {items.map((item) => {
          if (item.tipo === 'dia') {
            return (
              <div key={item.id} className={styles.dia} role="separator">
                <span>{item.texto}</span>
              </div>
            )
          }
          if (item.tipo === 'evento') {
            return (
              <div key={item.id} className={styles.evento} data-testid={`${testIdPrefix}-evento`}>
                {item.evento.texto}
              </div>
            )
          }
          const { mensaje } = item
          const eliminado = mensaje.eliminadoEl !== null
          return (
            <div key={item.id} className={`${styles.fila} ${mensaje.esPropio ? styles.filaPropia : ''}`} data-testid={`${testIdPrefix}-mensaje`} data-propio={mensaje.esPropio} data-eliminado={eliminado}>
              {!mensaje.esPropio && <AvatarPersona nombre={mensaje.emisorNombre} conNombre={false} tamanio="sm" tono="fuerte" />}
              <div className={styles.columna}>
                <div className={styles.burbujaFila}>
                  {permitirEliminar && puedeEliminar(mensaje) && (
                    <Dropdown
                      trigger={['click']}
                      menu={{ items: [{ key: 'eliminar', label: 'Eliminar', danger: true }], onClick: () => setAEliminar(mensaje) }}
                    >
                      <button type="button" className={styles.menu} aria-label="Opciones del mensaje" data-testid={`${testIdPrefix}-mensaje-menu`}>
                        <EllipsisOutlined />
                      </button>
                    </Dropdown>
                  )}
                  {eliminado ? (
                    <span className={`${styles.burbuja} ${styles.burbujaEliminada}`} data-testid={`${testIdPrefix}-mensaje-eliminado`}>
                      {textoMensajeEliminado(mensaje.eliminadoEl ?? mensaje.enviadoEl)}
                    </span>
                  ) : (
                    <span className={`${styles.burbuja} ${mensaje.esPropio ? styles.burbujaPropia : ''}`}>{mensaje.contenido}</span>
                  )}
                </div>
                <span className={styles.hora} data-testid={`${testIdPrefix}-mensaje-hora`}>
                  {fechaHoraMensaje(mensaje.enviadoEl)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {escritura.permitida ? (
        <div className={styles.composer}>
          {errorEnvio && (
            <Alert
              type="error"
              title={errorEnvio.reintentable ? 'No se pudo enviar' : errorEnvio.mensaje}
              description={errorEnvio.reintentable ? 'El mensaje quedó escrito. Tocá Reintentar cuando vuelva la conexión.' : undefined}
              action={
                errorEnvio.reintentable ? (
                  <span className={styles.accionesError}>
                    <Button type="primary" size="small" onClick={() => void enviar()} data-testid={`${testIdPrefix}-envio-reintentar`}>
                      Reintentar
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        setTexto('')
                        setErrorEnvio(null)
                      }}
                      data-testid={`${testIdPrefix}-envio-descartar`}
                    >
                      Descartar
                    </Button>
                  </span>
                ) : undefined
              }
              data-testid={`${testIdPrefix}-envio-error`}
            />
          )}
          <div className={styles.composerFila}>
            <Input.TextArea
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              onKeyDown={alTeclear}
              autoSize={{ minRows: 1, maxRows: 5 }}
              placeholder={escritura.placeholder}
              aria-label={escritura.placeholder}
              className={styles.caja}
              disabled={enviando}
              data-testid={`${testIdPrefix}-texto`}
            />
            <Button
              type="primary"
              onClick={() => void enviar()}
              disabled={!textoEnviable(texto)}
              loading={enviando}
              className={styles.enviar}
              aria-label={escritura.etiqueta}
              data-testid={`${testIdPrefix}-enviar`}
            >
              <span className={styles.enviarTexto}>{escritura.etiqueta}</span>
              <SendOutlined className={styles.enviarIcono} />
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.aviso} data-testid={`${testIdPrefix}-aviso`}>
          {escritura.aviso}
        </div>
      )}

      <ConfirmActionModal
        open={aEliminar !== null}
        title="¿Eliminar el mensaje?"
        description="Lo vas a dejar de ver los dos. En su lugar queda la marca “Mensaje eliminado”. No se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Volver"
        danger
        confirmLoading={eliminando}
        onConfirm={() => void confirmarEliminar()}
        onCancel={() => {
          setAEliminar(null)
          setErrorEliminar(null)
        }}
        data-testid={`${testIdPrefix}-eliminar-modal`}
      >
        {errorEliminar && <Alert type="error" title={errorEliminar} data-testid={`${testIdPrefix}-eliminar-error`} />}
      </ConfirmActionModal>
    </div>
  )
}
