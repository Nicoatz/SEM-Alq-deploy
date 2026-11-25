/**
 * ItemConversacion.tsx — una conversación en la bandeja de Mensajes (US-24).
 *
 * Qué muestra (Claude Design, "Mensajes" · 01 y 05): las iniciales y el nombre de
 * la otra persona, la propiedad, el último mensaje ("Vos: …" si es propio) y la
 * fecha (la hora si es de hoy, "ayer", el día o "12/09").
 * NOTA: sin negrita ni contador de no leídas: no hay US ni back (decisión del PO, 24/11).
 * NOTA: en real el listado no trae la propiedad (brecha R-6): la línea queda vacía.
 *
 * Quién lo usa: `BandejaMensajes`.
 */
import Link from 'next/link'
import { fechaEnBandeja, textoUltimoMensaje } from '@/lib/mensajes/bandeja'
import type { ConversacionVista } from '@/lib/mensajes/tipos'
import { AvatarPersona } from '@/components/personas/AvatarPersona'
import styles from './Mensajes.module.css'

/** Props de {@link ItemConversacion}. */
interface ItemConversacionProps {
  conversacion: ConversacionVista
  seleccionada: boolean
  /** "Ahora" en ISO, para la fecha relativa (en mock, el reloj del elenco). */
  ahoraIso: string
}

/** Fila de la bandeja, como link a la conversación. */
export function ItemConversacion({ conversacion, seleccionada, ahoraIso }: ItemConversacionProps) {
  const { otraPersona, propiedad, ultimoMensaje } = conversacion
  return (
    <Link
      href={`/panel/mensajes/${encodeURIComponent(conversacion.id)}`}
      className={`${styles.item} ${seleccionada ? styles.itemSeleccionado : ''}`}
      aria-current={seleccionada ? 'true' : undefined}
      data-testid={`mensajes-conversacion-${conversacion.id}`}
    >
      <AvatarPersona nombre={otraPersona.nombre} fotoSrc={otraPersona.fotoSrc} conNombre={false} decorativo tono={seleccionada ? 'fuerte' : 'suave'} />
      <span className={styles.itemTextos}>
        <span className={styles.itemFila}>
          <span className={styles.itemNombre}>{otraPersona.nombre}</span>
          <span className={styles.itemFecha}>{fechaEnBandeja(conversacion.actualizadaEl, ahoraIso)}</span>
        </span>
        <span className={styles.itemPropiedad} data-testid="mensajes-conversacion-propiedad">
          {propiedad?.direccion ?? ''}
        </span>
        <span className={`${styles.itemUltimo} ${ultimoMensaje?.eliminado ? styles.itemEliminado : ''}`}>{textoUltimoMensaje(conversacion)}</span>
      </span>
    </Link>
  )
}
