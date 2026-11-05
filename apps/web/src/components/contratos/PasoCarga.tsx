'use client'

/**
 * PasoCarga.tsx — paso 3 del alta: el contrato en PDF.
 *
 * Cubre: US-05 Registrar contrato de alquiler, "Paso 3 · Carga":
 * - "Se debe cargar el contrato en formato PDF, con un tamaño no superior a 5MB."
 * - "Si el archivo no es un PDF o supera los 5MB, se debe rechazar e informar
 *   el motivo, sin reemplazar el PDF que ya estaba cargado."
 * - "Se debe mostrar el nombre y el tamaño del archivo cargado, y se puede
 *   reemplazar por otro PDF mientras el contrato esté en borrador."
 * Decisión del PO: la única opción es el PDF; no hay plantilla.
 * NOTA (diseño vs. US): el diseño dibuja "Quitar", pero ni la US ni la API lo
 * tienen: el PDF se reemplaza, no se saca.
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 03): el archivo cargado
 * con su miniatura y la zona para cargar otro.
 * De dónde saca los datos: `contratos.service#subirPdfContrato`.
 * Quién lo usa: `components/contratos/AltaContrato.tsx`.
 */
import { useState } from 'react'
import { Alert, Button, Spin } from 'antd'
import type { UploadFile } from 'antd'
import type { ContratoBorrador, PdfContrato } from '@rentar/shared-types'
import { FileDropzone, FormSection } from '@rentar/ui'
import { cabeceraDe, errorDeArchivoPdf, tamanoLegible } from '@/lib/contratos/pdfCarga'
import { subirPdfContrato } from '@/services/contratos.service'
import { ServiceError } from '@/services/shared/errors'
import { MiniaturaPdf } from './MiniaturaPdf'
import styles from './PasoCarga.module.css'

/** Props de {@link PasoCarga}. */
interface PasoCargaProps {
  contratoId: string
  pdf: PdfContrato | null
  /** El PDF ya quedó guardado en el contrato: la subida no espera a "Guardar borrador". */
  onPdfCargado: (contrato: ContratoBorrador) => void
}

/** Paso 3 del alta: cargar o reemplazar el PDF. */
export function PasoCarga({ contratoId, pdf, onPdfCargado }: PasoCargaProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Cambia para vaciar la zona de carga: `FileDropzone` guarda su propia lista. */
  const [intento, setIntento] = useState(0)

  // ─── Handlers ───────────────────────────────────────────────────────
  async function cargar(archivos: UploadFile[]): Promise<void> {
    const archivo = archivos.at(-1)?.originFileObj
    if (!archivo) return
    setIntento((actual) => actual + 1)
    setError(null)
    // Un rechazo corta acá: el PDF anterior ni se toca.
    const motivo = errorDeArchivoPdf(archivo, await cabeceraDe(archivo))
    if (motivo) {
      setError(motivo)
      return
    }
    setSubiendo(true)
    try {
      onPdfCargado(await subirPdfContrato(contratoId, archivo))
    } catch (causa) {
      setError(causa instanceof ServiceError ? causa.message : 'No pudimos subir el PDF. El que estaba cargado sigue igual: probá de nuevo.')
    } finally {
      setSubiendo(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.paso} data-testid="contrato-paso-carga">
      <FormSection title="El contrato en PDF" description="Es el documento que van a firmar las partes: revisá que sea la versión final.">
        {pdf && (
          <div className={styles.cargado} data-testid="contrato-pdf-cargado">
            <MiniaturaPdf url={pdf.url} />
            <div className={styles.datos}>
              <span className={styles.nombre} data-testid="contrato-pdf-nombre">
                {pdf.nombre}
              </span>
              <span className={styles.tamano} data-testid="contrato-pdf-tamano">
                {tamanoLegible(pdf.tamanoBytes)}
              </span>
              <Button href={pdf.url} target="_blank" rel="noopener noreferrer" data-testid="contrato-pdf-abrir">
                Abrir
              </Button>
            </div>
          </div>
        )}

        {error && <Alert type="error" showIcon title={error} data-testid="contrato-pdf-error" />}

        <Spin spinning={subiendo} description="Subiendo el PDF…">
          <FileDropzone
            key={intento}
            accept=".pdf,application/pdf"
            multiple={false}
            hint={pdf ? 'Para reemplazarlo, cargá otro PDF de hasta 5 MB.' : 'PDF de hasta 5 MB.'}
            onFilesChange={(archivos) => void cargar(archivos)}
            data-testid="contrato-pdf-dropzone"
          />
        </Spin>
      </FormSection>
    </div>
  )
}
