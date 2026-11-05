/**
 * medios.ts — medios de un cobro registrado a mano.
 *
 * Qué es: la lista de US-08. El medio se muestra tal cual se cargó: un cobro a
 * mano nunca figura como pagado a través de RentAR.
 * Quién lo usa: `RegistrarCobroModal`, `DetallePeriodo` y `HojaComprobante`.
 */
import type { MedioCobro } from '@rentar/shared-types'

/** Texto de cada medio. */
export const ETIQUETA_MEDIO: Record<MedioCobro, string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  cheque: 'Cheque',
  mercadopago_externo: 'MercadoPago (fuera de RentAR)',
  otro: 'Otro',
}

/** Opciones del selector, en el orden de la US. */
export const OPCIONES_MEDIO = (Object.keys(ETIQUETA_MEDIO) as MedioCobro[]).map((value) => ({
  value,
  label: ETIQUETA_MEDIO[value],
}))
