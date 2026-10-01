/**
 * lib/utils/format.ts — formato del precio mensual ("$ 580.000 /mes").
 *
 * Quién lo usa: el catálogo `/design-system` (ejemplo del slider de precio).
 * Para montos sin "/mes", usar `formatARS` de `@rentar/ui`.
 */
const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/**
 * Formatea un monto mensual en pesos argentinos (ej. `580000` -> "$580.000 /mes").
 * Se usa en DesignSystem.
 */
export function formatMonthlyPrice(amount: number): string {
  return `${currencyFormatter.format(amount)} /mes`
}
