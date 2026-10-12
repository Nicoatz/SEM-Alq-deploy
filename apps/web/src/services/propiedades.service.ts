/**
 * propiedades.service.ts — frontera con el backend para las propiedades.
 *
 * Qué es: todo lo que las pantallas piden sobre propiedades pasa por acá.
 * Cada función tiene dos ramas: la mock (activa hoy, datos del elenco de
 * `lib/mocks/`) y la llamada real a `apps/api`; el interruptor es
 * `NEXT_PUBLIC_USE_MOCKS` (ver `shared/config.ts`).
 * Cubre: US-34 Consultar propiedades a alquilar, US-41 Consultar detalle de
 * propiedad, US-02 Consultar mis propiedades y US-01 Registrar mis
 * propiedades (y deja firmadas US-03 Modificar y US-04 Eliminar, tanda 3
 * del Sprint 2).
 *
 * NOTA: `/buscar` y el panel llaman a este service desde el navegador (no
 * desde el servidor), así en modo mock también ven las propiedades creadas
 * en el alta, que viven en `localStorage` (ver `shared/mockStore.ts`).
 * Quién lo usa: la landing (`app/(public)/page.tsx`), `/buscar`,
 * `/propiedad/[id]`, `/panel`, `/panel/propiedades` y
 * `/panel/propiedades/nueva`.
 */
import type {
  BusquedaFiltros,
  CreateFotoPayload,
  FotoNueva,
  Inmueble,
  MisAlquileresItem,
  OrdenBusqueda,
  Paginado,
  PropertyStatus,
  PropiedadDetalle,
  PropiedadLocador,
  PropiedadNueva,
  PropiedadResumen,
  UbicacionOpciones,
  CambiosPropiedad,
  PropiedadLocadorDetalle,
} from '@rentar/shared-types'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase/client'
import { buscarEnLista, FILTROS_INICIALES, ordenar, ubicacionesDe } from '@/lib/search/busqueda'
import { cobros as cobrosElenco, propiedades as propiedadesElenco, reclamos as reclamosElenco, solicitudes as solicitudesElenco, type PropiedadMock, type SolicitudMock } from '@/lib/mocks'
import { hoy } from '@/lib/utils/fechas'
import { FOTO_PESO_MAXIMO_BYTES, FOTO_TIPOS_ACEPTADOS } from '@/lib/validation/propiedad.rules'
import {
  aplicarCambiosMock,
  isSearchable,
  propiedadMockToDetalle,
  propiedadMockToDetalleLocador,
  propiedadMockToLocador,
  propiedadMockToResumen,
  propiedadNuevaToMock,
  tieneContratoVigenteMock,
} from './adapters/propiedad-mock.adapter'
import {
  estadoDePropiedadNueva,
  inmuebleDetalleToPropiedadDetalle,
  inmuebleDisponibleToPropiedadResumen,
  misAlquileresItemToPropiedadLocador,
  propiedadNuevaToCreateInmueble,
  cambiosCompletos,
  cambiosToUpdateInmueble,
  misAlquileresDetalleToPropiedadLocadorDetalle,
  misAlquileresItemToDetalleResponse,
  errorDeEliminarPropiedad,
  MI_PROPIEDAD_NO_ENCONTRADA_MESSAGE,
  PROPIEDAD_CON_CONTRATO_MESSAGE,
} from './adapters/propiedad.adapter'
import { apiRequest } from './shared/apiClient'
import type { DisponiblesQuery, InmuebleDetalleResponse, InmueblesDisponiblesResponse } from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { readMockCollection, saveMockRecord } from './shared/mockStore'
import { requireSessionUserId } from './shared/session'
import { readUsuariosMock } from './usuarios.service'

// ─── Helpers de la rama mock ────────────────────────────────────────────

/**
 * Todas las propiedades mock vigentes: el elenco más las creadas en el alta
 * (guardadas en el navegador), sin las eliminadas (US-04).
 * NOTA: del lado del servidor devuelve solo el elenco (ver `shared/mockStore.ts`).
 * La comparte `solicitudes.service.ts` (dueño y disponibilidad de la propiedad solicitada).
 */
export function readPropiedadesMock(): PropiedadMock[] {
  return readPropiedadesMockConBorradas().filter((propiedad) => !propiedad.deletedAt)
}

/**
 * Todas las propiedades mock, INCLUIDAS las eliminadas (US-04, borrado
 * lógico). Solo para mostrar el historial: las solicitudes de una propiedad
 * eliminada siguen mostrando su dirección y su foto.
 * La comparte `solicitudes.service.ts`.
 */
export function readPropiedadesMockConBorradas(): PropiedadMock[] {
  return readMockCollection('propiedades', propiedadesElenco)
}

/**
 * Propiedades mock de un locador, ya como filas de US-02: cada una con su
 * cobro del período y sus reclamos abiertos (de `lib/mocks/panel.mock.ts`).
 * La comparte `panel.service.ts` para los conteos del panel.
 */
export function misPropiedadesMock(ownerId: string): PropiedadLocador[] {
  return readPropiedadesMock()
    .filter((propiedad) => propiedad.ownerId === ownerId)
    .map((propiedad) =>
      propiedadMockToLocador(propiedad, {
        cobro: cobrosElenco.find((cobro) => cobro.propertyId === propiedad.id) ?? null,
        openClaims: reclamosElenco.filter(
          (reclamo) => reclamo.propertyId === propiedad.id && (reclamo.status === 'abierto' || reclamo.status === 'en_proceso'),
        ).length,
      }),
    )
}

// ─── Búsqueda pública (US-34) ───────────────────────────────────────────

/**
 * Tope de propiedades que se traen al "traer todas" (`/buscar`, opciones de
 * ubicación y "Propiedades similares").
 * Es el máximo que devuelve el back en un pedido: la API no limita `limit`,
 * pero Supabase corta cada consulta en 1000 filas (el "Max rows" por defecto
 * de la API de datos).
 * NOTA: traer todas y filtrar en el cliente sirve para el piloto (hoy hay muy
 * pocas propiedades publicadas) y NO escala: con más de 1000 disponibles la
 * lista quedaría incompleta, y aun antes de eso el pedido se vuelve pesado.
 * Desde ce677a4 (29/09) el back ya resuelve filtros, orden y paginación: falta
 * mandarle la búsqueda (ver el TODO(backend) de {@link buscarPropiedades}).
 */
const TOPE_DISPONIBLES_CLIENTE = 1000

/**
 * Pide `/inmuebles/disponibles` con los params del back.
 * NOTA: desde ce677a4 (29/09) el back respeta `page` y `limit` (tope 1000) y
 * ordena por id descendente (probado contra la API real el 06/10/2026).
 */
function pedirDisponibles(query: DisponiblesQuery): Promise<InmueblesDisponiblesResponse> {
  return apiRequest<InmueblesDisponiblesResponse>('/inmuebles/disponibles', { query: { ...query } })
}

/**
 * Rama real: todas las disponibles en un solo pedido, hasta
 * {@link TOPE_DISPONIBLES_CLIENTE} (ver su NOTA: sirve para el piloto, no escala).
 */
async function todasLasDisponibles(): Promise<PropiedadResumen[]> {
  const respuesta = await pedirDisponibles({ page: '1', limit: String(TOPE_DISPONIBLES_CLIENTE) })
  return respuesta.items.map(inmuebleDisponibleToPropiedadResumen)
}

/**
 * US-34 Consultar propiedades a alquilar — todas las buscables, sin filtros
 * ni paginación (de acá salen las opciones de ubicación, ver {@link listarUbicaciones}).
 * @backend GET /api/v1/inmuebles/disponibles?page=1&limit=1000   (existe · hasta 1000, ver TOPE_DISPONIBLES_CLIENTE)
 * @returns PropiedadResumen[]
 */
export async function listarPropiedadesPublicadas(): Promise<PropiedadResumen[]> {
  if (USE_MOCKS) {
    await delay()
    return readPropiedadesMock().filter(isSearchable).map(propiedadMockToResumen)
  }
  return todasLasDisponibles()
}

/**
 * US-34 Consultar propiedades a alquilar — las `cantidad` publicaciones más
 * recientes, para "Recién publicadas" de la landing.
 * @backend GET /api/v1/inmuebles/disponibles?page=1&limit=<cantidad>   (existe · pagina y ordena por id descendente)
 * @returns PropiedadResumen[]
 *
 * NOTA: "recientes" es el orden por id que devuelve el back (el último que
 * se cargó, primero). En modo mock, por `publishedAt`.
 * TODO(db): la base no guarda la fecha de publicación; con ese dato, el back
 * podría ordenar por fecha de verdad (y el front, mostrarla).
 * Probado contra la API real el 06/10/2026: `?page=1&limit=6` devuelve 6 de
 * 11, ordenadas por id descendente, con foto, precio, barrio y los datos de
 * la tarjeta de US-34 completos.
 * TODO(backend): `/disponibles` hace varias consultas por cada propiedad, una
 * atrás de otra (ver `HANDOFF-BACKEND.md` §7): aun con `limit=6` tarda entre
 * 7 y 10 s. La landing la muestra con `Suspense`, así el resto de la página
 * no la espera (el esqueleto llega en ~150 ms).
 */
export async function listarPropiedadesRecientes(cantidad: number): Promise<PropiedadResumen[]> {
  if (USE_MOCKS) {
    await delay()
    const publicadas = readPropiedadesMock().filter(isSearchable).map(propiedadMockToResumen)
    return ordenar(publicadas, 'recientes').slice(0, cantidad)
  }
  const respuesta = await pedirDisponibles({ page: '1', limit: String(cantidad) })
  // NOTA: se corta igual a `cantidad` por si el back devuelve más (antes de
  // ce677a4, del 29/09, ignoraba `limit` y devolvía todas).
  return respuesta.items.slice(0, cantidad).map(inmuebleDisponibleToPropiedadResumen)
}

/**
 * US-34 Consultar propiedades a alquilar — la búsqueda de `/buscar`: filtros,
 * orden y una página de 10 resultados.
 * @backend GET /api/v1/inmuebles/disponibles   (existe · filtra, ordena y pagina desde ce677a4)
 * @returns Paginado<PropiedadResumen>
 *
 * NOTA: por ahora se traen todas las disponibles y se filtra, ordena y pagina
 * en el cliente, con las mismas reglas que el modo mock (`lib/search/busqueda.ts`),
 * aunque el back ya lo resuelve (ce677a4): falta pasarlo, ver el TODO de abajo.
 * TODO(backend): desde ce677a4 (29/09) `/disponibles` respeta precio,
 * dormitorios, ambientes, superficie, tags, índice, orden y `page`/`limit`
 * (probado el 06/10/2026). `barrio` es por nombre exacto ("General Paz", no
 * el slug) y `dormitorios`/`ambientes` son igual exacto (el front usa "4 o
 * más"). Falta volver a mandar la búsqueda al servidor (en `feature/vistas`):
 * el mapeo de la URL a sus params estaba en `propiedad.adapter.ts`
 * (`consultaDeDisponibles`, commit 60f8c63). Ver `HANDOFF-BACKEND.md` §7.
 */
export async function buscarPropiedades(filtros: BusquedaFiltros, orden: OrdenBusqueda, pagina: number): Promise<Paginado<PropiedadResumen>> {
  if (USE_MOCKS) {
    await delay()
    const publicadas = readPropiedadesMock().filter(isSearchable).map(propiedadMockToResumen)
    return buscarEnLista(publicadas, filtros, orden, pagina)
  }
  return buscarEnLista(await todasLasDisponibles(), filtros, orden, pagina)
}

/**
 * US-34 — cuántas propiedades da una combinación de filtros, sin mostrarlas
 * (el "Ver N propiedades" del Drawer de filtros en móvil, que se calcula
 * mientras se eligen los filtros, antes de aplicarlos).
 * @backend GET /api/v1/inmuebles/disponibles   (existe · se cuenta en el cliente, ver `buscarPropiedades`)
 * @returns number
 */
export async function contarPropiedades(filtros: BusquedaFiltros): Promise<number> {
  const resultado = await buscarPropiedades(filtros, 'predeterminado', 1)
  return resultado.total
}

/**
 * US-34 — provincias, ciudades y barrios con propiedades publicadas (las
 * opciones de los filtros de ubicación).
 * @backend GET /api/v1/catalogos/ubicaciones   (no existe — propuesto)
 * @returns UbicacionOpciones
 * TODO(backend): crear la ruta (o sumar las ubicaciones a un catálogo general).
 * Mientras tanto se arman a partir de las propiedades disponibles.
 */
export async function listarUbicaciones(): Promise<UbicacionOpciones> {
  return ubicacionesDe(await listarPropiedadesPublicadas())
}

// ─── Detalle público (US-41) ────────────────────────────────────────────

/** Mensaje si la publicación no existe o ya no se muestra (Detalle de propiedad · 04). */
export const PROPIEDAD_NO_ENCONTRADA_MESSAGE = 'Esta publicación ya no está disponible.'

/** Cuántas "Propiedades similares" muestra el detalle (Detalle de propiedad · 01). */
const CANTIDAD_SIMILARES = 3

/**
 * US-41 Consultar detalle de propiedad — una publicación con todo lo que
 * muestra `/propiedad/[id]`. Accesible con y sin sesión.
 * @backend GET /api/v1/inmuebles/disponibles/:id   (existe · público; 400 id inválido, 404 si no existe o no está disponible)
 * @returns PropiedadDetalle
 * @throws {ServiceError} `not_found` con {@link PROPIEDAD_NO_ENCONTRADA_MESSAGE}
 *   si no existe (o el id no es válido); `network` / `server` si falla la red
 *   o el back (la pantalla ofrece "Reintentar").
 * TODO(backend): faltan dueño, estado, condiciones del contrato, medios de
 * pago y "si el usuario ya la solicitó" (ver
 * `propiedad.adapter.ts#inmuebleDetalleToPropiedadDetalle` y
 * `HANDOFF-BACKEND.md` §7, US-41).
 *
 * NOTA: con sesión, el request lleva `Authorization: Bearer …` (lo agrega
 * `apiClient`). Hoy la ruta es pública y lo ignora; queda listo para cuando
 * el back mande la dirección exacta solo con token. Mientras tanto la manda
 * siempre, y la aproximada sin sesión la arma el adaptador (`opciones.conSesion`).
 *
 * NOTA: en modo mock también se abre una alquilada sin fecha o pausada (con
 * `availability: 'no_disponible'`, "Ya no está disponible"); el back real
 * responde 404 para esas.
 */
export async function getPropiedad(id: string, opciones: { conSesion?: boolean } = {}): Promise<PropiedadDetalle> {
  if (USE_MOCKS) {
    await delay()
    const propiedad = readPropiedadesMock().find((item) => item.id === id)
    if (!propiedad) throw new ServiceError('not_found', PROPIEDAD_NO_ENCONTRADA_MESSAGE)
    // Dueño: nombre solo si está en el elenco de cuentas (Nicolás, Sofía); si no, "el dueño".
    const cuenta = readUsuariosMock().find((usuario) => usuario.id === propiedad.ownerId)
    const fullName = cuenta ? `${cuenta.nombre} ${cuenta.apellido}` : null
    return propiedadMockToDetalle(propiedad, { id: propiedad.ownerId, fullName }, opciones)
  }
  try {
    const dto = await apiRequest<InmuebleDetalleResponse>(`/inmuebles/disponibles/${encodeURIComponent(id)}`)
    return inmuebleDetalleToPropiedadDetalle(dto, opciones)
  } catch (error) {
    // 400 (id que no es un número, ej. un link viejo de modo mock) y 404 se ven igual: no existe.
    if (error instanceof ServiceError && (error.code === 'not_found' || error.code === 'validation')) {
      throw new ServiceError('not_found', PROPIEDAD_NO_ENCONTRADA_MESSAGE)
    }
    throw error
  }
}

/**
 * US-41 — "Propiedades similares": otras publicadas del mismo barrio (hasta
 * {@link CANTIDAD_SIMILARES}), sin la que se está mirando.
 * @backend GET /api/v1/inmuebles/disponibles   (existe · se filtra en el cliente, ver `buscarPropiedades`)
 * @returns PropiedadResumen[] (vacío si no hay o la propiedad no tiene barrio)
 *
 * NOTA: reutiliza la búsqueda de `/buscar` (mismo filtro por barrio, orden
 * predeterminado). Con el back real trae todas las disponibles (~2,7 s): la
 * pantalla la pide aparte, sin frenar el detalle.
 * TODO(backend): cuando `/disponibles` respete `barrio` y `limit`, pedir solo
 * las del barrio.
 */
export async function listarSimilares(propiedad: Pick<PropiedadDetalle, 'id' | 'neighborhoodSlug'>): Promise<PropiedadResumen[]> {
  if (!propiedad.neighborhoodSlug) return []
  const filtros = { ...FILTROS_INICIALES, neighborhoodSlugs: [propiedad.neighborhoodSlug] }
  const resultado = await buscarPropiedades(filtros, 'predeterminado', 1)
  return resultado.items.filter((item) => item.id !== propiedad.id).slice(0, CANTIDAD_SIMILARES)
}

// ─── Mis propiedades (US-02) ────────────────────────────────────────────

/**
 * US-02 Consultar mis propiedades — TODAS las propiedades del locador en
 * sesión (alquiladas o no, publicadas o no), con locatario, estado del pago,
 * reclamos abiertos y próximo ajuste.
 * @backend GET /api/v1/mis-alquileres   (existe · token + rol locador; el locador sale del token)
 * @returns PropiedadLocador[]
 * TODO(backend): le faltan locatario, estado de pago, reclamos, próximo
 * ajuste y fecha de alta (ver `propiedad.adapter.ts#misAlquileresItemToPropiedadLocador`).
 * @throws {ServiceError} `unauthorized` sin sesión; `forbidden` si la cuenta no es locadora.
 *
 * NOTA: los filtros de US-02 (barrio, tipo, estado, reclamos) y la búsqueda
 * se aplican en el cliente (`lib/mis-propiedades/`): un locador tiene pocas
 * propiedades y la pantalla necesita la lista completa igual, para los
 * contadores de cada pestaña y para ofrecer solo los barrios de sus
 * propiedades. Si algún día hace falta, el back puede aceptar
 * `?barrio=&tipo=&estado=&reclamos=&q=` con esos mismos nombres.
 */
export async function listarMisPropiedades(): Promise<PropiedadLocador[]> {
  if (USE_MOCKS) {
    await delay()
    return misPropiedadesMock(requireSessionUserId())
  }
  const items = await apiRequest<MisAlquileresItem[]>('/mis-alquileres')
  return items.map(misAlquileresItemToPropiedadLocador)
}

// ─── Alta (US-01) ───────────────────────────────────────────────────────

/**
 * Lo que devuelve el alta: el id nuevo (para "Ver la publicación") y el
 * estado con que quedó (una alquilada con fecha queda `alquilada_publicada`).
 */
export interface PropiedadRegistrada {
  id: string
  status: PropertyStatus
}

/** Mensaje si el navegador no pudo guardar la propiedad en modo mock (por ejemplo, fotos muy pesadas). */
const MOCK_STORAGE_FULL_MESSAGE =
  'No pudimos guardar la propiedad en este navegador: se llenó el espacio de los datos de prueba. Probá con fotos más livianas o tocá "Reiniciar datos de prueba".'

/**
 * Mensaje si una foto no se pudo subir a Storage (red, servidor o una foto que
 * el bucket rechazó). La pantalla agrega "Tus datos siguen acá: no perdiste
 * nada." (el formulario conserva lo escrito en memoria).
 */
export const FOTOS_NO_SUBIDAS_MESSAGE = 'No pudimos subir las fotos. Revisá tu conexión e intentá de nuevo.'

/** Mensaje si una foto no es JPG/PNG o pesa más de 350 KB (la pantalla ya lo valida al cargarla). */
export const FOTO_INVALIDA_MESSAGE = 'Una de las fotos no es JPG o PNG, o pesa más de 350 KB. Cambiala y volvé a intentar.'

/**
 * Mensaje si `POST /inmuebles` responde 403 a una cuenta locataria.
 * Regla del equipo (27/09/2026): cualquier usuario con sesión puede publicar,
 * y al publicar la primera el back le suma el rol locador.
 * NOTA: desde el 29/09 (`develop` d88deca) la ruta ya no tiene
 * `requireRole("locador")` y un locatario recibe 201 (probado en real). El
 * mensaje queda como respaldo, por si vuelve el 403.
 * La pantalla agrega "Tus datos siguen acá: no perdiste nada."
 */
export const PUBLICAR_SIN_ROL_MESSAGE = 'Todavía no podés publicar desde esta cuenta, estamos terminando este cambio.'

// ─── Fotos del alta en Supabase Storage (US-01) ────────────────────────

/** Bucket de las fotos (lo versiona `supabase/migrations/20260929000002_bucket_fotos_propiedades.sql`). */
const BUCKET_FOTOS = 'fotos-propiedades'

/** Extensión (y `formato` para el back) según el tipo de la foto. Solo JPG y PNG (US-01). */
const EXTENSION_POR_TIPO: Record<string, 'jpg' | 'png'> = { 'image/jpeg': 'jpg', 'image/png': 'png' }

/** Una foto ya subida: lo que pide el back más la ruta en el bucket (para borrarla si el alta falla). */
interface FotoSubida extends Omit<CreateFotoPayload, 'es_principal'> {
  /** Ruta dentro del bucket: `<auth.uid>/<uuid>.<ext>`. */
  path: string
}

/**
 * US-01 — sube una foto del alta a Supabase Storage y devuelve lo que el
 * back necesita para guardarla (URL pública, peso y formato).
 * @backend Supabase Storage, bucket `fotos-propiedades`, ruta
 *          `<auth.uid>/<uuid>.<jpg|png>`, con la sesión del usuario (no pasa
 *          por `apps/api`). Políticas: INSERT y DELETE solo en la carpeta propia.
 * @returns FotoSubida (sin `es_principal`: lo marca quien llama)
 * @throws {ServiceError} `validation` con {@link FOTO_INVALIDA_MESSAGE} si no es
 *   JPG/PNG o pesa más de 350 KB; `unauthorized` sin sesión; `server` con
 *   {@link FOTOS_NO_SUBIDAS_MESSAGE} si Storage la rechaza o no responde.
 *
 * NOTA: la foto llega como data URL (así la guarda el formulario, ver
 * `FotosField`); se pasa a `Blob` para subirla.
 * NOTA: se vuelve a validar tipo y peso aunque la pantalla ya lo hace: el
 * bucket rechaza lo que no cumple (límite de 358400 bytes y solo JPG/PNG) y
 * es mejor avisarlo antes, en español.
 * NOTA: `upsert: false`: el bucket no tiene política de UPDATE y el nombre es
 * un uuid nuevo, así que nunca pisa otra foto.
 * NOTA: `peso_kb` se redondea hacia arriba (`Math.ceil`): el front deja hasta
 * 350 × 1024 bytes y el back rechaza `peso_kb > 350`, así coinciden.
 */
export async function subirFotoPropiedad(foto: FotoNueva): Promise<FotoSubida> {
  const archivo = await (await fetch(foto.src)).blob()
  const extension = EXTENSION_POR_TIPO[archivo.type]
  if (!extension || !FOTO_TIPOS_ACEPTADOS.includes(archivo.type) || archivo.size > FOTO_PESO_MAXIMO_BYTES) {
    throw new ServiceError('validation', FOTO_INVALIDA_MESSAGE)
  }

  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const authUserId = data.session?.user.id
  if (!authUserId) throw new ServiceError('unauthorized', 'Tu sesión venció. Volvé a iniciar sesión para seguir.')

  const path = `${authUserId}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from(BUCKET_FOTOS).upload(path, archivo, { contentType: archivo.type, upsert: false })
  if (error) throw new ServiceError('server', FOTOS_NO_SUBIDAS_MESSAGE)

  const { data: publica } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(path)
  return { url: publica.publicUrl, peso_kb: Math.ceil(archivo.size / 1024), formato: extension, path }
}

/**
 * Borra fotos ya subidas (cuando el alta no se completó), para no dejar
 * archivos sueltos en el bucket. Usa la política "borrar fotos propias".
 * NOTA: es un intento: si el borrado falla, se anota en la consola y no tapa
 * el error del alta, que es lo que la persona tiene que ver.
 * NOTA: para borrar, Storage exige permisos de DELETE **y SELECT** sobre
 * `storage.objects`. Sin la política de SELECT, `remove()` no borra nada y
 * tampoco devuelve error (responde una lista vacía): por eso se compara
 * cuántos borró. La política "ver fotos propias" (migración
 * `20260930000000_bucket_fotos_select_propias.sql`) está aplicada desde el
 * 30/09 y el borrado se probó en real.
 */
async function borrarFotosSubidas(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  try {
    const { data, error } = await getSupabaseBrowserClient().storage.from(BUCKET_FOTOS).remove(paths)
    if (error) console.warn('No se pudieron borrar las fotos de un alta que no se completó.', error.message)
    else if ((data?.length ?? 0) < paths.length) {
      console.warn(`Se borraron ${data?.length ?? 0} de ${paths.length} fotos de un alta que no se completó (¿falta la política de SELECT del bucket?).`)
    }
  } catch (error) {
    console.warn('No se pudieron borrar las fotos de un alta que no se completó.', error)
  }
}

/**
 * Sube todas las fotos del alta, en el orden en que se cargaron, y marca la
 * principal (US-01: "la primera, cambiable").
 * NOTA: se suben en paralelo. Si falla alguna, se borran las que sí subieron
 * y se tira el error: o suben todas o no queda ninguna.
 */
async function subirFotosPropiedad(nueva: PropiedadNueva): Promise<(FotoSubida & { es_principal: boolean })[]> {
  const resultados = await Promise.allSettled(nueva.photos.map(subirFotoPropiedad))
  const subidas = resultados.flatMap((resultado) => (resultado.status === 'fulfilled' ? [resultado.value] : []))
  const fallo = resultados.find((resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected')
  if (fallo) {
    await borrarFotosSubidas(subidas.map((foto) => foto.path))
    throw fallo.reason instanceof ServiceError ? fallo.reason : new ServiceError('server', FOTOS_NO_SUBIDAS_MESSAGE)
  }
  return subidas.map((foto, index) => ({ ...foto, es_principal: index === nueva.mainPhotoIndex }))
}

/**
 * Rama mock de la regla del equipo (27/09/2026): al publicar la primera
 * propiedad, la cuenta pasa a tener `['locador', 'locatario']` (locador abarca
 * a locatario, igual que lo va a devolver `/usuarios/me`). Se guarda en
 * `rentar:mock:usuarios`, así sobrevive a recargar. La sesión se actualiza
 * igual que en modo real: la pantalla llama a `useAuth().refrescarUsuario`.
 * NOTA: si no se puede guardar (`localStorage` lleno), la propiedad ya quedó
 * creada; la cuenta sigue como estaba y el alta muestra el éxito sin
 * "Ir a mis propiedades".
 */
function sumarRolLocadorMock(userId: string): void {
  const usuario = readUsuariosMock().find((item) => item.id === userId)
  if (!usuario || usuario.roles.includes('locador')) return
  saveMockRecord('usuarios', { ...usuario, roles: ['locador', 'locatario'] })
}

/**
 * US-01 Registrar mis propiedades — da de alta una propiedad del usuario en
 * sesión, locatario o locador, con sus condiciones de contrato y sus fotos
 * (publicada, pausada o alquilada; alquilada con fecha de disponibilidad →
 * alquilada/publicada).
 * @backend POST /api/v1/inmuebles   (existe · token, cualquier rol; el dueño sale del token)
 *          Desde el 29/09 (d88deca) crea todo en una transacción
 *          (`registrar_propiedad_completa`) y le suma el rol locador al usuario.
 * @body    CreateInmuebleCompletoPayload (lo arma `propiedadNuevaToCreateInmueble`)
 * @returns PropiedadRegistrada
 * @throws {ServiceError} `unauthorized` sin sesión (US-01: "se debe haber
 *   iniciado sesión"); `forbidden` con {@link PUBLICAR_SIN_ROL_MESSAGE} si el
 *   back vuelve a exigir el rol locador (respaldo); `validation` si el back rechaza un
 *   dato o una foto no es válida; `server` si las fotos no se pueden subir.
 *
 * NOTA: primero se suben las fotos a Storage y después se manda el alta con
 * sus URLs. Si falla la subida, no se crea nada en la base; si falla el alta,
 * se borran las fotos subidas (ver `borrarFotosSubidas`).
 * NOTA: esta función no actualiza la sesión. Después del 201 la pantalla
 * relee los roles con `useAuth().refrescarUsuario` (ver `AltaPropiedad`).
 */
export async function registrarPropiedad(nueva: PropiedadNueva): Promise<PropiedadRegistrada> {
  if (USE_MOCKS) {
    await delay(900)
    const ownerId = requireSessionUserId()
    const propiedad = propiedadNuevaToMock(nueva, {
      id: `prop-${Date.now()}`,
      ownerId,
      publishedAt: hoy().format('YYYY-MM-DD'),
    })
    if (!saveMockRecord('propiedades', propiedad)) {
      throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    }
    sumarRolLocadorMock(ownerId)
    return { id: propiedad.id, status: propiedad.status }
  }

  const fotos = await subirFotosPropiedad(nueva)
  const paraElBack: CreateFotoPayload[] = fotos.map(({ url, peso_kb, formato, es_principal }) => ({ url, peso_kb, formato, es_principal }))
  try {
    const inmueble = await apiRequest<Inmueble>('/inmuebles', { method: 'POST', body: propiedadNuevaToCreateInmueble(nueva, paraElBack) })
    return { id: String(inmueble.id), status: estadoDePropiedadNueva(nueva) }
  } catch (error) {
    // El alta no se creó (el back la hace en una transacción): las fotos subidas sobran.
    await borrarFotosSubidas(fotos.map((foto) => foto.path))
    // Respaldo: si el back vuelve a exigir el rol locador, un locatario recibe 403 (ver el mensaje).
    if (error instanceof ServiceError && error.code === 'forbidden') throw new ServiceError('forbidden', PUBLICAR_SIN_ROL_MESSAGE)
    throw error
  }
}

// ─── Publicar o pausar (otro sprint) ────────────────────────────────────

/**
 * Publicar o pausar propiedad (sin US en Sprint 0, mapa US-40) — cambia el
 * estado de la publicación.
 * @backend PATCH /api/v1/inmuebles/:id/publicacion   (no existe — propuesto) body { activa: boolean }
 * @returns void
 *
 * NOTA: todavía no la usa ninguna pantalla. US-02 no pide acciones en el
 * listado: pausar, publicar y eliminar viven en el detalle de la propiedad,
 * que es del sprint de US-03 y US-04. Queda lista (y probada en mock)
 * para ese sprint.
 */
export async function cambiarEstadoPublicacion(propiedadId: string, estado: 'publicada' | 'pausada'): Promise<void> {
  if (USE_MOCKS) {
    await delay()
    const ownerId = requireSessionUserId()
    const propiedad = readPropiedadesMock().find((item) => item.id === propiedadId && item.ownerId === ownerId)
    if (!propiedad) throw new ServiceError('not_found', 'No encontramos esa propiedad entre las tuyas.')
    if (propiedad.status === 'alquilada' || propiedad.status === 'alquilada_publicada') {
      throw new ServiceError('validation', 'Una propiedad alquilada no se puede publicar ni pausar desde acá.')
    }
    if (!saveMockRecord('propiedades', { ...propiedad, status: estado })) {
      throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    }
    return
  }
  await apiRequest<void>(`/inmuebles/${encodeURIComponent(propiedadId)}/publicacion`, { method: 'PATCH', body: { activa: estado === 'publicada' } })
}

// ─── Detalle, modificar y eliminar (US-03, US-04) ───────────────────────

// NOTA: los mensajes del detalle y de eliminar viven en el adaptador (los usa
// `errorDeEliminarPropiedad`); se re-exportan acá para que las pantallas los
// sigan tomando del service.
export { MI_PROPIEDAD_NO_ENCONTRADA_MESSAGE, PROPIEDAD_CON_CONTRATO_MESSAGE }

/** Se intentó cambiar el precio o el ajuste de una propiedad con contrato vigente. */
export const CAMPOS_FIJADOS_POR_CONTRATO_MESSAGE = 'Con un contrato vigente, el precio y el ajuste los fija el contrato.'

/** Rama mock: una propiedad vigente del locador en sesión, o `not_found`. */
function miPropiedadMock(propiedadId: string): PropiedadMock {
  const ownerId = requireSessionUserId()
  const propiedad = readPropiedadesMock().find((item) => item.id === propiedadId && item.ownerId === ownerId)
  if (!propiedad) throw new ServiceError('not_found', MI_PROPIEDAD_NO_ENCONTRADA_MESSAGE)
  return propiedad
}

/** "Ahora" en el elenco: el "hoy" fijo (23/09/2026) con la hora actual. */
function ahoraMock(): string {
  const ahora = new Date()
  return hoy().hour(ahora.getHours()).minute(ahora.getMinutes()).format('YYYY-MM-DDTHH:mm:ss')
}

/**
 * US-03 y US-04 — una propiedad del locador en sesión, con todo lo que cargó
 * el alta, para su detalle (`/panel/propiedades/[id]`) y su edición.
 * @backend GET /api/v1/mis-alquileres   (existe · token + rol locador; el locador sale del token)
 *          Se usa como PUENTE: trae todas las propiedades del dueño y se busca
 *          la pedida. La ruta definitiva es GET /api/v1/mis-alquileres/:id
 *          (no existe — propuesto) → MisAlquileresDetalleResponse, con 404 si
 *          el inmueble no existe, está eliminado o no es del que llama.
 * @returns PropiedadLocadorDetalle (dirección EXACTA: la ve solo el dueño)
 * @throws {ServiceError} `not_found` con {@link MI_PROPIEDAD_NO_ENCONTRADA_MESSAGE}
 *   si no está entre las suyas (no existe o es de otro: mismo mensaje, para
 *   no revelar cuál); `unauthorized` sin sesión; `forbidden` sin rol locador
 *   (la página ya lo frena con `RequireRole`, como el resto del panel).
 * NOTA: el puente no escala (trae todas las propiedades del dueño para
 * mostrar una) y deja sin datos la fecha de fin del contrato y la de
 * publicación (ver `propiedad.adapter.ts#misAlquileresItemToDetalleResponse`).
 * TODO(backend): crear `GET /mis-alquileres/:id` y pedir solo esa (ver
 * `docs/api-endpoints.md`, "Detalle de mi propiedad").
 */
export async function getMiPropiedad(propiedadId: string): Promise<PropiedadLocadorDetalle> {
  if (USE_MOCKS) {
    await delay()
    return propiedadMockToDetalleLocador(miPropiedadMock(propiedadId))
  }
  const items = await apiRequest<MisAlquileresItem[]>('/mis-alquileres')
  const item = items.find((propiedad) => String(propiedad.id_inmueble) === propiedadId)
  if (!item) throw new ServiceError('not_found', MI_PROPIEDAD_NO_ENCONTRADA_MESSAGE)
  return misAlquileresDetalleToPropiedadLocadorDetalle(misAlquileresItemToDetalleResponse(item))
}

/**
 * `true` si los cambios tocan algo que fija el contrato vigente (precio,
 * índice o frecuencia de ajuste), comparando con lo guardado.
 */
function tocaCamposDelContrato(actual: PropiedadLocadorDetalle['values'], cambios: CambiosPropiedad): boolean {
  return (
    (cambios.priceMonthly !== undefined && cambios.priceMonthly !== actual.priceMonthly) ||
    (cambios.adjustmentIndex !== undefined && cambios.adjustmentIndex !== actual.adjustmentIndex) ||
    (cambios.adjustmentEveryMonths !== undefined && cambios.adjustmentEveryMonths !== actual.adjustmentEveryMonths)
  )
}

/**
 * Fotos de la edición para el back: las que ya estaban viajan con su URL; las
 * nuevas (data URL del formulario) se suben antes a Storage, como en el alta.
 * Devuelve también las rutas de las recién subidas, para borrarlas si el
 * `PUT` falla.
 * NOTA: de las fotos que ya estaban no se conoce el peso: van con `peso_kb: 0`
 * y el formato según la extensión de la URL.
 * TODO(backend): que el `PUT` ampliado acepte las fotos existentes solo con su URL.
 */
async function fotosParaEditar(cambios: PropiedadNueva): Promise<{ fotos: CreateFotoPayload[]; subidas: string[] }> {
  const nuevas = cambios.photos.filter((foto) => foto.src.startsWith('data:'))
  const resultados = await Promise.allSettled(nuevas.map(subirFotoPropiedad))
  const subidas = resultados.flatMap((resultado) => (resultado.status === 'fulfilled' ? [resultado.value] : []))
  const fallo = resultados.find((resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected')
  if (fallo) {
    await borrarFotosSubidas(subidas.map((foto) => foto.path))
    throw fallo.reason instanceof ServiceError ? fallo.reason : new ServiceError('server', FOTOS_NO_SUBIDAS_MESSAGE)
  }
  let siguienteNueva = 0
  const fotos = cambios.photos.map((foto, index): CreateFotoPayload => {
    const es_principal = index === cambios.mainPhotoIndex
    if (foto.src.startsWith('data:')) {
      const subida = subidas[siguienteNueva++]
      return { url: subida?.url ?? '', peso_kb: subida?.peso_kb ?? 0, formato: subida?.formato ?? 'jpg', es_principal }
    }
    const formato = /\.png($|\?)/i.test(foto.src) ? 'png' : 'jpg'
    return { url: foto.src, peso_kb: 0, formato, es_principal }
  })
  return { fotos, subidas: subidas.map((foto) => foto.path) }
}

/**
 * US-03 Modificar mis propiedades — guarda los cambios de una propiedad del
 * locador en sesión.
 * @backend PUT /api/v1/inmuebles/:id   (existe · token + rol locador; propuesto AMPLIADO:
 *          el mismo cuerpo que POST /inmuebles) → la propiedad actualizada
 * @returns PropiedadLocadorDetalle (la propiedad como quedó)
 * @throws {ServiceError} `not_found` si no es suya; `validation` si con
 *   contrato vigente cambia el precio o el ajuste
 *   ({@link CAMPOS_FIJADOS_POR_CONTRATO_MESSAGE}) o si una foto no es válida;
 *   `server` si las fotos nuevas no se pueden subir.
 *
 * NOTA: la pantalla manda el formulario completo. Si llegaran cambios
 * parciales, la rama real los completa con lo guardado (`getMiPropiedad`).
 * NOTA: la rama real manda el cuerpo completo aunque hoy el `PUT` ignore
 * parte (tags, fotos, condiciones): no se parte el formulario según lo que
 * soporta el back (decisión del PO).
 * TODO(backend): ampliar el `PUT` al cuerpo del alta y chequear que el
 * inmueble sea del que llama (hoy no lo hace: HANDOFF §10).
 * TODO(backend): hasta que el `PUT` guarde las fotos, cada edición con fotos
 * nuevas deja archivos huérfanos en el bucket (HANDOFF §10).
 */
export async function actualizarPropiedad(propiedadId: string, cambios: CambiosPropiedad): Promise<PropiedadLocadorDetalle> {
  if (USE_MOCKS) {
    await delay(800)
    const propiedad = miPropiedadMock(propiedadId)
    const actual = propiedadMockToDetalleLocador(propiedad)
    if (actual.activeContract && tocaCamposDelContrato(actual.values, cambios)) {
      throw new ServiceError('validation', CAMPOS_FIJADOS_POR_CONTRATO_MESSAGE)
    }
    const actualizada = aplicarCambiosMock(propiedad, cambios)
    if (!saveMockRecord('propiedades', actualizada)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return propiedadMockToDetalleLocador(actualizada)
  }

  const completos: PropiedadNueva = cambiosCompletos(cambios) ? cambios : { ...(await getMiPropiedad(propiedadId)).values, ...cambios }
  const { fotos, subidas } = await fotosParaEditar(completos)
  try {
    await apiRequest<unknown>(`/inmuebles/${encodeURIComponent(propiedadId)}`, { method: 'PUT', body: cambiosToUpdateInmueble(completos, fotos) })
  } catch (error) {
    // Como en el alta: si no se guardó, las fotos recién subidas sobran.
    await borrarFotosSubidas(subidas)
    throw error
  }
  // TODO(backend): el PUT de hoy ignora las fotos: las recién subidas quedan huérfanas en el bucket (HANDOFF §10).
  // NOTA: el PUT devuelve solo la fila de `inmueble`; la vista completa se vuelve a pedir.
  return getMiPropiedad(propiedadId)
}

/**
 * Rama mock de US-04: las solicitudes `pendiente` y `aceptada` de la
 * propiedad pasan a `cancelada` (decisión del PO). Devuelve cuántas.
 * NOTA: se escribe sobre la colección de solicitudes acá, y no con
 * `solicitudes.service`, para no armar un import circular entre services.
 */
function cancelarSolicitudesDePropiedadMock(propertyId: string): number {
  const activas = readMockCollection<SolicitudMock>('solicitudes', solicitudesElenco).filter(
    (item) => item.propertyId === propertyId && (item.status === 'pendiente' || item.status === 'aceptada'),
  )
  const respondedAt = ahoraMock()
  activas.forEach((item) => saveMockRecord('solicitudes', { ...item, status: 'cancelada', respondedAt }))
  return activas.length
}

/**
 * US-04 Eliminar mis propiedades — elimina una propiedad del locador en
 * sesión. Borrado LÓGICO (decisión del PO): deja de verse en Mis
 * propiedades, en `/buscar` y en su detalle, pero se conservan contratos y
 * reclamos anteriores.
 * @backend DELETE /api/v1/inmuebles/:id   (existe · `develop` b7ebf48, 09/10 · token + rol
 *          locador; el dueño se valida en la función SQL `eliminar_inmueble_logico`)
 *          Baja LÓGICA: `inmueble.activo = false` y sus contratos `estado = 3`,
 *          `activo = false`. 200 sin `data`; 403 si no es suya; 404 si no existe
 *          o ya estaba dada de baja; 409 si está `alquilado` o `publicado/alquilado`.
 * @returns void
 * @throws {ServiceError} `not_found` con {@link MI_PROPIEDAD_NO_ENCONTRADA_MESSAGE}
 *   si no es suya o ya no existe; `conflict` con
 *   {@link PROPIEDAD_CON_CONTRATO_MESSAGE} si está alquilada (ver
 *   `propiedad.adapter.ts#errorDeEliminarPropiedad`); `unauthorized`,
 *   `validation`, `network` o `server` sin cambios.
 *
 * NOTA: en modo mock, al eliminar, las solicitudes `pendiente` y `aceptada`
 * de la propiedad pasan a `cancelada` (decisión del PO). En real no hay
 * solicitudes (el back no tiene el módulo).
 * TODO(backend): el 409 sale de `estado_alquiler`, no del contrato vigente
 * (`contrato.estado = 2`): una publicada o pausada con un contrato vigente se
 * eliminaría y su contrato quedaría finalizado (HANDOFF §10).
 * TODO(backend): cancelar las solicitudes activas y mandar un mail a cada
 * postulante, cuando exista el módulo de solicitudes.
 * TODO(backend): las fotos quedan en el bucket público (`fotos-propiedades`)
 * y sus URLs siguen abriendo; decidir si se borran o se mueven.
 */
export async function eliminarPropiedad(propiedadId: string): Promise<void> {
  if (USE_MOCKS) {
    await delay(800)
    const propiedad = miPropiedadMock(propiedadId)
    if (tieneContratoVigenteMock(propiedad)) throw new ServiceError('conflict', PROPIEDAD_CON_CONTRATO_MESSAGE)
    if (!saveMockRecord('propiedades', { ...propiedad, deletedAt: ahoraMock() })) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    cancelarSolicitudesDePropiedadMock(propiedadId)
    return
  }
  try {
    await apiRequest<void>(`/inmuebles/${encodeURIComponent(propiedadId)}`, { method: 'DELETE' })
  } catch (error) {
    throw errorDeEliminarPropiedad(error)
  }
}
