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
 * `true` si el `src` es una foto remota (`http(s)://`, p. ej. Supabase
 * Storage) o una data URL: esas no pasan por el optimizador de Next (ver
 * {@link AppImage}).
 */
function esFotoRemota(src: string): boolean {
  return /^(https?:)?\/\//i.test(src) || src.startsWith('data:')
}

/**
 * Adaptador de `ImageComponentProps` → `next/image`, con optimización real.
 * Sin `fill`, `next/image` exige `width`/`height` — todo llamador de
 * `@rentar/ui` que no use `fill` los pasa (típicamente `logo.width`/
 * `logo.height` de una imagen importada estáticamente).
 *
 * Si la imagen no carga, muestra el placeholder de propiedad en vez del
 * ícono de imagen rota (`useFotoConRespaldo`). Las imágenes que pasan por
 * acá son casi todas fotos de propiedades (tarjetas de `@rentar/ui`).
 *
 * NOTA: las fotos remotas (Supabase Storage) y las data URL (modo mock) van
 * con `unoptimized`: el navegador las pide directo al bucket, igual que la
 * galería del detalle (`PhotoGallery`, `<Image>` de antd). Si pasaran por el
 * optimizador, el `src` sería `/_next/image?url=https%3A%2F%2F...` (la URL
 * del bucket codificada) y la foto dependería de que el servidor de Next
 * pueda bajarla: falla si el host resuelve a una IP privada (Next 16 lo
 * bloquea), si no está en `images.remotePatterns` o si se agota el cupo de
 * optimización de Vercel. Eso rompía las tarjetas de la landing y de
 * `/buscar` mientras el detalle sí cargaba. Las fotos ya llegan livianas
 * (≤ 350 KB, US-01), así que optimizarlas no ahorra casi nada. Los assets
 * locales (logo, ilustraciones, fotos del elenco) se siguen optimizando.
 */
export function AppImage({ src, alt, fill, width, height, sizes, priority, className, style }: ImageComponentProps) {
  const foto = useFotoConRespaldo(src)
  const unoptimized = esFotoRemota(foto.src)
  if (fill) {
    return <Image src={foto.src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={unoptimized} className={className} style={style} onError={foto.onError} />
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
      unoptimized={unoptimized}
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
