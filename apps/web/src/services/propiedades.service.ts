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
import { buscarEnLista, ubicacionesDe } from '@/lib/search/busqueda'
import { cobros as cobrosElenco, propiedades as propiedadesElenco, reclamos as reclamosElenco, type PropiedadMock } from '@/lib/mocks'
import { hoy } from '@/lib/utils/fechas'
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
 * NOTA: hoy el back ignora `page` y `limit` y devuelve todas (ver el
 * TODO(backend) de {@link buscarPropiedades}); se mandan igual por si vuelve a paginar.
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
 * US-34 Consultar propiedades a alquilar — la búsqueda de `/buscar`: filtros,
 * orden y una página de 10 resultados.
 * @backend GET /api/v1/inmuebles/disponibles   (existe · hoy ignora casi todos los filtros y la paginación)
 * @returns Paginado<PropiedadResumen>
 *
 * NOTA: se traen todas las disponibles y se filtra, ordena y pagina SIEMPRE en
 * el cliente, con las mismas reglas que el modo mock (`lib/search/busqueda.ts`).
 * TODO(backend): desde el 29/09 (`develop` a00f099), `/disponibles` solo
 * filtra por `barrio` (igual exacto) y `tipo`; ignora precio, dormitorios,
 * ambientes, superficie, tags, índice, orden y `page`/`limit` (responde todas
 * con `page: 1`). Cuando los respete, volver a mandar la búsqueda al servidor:
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
 * Mensaje mientras no exista el bucket de fotos en Supabase Storage.
 * NOTA: el back exige al menos 3 fotos con URL, así que sin bucket el alta
 * real no se puede guardar. Se avisa ANTES de mandar nada. La pantalla
 * agrega "Tus datos siguen acá: no perdiste nada." (el formulario conserva lo
 * escrito en memoria; no hay borrador en localStorage).
 */
export const FOTOS_NO_DISPONIBLES_MESSAGE =
  'Todavía no podemos guardar las fotos de las propiedades, así que por ahora el alta no se puede completar.'

/**
 * Mensaje si `POST /inmuebles` responde 403 a una cuenta locataria.
 * Regla del equipo (27/09/2026): cualquier usuario con sesión puede publicar,
 * y al publicar la primera el back le suma el rol locador.
 * TODO(backend): hoy la ruta tiene `requireRole("locador")`, así que un
 * locatario recibe 403. Cuando el cambio de Thiago esté, este caso no pasa más.
 * La pantalla agrega "Tus datos siguen acá: no perdiste nada."
 */
export const PUBLICAR_SIN_ROL_MESSAGE = 'Todavía no podés publicar desde esta cuenta, estamos terminando este cambio.'

/**
 * US-01 — sube una foto del alta a Supabase Storage y devuelve lo que el
 * back necesita para guardarla (URL pública, peso y formato).
 * @backend Supabase Storage, bucket `fotos-propiedades`, ruta `<auth.uid>/<archivo>`,
 *          con la sesión del usuario (no pasa por `apps/api`).
 * @returns CreateFotoPayload (sin `es_principal`: lo marca quien llama)
 * TODO(db): el bucket `fotos-propiedades` todavía no existe (la migración la
 * maneja Ivan por separado). Hasta entonces esta función avisa que no se
 * puede, sin intentar subir nada.
 * @throws {ServiceError} `server` con {@link FOTOS_NO_DISPONIBLES_MESSAGE}.
 */
export async function subirFotoPropiedad(foto: FotoNueva): Promise<Omit<CreateFotoPayload, 'es_principal'>> {
  void foto // se va a usar cuando exista el bucket (ver el TODO(db) de arriba)
  throw new ServiceError('server', FOTOS_NO_DISPONIBLES_MESSAGE)
}

/**
 * Sube todas las fotos del alta, en el orden en que se cargaron, y marca la
 * principal (US-01: "la primera, cambiable").
 */
async function subirFotosPropiedad(nueva: PropiedadNueva): Promise<CreateFotoPayload[]> {
  const subidas = await Promise.all(nueva.photos.map(subirFotoPropiedad))
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
 * @backend POST /api/v1/inmuebles   (existe · token + rol locador; el dueño sale del token)
 *          Propuesto (en curso, Thiago): cualquier usuario con sesión, y si
 *          no era locador, sumarle ese rol al crear la primera.
 * @body    CreateInmuebleCompletoPayload (lo arma `propiedadNuevaToCreateInmueble`)
 * @returns PropiedadRegistrada
 * @throws {ServiceError} `unauthorized` sin sesión (US-01: "se debe haber
 *   iniciado sesión"); `forbidden` con {@link PUBLICAR_SIN_ROL_MESSAGE} si el
 *   back todavía exige el rol locador; `validation` si el back rechaza un
 *   dato; `server` si las fotos no se pueden subir.
 *
 * NOTA: primero se suben las fotos y después se manda el alta con sus URLs.
 * Si falla la subida, no se crea nada en la base.
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
  try {
    const inmueble = await apiRequest<Inmueble>('/inmuebles', { method: 'POST', body: propiedadNuevaToCreateInmueble(nueva, fotos) })
    return { id: String(inmueble.id), status: estadoDePropiedadNueva(nueva) }
  } catch (error) {
    // Back viejo: `requireRole("locador")` le da 403 a un locatario (ver el TODO(backend) del mensaje).
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
