'use client'

/**
 * PanelNuevaConversacion.tsx — una conversación que todavía no existe, lista para
 * el primer mensaje (US-24).
 *
 * Qué es: lo que se abre desde "Escribirle al locador" del detalle publicado
 * (`/panel/mensajes?con=<persona>&propiedad=<id>`) cuando no hay una conversación
 * con esa persona por esa propiedad. Al mandar el primer mensaje se crea
 * (`iniciarConversacion`) y se abre.
 * - Si el back no deja (403 `REQUIERE_CONTRATO_VIGENTE`: un locador que quiere
 *   iniciarla sin contrato vigente), la caja se reemplaza por el aviso traducido:
 *   "No podés iniciar una conversación con Julieta Peralta porque no tienen un
 *   contrato vigente. Si Julieta te escribe, vas a poder responderle." (Mensajes · 04).
 *
 * Quién lo usa: `BandejaMensajes`.
 */
import { useState } from 'react'
import type { ConversacionNueva, ConversacionVista } from '@/lib/mensajes/tipos'
import { iniciarConversacion } from '@/services/mensajes.service'
import { ServiceError } from '@/services/shared/errors'
import { CabeceraConversacion } from './CabeceraConversacion'
import { ConversacionChat } from './ConversacionChat'
import styles from './Mensajes.module.css'

/** Props de {@link PanelNuevaConversacion}. */
interface PanelNuevaConversacionProps {
  nueva: ConversacionNueva
  existentes: readonly ConversacionVista[]
  onCreada: (conversacionId: string) => void
}

/** Conversación nueva, sin mensajes todavía. */
export function PanelNuevaConversacion({ nueva, existentes, onCreada }: PanelNuevaConversacionProps) {
  const [bloqueo, setBloqueo] = useState<string | null>(null)
  const primerNombre = nueva.destinatario.nombre.split(' ')[0] ?? nueva.destinatario.nombre

  async function enviar(texto: string): Promise<void> {
    try {
      onCreada(await iniciarConversacion(nueva, texto, existentes))
    } catch (error) {
      if (error instanceof ServiceError && error.code === 'forbidden') setBloqueo(error.message)
      throw error
    }
  }

  return (
    <div className={styles.panel} data-testid="mensajes-panel-nueva">
      <CabeceraConversacion persona={nueva.destinatario} propiedad={nueva.propiedad ? { ...nueva.propiedad, fotoSrc: null } : null} />
      <ConversacionChat
        mensajes={[]}
        vacio={`Todavía no le escribiste a ${primerNombre}. Tu primer mensaje inicia la conversación.`}
        escritura={
          bloqueo
            ? { permitida: false, aviso: <span data-testid="mensajes-bloqueo">{bloqueo}</span> }
            : { permitida: true, placeholder: `Escribile a ${primerNombre}…`, etiqueta: 'Enviar' }
        }
        onEnviar={enviar}
        onEliminar={() => Promise.resolve()}
        testIdPrefix="mensajes"
      />
    </div>
  )
}
