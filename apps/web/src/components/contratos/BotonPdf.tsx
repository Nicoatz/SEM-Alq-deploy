'use client'

/**
 * BotonPdf.tsx — abre el PDF del contrato con una URL recién pedida.
 *
 * Cubre: US-42 y US-43 ("descargar el contrato en PDF") y la brecha S4-13: la
 * URL firmada vence a los 5 minutos, así que no se usa la que vino con la
 * pantalla. Se pide al tocar el botón y, si falla, se reintenta una vez en
 * silencio antes de mostrar el error.
 *
 * NOTA: la pestaña se abre antes de pedir la URL: después de un `await` el
 * navegador lo tomaría como una ventana emergente y la bloquearía.
 *
 * De dónde saca los datos: `obtenerUrl`.
 * Quién lo usa: `DetalleContrato.tsx`, `PestanaContratos.tsx`, `PasoCarga.tsx` y `VisorPdf.tsx`.
 */
import { useState, type ReactNode } from 'react'
import { Button } from 'antd'
import { reintentarUnaVez } from '@/lib/contratos/pdfVisor'
import styles from './BotonPdf.module.css'

/** Props de {@link BotonPdf}. */
interface BotonPdfProps {
  /** Pide la URL en el momento; `null` si el contrato no tiene PDF. */
  obtenerUrl: () => Promise<string | null>
  icon?: ReactNode
  children: ReactNode
  'data-testid'?: string
}

/** El botón, con su error debajo. */
export function BotonPdf({ obtenerUrl, icon, children, 'data-testid': testId }: BotonPdfProps) {
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState(false)

  async function abrir(): Promise<void> {
    const ventana = window.open('', '_blank')
    setAbriendo(true)
    setError(false)
    try {
      const url = await reintentarUnaVez(obtenerUrl)
      if (!url) throw new Error('Sin PDF')
      if (ventana) ventana.location.href = url
      else window.location.href = url
    } catch {
      ventana?.close()
      setError(true)
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <span className={styles.boton}>
      <Button icon={icon} loading={abriendo} onClick={() => void abrir()} data-testid={testId}>
        {children}
      </Button>
      {error && (
        <span className={styles.error} role="alert" data-testid={testId ? `${testId}-error` : undefined}>
          No pudimos abrir el PDF. Probá de nuevo.
        </span>
      )}
    </span>
  )
}
