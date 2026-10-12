import { useEffect, useRef, type ReactNode } from 'react'
import { HeroSearch } from '@rentar/ui'

// Datos reales del piloto (los mismos que usa la landing en `lib/search/buscadorLanding.ts`).
const neighborhoods = [
  { slug: 'nueva-cordoba', name: 'Nueva Córdoba' },
  { slug: 'guemes', name: 'Güemes' },
  { slug: 'centro', name: 'Centro' },
  { slug: 'general-paz', name: 'General Paz' },
  { slug: 'cofico', name: 'Cofico' },
  { slug: 'alta-cordoba', name: 'Alta Córdoba' },
]

// De $ 200.000 a $ 600.000 de a $ 50.000, y después los saltos grandes (decisión del PO, 01/10/2026).
const priceSteps = [200000, 250000, 300000, 350000, 400000, 450000, 500000, 550000, 600000, 700000, 800000, 1000000, 1500000]

// Sin "Apto profesional": en la landing no se ofrece (no existe en `tags_inmueble`).
const characteristics = [
  { key: 'amoblado' as const, label: 'Amoblado' },
  { key: 'mascotas' as const, label: 'Acepta mascotas' },
  { key: 'cochera' as const, label: 'Cochera' },
  { key: 'balcon' as const, label: 'Balcón' },
]

// La primera oración de la ayuda del alta (`INDICE_INFO`), igual que la landing.
const indexHelp = {
  IPC: 'Es la inflación que publica el INDEC.',
  ICL: 'Lo publica el Banco Central y mezcla sueldos e inflación.',
}

/**
 * NOTA: el ancho de cada historia lo da el contenedor. La fila única (70rem
 * o más) es un container query, así que responde a este ancho. Lo que
 * depende del ancho de la pantalla (panel flotante o hoja desde abajo,
 * "Dormitorios" en la fila o en "Más filtros") sigue al viewport de la card.
 */
function Frame({ width, children }: { width: number; children: ReactNode }) {
  return <div style={{ width, maxWidth: '100%' }}>{children}</div>
}

/** Escritorio (1200 px): Zona, Tipología, Desde, Hasta y Dormitorios en una sola fila. */
export function Escritorio() {
  return (
    <Frame width={1200}>
      <HeroSearch id="preview-hero-escritorio" neighborhoods={neighborhoods} priceSteps={priceSteps} characteristics={characteristics} indexHelp={indexHelp} onSearch={() => {}} />
    </Frame>
  )
}

/** Tablet (768 px): los campos en dos columnas y "Buscar" a todo el ancho. */
export function Tablet768() {
  return (
    <Frame width={768}>
      <HeroSearch id="preview-hero-768" neighborhoods={neighborhoods} priceSteps={priceSteps} characteristics={characteristics} indexHelp={indexHelp} onSearch={() => {}} />
    </Frame>
  )
}

/** Ancho y alto del teléfono de la historia móvil. */
const MOVIL = { width: 375, height: 720 }

/**
 * Móvil (375 px) con "Más filtros" abierto como hoja desde abajo.
 *
 * NOTA: la hoja y el lugar de "Dormitorios" dependen del ancho de la
 * PANTALLA (media query + `matchMedia`), no del contenedor, y la card tiene
 * un solo viewport (ancho, para que `Escritorio` entre en una fila). Por eso,
 * en una card ancha esta historia se vuelve a cargar a sí misma
 * (`?story=MovilConHojaAbierta`) dentro de un iframe de 375 px: ahí el
 * componente real ve un viewport de teléfono. Dentro del iframe (ya angosto)
 * se dibuja directo, sin otro iframe.
 */
export function MovilConHojaAbierta() {
  const ref = useRef<HTMLDivElement>(null)
  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 768
  useEffect(() => {
    if (!isNarrow) return
    const details = ref.current?.querySelector('details')
    if (details) details.open = true
  }, [isNarrow])

  if (!isNarrow) {
    const url = new URL(window.location.href)
    url.searchParams.set('story', 'MovilConHojaAbierta')
    return (
      <iframe
        title="HeroSearch en un teléfono de 375 px"
        src={url.toString()}
        style={{ width: MOVIL.width + 48, height: MOVIL.height + 48, border: 0, display: 'block' }}
      />
    )
  }
  return (
    <div ref={ref} style={{ position: 'relative', width: MOVIL.width, height: MOVIL.height, transform: 'translateZ(0)' }}>
      <HeroSearch id="preview-hero-movil" neighborhoods={neighborhoods} priceSteps={priceSteps} characteristics={characteristics} indexHelp={indexHelp} onSearch={() => {}} />
    </div>
  )
}
