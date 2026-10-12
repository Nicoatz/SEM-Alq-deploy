/**
 * propiedad-mock.adapter.ts — traduce una propiedad del elenco mock a los
 * tipos de vista, y el alta (US-01) a una propiedad del elenco.
 *
 * Qué es: el equivalente, en modo mock, de `propiedad.adapter.ts`. El elenco
 * guarda cada propiedad completa (`PropiedadMock`, como la guardaría el
 * back); las pantallas reciben solo lo que muestran.
 * Cubre: US-34 (`PropiedadResumen`), US-41 (`PropiedadDetalle`), US-02
 * (`PropiedadLocador`) y US-01 (`PropiedadNueva` → `PropiedadMock`).
 * Quién lo usa: la rama mock de `services/propiedades.service.ts` y el
 * catálogo `/design-system`.
 */
import type {
  DisponibilidadPropiedad,
  DuenoPropiedad,
  EstadoPago,
  PropertyStatus,
  PropiedadDetalle,
  PropiedadLocador,
  PropiedadNueva,
  PropiedadResumen,
  CambiosPropiedad,
  PropiedadLocadorDetalle,
} from '@rentar/shared-types'
import type { CobroMock, PropiedadMock } from '@/lib/mocks'
import { neighborhoods } from '@/lib/catalogs/neighborhoods'
import { diasDesde } from '@/lib/utils/fechas'
import { formatApproxAddress, formatFloorUnit, separarPisoDepto } from './direccion'
import { estadoDePropiedadNueva, tituloDePropiedadNueva } from './propiedad.adapter'

/** Dirección exacta: "Calle 123, 7° B". Solo para el locador (US-02), nunca en la zona pública. */
export function formatAddress(propiedad: Pick<PropiedadMock, 'street' | 'streetNumber' | 'floor'>): string {
  const base = `${propiedad.street} ${propiedad.streetNumber}`
  return propiedad.floor ? `${base}, ${propiedad.floor}` : base
}

/** URL de la foto principal (US-01: la elegida como principal; si falta, la primera). */
export function mainPhotoSrc(propiedad: Pick<PropiedadMock, 'photos' | 'mainPhotoIndex'>): string {
  return propiedad.photos[propiedad.mainPhotoIndex]?.src ?? propiedad.photos[0]?.src ?? ''
}

/** Todas las fotos, con la principal primero (para el carrusel de la tarjeta). */
export function photosMainFirst(propiedad: Pick<PropiedadMock, 'photos' | 'mainPhotoIndex'>): string[] {
  const principal = mainPhotoSrc(propiedad)
  return [principal, ...propiedad.photos.map((foto) => foto.src).filter((src, index) => index !== propiedad.mainPhotoIndex)]
}

/**
 * `true` si la propiedad aparece en `/buscar` (US-34: "publicadas o
 * publicadas/alquiladas"). Una `alquilada` a secas o una `pausada`, nunca.
 */
export function isSearchable(propiedad: PropiedadMock): propiedad is PropiedadMock & { status: PropiedadResumen['status'] } {
  return propiedad.status === 'publicada' || propiedad.status === 'alquilada_publicada'
}

/**
 * `PropiedadMock` → `PropiedadResumen` (tarjeta de la landing y de `/buscar`).
 * Solo acepta propiedades buscables: filtrar antes con {@link isSearchable}.
 */
export function propiedadMockToResumen(propiedad: PropiedadMock & { status: PropiedadResumen['status'] }): PropiedadResumen {
  return {
    id: propiedad.id,
    title: propiedad.title,
    // Zona pública: dirección aproximada (ver la NOTA de privacidad en direccion.ts).
    address: formatApproxAddress(propiedad.street, propiedad.streetNumber),
    province: propiedad.province,
    city: propiedad.city,
    neighborhoodSlug: propiedad.neighborhoodSlug,
    neighborhoodName: propiedad.neighborhoodName,
    type: propiedad.type,
    priceMonthly: propiedad.priceMonthly,
    expenses: propiedad.expenses,
    bedrooms: propiedad.bedrooms,
    rooms: propiedad.rooms,
    areaM2: propiedad.totalAreaM2,
    adjustmentIndex: propiedad.adjustmentIndex,
    characteristics: propiedad.characteristics,
    description: propiedad.description,
    availableFrom: propiedad.availableFrom,
    imageSrc: mainPhotoSrc(propiedad),
    photoSrcs: photosMainFirst(propiedad),
    publishedAt: propiedad.publishedAt,
    status: propiedad.status,
  }
}

// ─── Detalle público (US-41) ────────────────────────────────────────────

/**
 * Si una propiedad se puede solicitar (US-41 y US-35): lo mismo que aparece
 * en `/buscar` (publicada o alquilada con fecha de disponibilidad). Una
 * alquilada sin fecha o pausada muestra "Ya no está disponible".
 */
export function disponibilidadDeEstado(status: PropertyStatus): DisponibilidadPropiedad {
  return status === 'publicada' || status === 'alquilada_publicada' ? 'disponible' : 'no_disponible'
}

/**
 * `PropiedadMock` → `PropiedadDetalle` (`/propiedad/[id]`, US-41).
 *
 * - `address` y `floor`: con sesión, la dirección EXACTA y el piso; sin
 *   sesión, la aproximada de `/buscar` y sin piso (decisión del PO con la
 *   US-35 actualizada; ver la NOTA de privacidad de `PropiedadDetalle`).
 *   NOTA: es solo cosmético mientras el back mande la altura y el piso sin
 *   token (HANDOFF §10).
 * - `requiredGuarantees`: las que exige el locador, si el elenco las define.
 * - `owner`: lo arma el service con el elenco de cuentas. Los dueños fuera
 *   del elenco (`otros-locadores`) van con `fullName: null` ("el dueño"): no
 *   se inventan locadores.
 * - `conditions`: plazo, ajuste y depósito (meses × precio) del alta; `null`
 *   si no se cargó ninguno.
 * - `paymentMethods`: los del alta; `null` si no hay ninguno.
 */
export function propiedadMockToDetalle(propiedad: PropiedadMock, owner: DuenoPropiedad, opciones: { conSesion?: boolean } = {}): PropiedadDetalle {
  const exacta = opciones.conSesion === true
  const depositAmount = propiedad.depositMonths === null ? null : propiedad.depositMonths * propiedad.priceMonthly
  const hayCondiciones = propiedad.contractMonths !== null || propiedad.adjustmentEveryMonths !== null || depositAmount !== null
  return {
    id: propiedad.id,
    title: propiedad.title,
    // Zona pública: dirección aproximada (ver la NOTA de privacidad en direccion.ts).
    address: exacta ? formatAddress(propiedad) : formatApproxAddress(propiedad.street, propiedad.streetNumber),
    province: propiedad.province,
    city: propiedad.city,
    neighborhoodSlug: propiedad.neighborhoodSlug,
    neighborhoodName: propiedad.neighborhoodName,
    type: propiedad.type,
    priceMonthly: propiedad.priceMonthly,
    expenses: propiedad.expenses,
    bedrooms: propiedad.bedrooms,
    rooms: propiedad.rooms,
    bathrooms: propiedad.bathrooms,
    areaM2: propiedad.totalAreaM2,
    coveredAreaM2: propiedad.coveredAreaM2,
    adjustmentIndex: propiedad.adjustmentIndex,
    characteristics: propiedad.characteristics,
    description: propiedad.description,
    availableFrom: propiedad.availableFrom,
    imageSrc: mainPhotoSrc(propiedad),
    photoSrcs: photosMainFirst(propiedad),
    publishedAt: propiedad.publishedAt,
    status: propiedad.status,
    availability: disponibilidadDeEstado(propiedad.status),
    owner,
    conditions: hayCondiciones
      ? { contractMonths: propiedad.contractMonths, adjustmentEveryMonths: propiedad.adjustmentEveryMonths, depositAmount }
      : null,
    paymentMethods: propiedad.paymentMethods.length > 0 ? propiedad.paymentMethods : null,
    addressPrecision: exacta ? 'exacta' : 'aproximada',
    floor: exacta ? propiedad.floor : null,
    requiredGuarantees: propiedad.requiredGuarantees ?? [],
  }
}

// ─── Mis propiedades (US-02) ────────────────────────────────────────────

/** Estado del pago de un período, calculado contra hoy (ver `lib/mocks/panel.mock.ts`). */
export interface EstadoPagoCalculado {
  status: EstadoPago
  /** Días de atraso; solo si está `retrasada`. */
  daysOverdue: number | null
}

/**
 * Estado del pago del cobro del período (US-02: "al día, con pago
 * pendiente, retrasada"): pagado → al día; sin pagar y sin vencer → con pago
 * pendiente; sin pagar y vencido → retrasada, con los días de atraso.
 */
export function estadoPagoDeCobro(cobro: Pick<CobroMock, 'dueDate' | 'paidAt'>): EstadoPagoCalculado {
  if (cobro.paidAt) return { status: 'al_dia', daysOverdue: null }
  const atraso = diasDesde(cobro.dueDate)
  return atraso > 0 ? { status: 'retrasada', daysOverdue: atraso } : { status: 'pago_pendiente', daysOverdue: null }
}

/** Lo que el listado necesita de otros módulos para una propiedad: su cobro del período y sus reclamos. */
export interface DatosAlquilerMock {
  cobro: CobroMock | null
  openClaims: number
}

/** `PropiedadMock` → `PropiedadLocador` (fila de `/panel/propiedades`, US-02). */
export function propiedadMockToLocador(propiedad: PropiedadMock, { cobro, openClaims }: DatosAlquilerMock): PropiedadLocador {
  const { rental } = propiedad
  const pago = rental && cobro ? estadoPagoDeCobro(cobro) : null
  return {
    id: propiedad.id,
    title: propiedad.title,
    address: formatAddress(propiedad),
    neighborhoodSlug: propiedad.neighborhoodSlug,
    neighborhoodName: propiedad.neighborhoodName,
    type: propiedad.type,
    rooms: propiedad.rooms,
    status: propiedad.status,
    priceMonthly: rental?.currentAmount ?? propiedad.priceMonthly,
    expenses: propiedad.expenses,
    imageSrc: mainPhotoSrc(propiedad),
    publishedAt: propiedad.publishedAt,
    tenantName: rental?.tenantName ?? null,
    paymentStatus: pago?.status ?? null,
    paymentDueDate: rental && cobro ? cobro.dueDate : null,
    daysOverdue: pago?.daysOverdue ?? null,
    hasOpenClaims: openClaims > 0,
    openClaims,
    adjustmentIndex: propiedad.adjustmentIndex,
    nextAdjustment:
      rental && propiedad.adjustmentIndex
        ? { date: rental.nextAdjustmentDate, index: propiedad.adjustmentIndex, everyMonths: propiedad.adjustmentEveryMonths ?? 12 }
        : null,
    availableFrom: propiedad.availableFrom,
  }
}

// ─── Alta (US-01) ───────────────────────────────────────────────────────

/**
 * `PropiedadNueva` (formulario del alta) → `PropiedadMock` (lo que se guarda
 * en `localStorage`).
 *
 * El estado sale de `estadoDePropiedadNueva`: una alquilada con fecha de
 * disponibilidad queda `alquilada_publicada` (aparece en `/buscar`); sin
 * fecha, `alquilada` (no aparece).
 */
export function propiedadNuevaToMock(nueva: PropiedadNueva, ids: { id: string; ownerId: string; publishedAt: string }): PropiedadMock {
  const barrio = neighborhoods.find((item) => item.slug === nueva.neighborhoodSlug)
  return {
    id: ids.id,
    ownerId: ids.ownerId,
    status: estadoDePropiedadNueva(nueva),
    publishedAt: ids.publishedAt,
    availableFrom: nueva.availableFrom,
    title: tituloDePropiedadNueva(nueva),
    street: nueva.street.trim(),
    streetNumber: nueva.streetNumber,
    floor: formatFloorUnit(nueva.floor, nueva.unit),
    province: nueva.province,
    city: nueva.city,
    neighborhoodSlug: nueva.neighborhoodSlug,
    neighborhoodName: barrio?.name ?? nueva.neighborhoodSlug,
    type: nueva.type,
    description: nueva.description.trim(),
    totalAreaM2: nueva.totalAreaM2,
    coveredAreaM2: nueva.coveredAreaM2,
    rooms: nueva.rooms,
    bedrooms: nueva.bedrooms,
    bathrooms: nueva.bathrooms,
    ageYears: nueva.ageYears,
    characteristics: nueva.characteristics,
    photos: nueva.photos.map((foto) => ({ src: foto.src })),
    mainPhotoIndex: nueva.mainPhotoIndex,
    priceMonthly: nueva.priceMonthly,
    expenses: nueva.expenses,
    adjustmentIndex: nueva.adjustmentIndex,
    adjustmentEveryMonths: nueva.adjustmentEveryMonths,
    paymentMethods: nueva.paymentMethods,
    dailyInterestPct: nueva.dailyInterestPct,
    graceDays: nueva.graceDays,
    contractMonths: nueva.contractMonths,
    depositMonths: nueva.depositMonths,
    rental: null,
  }
}

// ─── Detalle del locador y edición (US-03, US-04) ───────────────────────

/**
 * `PropiedadMock` → los datos con la forma del alta (`PropiedadNueva`), para
 * la ficha del detalle y el formulario de edición. El piso guardado ("7° B")
 * se separa en piso y depto; cada foto recibe un id local (`foto-<n>`).
 */
function valoresDeAlta(propiedad: PropiedadMock): PropiedadNueva {
  const { floor, unit } = separarPisoDepto(propiedad.floor)
  return {
    type: propiedad.type,
    street: propiedad.street,
    streetNumber: propiedad.streetNumber,
    floor,
    unit,
    neighborhoodSlug: propiedad.neighborhoodSlug,
    city: propiedad.city,
    province: propiedad.province,
    rooms: propiedad.rooms,
    bedrooms: propiedad.bedrooms,
    bathrooms: propiedad.bathrooms,
    ageYears: propiedad.ageYears,
    totalAreaM2: propiedad.totalAreaM2,
    coveredAreaM2: propiedad.coveredAreaM2,
    characteristics: propiedad.characteristics,
    description: propiedad.description,
    // Una alquilada con fecha (`alquilada_publicada`) es, en el alta, `alquilada` + `availableFrom`.
    status: propiedad.status === 'alquilada_publicada' ? 'alquilada' : propiedad.status,
    availableFrom: propiedad.availableFrom,
    photos: propiedad.photos.map((foto, index) => ({ id: `foto-${index + 1}`, src: foto.src, name: `Foto ${index + 1}` })),
    mainPhotoIndex: propiedad.mainPhotoIndex,
    priceMonthly: propiedad.priceMonthly,
    expenses: propiedad.expenses,
    dailyInterestPct: propiedad.dailyInterestPct,
    graceDays: propiedad.graceDays,
    paymentMethods: propiedad.paymentMethods,
    adjustmentIndex: propiedad.adjustmentIndex,
    adjustmentEveryMonths: propiedad.adjustmentEveryMonths,
    depositMonths: propiedad.depositMonths,
    contractMonths: propiedad.contractMonths,
  }
}

/** `true` si la propiedad tiene un contrato vigente (US-04: no se puede eliminar; US-03: precio y ajuste fijos). */
export function tieneContratoVigenteMock(propiedad: PropiedadMock): boolean {
  return propiedad.rental?.contractStatus === 'vigente'
}

/**
 * `PropiedadMock` → `PropiedadLocadorDetalle`, con las mismas reglas que la
 * rama real (`propiedad.adapter.ts#misAlquileresDetalleToPropiedadLocadorDetalle`):
 * dirección EXACTA y el contrato vigente, si lo hay.
 */
export function propiedadMockToDetalleLocador(propiedad: PropiedadMock): PropiedadLocadorDetalle {
  const rental = propiedad.rental
  return {
    id: propiedad.id,
    title: propiedad.title,
    address: formatAddress(propiedad),
    neighborhoodName: propiedad.neighborhoodName,
    status: propiedad.status,
    publishedAt: propiedad.publishedAt || null,
    values: valoresDeAlta(propiedad),
    activeContract:
      rental && tieneContratoVigenteMock(propiedad)
        ? {
            id: rental.contractId,
            tenantName: rental.tenantName,
            endDate: rental.endDate,
            nextAdjustmentDate: rental.nextAdjustmentDate,
            currentAmount: rental.currentAmount,
          }
        : null,
  }
}

/**
 * Aplica los cambios de la edición (US-03) sobre una propiedad del elenco.
 * Se arma la propiedad completa (lo que había + lo que cambió) con las mismas
 * reglas que el alta (`propiedadNuevaToMock`) y se conservan lo que el alta
 * no maneja: id, dueño, fecha de alta, título y alquiler.
 * NOTA: el título no se recalcula: los del elenco son descriptivos ("1
 * dormitorio en planta baja con cochera") y no salen de los campos.
 */
export function aplicarCambiosMock(propiedad: PropiedadMock, cambios: CambiosPropiedad): PropiedadMock {
  const completa: PropiedadNueva = { ...valoresDeAlta(propiedad), ...cambios }
  const actualizada = propiedadNuevaToMock(completa, { id: propiedad.id, ownerId: propiedad.ownerId, publishedAt: propiedad.publishedAt })
  return { ...actualizada, title: propiedad.title, rental: propiedad.rental }
}
