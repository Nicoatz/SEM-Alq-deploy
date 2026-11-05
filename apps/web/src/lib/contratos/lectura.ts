/**
 * lectura.ts — el progreso de lectura del PDF antes de firmar.
 *
 * Qué es: regla pura sobre las páginas que ya se vieron, separada de la pantalla.
 * Cubre: US-07 Firmar contrato de alquiler, "Firma".
 * Quién lo usa: `components/contratos/FirmaContrato.tsx`.
 */

/**
 * US-07: "Mientras el botón no esté habilitado, se debe indicar cuántas páginas
 * faltan leer" y "Volver a páginas anteriores no reduce el progreso de lectura".
 * Cuenta desde la página más avanzada que se vio, no desde la que se ve ahora.
 *
 * Casos verificados:
 * - 6 páginas, vistas 1 y 2: faltan 4.
 * - 6 páginas, vistas 1 a 4, y volvió a la 2: siguen faltando 2.
 * - 6 páginas, vio la última: faltan 0.
 * - 1 página, vista: faltan 0.
 *
 * @param vistas Páginas vistas, desde 1.
 * @param total Páginas del PDF.
 */
export function paginasQueFaltanLeer(vistas: ReadonlySet<number>, total: number): number {
  return Math.max(total - Math.max(0, ...vistas), 0)
}
