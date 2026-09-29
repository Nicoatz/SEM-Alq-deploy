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
}

export default nextConfig
