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

/** E.164 → "+54 351 555 0101" (US-20). */
export function telefonoParaMostrar(telefonoE164: string): string {
  return formatoE123(telefonoE164)
}

/** `1985-06-14` → `14/06/1985` (US-20). */
export function fechaParaMostrar(fechaIso: string): string {
  return dayjs(fechaIso).format('DD/MM/YYYY')
}

/** `30123456` → `30.123.456`: el DNI con puntos, como se lee en Argentina. */
export function dniParaMostrar(dni: string): string {
  return dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
