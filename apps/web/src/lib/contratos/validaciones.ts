/**
 * validaciones.ts — las reglas del alta de contrato, en un solo lugar.
 *
 * Qué es: funciones puras que devuelven el mensaje de error (o `null`), más
 * las reglas de antd `Form` armadas con ellas. Las usan los pasos del alta
 * (para ayudar mientras se carga) y la rama mock de
 * `services/contratos.service.ts` (para responder como el back).
 * TODO(backend): repetir estas reglas; el front valida para ayudar, no para proteger.
 * Cubre: US-05 Registrar contrato de alquiler (pasos 1, 2 y 3).
 * Reusa: DNI y nombre de `usuario.rules.ts` (US-19/US-21) y el correo de
 * `solicitud.rules.ts` (US-35), como pide la US.
 * Quién lo usa: `components/contratos/*` y `services/contratos.service.ts`.
 */
import type { FormRule } from 'antd'
import type { ClausulaContrato, CondicionesNuevoContrato, ContratoBorrador, GaranteContrato, ParteContrato } from '@rentar/shared-types'
import { emailValido, MENSAJES_SOLICITUD } from '@/lib/validation/solicitud.rules'
import { DNI_REGEX, NOMBRE_REGEX, soloDigitos } from '@/lib/validation/usuario.rules'
import { fechaCorta, inicioValido } from './fechas'

// ─── Límites y valores por defecto (US-05) ──────────────────────────────

/** US-05: "se pueden agregar hasta 3 garantes". */
export const GARANTES_MAX = 3
/** US-05: "máximo de 1.000 caracteres por cláusula". */
export const CLAUSULA_MAX = 1000
/** US-05: "por defecto es 24 meses". */
export const DURACION_POR_DEFECTO = 24
/** US-05: "entre 1 y 28. Por defecto es el día 10". */
export const DIA_VENCIMIENTO_MIN = 1
export const DIA_VENCIMIENTO_MAX = 28
export const DIA_VENCIMIENTO_POR_DEFECTO = 10

// ─── Mensajes ───────────────────────────────────────────────────────────

export const MENSAJES_CONTRATO = {
  garanteNombreVacio: 'Escribí el nombre y apellido del garante.',
  garanteNombreInvalido: 'Usá solo letras, espacios, apóstrofos y guiones.',
  garanteDniInvalido: 'El DNI tiene 7 u 8 números, sin puntos.',
  garanteEmailInvalido: MENSAJES_SOLICITUD.emailInvalido,
  garanteEsParte: 'El garante no puede ser el locador ni el locatario del contrato.',
  garanteDniRepetido: 'Ya cargaste otro garante con ese DNI.',
  garanteEmailRepetido: 'Ya cargaste otro garante con ese correo.',
  garantesMaximo: `Se pueden cargar hasta ${GARANTES_MAX} garantes.`,
  inicioVacio: 'Elegí la fecha de inicio.',
  inicioPasado: 'La fecha de inicio no puede ser anterior a hoy.',
  duracionInvalida: 'La duración es un número entero de meses, mayor a 0.',
  montoInvalido: 'El monto es un número entero mayor a 0, sin decimales.',
  depositoInvalido: 'El depósito es un número entero, 0 o más, sin decimales.',
  diaInvalido: `El día de vencimiento va de ${DIA_VENCIMIENTO_MIN} a ${DIA_VENCIMIENTO_MAX}.`,
  periodicidadVacia: 'Elegí cada cuánto se ajusta.',
  clausulaVacia: 'La cláusula no puede quedar vacía.',
  clausulaTituloVacio: 'Poné un título a la cláusula.',
  clausulaLarga: `La cláusula puede tener hasta ${CLAUSULA_MAX.toLocaleString('es-AR')} caracteres.`,
  revisionSinMarcar: 'Para enviar a firmar, marcá que revisaste las condiciones y las cláusulas.',
} as const

// ─── Paso 1 · Garantes ──────────────────────────────────────────────────

/** Errores de un garante, campo por campo (vacío = sin errores). */
export type ErroresGarante = Partial<Record<'fullName' | 'dni' | 'email', string>>

/** DNI y correo normalizados, para comparar sin importar puntos, espacios o mayúsculas. */
function claveDni(dni: string | null | undefined): string {
  return soloDigitos(dni ?? '')
}
function claveEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Errores de un garante (US-05, paso 1):
 * - "nombre y apellido, DNI y correo electrónico. Los tres datos son obligatorios."
 * - "El DNI del garante debe tener 7 u 8 dígitos numéricos."
 * - "El correo del garante debe respetar el mismo formato que en US-35."
 * - "No se puede cargar como garante al locador ni al locatario del contrato."
 * - "No se pueden repetir DNI ni correo entre garantes."
 * @param otros Los demás garantes cargados (sin este).
 * @param partes El locador y el locatario.
 */
export function erroresGarante(garante: GaranteContrato, otros: readonly GaranteContrato[], partes: readonly ParteContrato[]): ErroresGarante {
  const errores: ErroresGarante = {}
  const nombre = garante.fullName.trim()
  if (!nombre) errores.fullName = MENSAJES_CONTRATO.garanteNombreVacio
  else if (!NOMBRE_REGEX.test(nombre)) errores.fullName = MENSAJES_CONTRATO.garanteNombreInvalido

  const dni = claveDni(garante.dni)
  if (!DNI_REGEX.test(garante.dni.trim())) errores.dni = MENSAJES_CONTRATO.garanteDniInvalido
  else if (partes.some((parte) => claveDni(parte.dni) === dni)) errores.dni = MENSAJES_CONTRATO.garanteEsParte
  else if (otros.some((otro) => claveDni(otro.dni) === dni)) errores.dni = MENSAJES_CONTRATO.garanteDniRepetido

  const email = claveEmail(garante.email)
  if (!emailValido(email)) errores.email = MENSAJES_CONTRATO.garanteEmailInvalido
  else if (partes.some((parte) => claveEmail(parte.email) === email)) errores.email = MENSAJES_CONTRATO.garanteEsParte
  else if (otros.some((otro) => claveEmail(otro.email) === email)) errores.email = MENSAJES_CONTRATO.garanteEmailRepetido

  return errores
}

/** Primer error de la lista de garantes, o `null` si están todos bien (US-05, paso 1). */
export function errorDeGarantes(garantes: readonly GaranteContrato[], partes: readonly ParteContrato[]): string | null {
  if (garantes.length > GARANTES_MAX) return MENSAJES_CONTRATO.garantesMaximo
  for (const [indice, garante] of garantes.entries()) {
    const otros = garantes.filter((_, otro) => otro !== indice)
    const errores = erroresGarante(garante, otros, partes)
    const primero = errores.fullName ?? errores.dni ?? errores.email
    if (primero) return `Garante ${indice + 1}: ${primero}`
  }
  return null
}

// ─── Paso 2 · Condiciones ───────────────────────────────────────────────

/** Errores de las condiciones, campo por campo (vacío = sin errores). */
export type ErroresCondiciones = Partial<Record<keyof CondicionesNuevoContrato, string>>

/** `true` si es un entero (no `null`, no decimal). */
function esEntero(valor: number | null | undefined): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor)
}

/**
 * Errores de las condiciones (US-05, paso 2):
 * - Inicio obligatorio y no anterior a hoy.
 * - Duración: entero mayor a 0.
 * - Monto inicial: entero mayor a 0.
 * - Depósito: entero mayor o igual a 0 (puede quedar vacío: "se puede indicar").
 * - Día de vencimiento: de 1 a 28.
 * - Periodicidad obligatoria si el índice no es "Sin ajuste".
 */
export function erroresCondiciones(condiciones: CondicionesNuevoContrato, hoyIso: string): ErroresCondiciones {
  const errores: ErroresCondiciones = {}
  if (!condiciones.startDate) errores.startDate = MENSAJES_CONTRATO.inicioVacio
  else if (!inicioValido(condiciones.startDate, hoyIso)) errores.startDate = `${MENSAJES_CONTRATO.inicioPasado} Hoy es ${fechaCorta(hoyIso)}.`
  if (!esEntero(condiciones.durationMonths) || condiciones.durationMonths <= 0) errores.durationMonths = MENSAJES_CONTRATO.duracionInvalida
  if (!esEntero(condiciones.initialAmount) || condiciones.initialAmount <= 0) errores.initialAmount = MENSAJES_CONTRATO.montoInvalido
  if (condiciones.deposit !== null && (!esEntero(condiciones.deposit) || condiciones.deposit < 0)) errores.deposit = MENSAJES_CONTRATO.depositoInvalido
  const dia = condiciones.paymentDueDay
  if (!esEntero(dia) || dia < DIA_VENCIMIENTO_MIN || dia > DIA_VENCIMIENTO_MAX) errores.paymentDueDay = MENSAJES_CONTRATO.diaInvalido
  if (condiciones.adjustmentIndex !== 'sin_ajuste' && !condiciones.adjustmentPeriod) errores.adjustmentPeriod = MENSAJES_CONTRATO.periodicidadVacia
  return errores
}

// ─── Paso 3 · Cláusulas ─────────────────────────────────────────────────

/**
 * Error de una cláusula (US-05, paso 3): las editables y las propias no
 * pueden quedar vacías ni pasar de {@link CLAUSULA_MAX}. Las fijas no se
 * validan (no se pueden editar).
 */
export function errorDeClausula(clausula: Pick<ClausulaContrato, 'tipo' | 'titulo' | 'texto'>): string | null {
  if (clausula.tipo === 'fija') return null
  if (clausula.tipo === 'propia' && !clausula.titulo.trim()) return MENSAJES_CONTRATO.clausulaTituloVacio
  if (!clausula.texto.trim()) return MENSAJES_CONTRATO.clausulaVacia
  if (clausula.texto.length > CLAUSULA_MAX) return MENSAJES_CONTRATO.clausulaLarga
  return null
}

// ─── El contrato entero (enviar a firmar) ───────────────────────────────

/**
 * Primer error que impide enviar a firmar, o `null` (US-05, paso 4). Repite
 * las validaciones de los pasos 1 a 3: un borrador puede tener datos
 * incompletos, pero para enviarlo tienen que estar todos.
 */
export function errorParaEnviar(contrato: Pick<ContratoBorrador, 'garantes' | 'condiciones' | 'clausulas' | 'locador' | 'locatario'>, hoyIso: string): string | null {
  const garantes = errorDeGarantes(contrato.garantes, [contrato.locador, contrato.locatario])
  if (garantes) return garantes
  const condiciones = erroresCondiciones(contrato.condiciones, hoyIso)
  const primera = Object.values(condiciones)[0]
  if (primera) return primera
  for (const [indice, clausula] of contrato.clausulas.entries()) {
    const error = errorDeClausula(clausula)
    if (error) return `Cláusula ${indice + 1}: ${error}`
  }
  return null
}

// ─── Reglas de antd Form ────────────────────────────────────────────────

/** Regla de antd a partir de una función que devuelve el error o `null`. */
export function reglaDe<T>(error: (valor: T) => string | null | undefined): FormRule {
  return { validator: (_regla, valor: T) => (error(valor) ? Promise.reject(new Error(error(valor) ?? '')) : Promise.resolve()) }
}
