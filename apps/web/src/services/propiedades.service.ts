/**
 * propiedades.service.ts — frontera con el backend para las propiedades.
 *
 * Qué es: todo lo que las pantallas piden sobre propiedades pasa por acá.
 * Cada función tiene dos ramas: la mock (activa hoy, datos del elenco de
 * `lib/mocks/`) y la llamada real a `apps/api`; el interruptor es
 * `NEXT_PUBLIC_USE_MOCKS` (ver `shared/config.ts`).
 * Cubre: US-34 Consultar propiedades a alquilar, US-02 Consultar mis
 * propiedades y US-01 Registrar mis propiedades.
 *
 * NOTA: `/buscar` y el panel llaman a este service desde el navegador (no
 * desde el servidor), así en modo mock también ven las propiedades creadas
 * en el alta, que viven en `localStorage` (ver `shared/mockStore.ts`).
 * Quién lo usa: la landing (`app/(public)/page.tsx`), `/buscar`, `/panel`,
 * `/panel/propiedades` y `/panel/propiedades/nueva`.
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
  PropiedadLocador,
  PropiedadNueva,
  PropiedadResumen,
  UbicacionOpciones,
} from '@rentar/shared-types'
import { getSupabaseBrowserClient } from '@/lib/auth/supabase/client'
import { buscarEnLista, ordenar, ubicacionesDe } from '@/lib/search/busqueda'
import { cobros as cobrosElenco, propiedades as propiedadesElenco, reclamos as reclamosElenco, type PropiedadMock } from '@/lib/mocks'
import { hoy } from '@/lib/utils/fechas'
import { FOTO_PESO_MAXIMO_BYTES, FOTO_TIPOS_ACEPTADOS } from '@/lib/validation/propiedad.rules'
import { isSearchable, propiedadMockToLocador, propiedadMockToResumen, propiedadNuevaToMock } from './adapters/propiedad-mock.adapter'
import {
  estadoDePropiedadNueva,
  inmuebleDisponibleToPropiedadResumen,
  misAlquileresItemToPropiedadLocador,
  propiedadNuevaToCreateInmueble,
} from './adapters/propiedad.adapter'
import { apiRequest } from './shared/apiClient'
import type { DisponiblesQuery, InmueblesDisponiblesResponse } from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { readMockCollection, saveMockRecord } from './shared/mockStore'
import { requireSessionUserId } from './shared/session'
import { readUsuariosMock } from './usuarios.service'

// ─── Helpers de la rama mock ────────────────────────────────────────────

/**
 * Todas las propiedades mock: el elenco más las creadas en el alta
 * (guardadas en el navegador).
 * NOTA: del lado del servidor devuelve solo el elenco (ver `shared/mockStore.ts`).
 */
function readPropiedadesMock(): PropiedadMock[] {
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
 * Tope de propiedades que se traen al "traer todas" (landing, `/buscar` y
 * opciones de ubicación).
 * Es el máximo que devuelve el back en un pedido: la API no limita `limit`,
 * pero Supabase corta cada consulta en 1000 filas (el "Max rows" por defecto
 * de la API de datos).
 * NOTA: traer todas y filtrar en el cliente sirve para el piloto (hoy hay muy
 * pocas propiedades publicadas) y NO escala: con más de 1000 disponibles la
 * lista quedaría incompleta, y aun antes de eso el pedido se vuelve pesado.
 * La salida es que el back resuelva todos los filtros y órdenes (ver el
 * TODO(backend) de {@link buscarPropiedades}).
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
 * ni paginación (la landing filtra en el cliente y muestra una vista previa).
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
 * NOTA: se traen todas las disponibles y se filtra, ordena y pagina SIEMPRE en
 * el cliente, con las mismas reglas que el modo mock (`lib/search/busqueda.ts`).
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
