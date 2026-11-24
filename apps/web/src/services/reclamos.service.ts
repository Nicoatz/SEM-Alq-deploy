/**
 * reclamos.service.ts — frontera con el backend para los reclamos (US-14 a US-18).
 *
 * Qué es: todo lo que las pantallas piden sobre reclamos pasa por acá. Cada
 * función tiene dos ramas: la mock (elenco de `lib/mocks/reclamos.mock.ts` más lo
 * registrado en el navegador) y la real contra `apps/api`; el interruptor es
 * `NEXT_PUBLIC_USE_MOCKS`.
 * Cubre: US-14 Registrar reclamo y US-15 Consultar reclamos (Tanda A). El
 * detalle, responder, resolver y cancelar (US-15 a US-18) llegan con la Tanda B.
 *
 * NOTA: las rutas existen en el back desde el 24/11 (`develop` 6f9711c,
 * `apps/api/src/routes/v1/reclamos.routes.ts`) y se probaron en real ese día
 * (prueba de humo). Las diferencias con la vista se resuelven en el adaptador
 * (`adapters/reclamo.adapter.ts`), que además traduce los errores; las brechas,
 * en `docs/HANDOFF-BACKEND.md` §7.
 * NOTA: los permisos y las transiciones están en `lib/reclamos/reglas.ts`; la
 * rama mock los aplica tal cual.
 *
 * Quién lo usa: `components/reclamos/*`.
 */
import type { ReclamoResponse, TipoReclamo } from '@rentar/shared-types'
import { type ReclamoMock } from '@/lib/mocks'
import { TIPOS_RECLAMO } from '@/lib/reclamos/catalogo'
import { RECLAMO_NO_ENCONTRADO_MESSAGE, puedeVerReclamo } from '@/lib/reclamos/reglas'
import type { PropiedadParaReclamo, Reclamo, ReclamoNuevo, RolReclamos, TipoReclamoVista } from '@/lib/reclamos/tipos'
import { ahora } from '@/lib/utils/fechas'
import { errorDeMensaje, MENSAJES_RECLAMO, RECLAMO_FOTOS_MAX } from '@/lib/validation/reclamo.rules'
import { formatAddress, mainPhotoSrc } from './adapters/propiedad-mock.adapter'
import {
  errorDeListarReclamos,
  errorDeReclamo,
  errorDeRegistrarReclamo,
  FOTO_RECLAMO_INVALIDA_MESSAGE,
  FOTOS_RECLAMO_NO_SUBIDAS_MESSAGE,
  propiedadParaReclamoDeAlquiler,
  RECLAMO_SIN_CONTRATO_MESSAGE,
  reclamoDeDto,
  tiposDeReclamoDeDto,
} from './adapters/reclamo.adapter'
import { readReclamosMock, reclamoMockToReclamo } from './adapters/reclamo-mock.adapter'
import { readPropiedadesMock, readPropiedadesMockConBorradas } from './propiedades.service'
import { apiRequest } from './shared/apiClient'
import type { AlquilerLocatarioItemResponse } from './shared/backend-dtos'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { ServiceError } from './shared/errors'
import { borrarFotosDeBucket, subirFotosABucket } from './shared/fotosStorage'
import { saveMockRecord } from './shared/mockStore'
import { requireSessionUserId } from './shared/session'
import { readUsuariosMock } from './usuarios.service'

export {
  FOTO_RECLAMO_INVALIDA_MESSAGE,
  FOTOS_RECLAMO_NO_SUBIDAS_MESSAGE,
  RECLAMO_NO_REGISTRADO_MESSAGE,
  RECLAMO_SIN_CONTRATO_MESSAGE,
  RECLAMOS_ERROR_GENERICO_MESSAGE,
} from './adapters/reclamo.adapter'

/** Bucket de las fotos de los reclamos (migración `20261109000000_us14_reclamos.sql`). */
const BUCKET_FOTOS_RECLAMOS = 'fotos-reclamos'

/** Si el navegador no pudo guardar el reclamo en modo mock (fotos muy pesadas para `localStorage`). */
const MOCK_STORAGE_FULL_MESSAGE =
  'No pudimos guardar el reclamo en este navegador: se llenó el espacio de los datos de prueba. Probá con menos fotos o tocá "Reiniciar datos de prueba".'

// ─── Rama mock: helpers ─────────────────────────────────────────────────

/** Los reclamos del modo mock ya como vista (con propiedad y personas del elenco). */
function reclamosVistaMock(): Reclamo[] {
  const propiedades = readPropiedadesMockConBorradas()
  const usuarios = readUsuariosMock()
  return readReclamosMock().flatMap((reclamo) => reclamoMockToReclamo(reclamo, propiedades, usuarios) ?? [])
}

/** Las propiedades que el usuario alquila con un contrato vigente (US-14). */
function propiedadesVigentesMock(userId: string): PropiedadParaReclamo[] {
  const usuarios = readUsuariosMock()
  return readPropiedadesMock()
    .filter((propiedad) => propiedad.rental?.tenantUserId === userId && propiedad.rental.contractStatus === 'vigente')
    .map((propiedad) => {
      const locador = usuarios.find((usuario) => usuario.id === propiedad.ownerId)
      return {
        id: propiedad.id,
        direccion: formatAddress(propiedad),
        barrio: propiedad.neighborhoodName,
        fotoSrc: mainPhotoSrc(propiedad) || null,
        contratoCodigo: propiedad.rental?.contractId ?? null,
        locadorNombre: locador ? `${locador.nombre} ${locador.apellido}` : 'tu locador',
      }
    })
}

/** Próximo código libre: uno más que el mayor del elenco y del navegador ("RCL-2026-0044"). */
function proximoCodigoMock(): string {
  const mayor = Math.max(0, ...readReclamosMock().map((reclamo) => Number(reclamo.id.slice(-4)) || 0))
  return `RCL-${ahora().year()}-${String(mayor + 1).padStart(4, '0')}`
}

// ─── Catálogo ───────────────────────────────────────────────────────────

/**
 * US-14 — los tipos de reclamo, para las tarjetas del alta y el filtro del listado.
 * @backend GET /api/v1/reclamos/tipos   (existe; probado en real el 24/11) → TipoReclamo[]
 * @throws {ServiceError} `network` / `server`.
 */
export async function getTiposReclamo(): Promise<TipoReclamoVista[]> {
  if (USE_MOCKS) {
    await delay(150)
    return [...TIPOS_RECLAMO]
  }
  try {
    return tiposDeReclamoDeDto(await apiRequest<TipoReclamo[]>('/reclamos/tipos'))
  } catch (error) {
    throw errorDeListarReclamos(error)
  }
}

// ─── Listado (US-15) ────────────────────────────────────────────────────

/**
 * US-15 — los reclamos de las propiedades del usuario, según el rol activo:
 * como locador, los de sus propiedades; como locatario, los que registró.
 * Más recientes primero.
 * @backend GET /api/v1/reclamos?rol=locador|locatario   (existe; probado en real el 24/11) → ReclamoResponse[]
 * NOTA: no se manda `?estado=`: no filtra (brecha P0); el filtro por estado y
 * por tipo se hace en la pantalla (`lib/reclamos/filtros.ts`).
 * @throws {ServiceError} `unauthorized` sin sesión; `network` / `server`.
 */
export async function listarReclamos(rol: RolReclamos): Promise<Reclamo[]> {
  if (USE_MOCKS) {
    await delay(500)
    const userId = requireSessionUserId()
    return reclamosVistaMock()
      .filter((reclamo) => (rol === 'locador' ? reclamo.locador.id === userId : reclamo.locatario.id === userId))
      .sort((a, b) => b.creadoEl.localeCompare(a.creadoEl))
  }
  try {
    const dtos = await apiRequest<ReclamoResponse[]>('/reclamos', { query: { rol } })
    return dtos.map(reclamoDeDto).sort((a, b) => b.creadoEl.localeCompare(a.creadoEl))
  } catch (error) {
    throw errorDeListarReclamos(error)
  }
}

/**
 * US-15 — un reclamo, con el mensaje completo y sus fotos. Solo para las dos
 * partes: a cualquier otro le da el mismo "no encontrado" que un id que no existe.
 * @backend GET /api/v1/reclamos/:id   (existe; probado en real el 24/11) → ReclamoResponse
 * @throws {ServiceError} `not_found` con {@link RECLAMO_NO_ENCONTRADO_MESSAGE}
 *   (no existe o no es una de las partes); `unauthorized` sin sesión.
 */
export async function getReclamo(id: string): Promise<Reclamo> {
  if (USE_MOCKS) {
    await delay(400)
    const userId = requireSessionUserId()
    const reclamo = reclamosVistaMock().find((item) => item.id === id)
    if (!reclamo || !puedeVerReclamo(reclamo, userId)) throw new ServiceError('not_found', RECLAMO_NO_ENCONTRADO_MESSAGE)
    return reclamo
  }
  try {
    return reclamoDeDto(await apiRequest<ReclamoResponse>(`/reclamos/${encodeURIComponent(id)}`))
  } catch (error) {
    throw errorDeReclamo(error)
  }
}

// ─── Registro (US-14) ───────────────────────────────────────────────────

/**
 * US-14 — las propiedades con las que el usuario tiene un contrato vigente
 * como locatario: las únicas que puede elegir al registrar un reclamo.
 * @backend GET /api/v1/alquileres-locatario   (existe) → AlquilerLocatarioItemResponse[], filtrado por `estado = 'vigente'`
 * @throws {ServiceError} `unauthorized` sin sesión; `network` / `server`.
 */
export async function getPropiedadesParaReclamo(): Promise<PropiedadParaReclamo[]> {
  if (USE_MOCKS) {
    await delay(300)
    return propiedadesVigentesMock(requireSessionUserId())
  }
  try {
    const alquileres = await apiRequest<AlquilerLocatarioItemResponse[]>('/alquileres-locatario')
    return alquileres.filter((alquiler) => alquiler.estado === 'vigente').map(propiedadParaReclamoDeAlquiler)
  } catch (error) {
    throw errorDeListarReclamos(error)
  }
}

/**
 * US-14 — registra un reclamo del usuario en sesión. Queda "abierto".
 * @backend Supabase Storage, bucket `fotos-reclamos` (`<auth.uid>/<uuid>.<ext>`), y después
 *          POST /api/v1/reclamos   (existe; probado en real el 24/11)
 * @body    `{ id_inmueble, id_tipo_reclamo, mensaje, fotos: [{ url, peso_kb, formato, orden }] }`
 *          Sin `titulo`: lo genera el back y no se muestra (decisión del PO, 24/11).
 * @returns Reclamo (el registrado)
 * @throws {ServiceError} `validation` (propiedad, tipo, mensaje o fotos);
 *   `forbidden` con {@link RECLAMO_SIN_CONTRATO_MESSAGE} si no tiene contrato
 *   vigente con esa propiedad; `server` si las fotos no suben o el back falla.
 *
 * NOTA: primero suben las fotos y después va el alta con sus URL. Si falla la
 * subida no se crea nada; si falla el alta, se intenta borrar las fotos subidas.
 * TODO(db): el bucket `fotos-reclamos` no tiene política de SELECT, así que ese
 * borrado hoy no borra nada (ver `borrarFotosDeBucket`).
 */
export async function registrarReclamo(nuevo: ReclamoNuevo): Promise<Reclamo> {
  if (USE_MOCKS) {
    await delay(700)
    const userId = requireSessionUserId()
    const propiedad = propiedadesVigentesMock(userId).find((item) => item.id === nuevo.propiedadId)
    if (!nuevo.propiedadId) throw new ServiceError('validation', MENSAJES_RECLAMO.propiedad)
    if (!propiedad) throw new ServiceError('forbidden', RECLAMO_SIN_CONTRATO_MESSAGE, 'SIN_CONTRATO_VIGENTE')
    const tipo = TIPOS_RECLAMO.find((item) => item.id === nuevo.tipoId)
    if (!tipo) throw new ServiceError('validation', MENSAJES_RECLAMO.tipo)
    const errorMensaje = errorDeMensaje(nuevo.mensaje)
    if (errorMensaje) throw new ServiceError('validation', errorMensaje)
    if (nuevo.fotos.length > RECLAMO_FOTOS_MAX) throw new ServiceError('validation', MENSAJES_RECLAMO.fotosDeMas)

    const usuario = readUsuariosMock().find((item) => item.id === userId)
    const registrado: ReclamoMock = {
      id: proximoCodigoMock(),
      propertyId: propiedad.id,
      tenantUserId: userId,
      tenantName: usuario ? `${usuario.nombre} ${usuario.apellido}` : 'Locatario',
      type: tipo.nombre,
      status: 'abierto',
      message: nuevo.mensaje.trim(),
      photos: nuevo.fotos.map((foto) => ({ src: foto.src, name: foto.nombre })),
      createdAt: ahora().format(),
      inProgressAt: null,
      closedAt: null,
    }
    if (!saveMockRecord('reclamos', registrado)) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    const vista = reclamoMockToReclamo(registrado, readPropiedadesMockConBorradas(), readUsuariosMock())
    if (!vista) throw new ServiceError('server', MOCK_STORAGE_FULL_MESSAGE)
    return vista
  }

  const mensajesSubida = { invalida: FOTO_RECLAMO_INVALIDA_MESSAGE, noSubida: FOTOS_RECLAMO_NO_SUBIDAS_MESSAGE }
  const fotos = await subirFotosABucket(
    BUCKET_FOTOS_RECLAMOS,
    nuevo.fotos.map((foto) => foto.src),
    mensajesSubida,
  )
  try {
    const dto = await apiRequest<ReclamoResponse>('/reclamos', {
      method: 'POST',
      body: {
        id_inmueble: Number(nuevo.propiedadId),
        id_tipo_reclamo: nuevo.tipoId,
        mensaje: nuevo.mensaje.trim(),
        fotos: fotos.map(({ url, peso_kb, formato }, orden) => ({ url, peso_kb, formato, orden })),
      },
    })
    return reclamoDeDto(dto)
  } catch (error) {
    await borrarFotosDeBucket(BUCKET_FOTOS_RECLAMOS, fotos.map((foto) => foto.path))
    throw errorDeRegistrarReclamo(error)
  }
}
