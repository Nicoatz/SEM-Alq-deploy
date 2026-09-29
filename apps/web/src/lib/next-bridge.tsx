'use client'

/**
 * next-bridge.tsx — adaptadores reales de next/image y next/link para
 * @rentar/ui.
 *
 * Qué es: `packages/ui` expone un `NextBridgeProvider` genérico (ver
 * `packages/ui/src/providers/NextBridge.tsx`) que por default renderiza
 * `<img>`/`<a>` nativos — acá viven los ÚNICOS dos componentes de todo el
 * repo que traducen ese contrato a `next/image`/`next/link` de verdad.
 * Se inyectan una sola vez, en `lib/AppProviders.tsx` (Client Component).
 * Quién lo usa: `lib/AppProviders.tsx`.
 */
import Image from 'next/image'
import Link from 'next/link'
import type { ImageComponentProps, LinkComponentProps } from '@rentar/ui'
import { useFotoConRespaldo } from './imagenes/fotoConRespaldo'

/**
 * Adaptador de `ImageComponentProps` → `next/image`, con optimización real.
 * Sin `fill`, `next/image` exige `width`/`height` — todo llamador de
 * `@rentar/ui` que no use `fill` los pasa (típicamente `logo.width`/
 * `logo.height` de una imagen importada estáticamente).
 *
 * Si la imagen no carga, muestra el placeholder de propiedad en vez del
 * ícono de imagen rota (`useFotoConRespaldo`). Las imágenes que pasan por
 * acá son casi todas fotos de propiedades (tarjetas de `@rentar/ui`).
 */
export function AppImage({ src, alt, fill, width, height, sizes, priority, className, style }: ImageComponentProps) {
  const foto = useFotoConRespaldo(src)
  if (fill) {
    return <Image src={foto.src} alt={alt} fill sizes={sizes} priority={priority} className={className} style={style} onError={foto.onError} />
  }
  return (
    // NOTA: `?? 1` es una red de seguridad ante un llamador que rompa el
    // contrato (no manda width/height ni fill) — next/image tira en
    // build/runtime si le falta uno de los dos, así que un 1x1 visible es
    // preferible a que explote toda la página.
    <Image
      src={foto.src}
      alt={alt}
      width={width ?? 1}
      height={height ?? 1}
      sizes={sizes}
      priority={priority}
      className={className}
      style={style}
      onError={foto.onError}
    />
  )
}

/** Adaptador de `LinkComponentProps` → `next/link`, con navegación client-side real. */
export function AppLink({ href, children, ...rest }: LinkComponentProps) {
  return (
    <Link href={href} {...rest}>
      {children}
    </Link>
  )
}
