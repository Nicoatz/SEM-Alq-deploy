/**
 * periodos.mock.ts — períodos y cobros del elenco para `/panel/cobros`.
 *
 * Qué es: agosto, septiembre y octubre de 2026 de los 5 contratos vigentes.
 * Agosto está cobrado, septiembre sigue a `cobros` de `panel.mock.ts` (mismos
 * montos y vencimientos) y octubre es futuro: no se muestra ni se puede cobrar.
 * Cubre US-08, US-09 y US-10.
 *
 * NOTA: los cobros de septiembre del panel no se tocan: acá no se suman filas a
 * ese array, para no cambiar sus totales (decisión del PO, 05/11). Los ids de
 * período no llevan el formato `RC-`: ese es el de los comprobantes.
 *
 * Quién lo usa: `services/adapters/cobro-mock.adapter.ts`. Ninguna pantalla lo
 * importa.
 *
 * TODO(db): son filas de `periodo_cobro` y `cobro`.
 */
import type { MedioCobro } from '@rentar/shared-types'

/** Un período de un contrato. El estado se calcula contra hoy. */
export interface PeriodoMock {
  id: string
  contractId: string
  propertyId: string
  /** Mes `AAAA-MM`. */
  period: string
  /** Alquiler del período. */
  amount: number
}

/** Un cobro registrado. El id es el número del comprobante (US-10). */
export interface CobroRegistradoMock {
  id: string
  periodoId: string
  /** Fecha ISO del cobro. */
  fecha: string
  medio: MedioCobro
  nota: string | null
  registradoPor: string
  /** Fecha y hora ISO de la carga. */
  registradoEl: string
  /** Solo el nombre: el archivo no se guarda en `localStorage`. */
  adjuntoNombre: string | null
}

/**
 * Plazo de vencimiento de cada contrato, en días desde el inicio del período
 * (la misma regla que Mi alquiler, S4-2). Con estos plazos, al 23/09 Laprida
 * lleva 19 días de atraso y Belgrano 7, como en el resto del elenco.
 */
export const PLAZO_POR_CONTRATO: Record<string, number> = {
  'CT-2026-0102': 3,
  'CT-2026-0115': 15,
  'CT-2026-0121': 27,
  'CT-2026-0133': 4,
  'CT-2026-0148': 10,
}

/** Contrato, propiedad y alquiler de cada vigente del elenco. */
const CONTRATOS: { contractId: string; propertyId: string; amount: number }[] = [
  { contractId: 'CT-2026-0102', propertyId: 'prop-laprida-340', amount: 520000 },
  { contractId: 'CT-2026-0115', propertyId: 'prop-belgrano-1120', amount: 460000 },
  { contractId: 'CT-2026-0121', propertyId: 'prop-colon-2450', amount: 440000 },
  { contractId: 'CT-2026-0133', propertyId: 'prop-mariano-moreno-285', amount: 510000 },
  { contractId: 'CT-2026-0148', propertyId: 'prop-obispo-trejo-1250', amount: 470000 },
]

/** Id de un período: `PER-0102-2026-09`. */
function idDePeriodo(contractId: string, period: string): string {
  return `PER-${contractId.slice(-4)}-${period}`
}

export const periodos: PeriodoMock[] = CONTRATOS.flatMap(({ contractId, propertyId, amount }) =>
  ['2026-08', '2026-09', '2026-10'].map((period) => ({
    id: idDePeriodo(contractId, period),
    contractId,
    propertyId,
    period,
    amount,
  })),
)

const NICOLAS = 'Nicolás Arrieta'
const SOFIA = 'Sofía Ledesma'

export const cobrosDePeriodos: CobroRegistradoMock[] = [
  {
    // Tomás pagó 8 días tarde: con 5 de gracia, 3 días de mora ($7.800).
    id: 'RC-2026-0804',
    periodoId: 'PER-0102-2026-08',
    fecha: '2026-08-12',
    medio: 'efectivo',
    nota: null,
    registradoPor: NICOLAS,
    registradoEl: '2026-08-12T18:10:00',
    adjuntoNombre: null,
  },
  {
    id: 'RC-2026-0805',
    periodoId: 'PER-0133-2026-08',
    fecha: '2026-08-04',
    medio: 'transferencia',
    nota: null,
    registradoPor: SOFIA,
    registradoEl: '2026-08-04T10:25:00',
    adjuntoNombre: null,
  },
  {
    id: 'RC-2026-0811',
    periodoId: 'PER-0148-2026-08',
    fecha: '2026-08-05',
    medio: 'transferencia',
    nota: null,
    registradoPor: NICOLAS,
    registradoEl: '2026-08-05T09:40:00',
    adjuntoNombre: null,
  },
  {
    id: 'RC-2026-0816',
    periodoId: 'PER-0115-2026-08',
    fecha: '2026-08-14',
    medio: 'transferencia',
    nota: null,
    registradoPor: NICOLAS,
    registradoEl: '2026-08-14T12:05:00',
    adjuntoNombre: null,
  },
  {
    id: 'RC-2026-0828',
    periodoId: 'PER-0121-2026-08',
    fecha: '2026-08-20',
    medio: 'cheque',
    nota: null,
    registradoPor: NICOLAS,
    registradoEl: '2026-08-20T16:30:00',
    adjuntoNombre: null,
  },
  {
    // El cobro de septiembre de Sofía, el mismo del panel.
    id: 'RC-2026-0911',
    periodoId: 'PER-0148-2026-09',
    fecha: '2026-09-03',
    medio: 'transferencia',
    nota: null,
    registradoPor: NICOLAS,
    registradoEl: '2026-09-03T11:15:00',
    adjuntoNombre: 'transferencia-septiembre.pdf',
  },
]
