/**
 * propiedades.mock.ts — las propiedades del elenco único.
 *
 * Qué es: cada propiedad como la guardaría el back, con todos los campos del
 * alta (US-01), de la búsqueda (US-34) y de "Mis propiedades" (US-02).
 * Fuente de verdad: `docs/MapaDePantallas.pdf`, sección "El elenco y las
 * propiedades".
 *
 * Hay dos grupos:
 * 1. El elenco del mapa: las 7 de Nicolás Arrieta (4 alquiladas, 2
 *    publicadas, 1 pausada) y la de Sofía Ledesma como locadora.
 * 2. "Publicadas por otros locadores": las 16 propiedades que antes vivían
 *    aparte en la landing. Se sumaron para que `/buscar` tenga más de 10
 *    resultados (US-34 pide paginar). Conservan título, barrio, precio,
 *    dormitorios, m², índice, características y foto de la landing (así la
 *    landing se ve igual); se completaron dirección, expensas, descripción y
 *    fecha de disponibilidad. Todas están publicadas: ninguna alquilada
 *    aparece en `/buscar`.
 *
 * Quién lo usa: la rama mock de `services/propiedades.service.ts` (y, como
 * excepción documentada, el catálogo `/design-system`). Ninguna pantalla lo
 * importa directo.
 *
 * Con el back real, cada propiedad son filas de `inmueble` + `contrato` +
 * `foto_inmueble` + `inmueble_x_tag` + `medio_pago_x_contrato` (ver
 * `services/adapters/propiedad.adapter.ts`).
 */
import type {
  AdjustmentIndex,
  CharacteristicKey,
  ContractStatus,
  MedioPagoConRecargo,
  PropertyStatus,
  PropertyType,
} from '@rentar/shared-types'
import altaCordoba1 from '@/assets/properties/alta-cordoba-1.jpg'
import altaCordoba2 from '@/assets/properties/alta-cordoba-2.jpg'
import altaCordoba3 from '@/assets/properties/alta-cordoba-3.jpg'
import centro1 from '@/assets/properties/centro-1.jpg'
import centro2 from '@/assets/properties/centro-2.jpg'
import centro3 from '@/assets/properties/centro-3.jpg'
import cofico1 from '@/assets/properties/cofico-1.jpg'
import cofico2 from '@/assets/properties/cofico-2.jpg'
import generalPaz1 from '@/assets/properties/general-paz-1.jpg'
import generalPaz2 from '@/assets/properties/general-paz-2.jpg'
import guemes1 from '@/assets/properties/guemes-1.jpg'
import guemes2 from '@/assets/properties/guemes-2.jpg'
import nuevaCordoba1 from '@/assets/properties/nueva-cordoba-1.jpg'
import nuevaCordoba2 from '@/assets/properties/nueva-cordoba-2.jpg'
import nuevaCordoba3 from '@/assets/properties/nueva-cordoba-3.jpg'
import nuevaCordoba4 from '@/assets/properties/nueva-cordoba-4.jpg'

// ─── Tipos ──────────────────────────────────────────────────────────────

/** Una foto de la propiedad. `src` es una URL (en el elenco, la de un asset local). */
export interface FotoMock {
  src: string
}

/**
 * El contrato vigente de una propiedad alquilada (US-02: locatario y próximo
 * ajuste).
 * NOTA: los contratos son de otro sprint; acá vive solo el resumen que
 * necesitan el listado del locador y el panel. El estado del pago y los
 * reclamos NO van acá: salen de los cobros y reclamos de `panel.mock.ts`,
 * así el listado y el panel nunca se contradicen.
 */
export interface AlquilerMock {
  contractId: string
  contractStatus: ContractStatus
  tenantName: string
  /** `UsuarioSesion.id` del locatario, si tiene cuenta en el elenco (solo Sofía). */
  tenantUserId: string | null
  /** Fechas ISO de inicio y fin del contrato. */
  startDate: string
  endDate: string
  /** Monto mensual vigente del alquiler. */
  currentAmount: number
  /** Fecha ISO del próximo ajuste por índice. */
  nextAdjustmentDate: string
}

/**
 * Una propiedad completa, como la guardaría el back. JSON puro (sin
 * imágenes importadas): así se puede guardar en `localStorage` igual que las
 * que crea el alta (ver `services/shared/mockStore.ts`).
 */
export interface PropiedadMock {
  id: string
  /** `UsuarioSesion.id` del locador dueño. `'otros-locadores'` = dueños fuera del elenco. */
  ownerId: string
  status: PropertyStatus
  /** Fecha ISO de alta de la publicación; ordena "más recientes" en `/buscar`. */
  publishedAt: string
  /** Fecha ISO desde la que se puede alquilar; `null` = ya. */
  availableFrom: string | null

  // Ubicación (US-01)
  title: string
  street: string
  streetNumber: number
  /** Piso y depto, ej. "7° B"; `null` en casas y PH en planta baja sin número. */
  floor: string | null
  province: string
  city: string
  neighborhoodSlug: string
  neighborhoodName: string

  // Características (US-01)
  type: PropertyType
  description: string
  totalAreaM2: number
  coveredAreaM2: number
  rooms: number
  bedrooms: number
  bathrooms: number
  /** Antigüedad en años; `null` si no se cargó (es opcional). */
  ageYears: number | null
  characteristics: CharacteristicKey[]
  photos: FotoMock[]
  /** Índice de la foto principal dentro de `photos` (US-01: la primera, cambiable). */
  mainPhotoIndex: number

  // Condiciones y precio (US-01)
  priceMonthly: number
  expenses: number
  adjustmentIndex: AdjustmentIndex | null
  /** Cada cuántos meses se ajusta (US-01: 1 a 12); `null` si no se cargó. */
  adjustmentEveryMonths: number | null
  /** Medios de pago aceptados, con su recargo (US-01: al menos uno). */
  paymentMethods: MedioPagoConRecargo[]
  /** Interés por día de atraso, en %; `null` si no se cobra. */
  dailyInterestPct: number | null
  /** Días de gracia; obligatorio si hay interés por día (US-01). */
  graceDays: number | null
  contractMonths: number | null
  /** Depósito en meses de alquiler; `null` si no se pide. */
  depositMonths: number | null

  /** Solo para propiedades alquiladas (US-02). */
  rental: AlquilerMock | null
}

// ─── Helpers de armado ──────────────────────────────────────────────────

/**
 * Cada cuántos meses se ajusta, según el índice: el ICL una vez por año; el
 * IPC, en los contratos del elenco, cada cuatro meses.
 */
function everyMonthsFor(index: AdjustmentIndex): number {
  return index === 'ICL' ? 12 : 4
}

/** Medios de pago del elenco, todos sin recargo. */
const TRANSFERENCIA: MedioPagoConRecargo = { method: 'transferencia', surchargePct: 0 }
const MP_DEBITO: MedioPagoConRecargo = { method: 'mercadopago_debito', surchargePct: 0 }
const EFECTIVO: MedioPagoConRecargo = { method: 'efectivo', surchargePct: 0 }

/** Arma el título "Calle 123, 7° B" a partir de la dirección. */
function addressTitle(street: string, streetNumber: number, floor: string | null): string {
  return floor ? `${street} ${streetNumber}, ${floor}` : `${street} ${streetNumber}`
}

/** Campos comunes de las 16 propiedades "de otros locadores". */
interface OtroLocadorInput {
  id: string
  title: string
  street: string
  streetNumber: number
  floor: string | null
  neighborhoodSlug: string
  neighborhoodName: string
  type: PropertyType
  priceMonthly: number
  expenses: number
  bedrooms: number
  areaM2: number
  adjustmentIndex: AdjustmentIndex
  characteristics: CharacteristicKey[]
  photo: string
  description: string
  availableFrom: string | null
  publishedAt: string
}

/**
 * Completa una propiedad "de otro locador" con valores razonables en los
 * campos que la landing no tenía: ambientes = dormitorios + 1 (living),
 * superficie cubierta = total, 1 baño, contrato de 36 meses, depósito de un
 * mes, transferencia sin recargo como medio de pago y sin interés por atraso.
 */
function otroLocador(input: OtroLocadorInput): PropiedadMock {
  const { photo, areaM2, ...rest } = input
  return {
    ...rest,
    ownerId: 'otros-locadores',
    status: 'publicada',
    province: 'Córdoba',
    city: 'Córdoba Capital',
    totalAreaM2: areaM2,
    coveredAreaM2: areaM2,
    rooms: input.bedrooms + 1,
    bathrooms: 1,
    ageYears: null,
    photos: [{ src: photo }],
    mainPhotoIndex: 0,
    adjustmentEveryMonths: everyMonthsFor(input.adjustmentIndex),
    paymentMethods: [TRANSFERENCIA],
    dailyInterestPct: null,
    graceDays: null,
    contractMonths: 36,
    depositMonths: 1,
    rental: null,
  }
}

// ─── 1. El elenco del mapa ──────────────────────────────────────────────

const elenco: PropiedadMock[] = [
  {
    id: 'prop-laprida-340',
    ownerId: 'usr-nicolas',
    // "Séptima propiedad" de Nicolás en el mapa. Alquilada a Tomás Bianchi
    // (dato del export del listado, confirmado por producto): septiembre
    // vencido y 2 reclamos abiertos (ver panel.mock.ts).
    status: 'alquilada',
    publishedAt: '2025-03-01',
    availableFrom: null,
    title: addressTitle('Laprida', 340, null),
    street: 'Laprida',
    streetNumber: 340,
    floor: null,
    province: 'Córdoba',
    city: 'Córdoba Capital',
    neighborhoodSlug: 'nueva-cordoba',
    neighborhoodName: 'Nueva Córdoba',
    type: 'departamento',
    description: 'Departamento de dos dormitorios con balcón, a dos cuadras del Buen Pastor.',
    totalAreaM2: 55,
    coveredAreaM2: 52,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    ageYears: 15,
    characteristics: ['balcon'],
    photos: [{ src: nuevaCordoba1.src }],
    mainPhotoIndex: 0,
    priceMonthly: 520000,
    expenses: 70000,
    adjustmentIndex: 'ICL',
    adjustmentEveryMonths: 12,
    paymentMethods: [TRANSFERENCIA],
    dailyInterestPct: null,
    graceDays: null,
    contractMonths: 36,
    depositMonths: 1,
    rental: {
      contractId: 'CT-2026-0102',
      contractStatus: 'vigente',
      tenantName: 'Tomás Bianchi',
      tenantUserId: null,
      startDate: '2025-03-01',
      endDate: '2028-02-29',
      currentAmount: 520000,
      // ICL anual desde marzo de 2025.
      nextAdjustmentDate: '2027-03-01',
    },
  },
  {
    id: 'prop-obispo-trejo-1250',
    ownerId: 'usr-nicolas',
    // Alquilada a Sofía Ledesma — contrato CT-2026-0148: $470.000 + $85.000
    // de expensas, 01/04/2026 a 31/03/2029, ICL anual, próximo ajuste
    // 01/04/2027.
    status: 'alquilada',
    publishedAt: '2026-02-10',
    availableFrom: null,
    title: addressTitle('Obispo Trejo', 1250, '7° B'),
    street: 'Obispo Trejo',
    streetNumber: 1250,
    floor: '7° B',
    province: 'Córdoba',
    city: 'Córdoba Capital',
    neighborhoodSlug: 'nueva-cordoba',
    neighborhoodName: 'Nueva Córdoba',
    type: 'departamento',
    description: 'Departamento de dos dormitorios con balcón corrido, apto profesional.',
    totalAreaM2: 60,
    coveredAreaM2: 56,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    ageYears: 12,
    characteristics: ['balcon', 'apto-profesional'],
    photos: [{ src: nuevaCordoba2.src }],
    mainPhotoIndex: 0,
    priceMonthly: 470000,
    expenses: 85000,
    adjustmentIndex: 'ICL',
    adjustmentEveryMonths: 12,
    paymentMethods: [TRANSFERENCIA, MP_DEBITO],
    dailyInterestPct: null,
    graceDays: null,
    contractMonths: 36,
    depositMonths: 1,
    rental: {
      contractId: 'CT-2026-0148',
      contractStatus: 'vigente',
      tenantName: 'Sofía Ledesma',
      tenantUserId: 'usr-sofia',
      startDate: '2026-04-01',
      endDate: '2029-03-31',
      currentAmount: 470000,
      nextAdjustmentDate: '2027-04-01',
    },
  },
  {
    id: 'prop-rondeau-480',
    ownerId: 'usr-nicolas',
    // "La publicada" del mapa: la única buscable de la narrativa. Julieta
    // Peralta la solicita y termina firmando CT-2026-0207 ($385.000 +
    // $62.000, desde el 01/10/2026). Mientras el contrato está pendiente de
    // firma sigue publicada, disponible desde octubre.
    status: 'publicada',
    publishedAt: '2026-08-20',
    availableFrom: '2026-10-01',
    // Título descriptivo (no la dirección): en /buscar la tarjeta ya muestra la
    // dirección aproximada arriba, y abajo "barrio · título".
    title: '1 dormitorio en planta baja con cochera',
    street: 'Rondeau',
    streetNumber: 480,
    floor: 'PB',
    province: 'Córdoba',
    city: 'Córdoba Capital',
    neighborhoodSlug: 'guemes',
    neighborhoodName: 'Güemes',
    type: 'departamento',
    description: 'Departamento de un dormitorio en planta baja, con cochera, a una cuadra del Paseo de las Artes.',
    totalAreaM2: 42,
    coveredAreaM2: 42,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    ageYears: 20,
    characteristics: ['cochera'],
    photos: [{ src: guemes1.src }],
    mainPhotoIndex: 0,
    priceMonthly: 385000,
    expenses: 62000,
    adjustmentIndex: 'IPC',
    adjustmentEveryMonths: 4,
    paymentMethods: [TRANSFERENCIA, MP_DEBITO],
    dailyInterestPct: 0.5,
    graceDays: 5,
    contractMonths: 36,
    depositMonths: 1,
    rental: null,
  },
  {
    id: 'prop-belgrano-1120',
    ownerId: 'usr-nicolas',
    // Alquilada a Julián Ferreyra (dato del export): septiembre vencido, sin
    // reclamos (ver panel.mock.ts).
    status: 'alquilada',
    publishedAt: '2025-06-15',
    availableFrom: null,
    title: addressTitle('Belgrano', 1120, null),
    street: 'Belgrano',
    streetNumber: 1120,
    floor: null,
    province: 'Córdoba',
    city: 'Córdoba Capital',
    neighborhoodSlug: 'centro',
    neighborhoodName: 'Centro',
    type: 'departamento',
    description: 'Departamento amoblado de un dormitorio, cerca de la Plaza San Martín.',
    totalAreaM2: 45,
    coveredAreaM2: 45,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    ageYears: 30,
    characteristics: ['amoblado'],
    photos: [{ src: centro1.src }],
    mainPhotoIndex: 0,
    priceMonthly: 460000,
    expenses: 58000,
    adjustmentIndex: 'IPC',
    adjustmentEveryMonths: 4,
    paymentMethods: [TRANSFERENCIA],
    dailyInterestPct: null,
    graceDays: null,
    contractMonths: 36,
    depositMonths: 1,
    rental: {
      contractId: 'CT-2026-0115',
      contractStatus: 'vigente',
      tenantName: 'Julián Ferreyra',
      tenantUserId: null,
      startDate: '2025-07-01',
      endDate: '2028-06-30',
      currentAmount: 460000,
      // IPC cada 4 meses desde julio de 2025: nov-25, mar-26, jul-26, nov-26.
      nextAdjustmentDate: '2026-11-01',
    },
  },
  {
    id: 'prop-colon-2450',
    ownerId: 'usr-nicolas',
    // Cierra las "4 alquiladas" de Nicolás. Alquilada a Martín Cabrera (dato del
    // export): septiembre pendiente (vence este mes) y 1 reclamo abierto.
    status: 'alquilada',
    publishedAt: '2025-09-01',
    availableFrom: null,
    title: addressTitle('Av. Colón', 2450, '3° A'),
    street: 'Av. Colón',
    streetNumber: 2450,
    floor: '3° A',
    province: 'Córdoba',
    city: 'Córdoba Capital',
    neighborhoodSlug: 'general-paz',
    neighborhoodName: 'General Paz',
    type: 'departamento',
    description: 'Departamento de dos dormitorios con balcón; se aceptan mascotas.',
    totalAreaM2: 58,
    coveredAreaM2: 54,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    ageYears: 25,
    characteristics: ['balcon', 'mascotas'],
    photos: [{ src: generalPaz1.src }],
    mainPhotoIndex: 0,
    priceMonthly: 440000,
    expenses: 65000,
    adjustmentIndex: 'ICL',
    adjustmentEveryMonths: 12,
    paymentMethods: [TRANSFERENCIA],
    dailyInterestPct: null,
    graceDays: null,
    contractMonths: 36,
    depositMonths: 1,
    rental: {
      contractId: 'CT-2026-0121',
      contractStatus: 'vigente',
      tenantName: 'Martín Cabrera',
      tenantUserId: null,
      startDate: '2025-10-01',
      endDate: '2028-09-30',
      currentAmount: 440000,
      // ICL anual desde octubre de 2025.
      nextAdjustmentDate: '2026-10-01',
    },
  },
  {
    id: 'prop-rivera-785',
    ownerId: 'usr-nicolas',
    status: 'publicada',
    publishedAt: '2026-09-05',
    availableFrom: null,
    title: 'PH de 2 dormitorios con patio',
    street: 'Fructuoso Rivera',
    streetNumber: 785,
    floor: null,
    province: 'Córdoba',
    city: 'Córdoba Capital',
    neighborhoodSlug: 'cofico',
    neighborhoodName: 'Cofico',
    type: 'ph',
    description: 'PH de dos dormitorios con patio y cochera; se aceptan mascotas.',
    totalAreaM2: 65,
    coveredAreaM2: 58,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    ageYears: 40,
    characteristics: ['cochera', 'mascotas'],
    photos: [{ src: cofico1.src }],
    mainPhotoIndex: 0,
    priceMonthly: 450000,
    expenses: 15000,
    adjustmentIndex: 'IPC',
    adjustmentEveryMonths: 4,
    paymentMethods: [TRANSFERENCIA, EFECTIVO],
    dailyInterestPct: null,
    graceDays: null,
    contractMonths: 36,
    depositMonths: 1,
    rental: null,
  },
  {
    id: 'prop-chacabuco-690',
    ownerId: 'usr-nicolas',
    // Pausada: cierra el reparto de las 7 de Nicolás (4 alquiladas + 2
    // publicadas + 1 pausada).
    status: 'pausada',
    publishedAt: '2026-05-12',
    availableFrom: null,
    title: addressTitle('Chacabuco', 690, null),
    street: 'Chacabuco',
    streetNumber: 690,
    floor: null,
    province: 'Córdoba',
    city: 'Córdoba Capital',
    neighborhoodSlug: 'alta-cordoba',
    neighborhoodName: 'Alta Córdoba',
    type: 'departamento',
    description: 'Departamento amoblado de un dormitorio, ideal para estudiantes.',
    totalAreaM2: 34,
    coveredAreaM2: 34,
    rooms: 2,
    bedrooms: 1,
    bathrooms: 1,
    ageYears: null,
    characteristics: ['amoblado'],
    photos: [{ src: altaCordoba1.src }],
    mainPhotoIndex: 0,
    priceMonthly: 445000,
    expenses: 48000,
    adjustmentIndex: 'ICL',
    adjustmentEveryMonths: 12,
    paymentMethods: [TRANSFERENCIA],
    dailyInterestPct: null,
    graceDays: null,
    contractMonths: 36,
    depositMonths: 1,
    rental: null,
  },
  {
    id: 'prop-mariano-moreno-285',
    ownerId: 'usr-sofia',
    // Sofía Ledesma como locadora (su otro rol). Alquilada a Camila Ríos (dato
    // del export): el cobro de septiembre venció el 05/09 (ver panel.mock.ts).
    // No aparece en el listado de Nicolás: es de Sofía.
    status: 'alquilada',
    publishedAt: '2025-11-20',
    availableFrom: null,
    title: addressTitle('Mariano Moreno', 285, null),
    street: 'Mariano Moreno',
    streetNumber: 285,
    floor: null,
    province: 'Córdoba',
    city: 'Córdoba Capital',
    neighborhoodSlug: 'nueva-cordoba',
    neighborhoodName: 'Nueva Córdoba',
    type: 'casa',
    description: 'Casa de dos dormitorios con cochera y patio; se aceptan mascotas.',
    totalAreaM2: 70,
    coveredAreaM2: 62,
    rooms: 3,
    bedrooms: 2,
    bathrooms: 1,
    ageYears: 45,
    characteristics: ['cochera', 'mascotas'],
    photos: [{ src: nuevaCordoba3.src }],
    mainPhotoIndex: 0,
    priceMonthly: 510000,
    expenses: 0,
    adjustmentIndex: 'IPC',
    adjustmentEveryMonths: 4,
    paymentMethods: [TRANSFERENCIA],
    dailyInterestPct: null,
    graceDays: null,
    contractMonths: 36,
    depositMonths: 1,
    rental: {
      contractId: 'CT-2026-0133',
      contractStatus: 'vigente',
      tenantName: 'Camila Ríos',
      tenantUserId: null,
      startDate: '2025-12-01',
      endDate: '2028-11-30',
      currentAmount: 510000,
      // IPC cada 4 meses desde diciembre de 2025: abr-26, ago-26, dic-26.
      nextAdjustmentDate: '2026-12-01',
    },
  },
]

// ─── 2. Publicadas por otros locadores (las 16 de la landing) ───────────
// NOTA: tres títulos dicen "Monoambiente" pero la landing las modela como
// departamento de 1 dormitorio. Se dejan así para no cambiar lo que muestra
// la tarjeta de la landing ("1 dormitorio"); no son `type: 'monoambiente'`.

const otrosLocadores: PropiedadMock[] = [
  otroLocador({
    id: 'prop-otro-01',
    title: 'Monoambiente luminoso a metros de Plaza España',
    street: 'Independencia',
    streetNumber: 850,
    floor: '5° C',
    neighborhoodSlug: 'nueva-cordoba',
    neighborhoodName: 'Nueva Córdoba',
    type: 'departamento',
    priceMonthly: 580000,
    expenses: 72000,
    bedrooms: 1,
    areaM2: 38,
    adjustmentIndex: 'ICL',
    characteristics: ['amoblado', 'balcon'],
    photo: nuevaCordoba1.src,
    description: 'Amoblado y muy luminoso, con balcón al frente y a metros de Plaza España.',
    availableFrom: null,
    publishedAt: '2026-09-12',
  }),
  otroLocador({
    id: 'prop-otro-02',
    title: 'Depto de 1 dormitorio con balcón terraza',
    street: 'Bv. Chacabuco',
    streetNumber: 555,
    floor: '8° A',
    neighborhoodSlug: 'nueva-cordoba',
    neighborhoodName: 'Nueva Córdoba',
    type: 'departamento',
    priceMonthly: 610000,
    expenses: 80000,
    bedrooms: 1,
    areaM2: 42,
    adjustmentIndex: 'ICL',
    characteristics: ['balcon', 'apto-profesional'],
    photo: nuevaCordoba2.src,
    description: 'Un dormitorio con balcón terraza y vista abierta; apto profesional.',
    availableFrom: '2026-10-01',
    publishedAt: '2026-09-18',
  }),
  otroLocador({
    id: 'prop-otro-03',
    title: 'Departamento a estrenar cerca de la peatonal',
    street: '27 de Abril',
    streetNumber: 370,
    floor: '4° B',
    neighborhoodSlug: 'centro',
    neighborhoodName: 'Centro',
    type: 'departamento',
    priceMonthly: 470000,
    expenses: 55000,
    bedrooms: 1,
    areaM2: 40,
    adjustmentIndex: 'IPC',
    characteristics: ['amoblado', 'apto-profesional'],
    photo: centro1.src,
    description: 'A estrenar, amoblado y a dos cuadras de la peatonal.',
    availableFrom: null,
    publishedAt: '2026-08-28',
  }),
  otroLocador({
    id: 'prop-otro-04',
    title: 'Amplio 2 ambientes con living comedor integrado',
    street: 'Deán Funes',
    streetNumber: 460,
    floor: '2° A',
    neighborhoodSlug: 'centro',
    neighborhoodName: 'Centro',
    type: 'departamento',
    priceMonthly: 495000,
    expenses: 60000,
    bedrooms: 2,
    areaM2: 55,
    adjustmentIndex: 'IPC',
    characteristics: ['mascotas', 'balcon'],
    photo: centro2.src,
    description: 'Living comedor integrado, dos dormitorios y balcón; se aceptan mascotas.',
    availableFrom: null,
    publishedAt: '2026-07-30',
  }),
  otroLocador({
    id: 'prop-otro-05',
    title: 'PH de dos dormitorios con patio propio',
    street: 'Achával Rodríguez',
    streetNumber: 245,
    floor: null,
    neighborhoodSlug: 'guemes',
    neighborhoodName: 'Güemes',
    type: 'ph',
    priceMonthly: 460000,
    expenses: 0,
    bedrooms: 2,
    areaM2: 60,
    adjustmentIndex: 'IPC',
    characteristics: ['mascotas', 'cochera'],
    photo: guemes1.src,
    description: 'PH sin expensas, con patio propio y cochera; se aceptan mascotas.',
    availableFrom: null,
    publishedAt: '2026-09-02',
  }),
  otroLocador({
    id: 'prop-otro-06',
    title: 'Departamento reciclado sobre calle arbolada',
    street: 'Jujuy',
    streetNumber: 1780,
    floor: '1° B',
    neighborhoodSlug: 'cofico',
    neighborhoodName: 'Cofico',
    type: 'departamento',
    priceMonthly: 450000,
    expenses: 42000,
    bedrooms: 1,
    areaM2: 45,
    adjustmentIndex: 'ICL',
    characteristics: ['amoblado', 'mascotas'],
    photo: cofico1.src,
    description: 'Reciclado a nuevo, amoblado y sobre una calle arbolada.',
    availableFrom: '2026-11-01',
    publishedAt: '2026-09-20',
  }),
  otroLocador({
    id: 'prop-otro-07',
    title: 'Casa de 2 dormitorios con cochera cubierta',
    street: '24 de Septiembre',
    streetNumber: 1450,
    floor: null,
    neighborhoodSlug: 'general-paz',
    neighborhoodName: 'General Paz',
    type: 'casa',
    priceMonthly: 505000,
    expenses: 0,
    bedrooms: 2,
    areaM2: 70,
    adjustmentIndex: 'IPC',
    characteristics: ['cochera', 'mascotas'],
    photo: generalPaz1.src,
    description: 'Casa con cochera cubierta y patio; se aceptan mascotas.',
    availableFrom: null,
    publishedAt: '2026-08-10',
  }),
  otroLocador({
    id: 'prop-otro-08',
    title: 'Monoambiente ideal para estudiante, a metros del FFyH',
    street: 'Jerónimo Luis de Cabrera',
    streetNumber: 620,
    floor: '3° D',
    neighborhoodSlug: 'alta-cordoba',
    neighborhoodName: 'Alta Córdoba',
    type: 'departamento',
    priceMonthly: 445000,
    expenses: 38000,
    bedrooms: 1,
    areaM2: 32,
    adjustmentIndex: 'ICL',
    characteristics: ['amoblado'],
    photo: altaCordoba1.src,
    description: 'Amoblado y listo para entrar, pensado para estudiantes.',
    availableFrom: null,
    publishedAt: '2026-09-08',
  }),
  otroLocador({
    id: 'prop-otro-09',
    title: 'Departamento moderno con vista abierta',
    street: 'Buenos Aires',
    streetNumber: 1010,
    floor: '10° A',
    neighborhoodSlug: 'nueva-cordoba',
    neighborhoodName: 'Nueva Córdoba',
    type: 'departamento',
    priceMonthly: 595000,
    expenses: 78000,
    bedrooms: 1,
    areaM2: 40,
    adjustmentIndex: 'ICL',
    characteristics: ['amoblado', 'apto-profesional'],
    photo: nuevaCordoba3.src,
    description: 'Piso alto con vista abierta, amoblado y apto profesional.',
    availableFrom: null,
    publishedAt: '2026-09-15',
  }),
  otroLocador({
    id: 'prop-otro-10',
    title: 'Torre a metros de Plaza España, piso alto',
    street: 'Paraná',
    streetNumber: 690,
    floor: '14° B',
    neighborhoodSlug: 'nueva-cordoba',
    neighborhoodName: 'Nueva Córdoba',
    type: 'departamento',
    priceMonthly: 600000,
    expenses: 95000,
    bedrooms: 2,
    areaM2: 52,
    adjustmentIndex: 'ICL',
    characteristics: ['cochera', 'balcon'],
    photo: nuevaCordoba4.src,
    description: 'Dos dormitorios en torre con amenities, balcón y cochera.',
    availableFrom: '2026-10-15',
    publishedAt: '2026-09-21',
  }),
  otroLocador({
    id: 'prop-otro-11',
    title: 'PH luminoso con living comedor y patio',
    street: 'Pasaje Revol',
    streetNumber: 64,
    floor: null,
    neighborhoodSlug: 'guemes',
    neighborhoodName: 'Güemes',
    type: 'ph',
    priceMonthly: 470000,
    expenses: 0,
    bedrooms: 1,
    areaM2: 48,
    adjustmentIndex: 'IPC',
    characteristics: ['amoblado', 'balcon'],
    photo: guemes2.src,
    description: 'PH luminoso, amoblado, con patio y sin expensas.',
    availableFrom: null,
    publishedAt: '2026-08-22',
  }),
  otroLocador({
    id: 'prop-otro-12',
    title: 'Departamento renovado a dos cuadras del ferrocarril',
    street: 'Rodríguez Peña',
    streetNumber: 1850,
    floor: '2° A',
    neighborhoodSlug: 'alta-cordoba',
    neighborhoodName: 'Alta Córdoba',
    type: 'departamento',
    priceMonthly: 460000,
    expenses: 45000,
    bedrooms: 2,
    areaM2: 50,
    adjustmentIndex: 'IPC',
    characteristics: ['mascotas', 'cochera'],
    photo: altaCordoba2.src,
    description: 'Dos dormitorios renovados, con cochera; se aceptan mascotas.',
    availableFrom: null,
    publishedAt: '2026-07-18',
  }),
  otroLocador({
    id: 'prop-otro-13',
    title: 'Departamento con vista abierta y mucha luz natural',
    street: 'Rivadavia',
    streetNumber: 150,
    floor: '9° C',
    neighborhoodSlug: 'centro',
    neighborhoodName: 'Centro',
    type: 'departamento',
    priceMonthly: 485000,
    expenses: 68000,
    bedrooms: 2,
    areaM2: 58,
    adjustmentIndex: 'IPC',
    characteristics: ['balcon', 'apto-profesional'],
    photo: centro3.src,
    description: 'Dos dormitorios con balcón y mucha luz natural; apto profesional.',
    availableFrom: null,
    publishedAt: '2026-09-10',
  }),
  otroLocador({
    id: 'prop-otro-14',
    title: 'Casa de 2 dormitorios con habitaciones amplias',
    street: 'Ovidio Lagos',
    streetNumber: 380,
    floor: null,
    neighborhoodSlug: 'general-paz',
    neighborhoodName: 'General Paz',
    type: 'casa',
    priceMonthly: 495000,
    expenses: 0,
    bedrooms: 2,
    areaM2: 68,
    adjustmentIndex: 'IPC',
    characteristics: ['amoblado', 'mascotas'],
    photo: generalPaz2.src,
    description: 'Casa amoblada con dormitorios amplios; se aceptan mascotas.',
    availableFrom: '2026-11-01',
    publishedAt: '2026-08-30',
  }),
  otroLocador({
    id: 'prop-otro-15',
    title: 'Monoambiente con escritorio, ideal para estudiar',
    street: 'Isabel la Católica',
    streetNumber: 1120,
    floor: '1° A',
    neighborhoodSlug: 'alta-cordoba',
    neighborhoodName: 'Alta Córdoba',
    type: 'departamento',
    priceMonthly: 450000,
    expenses: 36000,
    bedrooms: 1,
    areaM2: 30,
    adjustmentIndex: 'ICL',
    characteristics: ['amoblado', 'apto-profesional'],
    photo: altaCordoba3.src,
    description: 'Amoblado, con escritorio y buena conexión a internet.',
    availableFrom: null,
    publishedAt: '2026-09-01',
  }),
  otroLocador({
    id: 'prop-otro-16',
    title: 'Departamento con cocina integrada a estrenar',
    street: 'Fragueiro',
    streetNumber: 1320,
    floor: '3° B',
    neighborhoodSlug: 'cofico',
    neighborhoodName: 'Cofico',
    type: 'departamento',
    priceMonthly: 465000,
    expenses: 47000,
    bedrooms: 1,
    areaM2: 44,
    adjustmentIndex: 'IPC',
    characteristics: ['cochera'],
    photo: cofico2.src,
    description: 'A estrenar, con cocina integrada y cochera.',
    availableFrom: null,
    publishedAt: '2026-09-16',
  }),
]

/** Todas las propiedades del elenco: primero las del mapa, después las de otros locadores. */
export const propiedades: PropiedadMock[] = [...elenco, ...otrosLocadores]
