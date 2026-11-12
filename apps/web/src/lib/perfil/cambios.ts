/**
 * cambios.ts — qué cambió en el bloque "Datos personales" de "Mi perfil".
 *
 * Qué es: funciones puras, sin estado, que pasan el perfil guardado a los
 * valores del formulario y comparan lo escrito contra lo guardado.
 * Cubre: US-21 Modificar usuario ("cada bloque se modifica y se guarda por
 * separado"; "Cancelar restaura los valores guardados del bloque"; "se debe
 * avisar si el usuario intenta salir de la pantalla con cambios sin guardar").
 *
 * NOTA: la misma comparación decide tres cosas, para que no se contradigan:
 * qué viaja al back al guardar, si el botón Guardar está habilitado y si
 * `AvisoCambiosProvider` frena la salida. Por eso se normaliza igual que al
 * enviar: nombre y apellido sin espacios en los extremos, el correo en
 * minúsculas, el teléfono por sus dígitos (sin espacios ni "+") y la fecha
 * como valor `YYYY-MM-DD`, no como el texto que se ve en el campo.
 *
 * Quién lo usa: `components/perfil/DatosPersonalesBloque.tsx`.
 */
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import type { DatosPersonalesCambios, PerfilUsuario } from '@rentar/shared-types'
import { aE164, formatoTelefonoEnCampo, telefonoParaPrecargar } from '@/lib/validation/solicitud.rules'
import { soloDigitos } from '@/lib/validation/usuario.rules'
import { tieneCodigoPais } from './formato'

/** Los campos del formulario de Datos personales, como los maneja antd `Form`. */
export interface ValoresDatos {
  nombre: string
  apellido: string
  dni: string
  email: string
  /** Lo que se ve en el campo, sin el "+" (que es fijo). */
  telefono: string
  fechaNacimiento: Dayjs | null
}

/** Opciones de {@link cambiosEntre} y {@link hayCambiosDatos}. */
export interface OpcionesCambios {
  /**
   * Nombre, apellido y DNI bloqueados por un contrato vigente o pendiente de
   * firma (`bloqueo_identidad`, US-21): no cuentan como cambio aunque el
   * campo tenga otro valor.
   */
  bloqueado: boolean
}

/**
 * Teléfono guardado → lo que se precarga en el campo. Un teléfono sin código
 * de país (modo real, los 10 dígitos del seed) se precarga tal cual: no se le
 * agrega el 54 (decisión del PO; si el usuario no lo toca, no viaja).
 */
export function telefonoInicial(telefono: string | null): string {
  if (telefono && !tieneCodigoPais(telefono)) return formatoTelefonoEnCampo(telefono)
  return telefonoParaPrecargar(telefono)
}

/** Perfil → valores del formulario (lo que restaura Cancelar). */
export function valoresDe(perfil: PerfilUsuario): ValoresDatos {
  return {
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    dni: perfil.dni ?? '',
    email: perfil.email,
    telefono: telefonoInicial(perfil.telefono),
    fechaNacimiento: perfil.fechaNacimiento ? dayjs(perfil.fechaNacimiento) : null,
  }
}

/** Teléfono del campo → E.164, o `null` si quedó vacío o solo con el código de país. */
export function telefonoDelCampo(texto: string): string | null {
  const e164 = aE164(texto)
  return e164 && e164.length > 4 ? e164 : null
}

/**
 * Fecha del campo → `YYYY-MM-DD`, o `null` si está vacía.
 * NOTA: se arma con `format` de dayjs, que usa la fecha local, nunca con
 * `toISOString()` (UTC). El valor del DatePicker puede traer una hora: el
 * 12/04/1995 a las 22:00 de Córdoba (UTC-3) es el 13/04 en UTC, y con
 * `toISOString()` se guardaría un día corrido.
 */
export function fechaDelCampo(fecha: Dayjs | null | undefined): string | null {
  return fecha ? fecha.format('YYYY-MM-DD') : null
}

/**
 * Lo que cambió respecto del perfil guardado: solo eso viaja al back (US-21
 * "cada bloque se guarda por separado"). Con `bloqueado`, nombre, apellido y
 * DNI no se miran. Un DNI o un correo vacíos no viajan: la validación del
 * formulario ya los marca como error cuando corresponde.
 *
 * Casos (perfil guardado de Lucía: teléfono `+5493515550101`, fecha `1995-04-12`):
 * - Valores recién abiertos (`valoresDe(perfil)`) → `{}`.
 * - Nombre `"  Lucía "` → `{}` (se compara sin espacios en los extremos).
 * - Correo con mayúsculas del guardado → `{}`.
 * - Teléfono `"54 9 351 555 0101"` (mismo número, otros espacios) → `{}`.
 * - Teléfono `"54 9 351 555 0199"` → `{ telefono: '+5493515550199' }`.
 * - Teléfono vacío o solo `"54 "` → `{ telefono: null }` (lo frena la validación).
 * - Fecha 12/04/1995 elegida de nuevo en el calendario → `{}`.
 * - Con `bloqueado` y nombre `"Otro"` → `{}`.
 */
export function cambiosEntre(perfil: PerfilUsuario, valores: ValoresDatos, { bloqueado }: OpcionesCambios): DatosPersonalesCambios {
  const cambios: DatosPersonalesCambios = {}
  if (!bloqueado) {
    if (valores.nombre.trim() !== perfil.nombre) cambios.nombre = valores.nombre.trim()
    if (valores.apellido.trim() !== perfil.apellido) cambios.apellido = valores.apellido.trim()
    const dni = soloDigitos(valores.dni)
    if (dni && dni !== perfil.dni) cambios.dni = dni
  }
  // El correo se compara sin mayúsculas: el back lo guarda en minúsculas.
  const email = valores.email.trim().toLowerCase()
  if (email && email !== perfil.email.toLowerCase()) cambios.email = email
  // Se comparan los dígitos: el guardado puede no tener "+" (sin código de país).
  const telefono = telefonoDelCampo(valores.telefono)
  if (soloDigitos(telefono ?? '') !== soloDigitos(perfil.telefono ?? '')) cambios.telefono = telefono
  const fecha = fechaDelCampo(valores.fechaNacimiento)
  if (fecha !== perfil.fechaNacimiento) cambios.fechaNacimiento = fecha
  return cambios
}

/**
 * `true` si el bloque tiene algo distinto de lo guardado. Es el criterio del
 * botón Guardar y del aviso de cambios sin guardar (ver la NOTA del encabezado).
 * Si el usuario cambia un campo y lo vuelve a dejar como estaba, da `false`.
 */
export function hayCambiosDatos(perfil: PerfilUsuario, valores: ValoresDatos, opciones: OpcionesCambios): boolean {
  return Object.keys(cambiosEntre(perfil, valores, opciones)).length > 0
}
