/**
 * next.config.mjs — configuración de Next.js para apps/web.
 *
 * `transpilePackages`: @rentar/ui y @rentar/shared-types se consumen como
 * TypeScript fuente (sin build propio); Next.js los transpila igual que al
 * código de esta app. La resolución de @rentar/shared-types a su `src/` la
 * fija el alias `paths` de `tsconfig.json`.
 *
 * `images.remotePatterns`: de qué hosts externos puede cargar fotos
 * `next/image` (cualquier otro responde 400). Las fotos de las propiedades
 * (US-01) se guardan como URL:
 * - Supabase Storage: URLs públicas del bucket `fotos-propiedades`
 *   (`https://<proyecto>.supabase.co/storage/v1/object/public/...`).
 * - rentar.com: NOTA: solo por las fotos de prueba del seed de la base
 *   (`https://rentar.com/fotos/...`), que en realidad no existen. Sacarlo
 *   cuando la base tenga fotos reales en Storage.
 *
 * NOTA: las fotos remotas de las propiedades ya no pasan por el optimizador
 * de Next: van con `unoptimized` y el navegador las pide directo al bucket
 * (ver `lib/next-bridge.tsx#AppImage`). Esta lista queda para cualquier
 * `next/image` remoto que sí se optimice.
 *
 * `headers()`: la página pública del garante (`/firma-garante/[token]`, US-07)
 * lleva el token en la URL. Con `Referrer-Policy: no-referrer` el navegador no
 * lo manda en el `Referer` a ningún otro sitio (DocuSign, fuentes, etc.).
 * La página también lo declara en su metadata: esto lo cubre desde el primer byte.
 *
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  transpilePackages: ['@rentar/ui', '@rentar/shared-types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
      { protocol: 'https', hostname: 'rentar.com', pathname: '/fotos/**' },
    ],
  },
  async headers() {
    return [{ source: '/firma-garante/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }] }]
  },
}

export default nextConfig
