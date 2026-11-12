'use client'

/**
 * VisorPdf.tsx — el documento del contrato, página por página.
 *
 * Cubre: US-42 Consultar detalle del contrato ("el documento del contrato
 * paginado") y la revisión del alta (US-05). En la Tanda 3 lo usa la firma:
 * informa qué páginas se vieron (`onPaginasVistas`), pero la lógica de firma
 * no vive acá.
 * Qué muestra (Claude Design, "Flujo de contratos" · 04 y 07): una hoja por
 * vez con su paginador; mientras carga, un esqueleto con la proporción de la
 * hoja; si falla, el aviso y "Descargar el PDF" como salida.
 *
 * De dónde saca los datos: `obtenerUrl`, al abrirse: la URL firmada vence a los
 * 5 minutos (S4-13). El documento ya abierto se sigue viendo.
 * NOTA: en modo mock, si se ve el PDF de ejemplo del elenco, arriba de la hoja
 * va un aviso (`contratos.service#esPdfDeEjemplo`): el PDF subido no se guarda
 * en el navegador y la otra parte ve el de ejemplo.
 * Quién lo usa: `DetalleContrato.tsx` y `FirmaContrato.tsx`.
 */
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Skeleton } from 'antd'
import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { dibujarPagina, usePdf, type ObtenerUrlPdf } from '@/lib/contratos/pdfVisor'
import { esPdfDeEjemplo } from '@/services/contratos.service'
import { BotonPdf } from './BotonPdf'
import styles from './VisorPdf.module.css'

/** Props de {@link VisorPdf}. */
interface VisorPdfProps {
  obtenerUrl: ObtenerUrlPdf
  /** Nombre que se lee en el encabezado; sin él, solo la página. */
  nombre?: string
  /** Se llama con las páginas vistas (desde 1) y el total, cada vez que se ve una nueva. */
  onPaginasVistas?: (vistas: ReadonlySet<number>, total: number) => void
  'data-testid'?: string
}

/** Props de {@link Hoja}. */
interface HojaProps {
  documento: PDFDocumentProxy
  nombre?: string
  onPaginasVistas?: VisorPdfProps['onPaginasVistas']
  testId: string
  /** Modo mock: el documento es el PDF de ejemplo, no el que se subió. */
  esEjemplo: boolean
}

/** Una hoja con su paginador. Se monta con el documento ya abierto. */
function Hoja({ documento, nombre, onPaginasVistas, testId, esEjemplo }: HojaProps) {
  const total = documento.numPages
  const [pagina, setPagina] = useState(1)
  const [error, setError] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const vistas = useRef<Set<number>>(new Set())

  // Dibuja la página. Una tarea a medio camino se cancela: dos sobre el mismo canvas fallan.
  useEffect(() => {
    let cancelado = false
    let cancelar: (() => void) | undefined
    const ancho = contenedor.current?.clientWidth ?? 0
    if (!canvas.current || ancho === 0) return
    void dibujarPagina(documento, pagina, canvas.current, ancho)
      .then((tarea) => {
        if (cancelado) tarea.cancel()
        else cancelar = () => tarea.cancel()
        return tarea.promise
      })
      .catch((motivo: unknown) => {
        // La cancelación no es un error: es que se cambió de página.
        if (!cancelado && !(motivo instanceof Error && motivo.name === 'RenderingCancelledException')) setError(true)
      })
    return () => {
      cancelado = true
      cancelar?.()
    }
  }, [documento, pagina])

  // Avisa las páginas vistas. Volver atrás no resta (US-07: "no reduce el progreso").
  useEffect(() => {
    if (vistas.current.has(pagina)) return
    vistas.current.add(pagina)
    onPaginasVistas?.(vistas.current, total)
  }, [pagina, total, onPaginasVistas])

  return (
    <div className={styles.visor} data-testid={testId}>
      {esEjemplo && (
        <Alert
          type="info"
          showIcon
          title="Modo demo: este es un PDF de ejemplo. El archivo que se sube no se guarda en este navegador."
          data-testid="visor-pdf-aviso-demo"
        />
      )}
      <div className={styles.encabezado}>
        {nombre && <span className={styles.nombre}>{nombre}</span>}
        <span className={styles.pagina} data-testid={`${testId}-pagina`}>
          Página {pagina} de {total}
        </span>
      </div>
      <div ref={contenedor} className={styles.hoja}>
        {error ? <Alert type="error" showIcon title="No pudimos mostrar esta página." /> : <canvas ref={canvas} className={styles.canvas} aria-label={`Página ${pagina} de ${total} del contrato`} />}
      </div>
      {total > 1 && (
        <div className={styles.paginador}>
          <Button icon={<LeftOutlined />} disabled={pagina === 1} onClick={() => setPagina((actual) => actual - 1)} data-testid={`${testId}-anterior`}>
            Anterior
          </Button>
          <Button disabled={pagina === total} onClick={() => setPagina((actual) => actual + 1)} data-testid={`${testId}-siguiente`}>
            Siguiente <RightOutlined />
          </Button>
        </div>
      )}
    </div>
  )
}

/** Abre el PDF y muestra la hoja, el esqueleto o el error. */
export function VisorPdf({ obtenerUrl, nombre, onPaginasVistas, 'data-testid': testId = 'contrato-visor' }: VisorPdfProps) {
  const pdf = usePdf(obtenerUrl)

  if (pdf.status === 'cargando') {
    return (
      <div className={styles.cargando} data-testid={`${testId}-cargando`}>
        <Skeleton.Node active className={styles.cargandoHoja} />
      </div>
    )
  }
  if (pdf.status === 'error') {
    return (
      <div className={styles.errorVisor} data-testid={`${testId}-error`}>
        <Alert type="warning" showIcon title="No se pudo cargar el documento" description="El resto del contrato se sigue viendo. Podés abrir el PDF aparte." />
        <BotonPdf obtenerUrl={obtenerUrl}>Descargar el PDF</BotonPdf>
      </div>
    )
  }
  return <Hoja documento={pdf.documento} nombre={nombre} onPaginasVistas={onPaginasVistas} testId={testId} esEjemplo={esPdfDeEjemplo(pdf.url)} />
}
