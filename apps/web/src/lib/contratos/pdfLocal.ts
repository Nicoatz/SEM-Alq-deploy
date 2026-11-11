'use client'

/**
 * pdfLocal.ts — la URL de un PDF que todavía está solo en el navegador.
 *
 * Qué es: el PDF adjuntado en el paso Carga queda en memoria hasta "Guardar
 * borrador" (US-05 y US-06: "Si el usuario intenta salir con cambios sin
 * guardar, se debe mostrar un aviso"). Para verlo antes de subirlo, la
 * miniatura y el botón "Abrir" usan una URL `blob:` del archivo.
 * NOTA: el archivo no va a `localStorage` ni a `sessionStorage`: pesa hasta
 * 5 MB y tiene datos personales de las partes.
 *
 * Cubre: US-05 (pasos 3 y 4) y US-06.
 * Quién lo usa: `components/contratos/PasoCarga.tsx` y `PasoRevision.tsx`.
 */
import { useCallback, useEffect, useRef } from 'react'
import type { ObtenerUrlPdf } from './pdfVisor'

/**
 * Pide una URL `blob:` del archivo cada vez que se la necesita (como la URL
 * firmada del PDF guardado) y las libera todas al cambiar de archivo o al
 * desmontar: si no, el navegador retiene el PDF hasta cerrar la pestaña.
 * @returns un `ObtenerUrlPdf` estable para `MiniaturaPdf` y `BotonPdf`; `null` sin archivo.
 */
export function useUrlPdfLocal(archivo: File | null): ObtenerUrlPdf | null {
  /** Las URL creadas para este archivo, para liberarlas después. */
  const creadas = useRef<string[]>([])

  useEffect(() => {
    const lista = creadas.current
    return () => {
      lista.forEach((url) => URL.revokeObjectURL(url))
      lista.length = 0
    }
  }, [archivo])

  const obtener = useCallback((): Promise<string | null> => {
    if (!archivo) return Promise.resolve(null)
    const url = URL.createObjectURL(archivo)
    creadas.current.push(url)
    return Promise.resolve(url)
  }, [archivo])

  return archivo ? obtener : null
}
