'use client'

/**
 * pdfVisor.ts — abre un PDF y dibuja sus páginas con `pdfjs-dist`.
 *
 * Qué es: la única puerta a `pdfjs-dist`. Se carga en diferido (`import()`)
 * recién cuando una pantalla de contrato pide un PDF, y el worker se sirve
 * desde el mismo sitio. Decisión del PO (Sprint 4): nada de esto entra al
 * bundle del resto de las pantallas.
 * NOTA: `pdfjs-dist` va en 5.x: la 6.x pide Node 22 y el repo usa Node 20 (`.nvmrc`).
 *
 * Cubre: US-05 (miniatura) y US-42 (documento paginado).
 * Quién lo usa: `components/contratos/VisorPdf.tsx` y `MiniaturaPdf.tsx`.
 */
import { useEffect, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'

/** La librería, cargada una sola vez. */
let libreria: Promise<typeof import('pdfjs-dist')> | null = null

function cargarLibreria(): Promise<typeof import('pdfjs-dist')> {
  libreria ??= import('pdfjs-dist').then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    return pdfjs
  })
  return libreria
}

/** Estado de un PDF que se está abriendo. */
export type EstadoPdf = { status: 'cargando' } | { status: 'error' } | { status: 'listo'; documento: PDFDocumentProxy }

/** Resultado guardado, con la URL a la que corresponde. */
type Resultado = { url: string } & ({ status: 'error' } | { status: 'listo'; documento: PDFDocumentProxy })

/**
 * Abre el PDF de `url`. "Cargando" se deduce de que el resultado guardado es
 * de otra URL (mismo criterio que `useServiceCall`), y el documento se cierra
 * al desmontar o al cambiar de archivo.
 */
export function usePdf(url: string): EstadoPdf {
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    let cancelado = false
    let abierto: PDFDocumentProxy | null = null
    cargarLibreria()
      .then((pdfjs) => pdfjs.getDocument({ url }).promise)
      .then((documento) => {
        abierto = documento
        if (cancelado) void documento.destroy()
        else setResultado({ url, status: 'listo', documento })
      })
      .catch(() => {
        if (!cancelado) setResultado({ url, status: 'error' })
      })
    return () => {
      cancelado = true
      void abierto?.destroy()
    }
  }, [url])

  if (!resultado || resultado.url !== url) return { status: 'cargando' }
  return resultado
}

/**
 * Dibuja una página en un `canvas`, ajustada a `ancho` (en píxeles de CSS).
 * @returns la tarea de dibujo, para cancelarla si la página cambia a mitad de camino.
 */
export async function dibujarPagina(documento: PDFDocumentProxy, numero: number, canvas: HTMLCanvasElement, ancho: number): Promise<RenderTask> {
  const pagina = await documento.getPage(numero)
  const escala = ancho / pagina.getViewport({ scale: 1 }).width
  // Más píxeles que CSS en pantallas de alta densidad: si no, el texto sale borroso.
  const densidad = Math.min(window.devicePixelRatio || 1, 2)
  const viewport = pagina.getViewport({ scale: escala * densidad })
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${Math.floor(viewport.width / densidad)}px`
  canvas.style.height = `${Math.floor(viewport.height / densidad)}px`
  return pagina.render({ canvas, viewport })
}
