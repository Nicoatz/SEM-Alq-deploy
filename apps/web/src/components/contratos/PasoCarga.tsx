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
 * US-05 y US-06: "Si el usuario intenta salir con cambios sin guardar, se debe
 * mostrar un aviso". El PDF adjuntado es un cambio más del borrador: queda en
 * memoria (`pdfPendiente`) y se sube recién con "Guardar borrador" o al enviar
 * a firmar (lo hace `AltaContrato`).
 * NOTA (diseño vs. US): el diseño dibuja "Quitar", pero ni la US ni la API lo
 * tienen: el PDF se reemplaza, no se saca.
 *
 * Qué muestra (Claude Design, "Flujo de contratos" · 03): el archivo cargado
 * con su miniatura y la zona para cargar otro.
 * De dónde saca los datos: el PDF guardado, del borrador
 * (`contratos.service#urlPdfDeContrato`); el pendiente, del archivo local
 * (`lib/contratos/pdfLocal`).
 * Quién lo usa: `components/contratos/AltaContrato.tsx`.
 */
import { useCallback, useState } from 'react'
import { Alert } from 'antd'
import type { UploadFile } from 'antd'
import type { PdfContrato } from '@rentar/shared-types'
import { FileDropzone, FormSection } from '@rentar/ui'
import { cabeceraDe, errorDeArchivoPdf, tamanoLegible } from '@/lib/contratos/pdfCarga'
import { useUrlPdfLocal } from '@/lib/contratos/pdfLocal'
import { urlPdfDeContrato } from '@/services/contratos.service'
import { BotonPdf } from './BotonPdf'
import { MiniaturaPdf } from './MiniaturaPdf'
import styles from './PasoCarga.module.css'

/** Aviso de un PDF adjuntado que todavía no se subió (lo usa también `PasoRevision`). */
export function textoPdfPendiente(hayGuardado: boolean): string {
  return hayGuardado
    ? 'Se sube al tocar Guardar borrador. Hasta entonces, el contrato sigue con el PDF anterior.'
    : 'Se sube al tocar Guardar borrador.'
}

/** Props de {@link PasoCarga}. */
interface PasoCargaProps {
  contratoId: string
  /** El PDF guardado en el borrador; `null` si todavía no hay. */
  pdf: PdfContrato | null
  /** El PDF adjuntado que todavía no se subió; `null` si no hay. */
  pdfPendiente: File | null
  /** Se eligió un PDF válido: queda pendiente hasta "Guardar borrador". */
  onPdfElegido: (archivo: File) => void
}

/** Paso 3 del alta: cargar o reemplazar el PDF. */
export function PasoCarga({ contratoId, pdf, pdfPendiente, onPdfElegido }: PasoCargaProps) {
  // ─── Estado local ───────────────────────────────────────────────────
  const [error, setError] = useState<string | null>(null)
  /** Cambia para vaciar la zona de carga: `FileDropzone` guarda su propia lista. */
  const [intento, setIntento] = useState(0)

  // ─── Handlers ───────────────────────────────────────────────────────
  const obtenerGuardado = useCallback(() => urlPdfDeContrato(contratoId, 'borrador'), [contratoId])
  const obtenerPendiente = useUrlPdfLocal(pdfPendiente)

  async function cargar(archivos: UploadFile[]): Promise<void> {
    const archivo = archivos.at(-1)?.originFileObj
    if (!archivo) return
    setIntento((actual) => actual + 1)
    setError(null)
    // Un rechazo corta acá: ni el PDF guardado ni el pendiente se tocan.
    const motivo = errorDeArchivoPdf(archivo, await cabeceraDe(archivo))
    if (motivo) {
      setError(motivo)
      return
    }
    onPdfElegido(archivo)
  }

  // ─── Render ─────────────────────────────────────────────────────────
  // El pendiente tapa al guardado: es el que se va a subir al guardar.
  const mostrado = pdfPendiente ? { nombre: pdfPendiente.name, tamanoBytes: pdfPendiente.size } : pdf
  const obtenerPdf = pdfPendiente ? obtenerPendiente : obtenerGuardado
  const claveMiniatura = pdfPendiente ? `pendiente-${pdfPendiente.name}-${pdfPendiente.lastModified}-${pdfPendiente.size}` : pdf?.url

  return (
    <div className={styles.paso} data-testid="contrato-paso-carga">
      <FormSection title="El contrato en PDF" description="Es el documento que van a firmar las partes: revisá que sea la versión final.">
        {pdfPendiente && (
          <Alert type="warning" showIcon title="Este PDF todavía no está guardado" description={textoPdfPendiente(pdf !== null)} data-testid="contrato-pdf-pendiente" />
        )}

        {mostrado && obtenerPdf && (
          <div className={styles.cargado} data-testid="contrato-pdf-cargado">
            {/* La `key` vuelve a abrir la miniatura al reemplazar el archivo. */}
            <MiniaturaPdf key={claveMiniatura} obtenerUrl={obtenerPdf} />
            <div className={styles.datos}>
              <span className={styles.nombre} data-testid="contrato-pdf-nombre">
                {mostrado.nombre}
              </span>
              <span className={styles.tamano} data-testid="contrato-pdf-tamano">
                {tamanoLegible(mostrado.tamanoBytes)}
              </span>
              <BotonPdf obtenerUrl={obtenerPdf} data-testid="contrato-pdf-abrir">
                Abrir
              </BotonPdf>
            </div>
          </div>
        )}

        {error && <Alert type="error" showIcon title={error} data-testid="contrato-pdf-error" />}

        <FileDropzone
          key={intento}
          accept=".pdf,application/pdf"
          multiple={false}
          hint={mostrado ? 'Para reemplazarlo, cargá otro PDF de hasta 5 MB.' : 'PDF de hasta 5 MB.'}
          onFilesChange={(archivos) => void cargar(archivos)}
          data-testid="contrato-pdf-dropzone"
        />
      </FormSection>
    </div>
  )
}
