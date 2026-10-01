'use client'

/**
 * ComoFunciona.tsx — sección "Cómo funciona" de la landing: el motivo del
 * loop y la lista de los 4 pasos, sincronizados.
 *
 * Qué es: el momento de movimiento autoral de la página. Mientras la sección
 * está en pantalla, el punto dorado recorre el loop y el paso de la lista que
 * le toca se resalta al mismo tiempo (los dos usan `--loop-duracion`, ver
 * `ProcessLoopMotif.module.css`). Arranca en "Buscá" la primera vez que la
 * sección entra en pantalla y se pausa cuando sale. Sin JS, o con "reducir
 * movimiento", no anima y los 4 pasos se ven iguales.
 * Cubre: sin US en Sprint 0 (contenido de la landing; el recorrido es el
 * flujo A del Mapa de pantallas, "Buscar y postularse").
 * De dónde saca los datos: textos fijos, aprobados por el PO (01/10/2026).
 * NOTA: en presente y sin links: postularse, la firma a distancia y los pagos
 * son de sprints siguientes (decisión del PO, 01/10/2026).
 * Quién lo usa: `app/(public)/page.tsx`. El Header y el Footer llevan a esta
 * sección con el ancla `/#como-funciona`.
 */
import { useEffect, useRef, useState } from 'react'
import ProcessLoopMotif, { type EstadoLoop } from '@/components/ProcessLoopMotif'
import styles from './ComoFunciona.module.css'

interface Paso {
  titulo: string
  texto: string
}

/** Los 4 pasos, en el mismo orden que los nodos del motivo. */
const PASOS: Paso[] = [
  { titulo: 'Buscá', texto: 'Filtrá por barrio, precio y tipología entre publicaciones de dueños.' },
  { titulo: 'Postulate', texto: 'Mandale tu solicitud al dueño desde la publicación.' },
  { titulo: 'Firmá', texto: 'El contrato se firma a distancia, igual que tu garante.' },
  { titulo: 'Pagá', texto: 'Cada pago queda registrado y el ajuste sale del índice del contrato.' },
]

/** Parte de la sección que tiene que verse para que el loop arranque (o siga). */
const UMBRAL_EN_PANTALLA = 0.35

/** Sección "De la búsqueda a las llaves, sin intermediarios" (ancla `#como-funciona`). */
export function ComoFunciona() {
  // ─── Estado local ───────────────────────────────────────────────────
  const sectionRef = useRef<HTMLElement>(null)
  const [estado, setEstado] = useState<EstadoLoop>('quieto')

  // ─── Efectos ────────────────────────────────────────────────────────
  // Corre mientras la sección está en pantalla; al salir se pausa (no se
  // reinicia: al volver sigue desde donde estaba).
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setEstado('corriendo')
        else setEstado((actual) => (actual === 'quieto' ? 'quieto' : 'pausado'))
      },
      { threshold: UMBRAL_EN_PANTALLA },
    )
    observer.observe(section)
    return () => observer.disconnect()
  }, [])

  // ─── Render ─────────────────────────────────────────────────────────
  // `quieto` no tiene clase: los resaltes de los pasos solo existen con `.corriendo` o `.pausado`.
  const claseEstado = estado === 'quieto' ? '' : styles[estado]

  return (
    <section
      id="como-funciona"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="landing-como-funciona-titulo"
      data-testid="landing-como-funciona"
    >
      <div className={styles.inner}>
        <h2 id="landing-como-funciona-titulo" className={styles.heading} data-reveal>
          De la búsqueda a las llaves, sin intermediarios
        </h2>
        <div className={styles.body} data-reveal>
          <ProcessLoopMotif estado={estado} className={styles.motif} />
          {/* El número de cada paso es decorativo: la lista ordenada ya lo anuncia. */}
          <ol className={`${styles.pasos} ${claseEstado}`}>
            {PASOS.map((paso, index) => (
              <li key={paso.titulo} className={styles.paso} data-testid={`landing-como-funciona-paso-${index + 1}`}>
                <span className={styles.numero} data-numero={index + 1} aria-hidden="true">
                  {index + 1}
                </span>
                <div>
                  <h3 className={styles.pasoTitulo}>{paso.titulo}</h3>
                  <p className={styles.pasoTexto}>{paso.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
