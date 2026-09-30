/**
 * /design-system — catálogo vivo de `@rentar/ui` (solo para el equipo, no es del producto).
 *
 * Qué es: monta `components/DesignSystem.tsx`. El Header muestra el link
 * solo en desarrollo.
 * Quién lo usa: el equipo, para ver cada componente con sus estados.
 */
import type { Metadata } from 'next'
import DesignSystem from '@/components/DesignSystem'

/** Título y descripción de la pestaña del navegador (Next.js los lee de este export). */
export const metadata: Metadata = {
  title: 'Sistema de Diseño',
  description: 'Referencia visual e interactiva del sistema de diseño de RentAR: colores, tipografía, espaciado, componentes y reglas de uso.',
}

/** Página del catálogo. */
export default function Page() {
  return <DesignSystem />
}
