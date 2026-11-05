/**
 * panel.mock.ts — los reclamos del elenco para `/panel`.
 *
 * Qué es: datos de un módulo de sprints futuros que el inicio del locador y "Mis
 * propiedades" (US-02) necesitan mostrar. Los cobros salen de `periodos.mock.ts`.
 *
 * TODO(db): son filas de la tabla de reclamos, que todavía no existe.
 */
import type { ClaimStatus } from '@rentar/shared-types'

// ─── Tipos ──────────────────────────────────────────────────────────────

/** Un reclamo de un locatario sobre la propiedad que alquila. */
export interface ReclamoMock {
  id: string
  propertyId: string
  title: string
  status: ClaimStatus
  /** Fecha ISO de creación. */
  createdAt: string
  /** Fecha ISO de la última respuesta del locador; `null` = sin responder. */
  answeredAt: string | null
}


// ─── Reclamos ───────────────────────────────────────────────────────────
// Títulos tomados del export del panel, asignados a los inquilinos del
// elenco: Laprida 340 tiene 2 abiertos y Av. Colón 2450 tiene 1.

export const reclamos: ReclamoMock[] = [
  {
    id: 'RCL-2026-0041',
    propertyId: 'prop-laprida-340',
    title: 'Pérdida de agua en el baño',
    status: 'abierto',
    createdAt: '2026-09-21',
    answeredAt: null,
  },
  {
    id: 'RCL-2026-0039',
    propertyId: 'prop-colon-2450',
    title: 'Ruido de la bomba de agua',
    status: 'en_proceso',
    createdAt: '2026-09-17',
    answeredAt: '2026-09-18',
  },
  {
    id: 'RCL-2026-0036',
    propertyId: 'prop-laprida-340',
    title: 'El termotanque no calienta',
    status: 'en_proceso',
    createdAt: '2026-09-12',
    answeredAt: '2026-09-13',
  },
]
