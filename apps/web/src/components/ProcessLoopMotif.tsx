/**
 * ProcessLoopMotif.tsx — el motivo insignia del sistema: el ciclo del alquiler
 * (buscá, postulate, firmá, pagá) como un loop con un punto dorado que lo recorre.
 *
 * Qué es: un diagrama circular animado y decorativo (`aria-hidden`): la
 * explicación accesible es la lista de pasos que lo acompaña.
 * Cubre: sin US en Sprint 0 (contenido de la landing).
 * De dónde saca los datos: ninguno; los 4 pasos son fijos.
 * Quién lo usa: `components/landing/ComoFunciona.tsx` y el catálogo `/design-system`.
 *
 * NOTA: cada nodo se envuelve en un `<g>` de posicionamiento estático + un
 * `<g>` interno animado (ver `docs/DESIGN.md`, "Do's and Don'ts"): mezclar
 * el atributo `transform` de posicionamiento con una animación CSS de
 * `transform` en el mismo nodo SVG hace que el navegador descarte el atributo.
 * NOTA: los colores salen de los tokens por CSS (clases), no de atributos del
 * SVG: un atributo no puede leer una variable CSS. El punto dorado es la
 * excepción documentada a "dorado solo para dinero" (`docs/DESIGN.md`,
 * "Dorado Trámite").
 */
import type { ReactNode } from 'react'
import styles from './ProcessLoopMotif.module.css'

/**
 * `quieto`: sin animar (antes de entrar en pantalla, o sin JS).
 * `corriendo`: anima. `pausado`: congelado donde estaba (salió de pantalla).
 */
export type EstadoLoop = 'quieto' | 'corriendo' | 'pausado'

interface LoopNode {
  cx: number
  cy: number
  icon: ReactNode
}

/**
 * Los 4 pasos, en el sentido del punto (horario, desde arriba): Buscá,
 * Postulate, Firmá y Pagá. Íconos de un solo trazo, dibujados en 24×24.
 */
const nodes: LoopNode[] = [
  {
    cx: 100,
    cy: 38,
    // Lupa: buscar.
    icon: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="M14.5 14.5L20 20" />
      </>
    ),
  },
  {
    cx: 162,
    cy: 100,
    // Avión de papel: la solicitud que se le manda al dueño.
    icon: <path d="M3 11.5L20 4l-6.5 16-2.5-6.5L3 11.5z M11 13.5l9-9.5" />,
  },
  {
    cx: 100,
    cy: 162,
    // Lapicera: firmar.
    icon: <path d="M4 19l4-1 10-10-3-3L5 15l-1 4z M15 5l3 3" />,
  },
  {
    cx: 38,
    cy: 100,
    // Recibo tildado: pagar.
    icon: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 12l2.5 2.5L16 9" />
      </>
    ),
  },
]

const nodeClasses = [styles.node0, styles.node1, styles.node2, styles.node3]

/** Props de {@link ProcessLoopMotif}. */
interface ProcessLoopMotifProps {
  /** Clases extra para posicionar el contenedor desde el componente padre. */
  className?: string
  /**
   * Si anima. Por defecto `corriendo`. "Cómo funciona" lo arranca cuando la
   * sección entra en pantalla y lo pausa cuando sale; así queda sincronizado
   * con la lista de pasos, que usa los mismos tiempos (`--loop-duracion`).
   */
  estado?: EstadoLoop
}

/**
 * Pieza insignia del sistema de diseño: diagrama circular de las 4 etapas
 * del proceso (buscá → postulate → firmá → pagá). Un punto dorado recorre el
 * círculo en 8 s; al pasar por cada nodo, el nodo late y queda marcado
 * hasta que el punto llega al siguiente.
 */
export default function ProcessLoopMotif({ className, estado = 'corriendo' }: ProcessLoopMotifProps) {
  // `quieto` no tiene clase: sin `.corriendo` ni `.pausado` no hay animaciones.
  const claseEstado = estado === 'quieto' ? '' : styles[estado]
  return (
    <div className={`${styles.container} ${claseEstado} ${className ?? ''}`} aria-hidden="true">
      <svg viewBox="0 0 200 200" className={styles.svg}>
        <circle className={styles.ring} cx="100" cy="100" r="62" />

        {/* Halo del paso activo: detrás del nodo, se enciende mientras el punto está en ese tramo. */}
        {nodes.map((node, index) => (
          <circle key={`halo-${index}`} className={`${styles.halo} ${nodeClasses[index]}`} cx={node.cx} cy={node.cy} r="27" />
        ))}

        {/*
         * El punto arranca a -45° (entre Pagá y Buscá) y gira alrededor del
         * centro. Va debajo de los nodos: pasa por detrás de cada uno.
         */}
        <g className={styles.orbit}>
          <circle className={styles.dot} cx="56.16" cy="56.16" r="5" />
        </g>

        {nodes.map((node, index) => (
          <g key={`nodo-${index}`} transform={`translate(${node.cx} ${node.cy})`}>
            <g className={`${styles.node} ${nodeClasses[index]}`}>
              <circle className={styles.nodeCircle} r="19" />
              <g className={styles.icon} transform="translate(-9 -9) scale(0.75)">
                {node.icon}
              </g>
            </g>
          </g>
        ))}
      </svg>
    </div>
  )
}
