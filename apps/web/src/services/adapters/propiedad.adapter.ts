/**
 * propiedad.adapter.ts — traduce los inmuebles del back a los tipos de vista
 * de propiedad, y el alta del front al cuerpo que espera el back.
 *
 * Qué es: la frontera entre `Inmueble` / `MisAlquileresItem` /
 * `CreateInmuebleCompletoPayload` (modelos del back, `@rentar/shared-types`)
 * y `PropiedadResumen` / `PropiedadLocador` / `PropiedadNueva` (tipos de
 * vista). Cada función comenta, campo por campo, lo que el back todavía no
 * devuelve o guarda distinto.
 * Cubre: US-34 (`PropiedadResumen`), US-02 (`PropiedadLocador`) y US-01
 * (`PropiedadNueva` → cuerpo de `POST /inmuebles`).
 * Quién lo usa: la rama real de `services/propiedades.service.ts`.
 */
import type {
  AdjustmentIndex,
  CharacteristicKey,
  CreateFotoPayload,
  CreateInmuebleCompletoPayload,
  EstadoAlquiler,
  MedioPagoPreferido,
  MisAlquileresItem,
  PropertyStatus,
  PropertyType,
  PropiedadLocador,
  PropiedadNueva,
  PropiedadResumen,
} from '@rentar/shared-types'
import { neighborhoods } from '@/lib/catalogs/neighborhoods'
import { PLACEHOLDER_PHOTO_SRC } from '@/lib/imagenes/fotoConRespaldo'
import type { InmuebleDisponibleResponse } from '../shared/backend-dtos'
import { formatApproxAddress, formatFloorUnit } from './direccion'

/**
 * Foto que se muestra cuando el inmueble no tiene fotos (o el endpoint no
 * las devuelve). Vive en
 * `lib/imagenes/fotoConRespaldo.ts`, que también la usa cuando una foto no carga.
 */
export { PLACEHOLDER_PHOTO_SRC }

// ─── Catálogos: id del back ↔ clave del front ───────────────────────────

/** `tipo_inmueble.id` → `PropertyType`. Mismos ids que la tabla `tipo_inmueble`. */
const PROPERTY_TYPE_BY_TIPO_ID: Record<number, PropertyType> = {
  1: 'departamento',
  2: 'casa',
  3: 'ph',
  4: 'monoambiente',
}

/** Traduce `inmueble.tipo` al `PropertyType` del front. Un id desconocido se muestra como departamento. */
export function propertyTypeFromTipoId(tipoId: number): PropertyType {
  return PROPERTY_TYPE_BY_TIPO_ID[tipoId] ?? 'departamento'
}

/** `PropertyType` → `tipo_inmueble.id` (para el alta, US-01). */
export function tipoIdFromPropertyType(type: PropertyType): number {
  const entry = Object.entries(PROPERTY_TYPE_BY_TIPO_ID).find(([, value]) => value === type)
  return Number(entry?.[0] ?? 1)
}

/**
 * `tags_inmueble.id` → `CharacteristicKey`. Mismos ids que la tabla.
 * NOTA: el back tiene 4 tags y el front 5: `apto-profesional` no existe en
 * el back. El id 4 del back, "Balcón con vista abierta", se muestra como
 * `balcon`.
 * TODO(db): sumar el tag "Apto profesional".
 */
const CHARACTERISTIC_BY_TAG_ID: Record<number, CharacteristicKey> = {
  1: 'mascotas',
  2: 'cochera',
  3: 'amoblado',
  4: 'balcon',
}

/** `CharacteristicKey` → `tags_inmueble.id`; `null` si el back no tiene ese tag (`apto-profesional`). */
export function tagIdFromCharacteristic(key: CharacteristicKey): number | null {
  const entry = Object.entries(CHARACTERISTIC_BY_TAG_ID).find(([, value]) => value === key)
  return entry ? Number(entry[0]) : null
}

/**
 * Descripción de un tag (`tags_inmueble.descripcion`, como la devuelven
 * `/mis-alquileres` y `/inmuebles/disponibles`) → `CharacteristicKey`. `null` si no
 * tiene equivalente.
 * NOTA: se compara por el comienzo del texto, sin tildes ni mayúsculas, para
 * no romperse si backend retoca la descripción ("Balcón con vista abierta").
 */
export function characteristicFromTagDescripcion(descripcion: string): CharacteristicKey | null {
  const texto = sinTildes(descripcion)
  if (texto.includes('mascota')) return 'mascotas'
  if (texto.includes('cochera')) return 'cochera'
  if (texto.startsWith('amoblado') || texto.startsWith('amueblado')) return 'amoblado'
  if (texto.startsWith('balcon')) return 'balcon'
  if (texto.includes('profesional')) return 'apto-profesional'
  return null
}

/**
 * `MisAlquileresItem.tipo_inmueble` (la descripción del tipo, ej. "Departamento") → `PropertyType`. Una
 * descripción desconocida se muestra como departamento.
 */
function propertyTypeFromDescripcion(descripcion: string): PropertyType {
  const texto = sinTildes(descripcion)
  if (texto.startsWith('casa')) return 'casa'
  if (texto.startsWith('ph')) return 'ph'
  if (texto.startsWith('mono')) return 'monoambiente'
  return 'departamento'
}

/**
 * `tipo_indice.id` ↔ `AdjustmentIndex`. Mismos ids que la tabla.
 * NOTA: el back además tiene CAC (id 3, Cámara Argentina de la
 * Construcción), que el front no ofrece: US-01 habla solo de ICL e IPC. Un
 * contrato con CAC se muestra sin índice.
 */
const INDICE_ID: Record<AdjustmentIndex, number> = { ICL: 1, IPC: 2 }

/** `tipo_indice.id` → `AdjustmentIndex`; `null` para CAC o un id desconocido. */
function adjustmentIndexFromId(id: number): AdjustmentIndex | null {
  const entry = Object.entries(INDICE_ID).find(([, value]) => value === id)
  return entry ? (entry[0] as AdjustmentIndex) : null
}

/**
 * Descripción del índice (`MisAlquileresItem.contrato.indice_aumento`, ej.
 * "ICL (Índice de Contratos de Locación)") → `AdjustmentIndex`; `null` para
 * CAC o un índice desconocido.
 */
function adjustmentIndexFromDescripcion(descripcion: string | null | undefined): AdjustmentIndex | null {
  const texto = descripcion?.trim().toUpperCase() ?? ''
  if (texto.startsWith('ICL')) return 'ICL'
  if (texto.startsWith('IPC')) return 'IPC'
  return null
}

/**
 * Medio de pago del front → `medio_pago.id` del back.
 *
 * NOTA: los catálogos no coinciden:
 * - Front: transferencia, MercadoPago débito, MercadoPago crédito y efectivo,
 *   cada uno con recargo (0 a 3 %).
 * - Back: Transferencia bancaria (1), Efectivo (2), Mercado Pago (3) y
 *   Débito automático (4), sin recargo.
 * Los dos de MercadoPago van al mismo id (3, se deduplica al armar el
 * cuerpo). "Débito automático" no se ofrece en el front.
 * TODO(db): el recargo de cada medio se pierde al guardar: `medio_pago_x_contrato`
 * no tiene dónde guardarlo (queda para la planning).
 */
const MEDIO_PAGO_ID: Record<MedioPagoPreferido, number> = {
  transferencia: 1,
  efectivo: 2,
  mercadopago_debito: 3,
  mercadopago_credito: 3,
}

/** Saca tildes y pasa a minúsculas, para comparar textos del back. */
function sinTildes(texto: string): string {
  return texto.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/** "Nueva Córdoba" → "nueva-cordoba". */
function slugDe(nombre: string): string {
  return sinTildes(nombre)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Barrio del back (texto libre, `inmueble.barrio`) → slug y nombre del front.
 * Si está en el catálogo del piloto (`lib/catalogs/neighborhoods.ts`), se
 * usa ese; si no (ej. "Alberdi"), se arma el slug a partir del nombre.
 * TODO(db): acordar un catálogo de barrios (id + nombre) en vez de texto libre.
 */
function barrioDe(barrio: string | null | undefined): { slug: string; name: string } {
  const nombre = barrio?.trim() ?? ''
  if (!nombre) return { slug: '', name: '' }
  const slug = slugDe(nombre)
  const delCatalogo = neighborhoods.find((item) => item.slug === slug)
  return delCatalogo ? { slug: delCatalogo.slug, name: delCatalogo.name } : { slug, name: nombre }
}

/**
 * NOTA: el back guarda la capital como "Córdoba" (`inmueble.ciudad`) y el
 * front usa "Córdoba Capital" (el nombre del diseño y del filtro
 * preseleccionado). Sin esto, la búsqueda contra el back real saldría vacía.
 * TODO(db): acordar un catálogo de ciudades (id + nombre) en vez de texto libre.
 */
function normalizarCiudad(ciudad: string): string {
  return sinTildes(ciudad) === 'cordoba' ? 'Córdoba Capital' : ciudad
}

/** Inversa de {@link normalizarCiudad}, para el alta. */
function ciudadParaBack(ciudad: string): string {
  return ciudad === 'Córdoba Capital' ? 'Córdoba' : ciudad
}

/**
 * Numéricos del back: la API los devuelve como número, pero una columna
 * `numeric` de Postgres puede llegar como texto ("360000.00") según cómo se
 * lea. Se normaliza acá para no mostrar `NaN`.
 */
function aNumero(valor: number | string | null | undefined): number {
  const numero = typeof valor === 'string' ? Number(valor) : valor
  return typeof numero === 'number' && Number.isFinite(numero) ? numero : 0
}

// ─── Estados ────────────────────────────────────────────────────────────

/**
 * `estado_alquiler` (+ `fecha_disponible`) → `PropertyStatus`.
 * Una alquilada CON fecha de disponibilidad es `alquilada_publicada`: se
 * vuelve a ofrecer para el próximo inquilino (US-02, US-34).
 * `publicado/alquilado` (nombre acordado con el back el 29/09) también es
 * `alquilada_publicada`; `alquilado` con fecha se sigue leyendo igual, por las
 * que se guardaron antes de ese acuerdo.
 * NOTA: `pausado` lo acepta la validación del back y se mapea por si aparece.
 */
function statusDeInmueble(estado: EstadoAlquiler, fechaDisponible: string | null | undefined): PropertyStatus {
  if (estado === 'publicado/alquilado') return 'alquilada_publicada'
  if (estado === 'alquilado') return fechaDisponible ? 'alquilada_publicada' : 'alquilada'
  if (estado === 'pausado') return 'pausada'
  return 'publicada'
}

/** Estado del alta (US-01) → `estado_alquiler` del back (sin contar la fecha: ver {@link estadoAlquilerDeAlta}). */
const ESTADO_ALQUILER_DE_ALTA: Record<PropiedadNueva['status'], EstadoAlquiler> = {
  publicada: 'publicado',
  pausada: 'pausado',
  alquilada: 'alquilado',
}

/**
 * `estado_alquiler` que manda el alta. Una alquilada CON fecha de
 * disponibilidad va como `publicado/alquilado`: así la devuelve
 * `/disponibles` (que busca `publicado` y `publicado/alquilado`) y aparece en
 * `/buscar` con "Disponible desde" (US-34). Sin fecha, `alquilado`: no se ofrece.
 * NOTA: nombre acordado con el back el 29/09 (`develop` 2264372). Antes el
 * alta mandaba `alquilado` + fecha y esas no aparecían en la búsqueda.
 */
function estadoAlquilerDeAlta(nueva: Pick<PropiedadNueva, 'status' | 'availableFrom'>): EstadoAlquiler {
  return nueva.status === 'alquilada' && nueva.availableFrom ? 'publicado/alquilado' : ESTADO_ALQUILER_DE_ALTA[nueva.status]
}

// ─── Títulos ────────────────────────────────────────────────────────────

/** Nombre del tipo para armar el título ("Departamento de 2 ambientes"). */
const TYPE_TITLE: Record<PropertyType, string> = {
  departamento: 'Departamento',
  casa: 'Casa',
  ph: 'PH',
  monoambiente: 'Monoambiente',
}

/**
 * Título de la publicación armado con el tipo y los ambientes (Alta · 01:
 * "Con esto armamos el título de la publicación"): "Departamento de 2
 * ambientes", "Monoambiente", "Casa de 3 ambientes".
 * NOTA: el back no guarda un título; se arma igual en el alta y al leer.
 */
export function tituloDePropiedadNueva(nueva: Pick<PropiedadNueva, 'type' | 'rooms'>): string {
  if (nueva.type === 'monoambiente') return TYPE_TITLE.monoambiente
  return `${TYPE_TITLE[nueva.type]} de ${nueva.rooms} ${nueva.rooms === 1 ? 'ambiente' : 'ambientes'}`
}

// ─── Disponibles → PropiedadResumen (US-34) ─────────────────────────────

/**
 * Item de `GET /inmuebles/disponibles` → `PropiedadResumen` (tarjeta de la
 * landing y de `/buscar`, US-34).
 *
 * Campo por campo, lo que el back todavía no devuelve (brechas en
 * `docs/HANDOFF-BACKEND.md`):
 * - `title`: el back no tiene título; se arma con el tipo y los ambientes,
 *   igual que en el alta.
 * - `address`: aproximada ("calle al 400"), ver la NOTA de privacidad en direccion.ts.
 * - `priceMonthly`, `expenses` y `adjustmentIndex`: del contrato del inmueble
 *   (`precio`, `expensas`, `indice_ajuste`). CAC → `null` (el front no lo ofrece).
 * - `expenses`: `null` (sin contrato) → `null`, y la tarjeta no muestra nada;
 *   `0` → `0`, que la tarjeta muestra como "Sin expensas"; negativo (el `-1`
 *   que mandaba el back sin contrato) → `null`. Nunca "$0".
 *   NOTA: desde el 29/09 (`develop` ce677a4) el listado vuelve a pedir contrato
 *   (`contrato!inner`), así que un `0` es "sin expensas" de verdad, y el back
 *   manda `null` sin contrato (8f9bf8c).
 * - `characteristics`: de los ids de `tags` (un tag sin equivalente se descarta).
 * - `imageSrc` / `photoSrcs`: solo la `foto_principal`; si no tiene fotos,
 *   {@link PLACEHOLDER_PHOTO_SRC}.
 * - `publishedAt`: el back no guarda la fecha de publicación; `''`. TODO(db):
 *   guardar la fecha de publicación.
 * - `status`: el listado no devuelve `estado_alquiler`. Una con
 *   `fecha_disponible` se muestra como alquilada/publicada ("Disponible
 *   desde"). TODO(backend): sumar `estado_alquiler` al item.
 */
export function inmuebleDisponibleToPropiedadResumen(item: InmuebleDisponibleResponse): PropiedadResumen {
  const type = propertyTypeFromTipoId(item.tipo.id)
  const barrio = barrioDe(item.barrio)
  const characteristics = item.tags
    .map((tag) => CHARACTERISTIC_BY_TAG_ID[tag.id] ?? characteristicFromTagDescripcion(tag.descripcion))
    .filter((key): key is CharacteristicKey => Boolean(key))
  const foto = item.foto_principal ?? PLACEHOLDER_PHOTO_SRC

  return {
    id: String(item.id),
    title: tituloDePropiedadNueva({ type, rooms: item.ambientes }),
    address: formatApproxAddress(item.direccion, item.numero),
    province: item.provincia,
    city: normalizarCiudad(item.ciudad),
    neighborhoodSlug: barrio.slug,
    neighborhoodName: barrio.name,
    type,
    priceMonthly: aNumero(item.precio),
    expenses: item.expensas === null || aNumero(item.expensas) < 0 ? null : aNumero(item.expensas),
    bedrooms: item.dormitorios,
    rooms: item.ambientes,
    areaM2: aNumero(item.m2_totales),
    adjustmentIndex: item.indice_ajuste ? adjustmentIndexFromId(item.indice_ajuste.id) : null,
    characteristics: [...new Set(characteristics)],
    description: item.descripcion ?? '',
    availableFrom: item.fecha_disponible ?? null,
    imageSrc: foto,
    photoSrcs: [foto],
    publishedAt: '',
    status: item.fecha_disponible ? 'alquilada_publicada' : 'publicada',
  }
}

// ─── MisAlquileresItem → PropiedadLocador (US-02) ───────────────────────

/**
 * `MisAlquileresItem` (respuesta de `GET /api/v1/mis-alquileres`) →
 * `PropiedadLocador` (fila de `/panel/propiedades`, US-02).
 *
 * Campo por campo:
 * - `title`: el back no tiene título; se arma con el tipo y los ambientes.
 * - `address`: exacta (la ve solo su dueño): calle, altura y piso.
 * - `status`: de `estado_alquiler` y `fecha_disponible` (ver `statusDeInmueble`).
 * - `priceMonthly`: alquilada → `contrato.monto_alquiler`; si no, `precio_publicado`.
 * - `expenses`: `contrato.expensas`.
 * - `imageSrc`: `foto_principal`, o el placeholder si no tiene fotos.
 * - `adjustmentIndex`: de `contrato.indice_aumento` (CAC → `null`).
 * - `publishedAt`: el back no guarda la fecha de alta; `''`. TODO(db): guardar
 *   la fecha de alta del inmueble.
 * - `tenantName`: "Nombre Apellido" de `contrato.locatario` (desde el 29/09);
 *   `null` si no hay locatario.
 * - `nextAdjustment`: `contrato.fecha_proximo_ajuste` (lo calcula el back) +
 *   el índice + cada cuántos meses (de `frecuencia_ajuste`, ver
 *   {@link mesesDeFrecuencia}). Si falta alguno de los tres (sin fecha, índice
 *   CAC o una frecuencia que no se entiende), `null`: se muestra "—", sin inventar.
 * - `hasOpenClaims`: `posee_reclamos_no_resueltos` (desde el 29/09). El back
 *   no manda la cantidad, así que `openClaims` es `null` (la columna dice
 *   "Con reclamos").
 * - `paymentStatus`, `paymentDueDate`, `daysOverdue`: no existen todavía
 *   (módulo de cobros). Se muestran vacíos ("—"). TODO(backend): sumarlos a
 *   `/mis-alquileres` cuando exista ese módulo.
 */
export function misAlquileresItemToPropiedadLocador(item: MisAlquileresItem): PropiedadLocador {
  const type = propertyTypeFromDescripcion(item.tipo_inmueble)
  const status = statusDeInmueble(item.estado_alquiler, item.fecha_disponible)
  const alquilada = status === 'alquilada' || status === 'alquilada_publicada'
  const barrio = barrioDe(item.barrio)
  const adjustmentIndex = adjustmentIndexFromDescripcion(item.contrato.indice_aumento)
  const locatario = item.contrato.locatario
  const mesesAjuste = mesesDeFrecuencia(item.contrato.frecuencia_ajuste)
  const fechaAjuste = item.contrato.fecha_proximo_ajuste

  return {
    id: String(item.id_inmueble),
    title: tituloDePropiedadNueva({ type, rooms: item.ambientes }),
    address: item.piso ? `${item.direccion} ${item.numero}, ${item.piso}` : `${item.direccion} ${item.numero}`,
    neighborhoodSlug: barrio.slug,
    neighborhoodName: barrio.name || normalizarCiudad(item.ciudad),
    type,
    rooms: item.ambientes,
    status,
    priceMonthly: aNumero(alquilada ? item.contrato.monto_alquiler : item.precio_publicado),
    expenses: aNumero(item.contrato.expensas),
    imageSrc: item.foto_principal ?? PLACEHOLDER_PHOTO_SRC,
    publishedAt: '',
    tenantName: locatario ? `${locatario.nombre} ${locatario.apellido ?? ''}`.trim() : null,
    paymentStatus: null,
    paymentDueDate: null,
    daysOverdue: null,
    hasOpenClaims: item.posee_reclamos_no_resueltos,
    openClaims: null,
    adjustmentIndex,
    nextAdjustment: fechaAjuste && adjustmentIndex && mesesAjuste ? { date: fechaAjuste, index: adjustmentIndex, everyMonths: mesesAjuste } : null,
    availableFrom: item.fecha_disponible ?? null,
  }
}

// ─── PropiedadNueva → cuerpo del alta (US-01) ───────────────────────────

/**
 * Estado con que queda la propiedad del alta. Una alquilada CON fecha de
 * disponibilidad pasa a `alquilada_publicada`: se publica para el próximo
 * inquilino y aparece en `/buscar` con "Disponible desde" (US-02, US-34 y la
 * nota de `PropertyStatus`). Sin fecha queda `alquilada` y no se ve.
 */
export function estadoDePropiedadNueva(nueva: Pick<PropiedadNueva, 'status' | 'availableFrom'>): PropertyStatus {
  return nueva.status === 'alquilada' && nueva.availableFrom ? 'alquilada_publicada' : nueva.status
}

/** `true` si la propiedad del alta aparece en `/buscar` (publicada, o alquilada con fecha). */
export function seVeEnBusqueda(nueva: Pick<PropiedadNueva, 'status' | 'availableFrom'>): boolean {
  const estado = estadoDePropiedadNueva(nueva)
  return estado === 'publicada' || estado === 'alquilada_publicada'
}

/**
 * Cada cuántos meses se ajusta (1 a 12) → `contrato.frecuencia_ajuste`.
 * NOTA: el back guarda la frecuencia como texto libre ("Semestral", "Anual"
 * en los datos de prueba). Se usan esos nombres para los valores habituales
 * y "<n> meses" para el resto.
 * TODO(db): guardar la frecuencia como un entero (meses).
 */
const NOMBRE_FRECUENCIA: Record<number, string> = {
  1: 'Mensual',
  2: 'Bimestral',
  3: 'Trimestral',
  4: 'Cuatrimestral',
  6: 'Semestral',
  12: 'Anual',
}

export function frecuenciaAjusteTexto(everyMonths: number): string {
  return NOMBRE_FRECUENCIA[everyMonths] ?? `${everyMonths} meses`
}

/**
 * Inversa de {@link frecuenciaAjusteTexto}: `contrato.frecuencia_ajuste`
 * ("Semestral", "Anual", "5 meses"…) → cada cuántos meses. `null` si no se
 * entiende (texto libre en la base, ver el TODO(db) de arriba).
 */
function mesesDeFrecuencia(texto: string | null | undefined): number | null {
  if (!texto) return null
  const limpio = sinTildes(texto)
  const porNombre = Object.entries(NOMBRE_FRECUENCIA).find(([, nombre]) => sinTildes(nombre) === limpio)
  if (porNombre) return Number(porNombre[0])
  const meses = limpio.match(/^(\d{1,2})\s*mes(es)?$/)
  return meses ? Number(meses[1]) : null
}

/**
 * `PropiedadNueva` → cuerpo de `POST /api/v1/inmuebles`
 * (`CreateInmuebleCompletoPayload`). El back crea inmueble, fotos, tags,
 * contrato y medios de pago juntos (con rollback si algo falla).
 *
 * @param fotos Las fotos ya subidas a Storage, en orden y con la principal
 *   marcada (las arma `propiedades.service.ts#subirFotosPropiedad`).
 *
 * Lo que el front carga y el back guarda distinto o no guarda:
 * - `characteristics`: `apto-profesional` no existe en el back y se descarta.
 *   TODO(db): sumar el tag "Apto profesional".
 * - `paymentMethods`: el recargo se pierde y los dos de MercadoPago quedan
 *   como uno (ver {@link MEDIO_PAGO_ID}). TODO(db): guardar el recargo por
 *   medio de pago (a la planning).
 * - `depositMonths`: el back guarda el depósito como MONTO, no en meses. Se
 *   manda meses × precio. TODO(db): guardar los meses (o confirmar el monto).
 * - `adjustmentEveryMonths`: el back lo guarda como texto (ver
 *   {@link frecuenciaAjusteTexto}). TODO(db): guardarlo como entero (meses).
 * - `floor` + `unit`: el back tiene un solo campo `piso`; van juntos ("7° B").
 * - `servicios`: el alta no los pide (no están en US-01); `null`.
 */
export function propiedadNuevaToCreateInmueble(nueva: PropiedadNueva, fotos: CreateFotoPayload[]): CreateInmuebleCompletoPayload {
  const tags = nueva.characteristics.map(tagIdFromCharacteristic).filter((id): id is number => id !== null)
  const mediosPago = nueva.paymentMethods.map((medio) => MEDIO_PAGO_ID[medio.method])
  const barrio = neighborhoods.find((item) => item.slug === nueva.neighborhoodSlug)

  return {
    tipo: tipoIdFromPropertyType(nueva.type),
    descripcion: nueva.description.trim() || null,
    provincia: nueva.province,
    ciudad: ciudadParaBack(nueva.city),
    barrio: barrio?.name ?? nueva.neighborhoodSlug,
    direccion: nueva.street.trim(),
    numero: nueva.streetNumber,
    piso: formatFloorUnit(nueva.floor, nueva.unit),
    m2_totales: nueva.totalAreaM2,
    m2_cubiertos: nueva.coveredAreaM2,
    ambientes: nueva.rooms,
    dormitorios: nueva.bedrooms,
    banos: nueva.bathrooms,
    antiguedad: nueva.ageYears,
    precio_publicado: nueva.priceMonthly,
    estado_alquiler: estadoAlquilerDeAlta(nueva),
    fecha_disponible: nueva.availableFrom,
    servicios: null,
    tags: [...new Set(tags)],
    fotos,
    condiciones_contrato: {
      monto_alquiler: nueva.priceMonthly,
      expensas: nueva.expenses,
      indice_aumento: nueva.adjustmentIndex ? INDICE_ID[nueva.adjustmentIndex] : null,
      frecuencia_ajuste: nueva.adjustmentEveryMonths ? frecuenciaAjusteTexto(nueva.adjustmentEveryMonths) : null,
      duracion_meses: nueva.contractMonths,
      deposito: nueva.depositMonths ? nueva.depositMonths * nueva.priceMonthly : null,
      interes_por_dia: nueva.dailyInterestPct,
      dias_gracia: nueva.graceDays,
      medios_pago: [...new Set(mediosPago)],
    },
  }
}
