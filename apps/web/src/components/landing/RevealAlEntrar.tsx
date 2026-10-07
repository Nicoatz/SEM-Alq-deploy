'use client'

/**
 * RevealAlEntrar.tsx — hace aparecer, una sola vez, los bloques de la landing
 * marcados con `data-reveal` cuando entran en pantalla.
 *
 * Qué es: un componente sin interfaz (no renderiza nada). Al hidratar mira
 * los elementos con `data-reveal`: los que ya se ven quedan como están; los
 * que están más abajo se ocultan (opacidad 0 y 12 px más abajo) y aparecen
 * con un fade de 400 ms cuando entran, escalonados cada 60 ms si entran
 * juntos (mapa de animaciones aprobado, punto 6).
 * NOTA: sin JS, antes de hidratar o con "reducir movimiento", todo se ve:
 * solo se oculta lo que está fuera de pantalla, y recién después de hidratar.
 * NOTA: trabaja sobre el DOM (clases y `transition-delay`), sin estado de
 * React, así que no re-renderiza nada. Si React reescribe la clase de un
 * elemento, en el peor caso ese elemento aparece sin animar: nunca queda oculto.
 * Cubre: sin US en Sprint 0 (contenido de la landing).
 * Quién lo usa: `app/(public)/page.tsx`. Las secciones marcan con
 * `data-reveal` lo que tiene que aparecer (títulos, barrios, diferenciales, CTA).
 */
import { useEffect } from 'react'
import styles from './RevealAlEntrar.module.css'

/** Parte del elemento que tiene que verse para que aparezca. */
const UMBRAL = 0.15

/** Observa los `[data-reveal]` de la página y los hace aparecer al entrar en pantalla. */
export function RevealAlEntrar() {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const yaRevisados = new WeakSet<Element>()

    /** Al terminar la entrada, se sacan la transición y el retraso (no interfieren con nada después). */
    function limpiar(event: TransitionEvent) {
      const elemento = event.currentTarget
      if (!(elemento instanceof HTMLElement) || event.target !== elemento) return
      elemento.classList.remove(styles.visible)
      elemento.style.removeProperty('transition-delay')
      elemento.removeEventListener('transitionend', limpiar)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let orden = 0
        for (const entry of entries) {
          const elemento = entry.target
          if (!(elemento instanceof HTMLElement)) continue

          // Primer aviso de cada elemento: lo que ya se ve (aunque sea un
          // borde) queda como está; lo que está más abajo se oculta.
          if (!yaRevisados.has(elemento)) {
            yaRevisados.add(elemento)
            if (entry.intersectionRatio > 0) observer.unobserve(elemento)
            else elemento.classList.add(styles.pendiente)
            continue
          }

          if (entry.intersectionRatio < UMBRAL) continue
          observer.unobserve(elemento)
          // Los que entran en el mismo aviso (por ejemplo, los 6 barrios) se escalonan.
          elemento.style.transitionDelay = `calc(var(--rentar-motion-stagger) * ${orden})`
          orden += 1
          elemento.addEventListener('transitionend', limpiar)
          elemento.classList.add(styles.visible)
          elemento.classList.remove(styles.pendiente)
        }
      },
      { threshold: [0, UMBRAL] },
    )

    document.querySelectorAll('[data-reveal]').forEach((elemento) => observer.observe(elemento))
    return () => observer.disconnect()
  }, [])

  return null
}
