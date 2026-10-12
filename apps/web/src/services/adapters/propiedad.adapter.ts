/**
 * propiedad.adapter.ts — traduce los inmuebles del back a los tipos de vista
 * de propiedad, y el alta del front al cuerpo que espera el back.
 *
 * Qué es: la frontera entre `Inmueble` / `MisAlquileresItem` /
 * `CreateInmuebleCompletoPayload` (modelos del back, `@rentar/shared-types`)
 * y `PropiedadResumen` / `PropiedadLocador` / `PropiedadNueva` (tipos de
 * vista). Cada función comenta, campo por campo, lo que el back todavía no
 * devuelve o guarda distinto.
 * Cubre: US-34 (`PropiedadResumen`), US-41 (`PropiedadDetalle`), US-02
 * (`PropiedadLocador`), US-01 (`PropiedadNueva` → cuerpo de `POST /inmuebles`)
 * y US-03/US-04 (`PropiedadLocadorDetalle`, por ahora con el puente desde
 * `/mis-alquileres`, y los errores de `DELETE /inmuebles/:id`).
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
  PropiedadDetalle,
  PropiedadNueva,
  PropiedadResumen,
  CambiosPropiedad,
  PropiedadLocadorDetalle,
  FotoNueva,
  MedioPagoConRecargo,
} from '@rentar/shared-types'
import { neighborhoods } from '@/lib/catalogs/neighborhoods'
import { PLACEHOLDER_PHOTO_SRC } from '@/lib/imagenes/fotoConRespaldo'
import type { InmuebleDetalleResponse, InmuebleDisponibleResponse, MisAlquileresDetalleResponse } from '../shared/backend-dtos'
import { ServiceError } from '../shared/errors'
import { formatApproxAddress, formatExactAddress, formatFloorUnit, separarPisoDepto } from './direccion'
import { tituloDePublicacion } from './titulo'

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
 * Lo usa también `solicitud.adapter.ts` (barrio de la propiedad solicitada).
 */
export function barrioDe(barrio: string | null | undefined): { slug: string; name: string } {
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
 * - `title`: el back no tiene título; se arma con tipo + dormitorios + barrio
 *   (`titulo.ts#tituloDePublicacion`), igual que en el detalle pero sin el
 *   barrio (`conBarrio: false`): la tarjeta ya muestra "barrio · título".
 *   Nunca la dirección.
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
    title: tituloDePublicacion({ type, bedrooms: item.dormitorios, neighborhoodName: barrio.name }, { conBarrio: false }),
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

// ─── Detalle → PropiedadDetalle (US-41) ─────────────────────────────────

/**
 * Un monto del detalle (`precio`, `expensas`) → número o `null`.
 * TODO(backend): sin contrato, el back mandaba `-1` y desde el 29/09 manda
 * `null` (`inmuebleService.getById`). Se aceptan los dos (y cualquier
 * negativo) como "no informado" hasta que el back confirme que ya no manda
 * `-1`. La pantalla muestra "Consultar" en vez del precio.
 */
function montoONull(valor: number | string | null | undefined): number | null {
  if (valor === null || valor === undefined) return null
  const numero = aNumero(valor)
  return numero < 0 ? null : numero
}

/**
 * Respuesta de `GET /api/v1/inmuebles/disponibles/:id` → `PropiedadDetalle`
 * (`/propiedad/[id]`, US-41).
 *
 * Campo por campo:
 * - `title`: el back no tiene título; se arma con tipo + dormitorios +
 *   barrio (`titulo.ts#tituloDePublicacion`), igual que la tarjeta de
 *   `/buscar`. Nunca la dirección: se ve en las migas.
 * - `address`: APROXIMADA ("Rondeau al 400"), nunca la altura ni el piso
 *   (NOTA de privacidad de `PropiedadDetalle`).
 * - `priceMonthly` / `expenses`: `null` si no vienen o vienen en `-1` (ver
 *   {@link montoONull}).
 * - `photoSrcs`: todas las fotos, la principal primero y el resto por
 *   `orden`; si no tiene, el placeholder.
 * - `status`: TODO(backend): el detalle no devuelve `estado_alquiler`. La
 *   ruta solo responde las disponibles (404 si no), así que se deduce: con
 *   `fecha_disponible` → `alquilada_publicada`; sin fecha → `publicada`. Por
 *   eso, con el back real, una que ya no está disponible llega como 404
 *   (pantalla "Esta publicación ya no está disponible").
 * - `publishedAt`: TODO(db): el back no guarda la fecha de publicación; `''`.
 * - `owner`: TODO(backend): el detalle no trae el dueño (id y nombre). Sin
 *   él, la tarjeta va sin nombre ("el dueño") y el front no puede saber si la
 *   publicación es propia (el back tiene que rechazar esa solicitud).
 * - `conditions`: TODO(backend): faltan plazo, frecuencia de ajuste y
 *   depósito del contrato (`duracion_meses`, `frecuencia_ajuste`,
 *   `deposito`). Con `null`, la sección "Condiciones del contrato" no se muestra.
 * - `paymentMethods`: TODO(backend): faltan los medios de pago del contrato
 *   (con su recargo). Con `null`, la sección "Cómo se paga" no se muestra.
 * - `address` y `floor`: con sesión, la EXACTA y el piso; sin sesión, la
 *   aproximada y sin piso (decisión del PO con la US-35 actualizada).
 *   NOTA: es solo cosmético: hoy la ruta es pública y ya manda `direccion`,
 *   `numero` y `piso` sin token (HANDOFF §10, gravedad alta).
 * - `requiredGuarantees`: TODO(backend): el back no tiene el dato; sin él,
 *   ninguna propiedad exige garantías (pendiente para el Sprint 3: toca US-01
 *   y US-03, HANDOFF §7).
 */
export function inmuebleDetalleToPropiedadDetalle(dto: InmuebleDetalleResponse, opciones: { conSesion?: boolean } = {}): PropiedadDetalle {
  const exacta = opciones.conSesion === true
  const type = propertyTypeFromTipoId(dto.tipo.id)
  const barrio = barrioDe(dto.barrio)
  const characteristics = dto.tags
    .map((tag) => CHARACTERISTIC_BY_TAG_ID[tag.id] ?? characteristicFromTagDescripcion(tag.descripcion))
    .filter((key): key is CharacteristicKey => Boolean(key))
  const fotos = [...dto.fotos]
    .sort((a, b) => Number(b.es_principal) - Number(a.es_principal) || (a.orden ?? 0) - (b.orden ?? 0))
    .map((foto) => foto.url)
  const photoSrcs = fotos.length > 0 ? fotos : [PLACEHOLDER_PHOTO_SRC]
  const status: PropertyStatus = dto.fecha_disponible ? 'alquilada_publicada' : 'publicada'

  return {
    id: String(dto.id),
    title: tituloDePublicacion({ type, bedrooms: dto.dormitorios, neighborhoodName: barrio.name }),
    address: exacta ? formatExactAddress(dto.direccion, dto.numero, dto.piso) : formatApproxAddress(dto.direccion, dto.numero),
    province: dto.provincia,
    city: normalizarCiudad(dto.ciudad),
    neighborhoodSlug: barrio.slug,
    neighborhoodName: barrio.name,
    type,
    priceMonthly: montoONull(dto.precio),
    expenses: montoONull(dto.expensas),
    bedrooms: dto.dormitorios,
    rooms: dto.ambientes,
    bathrooms: dto.banos,
    areaM2: aNumero(dto.m2_totales),
    coveredAreaM2: aNumero(dto.m2_cubiertos),
    adjustmentIndex: dto.indice_ajuste ? adjustmentIndexFromId(dto.indice_ajuste.id) : null,
    characteristics: [...new Set(characteristics)],
    description: dto.descripcion ?? '',
    availableFrom: dto.fecha_disponible ?? null,
    imageSrc: photoSrcs[0],
    photoSrcs,
    publishedAt: '',
    status,
    availability: 'disponible',
    owner: null,
    conditions: null,
    paymentMethods: null,
    addressPrecision: exacta ? 'exacta' : 'aproximada',
    floor: exacta ? (dto.piso ?? null) : null,
    requiredGuarantees: [],
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

// ─── Detalle del locador y edición (US-03, US-04) ───────────────────────

/** `medio_pago.id` → medio del front. Los dos de MercadoPago comparten id: vuelve como débito (ver {@link MEDIO_PAGO_ID}). */
function medioPagoFromId(id: number): MedioPagoConRecargo | null {
  const entry = Object.entries(MEDIO_PAGO_ID).find(([, value]) => value === id)
  // TODO(db): el recargo no se guarda (ver MEDIO_PAGO_ID): vuelve en 0 %.
  return entry ? { method: entry[0] as MedioPagoConRecargo['method'], surchargePct: 0 } : null
}

/** `estado_alquiler` → estado del alta (US-01). Una alquilada con fecha es `alquilada` + `availableFrom`. */
function estadoAltaDeInmueble(estado: EstadoAlquiler): PropiedadNueva['status'] {
  if (estado === 'pausado') return 'pausada'
  if (estado === 'alquilado' || estado === 'publicado/alquilado') return 'alquilada'
  return 'publicada'
}

/** Número que puede venir `null`: `null` se mantiene. */
function numeroONull(valor: number | string | null | undefined): number | null {
  return valor === null || valor === undefined ? null : aNumero(valor)
}

/**
 * Nombre de un medio de pago (`medio_pago.nombre`, como lo devuelve
 * `/mis-alquileres`) → `medio_pago.id`. `null` si no se reconoce.
 * NOTA: se compara por el comienzo del texto, sin tildes ni mayúsculas, como
 * {@link characteristicFromTagDescripcion}. "Débito automático" (4) no se
 * ofrece en el front: {@link medioPagoFromId} lo descarta.
 */
function medioPagoIdFromNombre(nombre: string): number | null {
  const texto = sinTildes(nombre)
  if (texto.startsWith('transferencia')) return 1
  if (texto.startsWith('efectivo')) return 2
  if (texto.startsWith('mercado')) return 3
  if (texto.startsWith('debito')) return 4
  return null
}

/**
 * PUENTE: un item de `GET /mis-alquileres` (existe) → la forma propuesta de
 * `GET /mis-alquileres/:id` (`MisAlquileresDetalleResponse`), para armar el
 * detalle y la edición del locador (US-04, US-03) mientras esa ruta no exista.
 * Así el resto del camino ({@link misAlquileresDetalleToPropiedadLocadorDetalle})
 * es el mismo que va a usar la ruta definitiva.
 *
 * Campo por campo, lo que `/mis-alquileres` manda distinto:
 * - `tipo`, `tags`, `indice_aumento` y `medios_pago` llegan como TEXTO (la
 *   descripción del catálogo) y se vuelven a ids con los mismos mapeos del
 *   Sprint 1. Un tag o un medio sin equivalente se descarta; CAC queda sin
 *   índice ({@link adjustmentIndexFromDescripcion}). Lo que se pierde en la
 *   precarga de `/editar` está en la NOTA de
 *   {@link misAlquileresDetalleToPropiedadLocadorDetalle}.
 * - `fecha_publicacion`: no existe en la base. TODO(db): guardar la fecha de
 *   alta del inmueble.
 * - `contrato_vigente`: la ruta no manda `contrato.estado`, así que se deduce
 *   de `estado_alquiler` (`alquilado` o `publicado/alquilado` = hay contrato
 *   vigente), la misma regla que usa US-02 para la columna "Locatario".
 *   NOTA: no se usa el locatario para deducirlo: hay contratos vigentes sin
 *   locatario cargado (inmueble 3 de los datos de prueba).
 * - `contrato_vigente.fecha_fin`: `null`. TODO(backend): `/mis-alquileres` no
 *   devuelve `fecha_fin_contrato` (la tabla la tiene).
 * - `contrato_vigente.monto_actual`: `contrato.monto_alquiler`.
 * TODO(backend): crear `GET /mis-alquileres/:id` y borrar este puente.
 */
export function misAlquileresItemToDetalleResponse(item: MisAlquileresItem): MisAlquileresDetalleResponse {
  const contrato = item.contrato
  const alquilada = item.estado_alquiler === 'alquilado' || item.estado_alquiler === 'publicado/alquilado'
  const tags = item.tags
    .map(characteristicFromTagDescripcion)
    .map((key) => (key ? tagIdFromCharacteristic(key) : null))
    .filter((id): id is number => id !== null)
  const indice = adjustmentIndexFromDescripcion(contrato.indice_aumento)
  const locatario = contrato.locatario ? `${contrato.locatario.nombre} ${contrato.locatario.apellido ?? ''}`.trim() : null

  return {
    id_inmueble: item.id_inmueble,
    tipo: tipoIdFromPropertyType(propertyTypeFromDescripcion(item.tipo_inmueble)),
    descripcion: item.descripcion ?? null,
    provincia: item.provincia,
    ciudad: item.ciudad,
    barrio: item.barrio,
    direccion: item.direccion,
    numero: item.numero,
    piso: item.piso ?? null,
    m2_totales: item.m2_totales,
    m2_cubiertos: item.m2_cubiertos,
    ambientes: item.ambientes,
    dormitorios: item.dormitorios,
    banos: item.banos,
    antiguedad: item.antiguedad ?? null,
    precio_publicado: item.precio_publicado,
    estado_alquiler: item.estado_alquiler,
    fecha_disponible: item.fecha_disponible ?? null,
    fecha_publicacion: null,
    tags: [...new Set(tags)],
    fotos: item.fotos.map((foto) => ({ url: foto.url, es_principal: foto.es_principal, orden: foto.orden })),
    condiciones_contrato: {
      monto_alquiler: contrato.monto_alquiler,
      expensas: contrato.expensas,
      indice_aumento: indice ? INDICE_ID[indice] : null,
      frecuencia_ajuste: contrato.frecuencia_ajuste ?? null,
      duracion_meses: contrato.duracion_meses ?? null,
      deposito: contrato.deposito ?? null,
      interes_por_dia: contrato.interes_por_dia ?? null,
      dias_gracia: contrato.dias_gracia ?? null,
      medios_pago: contrato.medios_pago.map(medioPagoIdFromNombre).filter((id): id is number => id !== null),
    },
    contrato_vigente:
      alquilada
        ? {
            id: contrato.id,
            locatario,
            fecha_fin: null,
            proximo_ajuste: contrato.fecha_proximo_ajuste ?? null,
            monto_actual: contrato.monto_alquiler,
          }
        : null,
  }
}

/**
 * `MisAlquileresDetalleResponse` (propuesto; hoy llega por el puente
 * {@link misAlquileresItemToDetalleResponse}) → `PropiedadLocadorDetalle`.
 *
 * Campo por campo:
 * - `address`: dirección EXACTA ("Rondeau 480, PB"): la ve solo el dueño.
 * - `values`: los datos con la forma del alta (`PropiedadNueva`), para la
 *   ficha y para el formulario de edición. `piso` se separa en piso y depto
 *   (`separarPisoDepto`); los tags vuelven a características; el depósito
 *   vuelve a meses (el back guarda el MONTO, ver `propiedadNuevaToCreateInmueble`).
 * - Fotos: en orden; cada una con un id local (`foto-<n>`) para el formulario.
 * - `activeContract`: el contrato vigente, si hay. Si no viene, `null`. El
 *   locatario y la fecha de fin pueden venir en `null` (la pantalla los omite).
 *
 * NOTA: la precarga de `/editar` (US-03) PIERDE dos datos que el front no
 * ofrece: el medio de pago "Débito automático" (`medio_pago.id` 4,
 * {@link medioPagoFromId} lo descarta) y el índice CAC (`tipo_indice.id` 3,
 * {@link adjustmentIndexFromId} lo deja en `null`). El formulario los muestra
 * vacíos y, al guardar, el cuerpo del `PUT` ya no los lleva.
 * TODO(backend): hoy el `PUT /inmuebles/:id` ignora `condiciones_contrato`, así
 * que no se borra nada; cuando se conecte el `PUT` ampliado, guardar la
 * edición BORRARÍA esos datos reales. Antes de conectarlo, o el front suma
 * los dos al catálogo, o el back conserva lo que el cuerpo no trae (ver
 * HANDOFF §7, US-03).
 * TODO(backend): crear la ruta (`GET /mis-alquileres/:id`, 404 si no es del que llama).
 */
export function misAlquileresDetalleToPropiedadLocadorDetalle(dto: MisAlquileresDetalleResponse): PropiedadLocadorDetalle {
  const barrio = barrioDe(dto.barrio)
  const { floor, unit } = separarPisoDepto(dto.piso)
  const condiciones = dto.condiciones_contrato
  const precio = aNumero(condiciones.monto_alquiler ?? dto.precio_publicado)
  const fotos = [...dto.fotos].sort((a, b) => a.orden - b.orden)
  const photos: FotoNueva[] = fotos.map((foto, index) => ({ id: `foto-${index + 1}`, src: foto.url, name: `Foto ${index + 1}` }))
  const deposito = numeroONull(condiciones.deposito)
  const mediosPago = [...new Set(condiciones.medios_pago)].map(medioPagoFromId).filter((medio): medio is MedioPagoConRecargo => medio !== null)
  const type = propertyTypeFromTipoId(dto.tipo)

  const values: PropiedadNueva = {
    type,
    street: dto.direccion,
    streetNumber: dto.numero,
    floor,
    unit,
    neighborhoodSlug: barrio.slug,
    city: normalizarCiudad(dto.ciudad),
    province: dto.provincia,
    rooms: dto.ambientes,
    bedrooms: dto.dormitorios,
    bathrooms: dto.banos,
    ageYears: dto.antiguedad,
    totalAreaM2: dto.m2_totales,
    coveredAreaM2: dto.m2_cubiertos,
    characteristics: [...new Set(dto.tags.map((id) => CHARACTERISTIC_BY_TAG_ID[id]).filter((key): key is CharacteristicKey => key !== undefined))],
    description: dto.descripcion ?? '',
    status: estadoAltaDeInmueble(dto.estado_alquiler),
    availableFrom: dto.fecha_disponible,
    photos,
    mainPhotoIndex: Math.max(0, fotos.findIndex((foto) => foto.es_principal)),
    priceMonthly: precio,
    expenses: aNumero(condiciones.expensas),
    dailyInterestPct: numeroONull(condiciones.interes_por_dia),
    graceDays: condiciones.dias_gracia,
    paymentMethods: mediosPago,
    adjustmentIndex: condiciones.indice_aumento ? adjustmentIndexFromId(condiciones.indice_aumento) : null,
    adjustmentEveryMonths: mesesDeFrecuencia(condiciones.frecuencia_ajuste),
    depositMonths: deposito && precio ? Math.round(deposito / precio) : null,
    contractMonths: condiciones.duracion_meses,
  }

  const contrato = dto.contrato_vigente
  return {
    id: String(dto.id_inmueble),
    title: tituloDePublicacion({ type, bedrooms: dto.dormitorios, neighborhoodName: barrio.name }),
    address: formatExactAddress(dto.direccion, dto.numero, dto.piso),
    neighborhoodName: barrio.name,
    status: statusDeInmueble(dto.estado_alquiler, dto.fecha_disponible),
    publishedAt: dto.fecha_publicacion,
    values,
    activeContract: contrato
      ? {
          id: String(contrato.id),
          tenantName: contrato.locatario,
          endDate: contrato.fecha_fin,
          nextAdjustmentDate: contrato.proximo_ajuste,
          currentAmount: numeroONull(contrato.monto_actual),
        }
      : null,
  }
}

/**
 * Los cambios de la edición (US-03), ya completos, → cuerpo del `PUT
 * /inmuebles/:id` AMPLIADO (propuesto): el mismo cuerpo que `POST
 * /inmuebles` (`CreateInmuebleCompletoPayload`), con las mismas
 * traducciones que el alta ({@link propiedadNuevaToCreateInmueble}).
 * @param fotos Las fotos en el orden final: las que ya estaban (con su URL)
 *   y las nuevas, recién subidas a Storage.
 * TODO(backend): hoy el `PUT` actualiza solo las columnas de `inmueble` e
 * ignora `tags`, `fotos` y `condiciones_contrato` (ver HANDOFF §7, US-03).
 */
export function cambiosToUpdateInmueble(cambios: PropiedadNueva, fotos: CreateFotoPayload[]): CreateInmuebleCompletoPayload {
  return propiedadNuevaToCreateInmueble(cambios, fotos)
}

/** `true` si los cambios traen todos los datos del alta (la pantalla de edición siempre manda el formulario completo). */
export function cambiosCompletos(cambios: CambiosPropiedad): cambios is PropiedadNueva {
  const requeridos: (keyof PropiedadNueva)[] = [
    'type', 'street', 'streetNumber', 'neighborhoodSlug', 'city', 'province', 'rooms', 'bedrooms', 'bathrooms',
    'totalAreaM2', 'coveredAreaM2', 'characteristics', 'description', 'status', 'photos', 'mainPhotoIndex',
    'priceMonthly', 'expenses', 'paymentMethods',
  ]
  return requeridos.every((campo) => cambios[campo] !== undefined)
}

// ─── Eliminar (US-04) ───────────────────────────────────────────────────

/** 404 del detalle del locador: no existe, se eliminó o no es suya (mismo mensaje, para no revelar cuál). */
export const MI_PROPIEDAD_NO_ENCONTRADA_MESSAGE = 'No encontramos esta propiedad.'

/** 409 de eliminar: tiene contrato vigente (decisión del PO, tanda 3 del Sprint 2). */
export const PROPIEDAD_CON_CONTRATO_MESSAGE = 'No podés eliminar una propiedad con contrato vigente.'

/**
 * Error de `DELETE /api/v1/inmuebles/:id` → el error que muestra el modal de
 * eliminar (US-04), con el mensaje en español del front en vez del texto del back.
 *
 * - 403 y 404 → `not_found` con {@link MI_PROPIEDAD_NO_ENCONTRADA_MESSAGE}.
 *   NOTA: el back responde 403 si el inmueble es de otro locador (o si el
 *   usuario no tiene el rol locador) y 404 si no existe o ya estaba dado de
 *   baja. Se muestran igual para no revelar que una propiedad ajena existe
 *   (mismo criterio que el detalle del locador).
 * - 409 → `conflict` con {@link PROPIEDAD_CON_CONTRATO_MESSAGE}. El back lo
 *   responde si el inmueble está `alquilado` o `publicado/alquilado`
 *   ("No se puede eliminar un inmueble que está alquilado."), o en un estado
 *   que no permite eliminarlo. Es la misma regla con la que el front deduce el
 *   contrato vigente, así que solo llega si la pantalla quedó vieja.
 * - El resto pasa sin cambios. NOTA: el 400 NO se traduce a "no encontrada":
 *   un error de la base también sale como 400 (HANDOFF §10.4) y quedaría
 *   disfrazado. Lo mismo `unauthorized`, `network` y `server`.
 */
export function errorDeEliminarPropiedad(error: unknown): unknown {
  if (!(error instanceof ServiceError)) return error
  if (error.code === 'forbidden' || error.code === 'not_found') return new ServiceError('not_found', MI_PROPIEDAD_NO_ENCONTRADA_MESSAGE)
  if (error.code === 'conflict') return new ServiceError('conflict', PROPIEDAD_CON_CONTRATO_MESSAGE)
  return error
}
