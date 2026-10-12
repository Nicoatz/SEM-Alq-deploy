/**
 * solicitud.rules.ts — reglas de las solicitudes de alquiler (US-35 a US-38).
 *
 * Qué es: el largo máximo del mensaje, cuándo una solicitud ya existente
 * impide mandar otra y qué cambios de estado se permiten y a quién, cada regla
 * con el criterio que cubre. Las usan el modal "Solicitar alquiler" (para
 * ayudar mientras se escribe), las pantallas de solicitudes (para decidir qué
 * botón mostrar) y la rama mock de `services/solicitudes.service.ts` (para
 * responder como respondería el back).
 *
 * TODO(backend): el back tiene que repetir estas mismas reglas; el front
 * valida para ayudar, no para proteger.
 * Quién lo usa: `services/solicitudes.service.ts`,
 * `components/detalle-propiedad/*`, `components/solicitudes/*` y
 * `components/mis-solicitudes/*`.
 */
import type { FormRule } from 'antd'
import type { EstadoSolicitud, GarantiaOfrecida, OcupacionPostulante, SolicitudNueva } from '@rentar/shared-types'

/**
 * Largo máximo del mensaje opcional al locador (US-35 actualizada: "se puede
 * adjuntar un mensaje de hasta 600 caracteres"; pruebas: "más de 600
 * caracteres (falla)" y "exactamente 600 (pasa)"). Coincide con el diseño
 * (Flujo de solicitudes · 01). Antes eran 1000 (la US-35 de la tanda 1).
 */
export const SOLICITUD_MENSAJE_MAX = 600

/** Mensaje de error si el mensaje supera {@link SOLICITUD_MENSAJE_MAX}. */
export const SOLICITUD_MENSAJE_LARGO_MESSAGE = `El mensaje puede tener hasta ${SOLICITUD_MENSAJE_MAX} caracteres.`

/**
 * Normaliza el mensaje antes de enviarlo: sin espacios en los bordes, y
 * `null` si quedó vacío (US-35: el mensaje es opcional; prueba de usuario
 * "sin adjuntar un mensaje, pasa").
 */
export function normalizarMensajeSolicitud(mensaje: string | null | undefined): string | null {
  const limpio = mensaje?.trim() ?? ''
  return limpio === '' ? null : limpio
}

/** `true` si el mensaje (ya normalizado) respeta el máximo de US-35. */
export function mensajeSolicitudValido(mensaje: string | null): boolean {
  return mensaje === null || mensaje.length <= SOLICITUD_MENSAJE_MAX
}

/**
 * `true` si la solicitud sigue viva y, por eso, impide mandar otra sobre la
 * misma propiedad: `pendiente` o `aceptada`.
 * NOTA: una `rechazada` o `cancelada` es historia (Flujo de solicitudes · 07:
 * "nada vuelve a pendiente; para volver a intentar se crea una nueva"), así
 * que no bloquea una nueva solicitud. El "no puede volver a solicitar por 30
 * días" que muestra el diseño al rechazar no tiene US: no se aplica.
 */
export function esSolicitudActiva(estado: EstadoSolicitud): boolean {
  return estado === 'pendiente' || estado === 'aceptada'
}

// ─── Cambios de estado (US-37, US-38) ───────────────────────────────────

/** Quién hace el cambio: el dueño de la propiedad o quien envió la solicitud. */
export type ActorSolicitud = 'locador' | 'postulante'

/** Los cambios de estado que se piden desde las pantallas. */
export type AccionSolicitud = 'aceptar' | 'rechazar' | 'cancelar'

/** Un cambio de estado permitido: quién lo hace, desde qué estado y a cuál. */
export interface TransicionSolicitud {
  accion: AccionSolicitud
  actor: ActorSolicitud
  desde: EstadoSolicitud
  hacia: EstadoSolicitud
}

/**
 * Las únicas transiciones permitidas. Cualquier otra combinación de acción,
 * actor y estado es un 409 (o un 403/404 si quien llama no es parte).
 *
 * | Acción | Quién | Desde | Hacia | Por qué |
 * |---|---|---|---|---|
 * | aceptar | locador | pendiente | aceptada | US-37. Además, **una sola aceptada por propiedad** (ver {@link aceptadaDeLaPropiedad}). |
 * | rechazar | locador | pendiente | rechazada | US-37 (sin motivo: la US no lo pide). |
 * | cancelar | locador | aceptada | cancelada | US-38 (Jira): "dar de baja una solicitud tras haberla aceptado inicialmente para considerar otros posibles locatarios". |
 * | cancelar | postulante | pendiente | cancelada | Sin US en Sprint 0 (mapa US-39): el locatario retira una solicitud que todavía no se respondió (Flujo de solicitudes · 04). |
 *
 * NOTA: nada vuelve a `pendiente` (Flujo de solicitudes · 07): para volver a
 * intentar se crea una nueva. La aceptada no la puede cancelar el
 * postulante: si se arrepiente, se lo dice al locador y la cancela él.
 */
export const TRANSICIONES_SOLICITUD: readonly TransicionSolicitud[] = [
  { accion: 'aceptar', actor: 'locador', desde: 'pendiente', hacia: 'aceptada' },
  { accion: 'rechazar', actor: 'locador', desde: 'pendiente', hacia: 'rechazada' },
  { accion: 'cancelar', actor: 'locador', desde: 'aceptada', hacia: 'cancelada' },
  { accion: 'cancelar', actor: 'postulante', desde: 'pendiente', hacia: 'cancelada' },
]

/** La transición que corresponde, o `null` si esa acción no se permite a ese actor en ese estado. */
export function transicionSolicitud(accion: AccionSolicitud, actor: ActorSolicitud, estado: EstadoSolicitud): TransicionSolicitud | null {
  return TRANSICIONES_SOLICITUD.find((item) => item.accion === accion && item.actor === actor && item.desde === estado) ?? null
}

/** `true` si ese actor puede hacer esa acción sobre una solicitud en ese estado. */
export function puedeHacerAccion(accion: AccionSolicitud, actor: ActorSolicitud, estado: EstadoSolicitud): boolean {
  return transicionSolicitud(accion, actor, estado) !== null
}

/**
 * `true` si ese actor puede cancelar una solicitud en ese estado: el locador
 * una aceptada (US-38) o el postulante una pendiente (sin US en Sprint 0).
 */
export function puedeCancelar(estado: EstadoSolicitud, actor: ActorSolicitud): boolean {
  return puedeHacerAccion('cancelar', actor, estado)
}

/**
 * La solicitud aceptada de una propiedad, si hay una. Regla del PO (tanda 2
 * del Sprint 2): **una sola aceptada por propiedad**. Mientras haya una, no
 * se puede aceptar otra (409); el locador primero la cancela (US-38) y
 * vuelve a poder elegir. Aceptar NO rechaza a las demás: siguen pendientes.
 * Recibe las solicitudes de UNA propiedad (de cualquier forma: elenco o vista).
 */
export function aceptadaDeLaPropiedad<T extends { status: EstadoSolicitud }>(solicitudesDeLaPropiedad: readonly T[]): T | undefined {
  return solicitudesDeLaPropiedad.find((item) => item.status === 'aceptada')
}

/** Por qué no se puede aceptar otra: el tooltip del botón y el 409 del service. */
export function textoYaAceptaste(nombre: string): string {
  return `Ya aceptaste a ${nombre}. Cancelá esa solicitud para aceptar otra.`
}

// ─── Datos y legajo de la solicitud (US-35 actualizada) ─────────────────

/** Opciones de "Situación ocupacional" (US-35), en el orden de la US. "-" es "Prefiero no decirlo" y va por defecto. */
export const OCUPACION_OPTIONS: { value: OcupacionPostulante; label: string }[] = [
  { value: 'sin_informar', label: 'Prefiero no decirlo' },
  { value: 'relacion_dependencia', label: 'Relación de dependencia' },
  { value: 'monotributista', label: 'Monotributista' },
  { value: 'autonoma', label: 'Autónoma' },
  { value: 'estudiante', label: 'Estudiante' },
  { value: 'jubilada', label: 'Jubilada' },
]

/** Texto de cada ocupación, para el detalle del postulante. */
export const OCUPACION_LABEL: Record<OcupacionPostulante, string> = Object.fromEntries(
  OCUPACION_OPTIONS.map((opcion) => [opcion.value, opcion.label]),
) as Record<OcupacionPostulante, string>

/**
 * Garantías que se pueden ofrecer (US-35: "garantía propietaria, seguro de
 * caución, otra"). NOTA: el diseño suma "recibo de sueldo" y "depósito
 * ampliado"; manda la US: van dentro de "otra".
 */
export const GARANTIA_OPTIONS: { value: GarantiaOfrecida; label: string; ayuda: string }[] = [
  { value: 'propietaria', label: 'Garantía propietaria', ayuda: 'Una persona con una propiedad a su nombre en Córdoba.' },
  { value: 'caucion', label: 'Seguro de caución', ayuda: 'Lo contratás vos con una aseguradora.' },
  { value: 'otra', label: 'Otra', ayuda: 'Recibo de sueldo, depósito ampliado u otra: se la proponés y el dueño decide.' },
]

/** Texto de cada garantía. */
export const GARANTIA_LABEL: Record<GarantiaOfrecida, string> = Object.fromEntries(
  GARANTIA_OPTIONS.map((opcion) => [opcion.value, opcion.label]),
) as Record<GarantiaOfrecida, string>

/** Personas a residir: valor por defecto y mínimo (US-35: "siendo una (1) la cantidad mínima"; "por defecto debe ser una (1)"). */
export const CONVIVIENTES_MINIMO = 1

/**
 * Largo máximo del detalle de las mascotas. NOTA: la US no pone tope;
 * 300 es una decisión del front aprobada por el PO (HANDOFF §7).
 */
export const MASCOTAS_DETALLE_MAX = 300

/** Mensajes de error de los campos nuevos (en castellano, hablando de vos). */
export const MENSAJES_SOLICITUD = {
  telefonoSoloNumeros: 'Ingresá solo números (el "+" ya está puesto).',
  telefonoLargo: 'El teléfono tiene que tener entre 10 y 15 números, con el código de país (ej. 54 351 555 0103).',
  emailInvalido: 'Revisá el email: tiene que ser del tipo nombre@dominio.com.',
  ingresosInvalidos: 'Ingresá un monto entero, sin decimales ni signo menos (0 si preferís no informarlo).',
  convivientesMinimo: 'Tiene que vivir al menos una persona (vos).',
  mascotasLargo: `Contalo en hasta ${MASCOTAS_DETALLE_MAX} caracteres.`,
  garantiasExigidas: 'Marcá al menos una de las garantías que pide el dueño.',
  aceptacion: 'Para enviar la solicitud tenés que confirmar que los datos son correctos.',
} as const

// ─── Teléfono: E.164 para guardar, E.123 para mostrar ───────────────────

/**
 * Teléfono canónico E.164 (US-35): "[+][código de país][número nacional]",
 * sin espacios ni separadores, de 10 a 15 dígitos en total (US-35: "longitud
 * mínima de 10 dígitos y máxima de 15"). El primer dígito no puede ser 0
 * (ningún código de país empieza con 0).
 */
export const TELEFONO_E164_REGEX = /^\+[1-9]\d{9,14}$/

/** Código de país por defecto: el producto es para Córdoba (decisión del PO). Se puede cambiar. */
export const CODIGO_PAIS_POR_DEFECTO = '54'

/** Lo que escribe la persona (sin el "+", que es fijo): solo números y espacios de formato. */
function soloDigitosYEspacios(texto: string): boolean {
  return /^[\d\s]*$/.test(texto)
}

/**
 * Lo que está en el campo (sin el "+") → E.164, o `null` si tiene algo que
 * no sea un número (US-35: "se deben ingresar únicamente caracteres
 * numéricos": no se limpia en silencio, la prueba espera que falle).
 */
export function aE164(texto: string | null | undefined): string | null {
  const limpio = (texto ?? '').trim().replace(/^\+/, '')
  if (!limpio || !soloDigitosYEspacios(limpio)) return null
  return `+${limpio.replace(/\s/g, '')}`
}

/**
 * Códigos de país de 1 y 2 dígitos más comunes (el resto se toma de 3). Solo
 * para agrupar al mostrar: la validación no depende de esto.
 */
const CODIGOS_DE_1 = ['1', '7']
const CODIGOS_DE_2 = ['20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '93', '94', '95', '98']

/** Separa el código de país del número nacional (solo para mostrar). */
function separarCodigoPais(digitos: string): [string, string] {
  if (CODIGOS_DE_1.includes(digitos.slice(0, 1))) return [digitos.slice(0, 1), digitos.slice(1)]
  if (CODIGOS_DE_2.includes(digitos.slice(0, 2))) return [digitos.slice(0, 2), digitos.slice(2)]
  return [digitos.slice(0, 3), digitos.slice(3)]
}

/** Agrupa el número nacional: 9 dígitos → 2-3-4; 10 → 3-3-4; con el 9 de celular argentino, "9 " adelante. */
function agruparNacional(codigo: string, nacional: string): string {
  if (codigo === '54' && nacional.length === 11 && nacional.startsWith('9')) return `9 ${agruparNacional(codigo, nacional.slice(1))}`
  if (nacional.length === 9) return [nacional.slice(0, 2), nacional.slice(2, 5), nacional.slice(5)].join(' ')
  if (nacional.length === 10) return [nacional.slice(0, 3), nacional.slice(3, 6), nacional.slice(6)].join(' ')
  // Otros largos: de a 3, el resto al final.
  return nacional.replace(/(\d{3})(?=\d{2,})/g, '$1 ').trim()
}

/**
 * Formato visual E.123 (US-35: "signo + para el prefijo internacional,
 * espacios para mejorar la legibilidad", ej. "+34 91 123 4567"). Recibe el
 * E.164 (o lo que esté en el campo) y nunca cambia los dígitos: solo suma
 * espacios. Si no son solo números, lo devuelve tal cual.
 */
export function formatoE123(telefono: string): string {
  const digitos = telefono.replace(/^\+/, '').replace(/\s/g, '')
  if (!/^\d+$/.test(digitos)) return telefono
  const [codigo, nacional] = separarCodigoPais(digitos)
  return nacional ? `+${codigo} ${agruparNacional(codigo, nacional)}` : `+${codigo}`
}

/**
 * Lo que se ve en el campo mientras se escribe (sin el "+", que es fijo):
 * los números se agrupan solos (US-35: "dar formato visual de manera
 * automática"); si hay letras u otros símbolos se deja como está, para que
 * la validación lo marque.
 */
export function formatoTelefonoEnCampo(texto: string): string {
  if (!soloDigitosYEspacios(texto)) return texto
  const digitos = texto.replace(/\s/g, '')
  return digitos ? formatoE123(digitos).replace(/^\+/, '') : ''
}

/**
 * Teléfono del perfil → lo que se precarga en el campo. El registro (US-19)
 * guarda 10 dígitos sin código de país: se le antepone el 54. Sin teléfono,
 * queda "54 " para que complete el resto (decisión del PO).
 */
export function telefonoParaPrecargar(telefonoPerfil: string | null | undefined): string {
  const digitos = (telefonoPerfil ?? '').replace(/\D/g, '')
  if (!digitos) return `${CODIGO_PAIS_POR_DEFECTO} `
  const conPais = digitos.length === 10 ? `${CODIGO_PAIS_POR_DEFECTO}${digitos}` : digitos
  return formatoTelefonoEnCampo(conPais)
}

/** `true` si el teléfono del campo es un E.164 válido (US-35). */
export function telefonoValido(texto: string | null | undefined): boolean {
  const e164 = aE164(texto)
  return e164 !== null && TELEFONO_E164_REGEX.test(e164)
}

// ─── Email ──────────────────────────────────────────────────────────────

/**
 * Email (US-35): "nombre@dominio.extension", admitiendo "nombre.apellido@",
 * "nombre+var@dominio.extension.extension2" y "nombre_apellido@". Sin puntos
 * seguidos ni al principio o al final de la parte del nombre.
 */
export const EMAIL_SOLICITUD_REGEX = /^[A-Za-z0-9_%+-]+(?:\.[A-Za-z0-9_%+-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/

/** `true` si el email tiene el formato de US-35. */
export function emailValido(email: string | null | undefined): boolean {
  return EMAIL_SOLICITUD_REGEX.test((email ?? '').trim())
}

// ─── Legajo ─────────────────────────────────────────────────────────────

/**
 * Ingresos (US-35: "un número entero superior a 0", "por defecto debe ser
 * cero"). La US se contradice: se interpreta 0 = "no lo informa" (pasa),
 * entero positivo (pasa), negativo o con decimales (falla). Decisión del PO;
 * anotado en HANDOFF §7 para corregir la US.
 */
export function ingresosValidos(valor: number | null | undefined): boolean {
  return valor === null || valor === undefined || (Number.isInteger(valor) && valor >= 0)
}

/** Personas a residir (US-35: "siendo una (1) la cantidad mínima"). */
export function convivientesValidos(valor: number | null | undefined): boolean {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= CONVIVIENTES_MINIMO
}

/**
 * Garantías exigidas (US-35: "se deben marcar las garantías solicitadas
 * explícitamente por el locador"; prueba: "sin indicar las garantías
 * exigidas (falla)"). Decisión del PO:
 * - Alcanza con ofrecer AL MENOS UNA de las exigidas ("propietaria o
 *   caución"). Si un día una propiedad exige todas, se suma un modo.
 * - "Marcadas" se lee como "señaladas": arrancan sin tildar y resaltadas
 *   con "La pide el dueño", para que nadie declare sin querer una garantía
 *   que no tiene. Interpretación anotada en HANDOFF §7.
 */
export function garantiasCumplen(ofrecidas: readonly GarantiaOfrecida[], exigidas: readonly GarantiaOfrecida[]): boolean {
  return exigidas.length === 0 || exigidas.some((garantia) => ofrecidas.includes(garantia))
}

// ─── Reglas de antd Form (el modal "Solicitar alquiler") ─────────────────

/** Teléfono (US-35: solo números, E.164 de 10 a 15 dígitos). */
export const reglasTelefonoSolicitud: FormRule[] = [
  {
    validator: (_rule, value?: string) => {
      if (!soloDigitosYEspacios((value ?? '').replace(/^\+/, ''))) return Promise.reject(new Error(MENSAJES_SOLICITUD.telefonoSoloNumeros))
      return telefonoValido(value) ? Promise.resolve() : Promise.reject(new Error(MENSAJES_SOLICITUD.telefonoLargo))
    },
  },
]

/** Email (US-35: formato "nombre@dominio.extension" y sus variantes). */
export const reglasEmailSolicitud: FormRule[] = [
  { validator: (_rule, value?: string) => (emailValido(value) ? Promise.resolve() : Promise.reject(new Error(MENSAJES_SOLICITUD.emailInvalido))) },
]

/** Ingresos (US-35, con la interpretación de {@link ingresosValidos}). */
export const reglasIngresos: FormRule[] = [
  { validator: (_rule, value?: number | null) => (ingresosValidos(value) ? Promise.resolve() : Promise.reject(new Error(MENSAJES_SOLICITUD.ingresosInvalidos))) },
]

/** Personas a residir (US-35: mínimo 1). */
export const reglasConvivientes: FormRule[] = [
  { validator: (_rule, value?: number) => (convivientesValidos(value) ? Promise.resolve() : Promise.reject(new Error(MENSAJES_SOLICITUD.convivientesMinimo))) },
]

/** Detalle de mascotas (opcional; tope de {@link MASCOTAS_DETALLE_MAX}). */
export const reglasDetalleMascotas: FormRule[] = [{ max: MASCOTAS_DETALLE_MAX, message: MENSAJES_SOLICITUD.mascotasLargo }]

/** Garantías: al menos una de las exigidas por el locador (ver {@link garantiasCumplen}). */
export function reglasGarantias(exigidas: readonly GarantiaOfrecida[]): FormRule[] {
  return [
    {
      validator: (_rule, value?: GarantiaOfrecida[]) =>
        garantiasCumplen(value ?? [], exigidas) ? Promise.resolve() : Promise.reject(new Error(MENSAJES_SOLICITUD.garantiasExigidas)),
    },
  ]
}

/** Aceptación (US-35: "se debe aceptar lo que implica el envío de la solicitud"). */
export const reglasAceptacion: FormRule[] = [
  { validator: (_rule, value?: boolean) => (value === true ? Promise.resolve() : Promise.reject(new Error(MENSAJES_SOLICITUD.aceptacion))) },
]

/**
 * Valida una solicitud completa con las mismas reglas que el formulario. La
 * usa el service (las dos ramas) para responder como el back: el front
 * valida para ayudar, no para proteger (TODO(backend): repetirlas).
 * @param exigidas Las garantías que exige la propiedad (`requiredGuarantees`).
 * @returns el primer mensaje de error, o `null` si está bien.
 */
export function errorDeSolicitudNueva(nueva: SolicitudNueva, exigidas: readonly GarantiaOfrecida[]): string | null {
  if (!mensajeSolicitudValido(nueva.message)) return SOLICITUD_MENSAJE_LARGO_MESSAGE
  if (!TELEFONO_E164_REGEX.test(nueva.contact.phone)) return MENSAJES_SOLICITUD.telefonoLargo
  if (!emailValido(nueva.contact.email)) return MENSAJES_SOLICITUD.emailInvalido
  if (!ingresosValidos(nueva.legajo.monthlyIncome)) return MENSAJES_SOLICITUD.ingresosInvalidos
  if (!convivientesValidos(nueva.legajo.residents)) return MENSAJES_SOLICITUD.convivientesMinimo
  if ((nueva.legajo.petsDetail?.length ?? 0) > MASCOTAS_DETALLE_MAX) return MENSAJES_SOLICITUD.mascotasLargo
  if (!garantiasCumplen(nueva.legajo.guarantees, exigidas)) return MENSAJES_SOLICITUD.garantiasExigidas
  if (nueva.acceptedTerms !== true) return MENSAJES_SOLICITUD.aceptacion
  return null
}
