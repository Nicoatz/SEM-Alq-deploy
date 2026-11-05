'use client'

/**
 * MiniaturaPdf.tsx — la primera página del PDF, chica, con la cantidad de páginas.
 *
 * Cubre: US-05 Registrar contrato de alquiler, paso 3 y paso 4 ("una miniatura
 * de la primera página del PDF").
 * De dónde saca los datos: `url`.
 * Quién lo usa: `PasoCarga.tsx` y `PasoRevision.tsx`.
 */
import { useEffect, useRef } from 'react'
import { Skeleton } from 'antd'
import { dibujarPagina, usePdf } from '@/lib/contratos/pdfVisor'
import styles from './MiniaturaPdf.module.css'

/** Ancho de la miniatura, en píxeles. */
const ANCHO = 112

/** Props de {@link MiniaturaPdf}. */
interface MiniaturaPdfProps {
  url: string
  'data-testid'?: string
}

/** La miniatura. Si el PDF no abre, lo dice sin frenar el alta. */
export function MiniaturaPdf({ url, 'data-testid': testId = 'contrato-pdf-miniatura' }: MiniaturaPdfProps) {
  const pdf = usePdf(url)
  const canvas = useRef<HTMLCanvasElement>(null)
  const documento = pdf.status === 'listo' ? pdf.documento : null

  useEffect(() => {
    if (!documento || !canvas.current) return
    let cancelado = false
    let cancelar: (() => void) | undefined
    void dibujarPagina(documento, 1, canvas.current, ANCHO)
      .then((tarea) => {
        if (cancelado) tarea.cancel()
        else cancelar = () => tarea.cancel()
        return tarea.promise
      })
      .catch(() => undefined)
    return () => {
      cancelado = true
      cancelar?.()
    }
  }, [documento])

  if (pdf.status === 'cargando') return <Skeleton.Node active className={styles.cargando} data-testid={`${testId}-cargando`} />
  if (pdf.status === 'error') {
    return (
      <span className={styles.error} data-testid={`${testId}-error`}>
        No pudimos mostrar la vista previa.
      </span>
    )
  }
  const total = pdf.documento.numPages
  return (
    <span className={styles.miniatura} data-testid={testId}>
      <canvas ref={canvas} className={styles.canvas} aria-label="Primera página del contrato" />
      <span className={styles.paginas} data-testid={`${testId}-paginas`}>
        {total === 1 ? '1 página' : `${total} páginas`}
      </span>
    </span>
  )
}
