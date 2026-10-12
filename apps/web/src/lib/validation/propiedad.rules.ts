/**
 * propiedad.rules.ts — reglas de validación del alta de propiedad (US-01).
 *
 * Qué es: los límites de cada campo y las reglas de antd `Form`, cada una
 * comentada con el criterio de aceptación o la prueba de usuario de US-01
 * que cubre. Se valida al tocar "Siguiente" (Alta · 06: "nunca mientras se
 * escribe").
 *
 * TODO(backend): el back tiene que repetir estas mismas reglas; el front
 * valida para ayudar, no para proteger.
 * Quién lo usa: `components/alta/*`.
 */
import type { FormRule } from 'antd'
import dayjs from 'dayjs'
import type { AdjustmentIndex, CharacteristicKey, EstadoPublicacionAlta, FotoNueva, MedioPagoConRecargo, PropertyType } from '@rentar/shared-types'
import { RECARGO_MAXIMO_PCT } from '@/lib/catalogs/propiedad'
import { hoy } from '@/lib/utils/fechas'

// ─── Valores del formulario ─────────────────────────────────────────────

/**
 * Valores del formulario del alta. Es `PropiedadNueva` con los campos
 * todavía opcionales (se van completando paso a paso) y la foto principal
 * por id (así sigue a la foto cuando se reordenan).
 */
export interface AltaValues {
  type?: PropertyType
  street?: string
  streetNumber?: number
  floor?: string
  unit?: string
  neighborhoodSlug?: string
  city: string
  province: string
  rooms: number
  bedrooms: number
  bathrooms: number
  ageYears?: number | null
  totalAreaM2?: number
  coveredAreaM2?: number
  characteristics: CharacteristicKey[]
  description?: string
  status?: EstadoPublicacionAlta
  /** Fecha ISO "YYYY-MM-DD". */
  availableFrom?: string | null
  photos: FotoNueva[]
  mainPhotoId: string | null
  priceMonthly?: number
  expenses?: number
  dailyInterestPct?: number | null
  graceDays?: number | null
  paymentMethods: MedioPagoConRecargo[]
  adjustmentEveryMonths?: number | null
  adjustmentIndex?: AdjustmentIndex | null
  depositMonths?: number | null
  contractMonths?: number | null
}

/** Ubicación del piloto: RentAR opera solo en Córdoba Capital (Alta · 01). */
export const CIUDAD_PILOTO = 'Córdoba Capital'
/** Provincia del piloto (fija en el alta). */
export const PROVINCIA_PILOTO = 'Córdoba'

/** Valores con que arranca un alta nueva. Tipo y estado arrancan vacíos: US-01 pide elegirlos. */
export const ALTA_VALORES_INICIALES: AltaValues = {
  city: CIUDAD_PILOTO,
  province: PROVINCIA_PILOTO,
  rooms: 2,
  bedrooms: 1,
  bathrooms: 1,
  characteristics: [],
  photos: [],
  mainPhotoId: null,
  paymentMethods: [],
}

// ─── Límites ────────────────────────────────────────────────────────────

/** US-01: "Se deben cargar al menos tres fotos". */
export const FOTOS_MINIMO = 3
/** US-01: "Se pueden cargar hasta 50 fotos por propiedad". */
export const FOTOS_MAXIMO = 50
/** US-01: "no superar los 350kb". */
export const FOTO_PESO_MAXIMO_BYTES = 350 * 1024
/** US-01: "formato JPG o PNG". */
export const FOTO_TIPOS_ACEPTADOS = ['image/jpeg', 'image/png']

/** Superficie mínima razonable (Alta · 06: "m² entre 10 y 2000"). */
export const M2_MINIMO = 10
/** Tope de superficie (Alta · 06). */
export const M2_MAXIMO = 2000
/** Descripción: el contador del diseño. */
export const DESCRIPCION_MAXIMO = 1200
/** Interés diario de mora: tope razonable para evitar un tipeo de más. */
export const INTERES_DIARIO_MAXIMO = 5

// ─── Mensajes ───────────────────────────────────────────────────────────

export const MENSAJES_ALTA = {
  tipo: 'Elegí qué tipo de propiedad es.',
  calle: 'Completá la calle.',
  numero: 'Completá el número de la calle.',
  numeroInvalido: 'Poné solo el número, sin letras (ej. 1250).',
  barrio: 'Elegí el barrio.',
  ambientesMono: 'Un monoambiente tiene un solo ambiente.',
  ambientesMinimo: 'Si no es monoambiente, tiene que tener al menos 2 ambientes.',
  dormitoriosMono: 'Un monoambiente no tiene dormitorios aparte.',
  dormitoriosMinimo: 'Si no es monoambiente, tiene que tener al menos 1 dormitorio.',
  dormitoriosMaximo: 'Los dormitorios no pueden ser más que los ambientes.',
  banos: 'Tiene que tener al menos 1 baño.',
  superficieTotal: 'Completá la superficie total.',
  superficieCubierta: 'Completá la superficie cubierta.',
  superficieRango: `Tiene que estar entre ${M2_MINIMO} y ${M2_MAXIMO} m².`,
  cubiertaMayor: 'La superficie cubierta no puede ser mayor que la total.',
  estado: 'Elegí el estado de la publicación.',
  disponiblePasada: 'La fecha no puede ser anterior a hoy.',
  fotosMinimo: `Necesitás al menos ${FOTOS_MINIMO} fotos.`,
  precio: 'Completá el precio mensual.',
  precioMayorACero: 'El precio tiene que ser mayor a $ 0.',
  expensas: 'Completá las expensas. Si no paga, dejá 0.',
  diasGracia: 'Si cobrás interés por día, indicá los días de gracia.',
  mediosPago: 'Habilitá al menos un medio de pago.',
  recargo: `El recargo va de 0 a ${RECARGO_MAXIMO_PCT} %.`,
} as const

// ─── Reglas por campo (antd Form) ───────────────────────────────────────

/** US-01: "Se debe indicar el tipo de propiedad". */
export const reglasTipo: FormRule[] = [{ required: true, message: MENSAJES_ALTA.tipo }]

/** US-01: "Se debe indicar la calle". */
export const reglasCalle: FormRule[] = [{ required: true, whitespace: true, message: MENSAJES_ALTA.calle }]

/** US-01: "Se debe indicar a qué altura de la calle". */
export const reglasNumero: FormRule[] = [
  { required: true, message: MENSAJES_ALTA.numero },
  { type: 'integer', min: 1, max: 99999, message: MENSAJES_ALTA.numeroInvalido },
]

/** US-01: "Se debe indicar el barrio". Provincia y ciudad vienen fijas (piloto). */
export const reglasBarrio: FormRule[] = [{ required: true, message: MENSAJES_ALTA.barrio }]

/**
 * US-01: ambientes obligatorios si no es monoambiente. Pruebas: "monoambiente
 * con más de un ambiente (falla)" y "no monoambiente con menos de 2
 * ambientes (falla)".
 */
export function reglasAmbientes(tipo: PropertyType | undefined): FormRule[] {
  if (tipo === 'monoambiente') return [{ type: 'number', max: 1, message: MENSAJES_ALTA.ambientesMono }]
  return [{ type: 'number', min: 2, message: MENSAJES_ALTA.ambientesMinimo }]
}

/**
 * US-01: dormitorios obligatorios si no es monoambiente. Pruebas:
 * "monoambiente con más de un dormitorio (falla)", "no monoambiente con
 * menos de 1 habitación (falla)" y "menos de 0 habitaciones (falla)".
 */
export function reglasDormitorios(tipo: PropertyType | undefined, ambientes: number): FormRule[] {
  if (tipo === 'monoambiente') return [{ type: 'number', max: 0, message: MENSAJES_ALTA.dormitoriosMono }]
  return [
    { type: 'number', min: 1, message: MENSAJES_ALTA.dormitoriosMinimo },
    { type: 'number', max: Math.max(1, ambientes - 1), message: MENSAJES_ALTA.dormitoriosMaximo },
  ]
}

/** US-01: "Se debe indicar la cantidad de baños" y "0 o menos baños (falla)". */
export const reglasBanos: FormRule[] = [{ type: 'number', min: 1, message: MENSAJES_ALTA.banos }]

/** US-01: "superficie total" obligatoria; prueba "0 o menos metros cuadrados (falla)". */
export const reglasSuperficieTotal: FormRule[] = [
  { required: true, message: MENSAJES_ALTA.superficieTotal },
  { type: 'number', min: M2_MINIMO, max: M2_MAXIMO, message: MENSAJES_ALTA.superficieRango },
]

/** US-01: "superficie cubierta" obligatoria y nunca mayor que la total (pedido de producto). */
export function reglasSuperficieCubierta(total: number | undefined): FormRule[] {
  return [
    { required: true, message: MENSAJES_ALTA.superficieCubierta },
    { type: 'number', min: 1, max: M2_MAXIMO, message: MENSAJES_ALTA.superficieRango },
    {
      validator: (_rule, value?: number) =>
        value !== undefined && total !== undefined && value > total ? Promise.reject(new Error(MENSAJES_ALTA.cubiertaMayor)) : Promise.resolve(),
    },
  ]
}

/** US-01: "Se debe indicar el estado del alquiler: publicado, pausado o alquilado". */
export const reglasEstado: FormRule[] = [{ required: true, message: MENSAJES_ALTA.estado }]

/**
 * US-01: "Si la propiedad se encuentra alquilada, se puede ingresar desde qué
 * fecha estará disponible": es OPCIONAL. Si una alquilada la trae, queda
 * alquilada/publicada (ver `propiedad.adapter.ts#estadoDePropiedadNueva`).
 * Nunca anterior a hoy (Alta · 06).
 */
export const reglasDisponibleDesde: FormRule[] = [
  {
    validator: (_rule, value?: string | null) =>
      value && dayjs(value).isBefore(hoy()) ? Promise.reject(new Error(MENSAJES_ALTA.disponiblePasada)) : Promise.resolve(),
  },
]

/** US-01: "al menos tres fotos" (el máximo, el formato y el peso se controlan al agregarlas). */
export const reglasFotos: FormRule[] = [
  {
    validator: (_rule, value?: FotoNueva[]) =>
      (value?.length ?? 0) >= FOTOS_MINIMO ? Promise.resolve() : Promise.reject(new Error(MENSAJES_ALTA.fotosMinimo)),
  },
]

/** Misma lista de fotos (mismas fotos, en el mismo orden). */
function mismasFotos(a: readonly FotoNueva[] | undefined, b: readonly FotoNueva[]): boolean {
  const ids = (fotos: readonly FotoNueva[] | undefined) => (fotos ?? []).map((foto) => foto.id).join('|')
  return ids(a) === ids(b)
}

/**
 * Edición (US-03): el mínimo de 3 fotos de US-01 se valida SOLO si el usuario
 * cambió la sección Fotos (agregó, quitó o reordenó).
 * Por qué (decisión del PO, tanda 3 del Sprint 2): hay propiedades cargadas
 * antes de la regla, con 1 a 3 fotos en el back real. Corregir un dato
 * suelto (por ejemplo, las expensas) no tiene que obligar a subir fotos. Si
 * se tocan las fotos, la regla del alta vuelve a valer completa.
 * @param originales Las fotos guardadas, contra las que se compara.
 */
export function reglasFotosEdicion(originales: readonly FotoNueva[]): FormRule[] {
  return [
    {
      validator: (_rule, value?: FotoNueva[]) =>
        mismasFotos(value, originales) || (value?.length ?? 0) >= FOTOS_MINIMO ? Promise.resolve() : Promise.reject(new Error(MENSAJES_ALTA.fotosMinimo)),
    },
  ]
}

/** US-01: "Se debe indicar el monto de alquiler" (prueba: "sin monto (falla)"). */
export const reglasPrecio: FormRule[] = [
  { required: true, message: MENSAJES_ALTA.precio },
  { type: 'number', min: 1, message: MENSAJES_ALTA.precioMayorACero },
]

/** US-01: "Se debe indicar el monto de las expensas" (0 = no paga). */
export const reglasExpensas: FormRule[] = [{ required: true, message: MENSAJES_ALTA.expensas }]

/** US-01: "Si se indicó el interés por día, se deben indicar los días de gracia". */
export function reglasDiasGracia(interes: number | null | undefined): FormRule[] {
  return [{ required: (interes ?? 0) > 0, message: MENSAJES_ALTA.diasGracia }]
}

/**
 * US-01: "Se debe indicar los métodos de pago preferidos". Producto lo dejó
 * obligatorio (al menos uno), con recargo de 0 a 3 %.
 */
export const reglasMediosPago: FormRule[] = [
  {
    validator: (_rule, value?: MedioPagoConRecargo[]) => {
      if (!value || value.length === 0) return Promise.reject(new Error(MENSAJES_ALTA.mediosPago))
      if (value.some((medio) => medio.surchargePct < 0 || medio.surchargePct > RECARGO_MAXIMO_PCT)) {
        return Promise.reject(new Error(MENSAJES_ALTA.recargo))
      }
      return Promise.resolve()
    },
  },
]

// ─── Pasos ──────────────────────────────────────────────────────────────

/** Los campos que valida cada paso al tocar "Siguiente". */
export const CAMPOS_POR_PASO: (keyof AltaValues)[][] = [
  ['type', 'street', 'streetNumber', 'floor', 'unit', 'neighborhoodSlug', 'city', 'province'],
  ['rooms', 'bedrooms', 'bathrooms', 'ageYears', 'totalAreaM2', 'coveredAreaM2', 'characteristics', 'description', 'status', 'availableFrom'],
  ['photos'],
  ['priceMonthly', 'expenses', 'dailyInterestPct', 'graceDays', 'paymentMethods', 'adjustmentEveryMonths', 'adjustmentIndex', 'depositMonths', 'contractMonths'],
  [],
]

/** Nombre visible de cada campo, para el resumen "Faltan N datos para seguir". */
export const ETIQUETA_CAMPO: Partial<Record<keyof AltaValues, string>> = {
  type: 'Tipo de propiedad',
  street: 'Calle',
  streetNumber: 'Número de la calle',
  neighborhoodSlug: 'Barrio',
  rooms: 'Ambientes',
  bedrooms: 'Dormitorios',
  bathrooms: 'Baños',
  totalAreaM2: 'Superficie total',
  coveredAreaM2: 'Superficie cubierta',
  status: 'Estado de la publicación',
  availableFrom: 'Disponible desde',
  photos: 'Fotos',
  priceMonthly: 'Precio mensual',
  expenses: 'Expensas',
  graceDays: 'Días de gracia',
  paymentMethods: 'Medios de pago',
}

// ─── Detalle y edición del locador (US-03, US-04) ───────────────────────

/**
 * Campos que fija el contrato vigente: con contrato, no se modifican desde
 * la edición (Detalle de propiedad del locador · 06: "Con contrato vigente
 * no se puede cambiar el precio ni el índice: eso vive en el contrato"; la
 * frecuencia va con el índice).
 */
export const CAMPOS_FIJADOS_POR_CONTRATO = ['priceMonthly', 'adjustmentIndex', 'adjustmentEveryMonths'] as const satisfies readonly (keyof AltaValues)[]

/**
 * `true` si la propiedad se puede eliminar (US-04): no tiene contrato
 * vigente (decisión del PO, tanda 3 del Sprint 2). El botón no se esconde:
 * con contrato, abre el aviso que explica por qué no se puede.
 */
export function puedeEliminar(detalle: { activeContract: unknown }): boolean {
  return detalle.activeContract === null
}

