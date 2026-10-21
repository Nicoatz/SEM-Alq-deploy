'use client'

/**
 * AvisoCambiosProvider.tsx — avisar antes de salir de una pantalla del panel
 * con cambios sin guardar.
 *
 * Qué es: un provider que envuelve el panel (`app/(app)/panel/layout.tsx`) y
 * es dueño del modal "Tenés cambios sin guardar". Las pantallas avisan si
 * tienen cambios con {@link useAvisoCambiosSinGuardar}; el layout le pide
 * permiso antes de cerrar sesión con {@link useConfirmarSalida}. Mientras
 * haya cambios, frena tres caminos:
 * 1. **Recargar, cerrar la pestaña, escribir otra URL**: `beforeunload`. Ahí
 *    el navegador muestra SU diálogo (el texto no se puede cambiar).
 * 2. **Links internos** (`<a href>` del mismo sitio): el menú lateral, el
 *    UserMenu, las migas y cualquier link de la página. Un listener de clics
 *    en fase de captura sobre `document` frena el clic antes de que llegue
 *    al `<Link>` de Next y abre el modal.
 * 3. **Cerrar sesión** desde el UserMenu: el layout envuelve `onLogout` con
 *    `confirmarAntesDe`, así el modal aparece ANTES de `signOut`; con
 *    "Seguir editando" la sesión no se cierra. No hace falta tocar
 *    `@rentar/ui`: `AppShell` recibe `onLogout` del layout.
 *
 * NOTA (limitaciones, decisión del PO): NO cubre el botón Atrás del
 * navegador ni el selector "Viendo como" (cambia de rol con `router.push`,
 * sin un link). Atrás se podría cubrir con una entrada extra en el historial
 * y `popstate`, pero es frágil con el router de Next. "Viendo como" se
 * cubriría envolviendo `handleRoleChange` del layout con `confirmarAntesDe`.
 * Tampoco frena los clics con Ctrl/Cmd/Shift ni los links con
 * `target="_blank"`: abren otra pestaña y no se pierde nada.
 *
 * Cubre: US-21 Modificar usuario ("se debe avisar si el usuario intenta
 * salir de la pantalla con cambios sin guardar").
 * Quién lo usa: `app/(app)/panel/layout.tsx` (provider y cierre de sesión) y
 * `components/perfil/PerfilScreen.tsx` (avisa si hay cambios).
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ConfirmActionModal } from '@rentar/ui'

/** Lo que se quiso hacer y quedó esperando la respuesta del modal. */
type SalidaPendiente = { tipo: 'navegar'; destino: string } | { tipo: 'accion'; accion: () => void }

/** Lo que comparte el provider. */
interface AvisoCambiosContextValue {
  /** Marca (o desmarca) que la pantalla `id` tiene cambios sin guardar. */
  marcar: (id: string, hayCambios: boolean) => void
  /** Corre `accion` si no hay cambios; si los hay, pregunta antes. */
  confirmarAntesDe: (accion: () => void) => void
}

const AvisoCambiosContext = createContext<AvisoCambiosContextValue | null>(null)

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

/** Provider del aviso de salida (ver el encabezado). Va en el layout del panel. */
export function AvisoCambiosProvider({ children }: { children: ReactNode }) {
  const router = useRouter()

  // ─── Estado local ───────────────────────────────────────────────────
  /** Pantallas (por id) con cambios sin guardar. */
  const [conCambios, setConCambios] = useState<ReadonlySet<string>>(() => new Set())
  const [pendiente, setPendiente] = useState<SalidaPendiente | null>(null)
  /** `true` después de confirmar: esa salida (y su recarga, si la hay) ya no se frena. */
  const saliendo = useRef(false)
  const hayCambios = conCambios.size > 0

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
      setPendiente({ tipo: 'navegar', destino })
    }
    document.addEventListener('click', alHacerClic, true)
    return () => document.removeEventListener('click', alHacerClic, true)
  }, [hayCambios])

  // ─── Handlers ───────────────────────────────────────────────────────
  const marcar = useCallback((id: string, hay: boolean) => {
    setConCambios((actual) => {
      if (actual.has(id) === hay) return actual
      const siguiente = new Set(actual)
      if (hay) siguiente.add(id)
      else siguiente.delete(id)
      return siguiente
    })
  }, [])

  // ─── 3. Acciones (cerrar sesión) ────────────────────────────────────
  const confirmarAntesDe = useCallback(
    (accion: () => void) => {
      if (!hayCambios || saliendo.current) {
        accion()
        return
      }
      setPendiente({ tipo: 'accion', accion })
    },
    [hayCambios],
  )

  /** "Salir sin guardar": hace lo que había quedado esperando. */
  function confirmarSalida(): void {
    const salida = pendiente
    if (!salida) return
    saliendo.current = true
    setPendiente(null)
    setConCambios(new Set())
    if (salida.tipo === 'navegar') router.push(salida.destino)
    else salida.accion()
  }

  /**
   * Al llegar a otra pantalla, el aviso vuelve a quedar armado. (Si la
   * salida fue cerrar sesión, la página se recarga y esto no importa.)
   */
  useEffect(() => {
    if (!hayCambios) saliendo.current = false
  }, [hayCambios])

  const value = useMemo(() => ({ marcar, confirmarAntesDe }), [marcar, confirmarAntesDe])

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <AvisoCambiosContext.Provider value={value}>
      {children}
      <ConfirmActionModal
        open={pendiente !== null}
        title="Tenés cambios sin guardar"
        description={
          pendiente?.tipo === 'accion'
            ? 'Si cerrás sesión ahora, se pierden. Para no perderlos, quedate y tocá Guardar en el bloque que estabas editando.'
            : 'Si salís ahora, se pierden. Para no perderlos, quedate y tocá Guardar en el bloque que estabas editando.'
        }
        confirmLabel={pendiente?.tipo === 'accion' ? 'Cerrar sesión sin guardar' : 'Salir sin guardar'}
        cancelLabel="Seguir editando"
        danger
        onConfirm={confirmarSalida}
        onCancel={() => setPendiente(null)}
        data-testid="aviso-salida"
      />
    </AvisoCambiosContext.Provider>
  )
}

/**
 * Para las pantallas: avisa al provider si hay cambios sin guardar. Al
 * desmontarse, deja de avisar. Fuera del provider no hace nada.
 * @param hayCambios `true` si algún bloque de la pantalla tiene cambios sin guardar.
 */
export function useAvisoCambiosSinGuardar(hayCambios: boolean): void {
  const contexto = useContext(AvisoCambiosContext)
  const id = useId()
  const marcar = contexto?.marcar
  useEffect(() => {
    marcar?.(id, hayCambios)
  }, [marcar, id, hayCambios])
  useEffect(() => () => marcar?.(id, false), [marcar, id])
}

/**
 * Para el layout: corre una acción (cerrar sesión) preguntando antes si hay
 * cambios sin guardar. Fuera del provider, la corre directo.
 */
export function useConfirmarSalida(): (accion: () => void) => void {
  const contexto = useContext(AvisoCambiosContext)
  return contexto?.confirmarAntesDe ?? ((accion: () => void) => accion())
}
