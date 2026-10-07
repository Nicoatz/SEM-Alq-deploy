'use client'

/**
 * BuscadorLanding.tsx — el buscador del hero de la landing, conectado a `/buscar`.
 *
 * Qué es: `HeroSearch` de `@rentar/ui` con las opciones de RentAR (barrios,
 * montos, características, ayuda de los índices) y la navegación de Next.
 * Cubre: US-34 Consultar propiedades a alquilar (lleva a `/buscar` con los
 * filtros aplicados).
 * De dónde saca los datos: catálogos fijos (`lib/search/buscadorLanding.ts`),
 * sin llamar al back.
 * Quién lo usa: `components/landing/LandingHero.tsx`.
 *
 * NOTA: sin JS el formulario se envía solo (GET a `/buscar`). Con JS, el
 * envío arma la URL con `hrefBuscarDesdeBuscador` (sin params vacíos) y
 * navega del lado del cliente.
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HeroSearch } from '@rentar/ui'
import {
  AYUDA_INDICES,
  BARRIOS_BUSCADOR,
  CARACTERISTICAS_BUSCADOR,
  PRECIOS_BUSCADOR,
  hrefBuscarDesdeBuscador,
} from '@/lib/search/buscadorLanding'

/** Buscador de la landing (`data-testid` con prefijo `landing-buscador`). */
export function BuscadorLanding() {
  const router = useRouter()

  // `/buscar` es el único destino del buscador: se precarga apenas se ve la landing.
  useEffect(() => {
    router.prefetch('/buscar')
  }, [router])

  return (
    <HeroSearch
      id="landing-buscador"
      neighborhoods={BARRIOS_BUSCADOR}
      priceSteps={PRECIOS_BUSCADOR}
      characteristics={CARACTERISTICAS_BUSCADOR}
      indexHelp={AYUDA_INDICES}
      onSearch={(valores) => router.push(hrefBuscarDesdeBuscador(valores))}
      data-testid="landing-buscador"
    />
  )
}
