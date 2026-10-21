/**
 * paginas.ts — cómo se divide el documento del contrato en páginas.
 *
 * Qué es: lógica pura (sin React). Cubre US-07 Firmar contrato de alquiler:
 * "el botón 'Firmar contrato' solo se habilita cuando el usuario llegó a la
 * última página del documento" y "se debe indicar cuántas páginas faltan
 * leer". Para eso, una "página" tiene que ser la misma para todos.
 *
 * NOTA (cómo se define una página): por CONTENIDO, nunca por el alto de la
 * pantalla. Las cláusulas se agrupan en orden hasta juntar unos
 * {@link CARACTERES_POR_PAGINA} caracteres, sin cortar nunca una cláusula
 * (si una sola pasa el tope, ocupa su propia página). La primera página
 * lleva además el título. Así el contrato tiene la misma cantidad de
 * páginas a 390 y a 1440 px, y "te faltan 2 páginas" significa lo mismo en
 * el celular y en la computadora. Con la plantilla RentAR (14 cláusulas),
 * CT-2026-0207 queda en 6 páginas, como el diseño.
 *
 * Quién lo usa: `components/contratos/VisorContrato.tsx` (y la hoja de
 * impresión, que corta en las mismas páginas).
 */
import type { ClausulaContrato } from '@rentar/shared-types'

/**
 * Tope aproximado de caracteres por página: lo que se lee cómodo en el visor
 * sin scroll largo, también a 390 px (unas 2 o 3 cláusulas).
 */
export const CARACTERES_POR_PAGINA = 800

/** Una cláusula dentro de una página, con su número en el contrato (1, 2, 3…). */
export interface ClausulaEnPagina {
  numero: number
  clausula: ClausulaContrato
}

/** Una página del documento. */
export interface PaginaContrato {
  /** 1, 2, 3… */
  numero: number
  clausulas: ClausulaEnPagina[]
}

/** Lo que "pesa" una cláusula: título y texto (los huecos vacíos cuentan como una línea). */
function largoDe(clausula: ClausulaContrato): number {
  return (clausula.titulo || ' ').length + Math.max(clausula.texto.length, 40)
}

/**
 * Divide las cláusulas en páginas (ver la NOTA del encabezado). Siempre
 * devuelve al menos una página, aunque no haya cláusulas.
 * @example paginarContrato(clausulasDe0207).length // 6
 */
export function paginarContrato(clausulas: readonly ClausulaContrato[]): PaginaContrato[] {
  const paginas: PaginaContrato[] = []
  let actual: ClausulaEnPagina[] = []
  let ocupado = 0
  clausulas.forEach((clausula, indice) => {
    const largo = largoDe(clausula)
    if (actual.length > 0 && ocupado + largo > CARACTERES_POR_PAGINA) {
      paginas.push({ numero: paginas.length + 1, clausulas: actual })
      actual = []
      ocupado = 0
    }
    actual.push({ numero: indice + 1, clausula })
    ocupado += largo
  })
  paginas.push({ numero: paginas.length + 1, clausulas: actual })
  return paginas
}

/**
 * Progreso de lectura (US-07: "volver a páginas anteriores no reduce el
 * progreso de lectura"): la página más alta que se llegó a ver.
 * @param leidaHasta Página más alta vista hasta ahora (1 al abrir).
 * @param vista Página que se acaba de abrir.
 */
export function avanzarLectura(leidaHasta: number, vista: number): number {
  return Math.max(leidaHasta, vista)
}

/** US-07: "se debe indicar cuántas páginas faltan leer" (0 = llegó al final). */
export function paginasQueFaltan(leidaHasta: number, total: number): number {
  return Math.max(total - leidaHasta, 0)
}
