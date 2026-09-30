/**
 * app/layout.tsx — layout raíz de toda la app (Server Component).
 *
 * Qué es: pone `<html>`/`<body>` una sola vez, la fuente League Spartan, el
 * registro SSR de estilos de antd (`AntdRegistry`: sin él, Ant Design
 * "parpadea" sin estilos en el primer render del servidor), el tema de marca
 * (`ConfigProvider`) y los providers cliente (`AppProviders`: sesión y
 * adaptadores de next/image y next/link).
 * Quién lo usa: Next.js, para todas las rutas.
 */
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { League_Spartan } from 'next/font/google'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import { ConfigProvider } from 'antd'
// Import directo de theme.ts/locale.ts (no del barrel @rentar/ui): ese
// barrel también re-exporta statusMeta (usa @ant-design/icons, que usa
// Context de React). Este layout es un Server Component, donde Context no
// existe — pasar por el barrel rompe el build. Ver el comentario en
// packages/ui/src/theme.ts.
import { antdTheme } from '@rentar/ui/src/theme'
import { antdLocale } from '@rentar/ui/src/locale'
import '@rentar/ui/src/tokens/css-vars.css'
import { AppProviders } from '@/lib/AppProviders'
import './globals.css'

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-league-spartan',
  display: 'swap',
})

/**
 * Título y descripción de la pestaña del navegador (Next.js los lee de este export).
 *
 * `title.template`: cada página exporta solo su nombre (`{ title: 'Mis
 * propiedades' }`) y Next le suma "— RentAR". La landing no exporta título y
 * usa `default`.
 */
export const metadata: Metadata = {
  title: {
    default: 'RentAR — Alquilá directo, sin inmobiliaria',
    template: '%s — RentAR',
  },
  description:
    'RentAR: alquilá o publicá tu propiedad en Córdoba directamente entre particulares, sin inmobiliaria. Contrato con firma electrónica, ajuste automático por IPC/ICL y pagos trazables.',
}

/** Layout raíz: fuente, estilos SSR de antd, tema de marca y providers. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-AR" className={leagueSpartan.variable}>
      <body>
        <AntdRegistry>
          <ConfigProvider theme={antdTheme} locale={antdLocale}>
            <AppProviders>{children}</AppProviders>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  )
}
