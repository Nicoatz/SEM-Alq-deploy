/**
 * /buscar — Buscar propiedades (US-34 Consultar propiedades a alquilar). Arquetipo A1.
 *
 * Diseño: Claude Design, "Búsqueda de propiedades" · 01, 03 y 04.
 * Entra desde: "Buscar propiedades" del Header y del Footer, y "Buscar más
 * propiedades" de la landing. Accesible con y sin sesión.
 *
 * La pantalla entera es un Client Component (`BuscarPropiedades`): lee la
 * búsqueda de la URL y llama al service desde el navegador. `Suspense` es
 * obligatorio en Next.js 16 para usar `useSearchParams` en una página que se
 * pre-renderiza; mientras tanto se ven las tarjetas "esqueleto".
 */
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { BuscarPropiedades } from '@/components/buscar/BuscarPropiedades'
import { ResultadosCargando } from '@/components/buscar/ResultadosBusqueda'

/** Título y descripción de la pestaña del navegador (Next.js los lee de este export). */
export const metadata: Metadata = {
  title: 'Buscar propiedades',
  description: 'Alquileres de larga duración en Córdoba, directo con el dueño: filtrá por barrio, precio, tipología y más.',
}

/** Monta la búsqueda (US-34). Va con Suspense porque lee los filtros de la URL. */
export default function BuscarPage() {
  return (
    <Suspense fallback={<ResultadosCargando />}>
      <BuscarPropiedades />
    </Suspense>
  )
}
