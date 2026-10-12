/**
 * panel.mock.ts — cobros y reclamos del elenco para `/panel`.
 *
 * Qué es: los datos de otros módulos (Cobros, Reclamos, Solicitudes, de
 * sprints futuros) que el inicio del locador y "Mis propiedades" (US-02)
 * necesitan mostrar. Todo sale del elenco (`propiedades.mock.ts`): mismos
 * inquilinos, mismos montos, mismas propiedades. Nada de fechas relativas
 * escritas a mano: "vence en 5 días" o "hace 2 días" se calculan contra
 * hoy (`lib/utils/fechas.ts`).
 *
 * Cómo se calcula cada cifra del panel (en `services/panel.service.ts`):
 * - **Cobrado / Total del mes**: suma de los `amount` de {@link cobros} del
 *   período con `paidAt` (cobrado) sobre la suma de todos los del período
 *   (total). Nicolás, septiembre: $435.800 / $1.855.800.
 * - **Cobros vencidos**: suma de los cobros sin `paidAt` cuyo `dueDate` ya
 *   pasó. Nicolás: Laprida 340 ($520.000) + Belgrano 1120 ($460.000) =
 *   $980.000, 2 cobros.
 * - **Estado del alquiler** (listado, US-02): del cobro del período de cada
 *   propiedad. Con `paidAt` → al día; sin `paidAt` y `dueDate` futuro → con
 *   pago pendiente; sin `paidAt` y `dueDate` pasado → retrasada, con los días
 *   de atraso = hoy − `dueDate`.
 * - **Reclamos abiertos**: {@link reclamos} en estado `abierto` o
 *   `en_proceso`. "Sin responder" = sin `answeredAt`. Nicolás: 3 abiertos, 1
 *   sin responder.
 * - **Contratos por vencer o por ajustar (60 días)**: de `rental` de cada
 *   propiedad alquilada (`nextAdjustmentDate` y `endDate`), los que caen en
 *   los próximos 60 días.
 * - **Solicitudes nuevas**: las de `solicitudes.mock.ts` (más las enviadas
 *   en el navegador) en estado `pendiente`, de propiedades del locador.
 *
 * Quién lo usa: la rama mock de `services/panel.service.ts` y de
 * `services/propiedades.service.ts`. Ninguna pantalla lo importa directo.
 *
 * TODO(db): son filas de las tablas de cobros y reclamos, que
 * todavía no existen en el back.
 */
import type { ClaimStatus } from '@rentar/shared-types'

// ─── Tipos ──────────────────────────────────────────────────────────────

/** El cobro de un período (mes) de un alquiler. */
export interface CobroMock {
  /** Prefijo `RC-2026-` (el del recibo del período). */
  id: string
  propertyId: string
  contractId: string
  /** Período, "YYYY-MM". */
  period: string
  amount: number
  /** Fecha ISO de vencimiento del período. */
  dueDate: string
  /** Fecha ISO de acreditación; `null` = todavía no se pagó. */
  paidAt: string | null
}

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


// ─── Cobros de septiembre de 2026 ───────────────────────────────────────
// Un cobro por alquiler. Cada contrato vence un día distinto del mes (el
// que se pactó al firmar).

export const cobros: CobroMock[] = [
  {
    id: 'RC-2026-0911',
    propertyId: 'prop-obispo-trejo-1250',
    contractId: 'CT-2026-0148',
    period: '2026-09',
    // Mapa: "Septiembre se paga $435.800 ($470.000 − $34.200 de
    // extraordinarias)". Sofía está al día: lo pagó el 03/09.
    amount: 435800,
    dueDate: '2026-09-10',
    paidAt: '2026-09-03',
  },
  {
    id: 'RC-2026-0904',
    propertyId: 'prop-laprida-340',
    contractId: 'CT-2026-0102',
    period: '2026-09',
    // Tomás Bianchi: vencido el 04/09 (19 días de atraso al 23/09).
    amount: 520000,
    dueDate: '2026-09-04',
    paidAt: null,
  },
  {
    id: 'RC-2026-0916',
    propertyId: 'prop-belgrano-1120',
    contractId: 'CT-2026-0115',
    period: '2026-09',
    // Julián Ferreyra: vencido el 16/09 (7 días de atraso al 23/09).
    amount: 460000,
    dueDate: '2026-09-16',
    paidAt: null,
  },
  {
    id: 'RC-2026-0928',
    propertyId: 'prop-colon-2450',
    contractId: 'CT-2026-0121',
    period: '2026-09',
    // Martín Cabrera: pendiente, vence este mes (el 28/09).
    amount: 440000,
    dueDate: '2026-09-28',
    paidAt: null,
  },
  {
    id: 'RC-2026-0905',
    propertyId: 'prop-mariano-moreno-285',
    contractId: 'CT-2026-0133',
    period: '2026-09',
    // Camila Ríos (inquilina de Sofía): vencido el 05/09.
    amount: 510000,
    dueDate: '2026-09-05',
    paidAt: null,
  },
]

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
