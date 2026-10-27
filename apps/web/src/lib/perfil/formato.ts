/**
 * formato.ts — cómo se muestran los datos personales en "Mi perfil".
 *
 * Qué es: funciones puras de formato, sin estado.
 * Cubre: US-20 Consultar usuario ("el teléfono se debe mostrar con el
 * formato visual UIT-T E.123"; "la fecha de nacimiento se debe mostrar con el
 * formato dd/mm/aaaa"). Reusa el formato E.123 de US-35 (`solicitud.rules.ts`).
 * Quién lo usa: `components/perfil/*` y la rama mock de `services/perfil.service.ts`.
 */
import dayjs from 'dayjs'
import { CODIGO_PAIS_POR_DEFECTO, formatoE123 } from '@/lib/validation/solicitud.rules'

/**
 * Cualquier teléfono guardado → E.164 (`+543515550101`), o `null` si no hay.
 * El registro (US-19) guarda 10 dígitos sin código de país ("351 555 0101"):
 * se le antepone el 54, igual que al precargar la solicitud (decisión del PO).
 */
export function telefonoAE164(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (!digitos) return null
  return `+${digitos.length === 10 ? `${CODIGO_PAIS_POR_DEFECTO}${digitos}` : digitos}`
}

/**
 * Largo mínimo de un teléfono que ya trae el código de país: un número
 * nacional argentino tiene 10 dígitos (área + abonado), así que con 11 o más
 * se asume que el código de país está adelante.
 */
const DIGITOS_CON_CODIGO_PAIS = 11

/**
 * Teléfono de `GET /usuarios/me` (solo dígitos, sin "+") → `PerfilUsuario.telefono`.
 * - Con código de país (11 dígitos o más) → E.164 (`+543515550101`).
 * - Sin código de país (los 10 dígitos del seed, "3511112233") → los dígitos
 *   tal cual, SIN "+": no se inventa el 54 (decisión del PO para el modo
 *   real; brecha de datos anotada en HANDOFF §7).
 * NOTA: a diferencia de {@link telefonoAE164} (modo mock y solicitudes), acá
 * no se completa nada: lo que se muestra es lo que guardó el back.
 */
export function telefonoDelBack(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  if (!digitos) return null
  return digitos.length >= DIGITOS_CON_CODIGO_PAIS ? `+${digitos}` : digitos
}

/** `true` si el teléfono del perfil trae el código de país (es un E.164 con "+"). */
export function tieneCodigoPais(telefono: string): boolean {
  return telefono.startsWith('+')
}

/**
 * Teléfono del perfil → lo que se muestra (US-20). E.164 → E.123
 * ("+54 351 555 0101"); sin código de país (ver {@link telefonoDelBack}),
 * tal cual: sin "+" ni espacios inventados.
 */
export function telefonoParaMostrar(telefono: string): string {
  return tieneCodigoPais(telefono) ? formatoE123(telefono) : telefono
}

/** `1985-06-14` → `14/06/1985` (US-20). */
export function fechaParaMostrar(fechaIso: string): string {
  return dayjs(fechaIso).format('DD/MM/YYYY')
}

/** `30123456` → `30.123.456`: el DNI con puntos, como se lee en Argentina. */
export function dniParaMostrar(dni: string): string {
  return dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
