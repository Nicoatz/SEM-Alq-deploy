'use client'

/**
 * imagenes/fotoConRespaldo.ts — si una foto no carga, mostrar el placeholder.
 *
 * Qué es: un hook para `next/image` (o `<img>`) que cambia a la foto de
 * respaldo cuando la original falla (404, host caído, URL inventada). Sin
 * esto, el navegador muestra el ícono de imagen rota con el texto
 * alternativo encima de la tarjeta.
 * NOTA: hoy pasa con las fotos de prueba del seed de la base
 * (`https://rentar.com/fotos/...`), que no existen; y puede pasar con
 * cualquier foto que se borre de Storage.
 *
 * Quién lo usa: `lib/next-bridge.tsx#AppImage` (tarjetas de `@rentar/ui`),
 * `components/PropertyCard.tsx` (landing) y
 * `components/mis-propiedades/columnas.tsx#FotoPropiedad` (US-02).
 */
import { useState } from 'react'

/** Foto que se muestra cuando una propiedad no tiene fotos o la suya no carga. */
export const PLACEHOLDER_PHOTO_SRC = '/placeholder-propiedad.svg'

/** Lo que devuelve {@link useFotoConRespaldo}: el `src` a usar y el `onError` a pasarle a la imagen. */
export interface FotoConRespaldo {
  src: string
  onError: () => void
}

/**
 * Devuelve el `src` a mostrar: el original, o `respaldo` si el original ya
 * falló una vez.
 *
 * NOTA: se guarda QUÉ `src` falló (no un "falló sí/no"): si la imagen cambia
 * (por ejemplo, la foto siguiente de un carrusel), la nueva se intenta
 * cargar normalmente, sin efectos para "resetear" el estado. Si el respaldo
 * también falla, no se hace nada más (evita un bucle de errores).
 *
 * @example
 * const foto = useFotoConRespaldo(propiedad.imageSrc)
 * return <Image src={foto.src} onError={foto.onError} alt="" fill />
 */
export function useFotoConRespaldo(src: string, respaldo: string = PLACEHOLDER_PHOTO_SRC): FotoConRespaldo {
  const [srcFallido, setSrcFallido] = useState<string | null>(null)
  const usarRespaldo = srcFallido === src && src !== respaldo

  return {
    src: usarRespaldo ? respaldo : src,
    onError: () => {
      if (src !== respaldo) setSrcFallido(src)
    },
  }
}
