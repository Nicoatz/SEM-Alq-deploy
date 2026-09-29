/**
 * propiedad.ts — propiedades tal como las muestra el frontend.
 *
 * Qué es: TIPOS DE VISTA DEL FRONT. El back guarda una propiedad repartida
 * en varias tablas (`inmueble`, `publicacion`, `contrato`, catálogos de
 * tipo/tag/servicio — ver los modelos del back en `index.ts`). Las pantallas
 * no conocen esas tablas: reciben estos tipos ya armados por los adaptadores
 * de `apps/web/src/services/adapters/propiedad.adapter.ts`.
 *
 * Quién lo usa: `@rentar/ui` (`PropertyCard`, `SearchFilters`) y las
 * pantallas de la landing, `/buscar` (US-34), `/panel/propiedades` (US-02)
 * y `/panel/propiedades/nueva` (US-01).
 */
import type { PropertyStatus } from './status'

/**
 * Tipología de la propiedad (US-01: casa, departamento, monoambiente; el
 * back además tiene PH).
 * Adaptador: `propiedad.adapter.ts#propertyTypeFromTipoId` ↔ `tipo_inmueble.id`.
 */
export type PropertyType = 'departamento' | 'casa' | 'ph' | 'monoambiente'

/**
 * Índice legal de ajuste periódico del alquiler en Argentina: IPC (INDEC) o
 * ICL (BCRA) — los dos únicos índices habilitados para contratos de alquiler.
 * El back lo guarda en `contrato.indice_aumento` (id de `tipo_indice`: ICL 1,
 * IPC 2). NOTA: la base además tiene CAC (3), que el front no ofrece.
 */
export type AdjustmentIndex = 'IPC' | 'ICL'

/**
 * Clave de una característica opcional de la propiedad (los "tags" de US-01).
 * Adaptador: `propiedad.adapter.ts#characteristicFromTagId` ↔ `tag_inmueble.id`.
 */
export type CharacteristicKey = 'amoblado' | 'mascotas' | 'cochera' | 'balcon' | 'apto-profesional'

/** Opción de característica tal como se muestra en filtros y tarjetas. */
export interface CharacteristicOption {
  key: CharacteristicKey
  label: string
}

/**
 * Medio de pago que el locador acepta para el alquiler (US-01: "métodos de
 * pago preferidos", al menos uno). MercadoPago se separa en débito (dinero en
 * cuenta) y crédito porque la comisión de la pasarela es distinta.
 * TODO(db): la tabla `medio_pago` tiene otros medios (transferencia,
 * efectivo, Mercado Pago, débito automático) y no guarda el recargo. El
 * mapeo está en `propiedad.adapter.ts#propiedadNuevaToCreateInmueble`.
 */
export type MedioPagoPreferido = 'transferencia' | 'mercadopago_debito' | 'mercadopago_credito' | 'efectivo'

/**
 * Un medio de pago habilitado, con el recargo que se le traslada al
 * locatario si lo elige (Alta de propiedad · 04: "Cómo acepta que te paguen").
 */
export interface MedioPagoConRecargo {
  method: MedioPagoPreferido
  /** Recargo en %, de 0 a 3. `0` = el medio se ofrece sin costo extra. */
  surchargePct: number
}

/** Estado del pago del alquiler de una propiedad alquilada (US-02). */
export type EstadoPago = 'al_dia' | 'pago_pendiente' | 'retrasada'

/**
 * Una propiedad buscable, tal como se ve en una tarjeta de la landing y de
 * `/buscar` (US-34).
 *
 * Adaptador: `propiedad.adapter.ts#inmuebleDisponibleToPropiedadResumen`
 * (cada item de `GET /inmuebles/disponibles` → `PropiedadResumen`). Los
 * campos que el back todavía no devuelve están marcados en ese adaptador.
 */
export interface PropiedadResumen {
  id: string
  /** Título de la publicación, ej. "Monoambiente luminoso a metros de Plaza España". */
  title: string
  /**
   * Dirección APROXIMADA, ej. "Rondeau al 400" (US-34: dirección visible).
   * NOTA: decisión de privacidad del diseño: en la zona pública nunca se
   * muestra la altura exacta ni el piso; se redondea al centenar. La
   * dirección exacta la ve solo el locador y, más adelante, quien firma el
   * contrato.
   */
  address: string
  province: string
  city: string
  neighborhoodSlug: string
  neighborhoodName: string
  type: PropertyType
  /** Monto mensual del alquiler, en pesos (US-34: precio visible). */
  priceMonthly: number
  /**
   * Expensas mensuales, en pesos (US-34: expensas visibles). `0` = sin
   * expensas; `null` = no informadas (el back todavía no las devuelve): en
   * ese caso no se muestra nada, en vez de decir "Sin expensas".
   */
  expenses: number | null
  bedrooms: number
  rooms: number
  /** Superficie total en m² (US-34: m² visibles). */
  areaM2: number
  /** `null` si el locador no cargó índice (es opcional en US-01). */
  adjustmentIndex: AdjustmentIndex | null
  characteristics: CharacteristicKey[]
  /** Descripción libre (US-34: descripción visible). */
  description: string
  /**
   * Fecha ISO desde la que se puede alquilar (US-34: fecha de
   * disponibilidad visible). `null` = disponible ya.
   */
  availableFrom: string | null
  /** URL de la foto principal (US-01: la primera foto cargada, cambiable). */
  imageSrc: string
  /** Todas las fotos, empezando por la principal (el carrusel de la tarjeta). */
  photoSrcs: string[]
  /** Fecha ISO de publicación; se usa para ordenar por "más recientes". */
  publishedAt: string
  /** Solo los dos estados buscables: una propiedad `alquilada` o `pausada` nunca llega acá. */
  status: Extract<PropertyStatus, 'publicada' | 'alquilada_publicada'>
}

/**
 * Próximo ajuste del monto de un alquiler vigente (US-02: "fecha del
 * próximo ajuste y el tipo de ajuste").
 */
export interface ProximoAjuste {
  /** Fecha ISO del ajuste. */
  date: string
  index: AdjustmentIndex
  /** Cada cuántos meses se ajusta (US-01: de 1 a 12), ej. `12` = anual. */
  everyMonths: number
}

/**
 * Una propiedad del locador en sesión, tal como se ve en `/panel/propiedades`
 * (US-02): cualquier estado, con los datos del alquiler si está alquilada.
 *
 * Adaptador: `propiedad.adapter.ts#misAlquileresItemToPropiedadLocador`
 * (`MisAlquileresItem` → `PropiedadLocador`).
 */
export interface PropiedadLocador {
  id: string
  title: string
  /** Dirección EXACTA, ej. "Obispo Trejo 1250, 7° B": la ve solo su dueño. */
  address: string
  neighborhoodSlug: string
  neighborhoodName: string
  type: PropertyType
  rooms: number
  /** Estado de la publicación (US-02: publicada, pausada, alquilada, alquilada/publicada). */
  status: PropertyStatus
  priceMonthly: number
  expenses: number
  imageSrc: string
  /** Fecha ISO de alta; ordena "Más recientes". */
  publishedAt: string
  /** Nombre del locatario; solo para alquiladas (US-02). */
  tenantName: string | null
  /** Estado del pago del período actual; solo para alquiladas (US-02). */
  paymentStatus: EstadoPago | null
  /** Vencimiento (fecha ISO) del período actual; solo para alquiladas. */
  paymentDueDate: string | null
  /** Días de atraso; solo si `paymentStatus` es `retrasada`. */
  daysOverdue: number | null
  /** Cantidad de reclamos sin resolver (US-02: "si posee reclamos no resueltos"). */
  openClaims: number
  /** Índice cargado en el alta (US-01, opcional); en las no alquiladas se aplica "al firmar". */
  adjustmentIndex: AdjustmentIndex | null
  /** Próximo ajuste; solo para alquiladas con contrato vigente (US-02). */
  nextAdjustment: ProximoAjuste | null
  /** Fecha ISO desde la que vuelve a estar disponible, si se cargó (US-01). */
  availableFrom: string | null
}

/**
 * Estado de la publicación que se elige en el alta (US-01: "publicado,
 * pausado o alquilado"). `alquilada_publicada` no se elige a mano: la
 * calcula el sistema (ver `PropertyStatus`).
 */
export type EstadoPublicacionAlta = Extract<PropertyStatus, 'publicada' | 'pausada' | 'alquilada'>

/**
 * Una foto cargada en el alta. `src` es una data URL en modo mock.
 * TODO(db): con el back real, cada foto se sube al bucket `fotos-propiedades`
 * de Supabase Storage (todavía no existe) y al back viaja su URL pública
 * (`propiedades.service.ts#subirFotoPropiedad`).
 */
export interface FotoNueva {
  id: string
  src: string
  /** Nombre del archivo original, para el texto alternativo y la revisión. */
  name: string
}

/**
 * Los datos del alta de una propiedad (US-01), tal como los arma el
 * formulario de `/panel/propiedades/nueva`. El service los traduce al
 * cuerpo que espera el back (`propiedad.adapter.ts#propiedadNuevaToCreateInmueble`).
 */
export interface PropiedadNueva {
  // Paso 1 · Tipo y ubicación
  type: PropertyType
  street: string
  streetNumber: number
  /** Piso, ej. "7". Opcional. */
  floor: string | null
  /** Departamento, ej. "B". Opcional. */
  unit: string | null
  neighborhoodSlug: string
  city: string
  province: string

  // Paso 2 · Características
  rooms: number
  bedrooms: number
  bathrooms: number
  /** Antigüedad en años (opcional). */
  ageYears: number | null
  totalAreaM2: number
  coveredAreaM2: number
  characteristics: CharacteristicKey[]
  description: string
  status: EstadoPublicacionAlta
  /**
   * Fecha ISO desde la que vuelve a estar disponible (US-01: opcional). Una
   * `alquilada` con fecha queda `alquilada_publicada` y aparece en `/buscar`.
   */
  availableFrom: string | null

  // Paso 3 · Fotos
  photos: FotoNueva[]
  /** Índice de la principal dentro de `photos` (US-01: la primera, cambiable). */
  mainPhotoIndex: number

  // Paso 4 · Condiciones
  priceMonthly: number
  expenses: number
  /** Interés por día de atraso en %; `null` si no se cobra. */
  dailyInterestPct: number | null
  /** Días de gracia; obligatorios si hay interés por día (US-01). */
  graceDays: number | null
  paymentMethods: MedioPagoConRecargo[]
  adjustmentIndex: AdjustmentIndex | null
  /** Cada cuántos meses se ajusta (1 a 12); `null` si no se cargó. */
  adjustmentEveryMonths: number | null
  /** Depósito, en meses de alquiler; `null` si no se pide. */
  depositMonths: number | null
  /** Duración del contrato en meses; `null` si no se cargó. */
  contractMonths: number | null
}
