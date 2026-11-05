/**
 * montoEnLetras.ts — el total del comprobante en letras.
 *
 * Qué es: US-10 pide el total en números y en letras. Se arma acá, en mock y en
 * real, porque el texto del back tiene errores (issue #27, punto 7).
 * Quién lo usa: `HojaComprobante`.
 */

const UNIDADES = [
  '', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez',
  'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
  'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis',
  'veintisiete', 'veintiocho', 'veintinueve',
]
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa']
const CENTENAS = [
  '', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos',
  'ochocientos', 'novecientos',
]

/** Un número de 1 a 999 en letras. */
function hastaMil(numero: number): string {
  if (numero === 100) return 'cien'
  const resto = numero % 100
  const centena = CENTENAS[Math.floor(numero / 100)]
  const decena = resto < 30
    ? UNIDADES[resto]
    : [DECENAS[Math.floor(resto / 10)], UNIDADES[resto % 10]].filter(Boolean).join(' y ')
  return [centena, decena].filter(Boolean).join(' ')
}

/** "uno" pierde la última letra antes de "mil" o "millones": "veintiún mil", "treinta y un mil". */
function apocopar(texto: string): string {
  return texto.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un')
}

/** Un entero positivo en letras. */
function enteroEnLetras(numero: number): string {
  if (numero === 0) return 'cero'
  const millones = Math.floor(numero / 1_000_000)
  const miles = Math.floor((numero % 1_000_000) / 1000)
  const resto = numero % 1000
  const partes: string[] = []
  if (millones === 1) partes.push('un millón')
  else if (millones > 1) partes.push(`${apocopar(enteroEnLetras(millones))} millones`)
  if (miles === 1) partes.push('mil')
  else if (miles > 1) partes.push(`${apocopar(hastaMil(miles))} mil`)
  if (resto > 0) partes.push(hastaMil(resto))
  return partes.join(' ')
}

/**
 * Monto en letras, con los centavos en número.
 *
 * @example
 * montoEnLetras(150000) // → 'Pesos ciento cincuenta mil con 00/100'
 * montoEnLetras(21000) // → 'Pesos veintiún mil con 00/100'
 * montoEnLetras(1500000) // → 'Pesos un millón quinientos mil con 00/100'
 * montoEnLetras(470000) // → 'Pesos cuatrocientos setenta mil con 00/100'
 * montoEnLetras(479400.5) // → 'Pesos cuatrocientos setenta y nueve mil cuatrocientos con 50/100'
 */
export function montoEnLetras(monto: number): string {
  const centavosTotales = Math.round(monto * 100)
  const entero = Math.floor(centavosTotales / 100)
  const centavos = String(centavosTotales % 100).padStart(2, '0')
  return `Pesos ${enteroEnLetras(entero)} con ${centavos}/100`
}
