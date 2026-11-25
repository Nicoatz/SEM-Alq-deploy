/**
 * Layout de /panel/mensajes — Mensajes (US-24 Enviar mensajes).
 *
 * Qué es: monta la bandeja (`components/mensajes/BandejaMensajes.tsx`), que lee
 * la conversación abierta de la URL (`/panel/mensajes/[id]`). Va en el layout y
 * no en cada página para que, al abrir otra conversación, la bandeja no se
 * vuelva a pedir ni pierda la búsqueda. Las páginas no dibujan nada.
 * Sin `RequireRole`: lo usan los dos roles. Entra desde: el ítem "Mensajes" del
 * menú (locador y locatario) y "Escribirle al locador" del detalle publicado.
 */
import { Suspense, type ReactNode } from 'react'
import { BandejaMensajes } from '@/components/mensajes/BandejaMensajes'

/** Monta la bandeja de Mensajes. `children` (las páginas) no dibuja nada. */
export default function MensajesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* Suspense: lee `?con=` y `?propiedad=` con useSearchParams. */}
      <Suspense>
        <BandejaMensajes />
      </Suspense>
      {children}
    </>
  )
}
