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
  BusquedaFiltros,
  CharacteristicKey,
  CreateFotoPayload,
  CreateInmuebleCompletoPayload,
  EstadoAlquiler,
  MedioPagoPreferido,
  MisAlquileresItem,
  OrdenBusqueda,
  Paginado,
  PropertyStatus,
  PropertyType,
  PropiedadLocador,
  PropiedadNueva,
  PropiedadResumen,
} from '@rentar/shared-types'
import { neighborhoods } from '@/lib/catalogs/neighborhoods'
import { PLACEHOLDER_PHOTO_SRC } from '@/lib/imagenes/fotoConRespaldo'
import type { DisponiblesQuery, InmuebleDisponibleResponse, InmueblesDisponiblesResponse } from '../shared/backend-dtos'
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
 * NOTA: hoy la base solo usa `publicado` y `alquilado`; `pausado` lo acepta
 * la validación del back y se mapea por si aparece.
 */
function statusDeInmueble(estado: EstadoAlquiler, fechaDisponible: string | null | undefined): PropertyStatus {
  if (estado === 'alquilado') return fechaDisponible ? 'alquilada_publicada' : 'alquilada'
  if (estado === 'pausado') return 'pausada'
  return 'publicada'
}

/** Estado del alta (US-01) → `estado_alquiler` del back. */
const ESTADO_ALQUILER_DE_ALTA: Record<PropiedadNueva['status'], EstadoAlquiler> = {
  publicada: 'publicado',
  pausada: 'pausado',
  alquilada: 'alquilado',
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
    expenses: aNumero(item.expensas),
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

/** Una página de `/inmuebles/disponibles` → `Paginado<PropiedadResumen>` de `/buscar`. */
export function disponiblesToPaginado(respuesta: InmueblesDisponiblesResponse): Paginado<PropiedadResumen> {
  return {
    items: respuesta.items.map(inmuebleDisponibleToPropiedadResumen),
    page: respuesta.page,
    pageSize: respuesta.limit,
    total: respuesta.total,
  }
}

// ─── Filtros de /buscar → query de /inmuebles/disponibles (US-34) ───────

/**
 * Resultado de {@link consultaDeDisponibles}.
 * - `exacta: true`: el back puede resolver la búsqueda tal cual; `query` va
 *   directo a `/inmuebles/disponibles` y la página que vuelve es la que se muestra.
 * - `exacta: false`: algún filtro u orden no tiene equivalente exacto en el
 *   back; hay que traer todas las disponibles (hasta 1000, ver
 *   `propiedades.service.ts#TOPE_DISPONIBLES_CLIENTE`: sirve para el piloto,
 *   no escala) y filtrar, ordenar y paginar en el cliente
 *   (`lib/search/busqueda.ts`), igual que en modo mock.
 */
export type ConsultaDisponibles = { exacta: true; query: DisponiblesQuery } | { exacta: false }

/** `true` si una selección múltiple de cantidades se puede mandar como un número exacto. */
function cantidadExacta(elegidas: number[]): boolean {
  return elegidas.length === 1 && elegidas[0] < 4
}

/**
 * Traduce los filtros, el orden y la página de `/buscar` a los query params
 * de `GET /inmuebles/disponibles`. Es el ÚNICO lugar donde se mapean los
 * nombres de la URL del front (`lib/search/busquedaParams.ts`) a los del back.
 *
 * | Front (`BusquedaFiltros` / orden) | Back                               | Exacta si…                              |
 * |-----------------------------------|------------------------------------|-----------------------------------------|
 * | `neighborhoodSlugs`               | `barrio` (texto, "contiene")       | hay 0 o 1 barrio y está en el catálogo  |
 * | `minPrice` / `maxPrice`           | `precioMin` / `precioMax`          | siempre                                 |
 * | `types`                           | `tipo` (id)                        | hay 0 o 1 tipo                          |
 * | `bedrooms` / `rooms`              | `dormitorios` / `ambientes`        | hay 0 o 1 valor y no es "4 o más"       |
 * | `minAreaM2` / `maxAreaM2`         | `superficieMin` / `superficieMax`  | siempre                                 |
 * | `characteristics`                 | `tags` (ids)                       | hay 0 o 1 y el tag existe en el back    |
 * | `adjustmentIndex`                 | `indiceAjuste` (id)                | siempre                                 |
 * | `province` / `city`               | —                                  | ver la NOTA de abajo                    |
 * | `dormitorios_desc` / `m2_desc`    | `orden=dormitorios\|m2&direccion=desc` | siempre                             |
 * | `predeterminado` / `recientes`    | sin orden (id descendente)         | siempre                                 |
 * | `precio_asc` / `precio_desc`      | `orden=precio`                     | nunca (ver el TODO)                     |
 *
 * Por qué hay casos no exactos: el back acepta UN valor por filtro y
 * cantidades exactas, y con `tags` devuelve las que tengan CUALQUIERA de los
 * elegidos. US-34 pide selección múltiple, "4 o más" y "que cumplan con
 * todos los criterios seleccionados".
 * TODO(backend): aceptar varios valores por filtro, "4 o más" y tags con
 * todas las elegidas, para que toda búsqueda se resuelva en el servidor.
 * TODO(backend): `orden=precio` no ordena los inmuebles (ordena el contrato
 * embebido: asc y desc devuelven lo mismo). Hasta que se arregle, los
 * órdenes por precio se resuelven en el cliente.
 * NOTA: `recientes` se manda sin orden: el back no guarda la fecha de
 * publicación y su orden por defecto (id descendente, el más nuevo primero)
 * es lo más parecido.
 * NOTA: el back no filtra por provincia ni ciudad. Hoy solo hay propiedades
 * de Córdoba Capital, así que se filtran en el cliente sobre la página que
 * vuelve (ver `propiedades.service.ts#buscarPropiedades`).
 */
export function consultaDeDisponibles(
  filtros: BusquedaFiltros,
  orden: OrdenBusqueda,
  pagina: number,
  pageSize: number,
): ConsultaDisponibles {
  const query: DisponiblesQuery = { page: String(Math.max(1, pagina)), limit: String(pageSize) }

  if (filtros.neighborhoodSlugs.length > 1) return { exacta: false }
  if (filtros.neighborhoodSlugs.length === 1) {
    const barrio = neighborhoods.find((item) => item.slug === filtros.neighborhoodSlugs[0])
    if (!barrio) return { exacta: false }
    query.barrio = barrio.name
  }

  if (filtros.minPrice !== null) query.precioMin = String(filtros.minPrice)
  if (filtros.maxPrice !== null) query.precioMax = String(filtros.maxPrice)

  if (filtros.types.length > 1) return { exacta: false }
  if (filtros.types.length === 1) query.tipo = String(tipoIdFromPropertyType(filtros.types[0]))

  if (filtros.bedrooms.length > 0) {
    if (!cantidadExacta(filtros.bedrooms)) return { exacta: false }
    query.dormitorios = String(filtros.bedrooms[0])
  }
  if (filtros.rooms.length > 0) {
    if (!cantidadExacta(filtros.rooms)) return { exacta: false }
    query.ambientes = String(filtros.rooms[0])
  }

  if (filtros.minAreaM2 !== null) query.superficieMin = String(filtros.minAreaM2)
  if (filtros.maxAreaM2 !== null) query.superficieMax = String(filtros.maxAreaM2)

  if (filtros.characteristics.length > 1) return { exacta: false }
  if (filtros.characteristics.length === 1) {
    const tagId = tagIdFromCharacteristic(filtros.characteristics[0])
    if (tagId === null) return { exacta: false }
    query.tags = String(tagId)
  }

  if (filtros.adjustmentIndex !== null) query.indiceAjuste = String(INDICE_ID[filtros.adjustmentIndex])

  switch (orden) {
    case 'precio_asc':
    case 'precio_desc':
      return { exacta: false }
    case 'dormitorios_desc':
      query.orden = 'dormitorios'
      query.direccion = 'desc'
      break
    case 'm2_desc':
      query.orden = 'm2'
      query.direccion = 'desc'
      break
    case 'predeterminado':
    case 'recientes':
      break
  }

  return { exacta: true, query }
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
 * - `tenantName`, `paymentStatus`, `paymentDueDate`, `daysOverdue`,
 *   `openClaims`, `nextAdjustment`: no existen todavía (módulos de contratos,
 *   cobros y reclamos). Se muestran vacíos ("—"). TODO(backend): sumarlos a
 *   `/mis-alquileres` cuando existan esos módulos.
 */
export function misAlquileresItemToPropiedadLocador(item: MisAlquileresItem): PropiedadLocador {
  const type = propertyTypeFromDescripcion(item.tipo_inmueble)
  const status = statusDeInmueble(item.estado_alquiler, item.fecha_disponible)
  const alquilada = status === 'alquilada' || status === 'alquilada_publicada'
  const barrio = barrioDe(item.barrio)

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
    tenantName: null,
    paymentStatus: null,
    paymentDueDate: null,
    daysOverdue: null,
    openClaims: 0,
    adjustmentIndex: adjustmentIndexFromDescripcion(item.contrato.indice_aumento),
    nextAdjustment: null,
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
export function frecuenciaAjusteTexto(everyMonths: number): string {
  const nombres: Record<number, string> = {
    1: 'Mensual',
    2: 'Bimestral',
    3: 'Trimestral',
    4: 'Cuatrimestral',
    6: 'Semestral',
    12: 'Anual',
  }
  return nombres[everyMonths] ?? `${everyMonths} meses`
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
    estado_alquiler: ESTADO_ALQUILER_DE_ALTA[nueva.status],
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
