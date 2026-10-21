'use client'

/**
 * useAvisoCambiosSinGuardar.ts — avisar antes de salir de una pantalla con
 * cambios sin guardar.
 *
 * Qué es: un hook que, mientras `hayCambios` sea `true`, frena la salida de
 * la pantalla y deja que la pantalla pregunte. El App Router de Next no
 * tiene un bloqueo de navegación propio, así que se cubren dos caminos:
 * 1. Recargar, cerrar la pestaña, escribir otra URL o una navegación con
 *    recarga completa (por ejemplo, "Cerrar sesión"): `beforeunload`. Ahí
 *    el navegador muestra SU diálogo (el texto no se puede cambiar).
 * 2. Links internos (`<a href>` del mismo sitio): el menú lateral, el
 *    UserMenu, las migas y cualquier link de la página. Un listener de
 *    clics en fase de captura sobre `document` frena el clic antes de que
 *    llegue al `<Link>` de Next y guarda el destino en `destinoPendiente`;
 *    la pantalla muestra su modal y llama a `confirmarSalida` o a
 *    `cancelarSalida`.
 *
 * NOTA (limitaciones, decisión del PO): NO cubre el botón Atrás del
 * navegador ni el selector "Viendo como" (cambia de rol con
 * `router.push`, sin un link). Atrás se podría cubrir con una entrada extra
 * en el historial y `popstate`, pero es frágil con el router de Next.
 * Tampoco frena los clics con Ctrl/Cmd/Shift ni los links con
 * `target="_blank"`: abren otra pestaña y no se pierde nada.
 *
 * Cubre: US-21 Modificar usuario ("se debe avisar si el usuario intenta
 * salir de la pantalla con cambios sin guardar").
 * Quién lo usa: `components/perfil/PerfilScreen.tsx`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

/** Lo que devuelve {@link useAvisoCambiosSinGuardar}. */
export interface AvisoCambiosSinGuardar {
  /** Ruta a la que se quiso ir (con query y hash); `null` si no hay una salida en espera. */
  destinoPendiente: string | null
  /** Sale igual: navega a `destinoPendiente` descartando los cambios. */
  confirmarSalida: () => void
  /** Se queda en la pantalla. */
  cancelarSalida: () => void
}

/**
 * El destino interno de un clic, o `null` si el clic no es una navegación
 * interna que haya que frenar.
 */
function destinoInterno(evento: MouseEvent): string | null {
  if (evento.defaultPrevented || evento.button !== 0) return null
  if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return null
  const link = evento.target instanceof Element ? evento.target.closest('a[href]') : null
  if (!(link instanceof HTMLAnchorElement)) return null
  if ((link.target && link.target !== '_self') || link.hasAttribute('download')) return null
  const url = new URL(link.href, window.location.href)
  if (url.origin !== window.location.origin) return null
  // Un ancla de la misma pantalla (#algo) no sale de la pantalla.
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Avisa antes de salir mientras `hayCambios` sea `true` (ver el encabezado).
 * @param hayCambios `true` si algún bloque de la pantalla tiene cambios sin guardar.
 */
export function useAvisoCambiosSinGuardar(hayCambios: boolean): AvisoCambiosSinGuardar {
  const router = useRouter()
  const [destinoPendiente, setDestinoPendiente] = useState<string | null>(null)
  /** `true` mientras se navega después de confirmar: ese clic/salida ya no se frena. */
  const saliendo = useRef(false)

  // ─── 1. Recargar, cerrar o recarga completa ─────────────────────────
  useEffect(() => {
    if (!hayCambios) return
    function antesDeSalir(evento: BeforeUnloadEvent): void {
      if (saliendo.current) return
      evento.preventDefault()
      // Algunos navegadores todavía piden `returnValue` para mostrar el diálogo.
      evento.returnValue = ''
    }
    window.addEventListener('beforeunload', antesDeSalir)
    return () => window.removeEventListener('beforeunload', antesDeSalir)
  }, [hayCambios])

  // ─── 2. Links internos ──────────────────────────────────────────────
  useEffect(() => {
    if (!hayCambios) return
    function alHacerClic(evento: MouseEvent): void {
      if (saliendo.current) return
      const destino = destinoInterno(evento)
      if (!destino) return
      // Frena el clic antes de que llegue al <Link> de Next (que escucha en la raíz de React).
      evento.preventDefault()
      evento.stopPropagation()
      setDestinoPendiente(destino)
    }
    document.addEventListener('click', alHacerClic, true)
    return () => document.removeEventListener('click', alHacerClic, true)
  }, [hayCambios])

  // ─── Handlers ───────────────────────────────────────────────────────
  const confirmarSalida = useCallback(() => {
    if (!destinoPendiente) return
    saliendo.current = true
    setDestinoPendiente(null)
    router.push(destinoPendiente)
  }, [destinoPendiente, router])

  const cancelarSalida = useCallback(() => setDestinoPendiente(null), [])

  return { destinoPendiente, confirmarSalida, cancelarSalida }
}
