'use client'

/**
 * NuevaConversacionModal.tsx — "Nueva conversación" de Mensajes (US-24).
 *
 * Cubre US-24:
 * - Locador: "solo puede iniciarla con sus locatarios con contrato vigente". La
 *   lista sale de `GET /mis-alquileres` (lento: se pide al abrir el modal, con
 *   skeleton, y se guarda mientras la página esté abierta, `useDestinatarios`).
 * - Locatario: "un locatario puede iniciar una conversación con un locador". La
 *   lista son los locadores de lo que alquila; a cualquier otro se le escribe
 *   desde su propiedad publicada ("Escribirle al locador").
 * - Si ya hay una conversación con esa persona por esa propiedad, el mensaje va
 *   ahí y se abre esa (decisión del PO: una por persona y propiedad).
 * - Enviar deshabilitado con el mensaje vacío o solo con espacios.
 * - Si el back no deja (403 `REQUIERE_CONTRATO_VIGENTE`), el aviso traducido.
 *
 * Qué muestra (Claude Design, "Mensajes" · 02): la lista de personas con la
 * propiedad y "contrato vigente", la caja del mensaje, Volver y Enviar.
 *
 * Quién lo usa: `BandejaMensajes`.
 */
import { useState } from 'react'
import { Alert, Button, Input, Modal, Skeleton } from 'antd'
import Link from 'next/link'
import { textoEnviable } from '@/lib/mensajes/reglas'
import type { ConversacionVista, DestinatarioConversacion } from '@/lib/mensajes/tipos'
import { iniciarConversacion } from '@/services/mensajes.service'
import { ServiceError } from '@/services/shared/errors'
import { AvatarPersona } from '@/components/personas/AvatarPersona'
import { useDestinatarios } from './useDestinatarios'
import styles from './Mensajes.module.css'

/** Props de {@link NuevaConversacionModal}. */
interface NuevaConversacionModalProps {
  open: boolean
  rol: 'locador' | 'locatario'
  usuarioId: string
  /** La bandeja ya cargada, para abrir la conversación que ya existe. */
  existentes: readonly ConversacionVista[]
  onCerrar: () => void
  /** Se creó (o se encontró) la conversación: la bandeja la abre. */
  onCreada: (conversacionId: string) => void
}

/** Clave de un destinatario: persona + propiedad (una conversación por cada par). */
function claveDe(destinatario: DestinatarioConversacion): string {
  return `${destinatario.personaId}|${destinatario.propiedad.id}`
}

/** Modal para iniciar una conversación. */
export function NuevaConversacionModal({ open, rol, usuarioId, existentes, onCerrar, onCreada }: NuevaConversacionModalProps) {
  const destinatarios = useDestinatarios(usuarioId, rol, open)
  const [elegido, setElegido] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lista = destinatarios.status === 'listo' ? destinatarios.data : []
  const destinatario = lista.find((item) => claveDe(item) === elegido) ?? null

  // ─── Handlers ───────────────────────────────────────────────────────
  async function enviar(): Promise<void> {
    if (!destinatario || !textoEnviable(texto)) return
    setEnviando(true)
    setError(null)
    try {
      const id = await iniciarConversacion(
        { destinatario: { personaId: destinatario.personaId, nombre: destinatario.nombre, rol: destinatario.rol }, propiedad: destinatario.propiedad },
        texto,
        existentes,
      )
      setTexto('')
      setElegido(null)
      onCreada(id)
    } catch (causa) {
      setError(causa instanceof ServiceError ? causa.message : 'No se pudo enviar. Probá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  const ayuda =
    rol === 'locador' ? 'Podés escribirles a tus locatarios con contrato vigente.' : 'Podés escribirles a los locadores de lo que alquilás. A otro locador, escribile desde su propiedad publicada.'

  return (
    <Modal
      open={open}
      onCancel={onCerrar}
      title="Nueva conversación"
      footer={null}
      destroyOnHidden
      modalRender={(panel) => <div data-testid="mensajes-nueva-modal">{panel}</div>}
    >
      <p className={styles.modalAyuda}>{ayuda}</p>

      {destinatarios.status === 'cargando' && (
        <div className={styles.modalCargando} data-testid="mensajes-nueva-cargando" aria-busy="true">
          {[0, 1, 2].map((fila) => (
            <Skeleton key={fila} active avatar title={{ width: '45%' }} paragraph={{ rows: 1, width: '70%' }} />
          ))}
        </div>
      )}

      {destinatarios.status === 'error' && (
        <Alert
          type="error"
          title={destinatarios.message}
          action={
            <Button size="small" onClick={destinatarios.reintentar} data-testid="mensajes-nueva-reintentar">
              Reintentar
            </Button>
          }
          data-testid="mensajes-nueva-error-carga"
        />
      )}

      {destinatarios.status === 'listo' && lista.length === 0 && (
        <div className={styles.modalVacio} data-testid="mensajes-nueva-sin-destinatarios">
          {rol === 'locador' ? (
            <p>Todavía no tenés locatarios con contrato vigente. Cuando un locatario te escriba, vas a poder responderle desde acá.</p>
          ) : (
            <p>
              Todavía no alquilás ninguna propiedad. Para escribirle a un locador, entrá a su propiedad publicada y tocá “Escribirle al locador”.{' '}
              <Link href="/buscar">Buscar propiedades</Link>
            </p>
          )}
        </div>
      )}

      {lista.length > 0 && (
        <>
          <div className={styles.destinatarios} role="radiogroup" aria-label="A quién le escribís">
            {lista.map((item) => {
              const clave = claveDe(item)
              const activo = clave === elegido
              return (
                <button
                  key={clave}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  className={`${styles.destinatario} ${activo ? styles.destinatarioElegido : ''}`}
                  onClick={() => setElegido(clave)}
                  disabled={enviando}
                  data-testid="mensajes-nueva-destinatario"
                >
                  <AvatarPersona nombre={item.nombre} conNombre={false} decorativo tono={activo ? 'fuerte' : 'suave'} />
                  <span className={styles.destinatarioTextos}>
                    <strong>{item.nombre}</strong>
                    <span>
                      {item.propiedad.direccion} · {item.detalle}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          <Input.TextArea
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            autoSize={{ minRows: 2, maxRows: 6 }}
            placeholder={destinatario ? `Escribile a ${destinatario.nombre.split(' ')[0]}…` : 'Elegí a quién le escribís'}
            disabled={!destinatario || enviando}
            aria-label="Mensaje"
            data-testid="mensajes-nueva-texto"
          />
          {error && <Alert type="error" title={error} className={styles.modalError} data-testid="mensajes-nueva-error" />}
        </>
      )}

      <div className={styles.modalBotones}>
        <Button onClick={onCerrar} disabled={enviando} data-testid="mensajes-nueva-volver">
          Volver
        </Button>
        <Button type="primary" onClick={() => void enviar()} disabled={!destinatario || !textoEnviable(texto)} loading={enviando} data-testid="mensajes-nueva-enviar">
          Enviar
        </Button>
      </div>
    </Modal>
  )
}
