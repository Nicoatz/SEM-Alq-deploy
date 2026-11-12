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
export type EstadoPdf = { status: 'cargando' } | { status: 'error' } | { status: 'listo'; documento: PDFDocumentProxy; url: string }

/** Pide la URL del PDF en el momento; `null` si no hay. */
export type ObtenerUrlPdf = () => Promise<string | null>

/** Resultado guardado, con el pedido al que corresponde. */
type Resultado = { origen: ObtenerUrlPdf } & ({ status: 'error' } | { status: 'listo'; documento: PDFDocumentProxy; url: string })

/**
 * Hace `accion` y, si falla, una vez más en silencio: la causa más común es
 * una URL firmada vencida (S4-13), y el segundo intento pide otra.
 */
export async function reintentarUnaVez<T>(accion: () => Promise<T>): Promise<T> {
  try {
    return await accion()
  } catch {
    return accion()
  }
}

/**
 * Abre el PDF con una URL recién pedida (S4-13: vence a los 5 minutos).
 * "Cargando" se deduce de que el resultado guardado es de otro pedido (mismo
 * criterio que `useServiceCall`), y el documento se cierra al desmontar.
 * @param obtenerUrl Tiene que ser estable (`useCallback`).
 */
export function usePdf(obtenerUrl: ObtenerUrlPdf): EstadoPdf {
  const [resultado, setResultado] = useState<Resultado | null>(null)

  useEffect(() => {
    let cancelado = false
    let abierto: PDFDocumentProxy | null = null
    reintentarUnaVez(async () => {
      const [pdfjs, url] = await Promise.all([cargarLibreria(), obtenerUrl()])
      if (!url) throw new Error('Sin PDF')
      return { documento: await pdfjs.getDocument({ url }).promise, url }
    })
      .then(({ documento, url }) => {
        abierto = documento
        if (cancelado) void documento.destroy()
        else setResultado({ origen: obtenerUrl, status: 'listo', documento, url })
      })
      .catch(() => {
        if (!cancelado) setResultado({ origen: obtenerUrl, status: 'error' })
      })
    return () => {
      cancelado = true
      void abierto?.destroy()
    }
  }, [obtenerUrl])

  if (!resultado || resultado.origen !== obtenerUrl) return { status: 'cargando' }
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
