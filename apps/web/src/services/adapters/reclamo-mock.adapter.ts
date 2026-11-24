/**
 * reclamo-mock.adapter.ts — los reclamos del elenco, leídos del navegador y
 * traducidos a los tipos de vista (US-14 a US-18, modo mock).
 *
 * Qué hace: combina el elenco (`lib/mocks/reclamos.mock.ts`) con lo registrado
 * en el navegador (`rentar:mock:reclamos`) y arma el `Reclamo` de la vista con la
 * propiedad y las personas del elenco.
 *
 * NOTA: vive en un adaptador (y no en `reclamos.service.ts`) porque también lo
 * leen `propiedades.service.ts` y `panel.service.ts` (los "N abiertos" de Mis
 * propiedades y los reclamos recientes del inicio), y así no se importan entre sí.
 *
 * Quién lo usa: la rama mock de `reclamos.service.ts`, `propiedades.service.ts` y `panel.service.ts`.
 */
import { reclamos as reclamosElenco, type PropiedadMock, type ReclamoMock, type UsuarioMock } from '@/lib/mocks'
import type { PersonaReclamo, Reclamo } from '@/lib/reclamos/tipos'
import { readMockCollection } from '../shared/mockStore'
import { formatAddress, mainPhotoSrc } from './propiedad-mock.adapter'

/** Todos los reclamos del modo mock: el elenco más los registrados en el navegador. */
export function readReclamosMock(): ReclamoMock[] {
  return readMockCollection('reclamos', reclamosElenco)
}

/** `true` si el reclamo sigue sin cerrar (abierto o en proceso): los "N abiertos" de Mis propiedades (US-02). */
export function esReclamoAbiertoMock(reclamo: Pick<ReclamoMock, 'status'>): boolean {
  return reclamo.status === 'abierto' || reclamo.status === 'en_proceso'
}

/** Nombre y apellido de una cuenta del elenco, o el texto que se le pase si no existe. */
function persona(id: string | null, nombreDeRespaldo: string, usuarios: readonly UsuarioMock[]): PersonaReclamo {
  const usuario = id ? usuarios.find((item) => item.id === id) : undefined
  return {
    // NOTA: un locatario sin cuenta (Tomás Bianchi) lleva un id propio, que nunca coincide con una sesión.
    id: usuario?.id ?? id ?? `sin-cuenta:${nombreDeRespaldo}`,
    nombre: usuario ? `${usuario.nombre} ${usuario.apellido}` : nombreDeRespaldo,
    fotoSrc: null,
  }
}

/**
 * `ReclamoMock` → `Reclamo`, con la propiedad y su dueño. Devuelve `null` si la
 * propiedad ya no existe en el elenco (no debería pasar).
 */
export function reclamoMockToReclamo(reclamo: ReclamoMock, propiedades: readonly PropiedadMock[], usuarios: readonly UsuarioMock[]): Reclamo | null {
  const propiedad = propiedades.find((item) => item.id === reclamo.propertyId)
  if (!propiedad) return null
  return {
    id: reclamo.id,
    codigo: reclamo.id,
    propiedad: {
      id: propiedad.id,
      direccion: formatAddress(propiedad),
      barrio: propiedad.neighborhoodName,
      fotoSrc: mainPhotoSrc(propiedad) || null,
    },
    locador: persona(propiedad.ownerId, 'Locador', usuarios),
    locatario: persona(reclamo.tenantUserId, reclamo.tenantName, usuarios),
    tipo: reclamo.type,
    estado: reclamo.status,
    mensaje: reclamo.message,
    fotos: reclamo.photos.map((foto, index) => ({ id: `${reclamo.id}-foto-${index + 1}`, src: foto.src, nombre: foto.name })),
    creadoEl: reclamo.createdAt,
    enProcesoDesde: reclamo.inProgressAt,
    cerradoEl: reclamo.closedAt,
    // El chat del reclamo llega con la Tanda B.
    conversacionId: null,
  }
}
