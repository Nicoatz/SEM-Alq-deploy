/**
 * panel.service.ts — frontera con el backend para `/panel`, el inicio del
 * locador.
 *
 * Qué es: los bloques del panel que NO son propiedades: cobros del mes,
 * reclamos, contratos por vencer o ajustar y solicitudes nuevas (los conteos
 * de propiedades salen de `propiedades.service.ts#listarMisPropiedades`).
 * Cada bloque es una función aparte: si falla una, la pantalla muestra el
 * error solo en ese bloque (Claude Design, "Panel de inicio" · 03).
 * Cubre: sin US en Sprint 0 (mapa A3, inicio del locador). Los datos son de
 * módulos de sprints futuros (US-09 cobros, US-15 reclamos, US-36
 * solicitudes), así que en el back todavía no existe nada de esto.
 *
 * Cómo se calcula cada cifra en modo mock: ver los encabezados de
 * `lib/mocks/periodos.mock.ts` (cobros) y `lib/mocks/reclamos.mock.ts` (reclamos).
 * Quién lo usa: `app/(app)/panel/page.tsx` y el layout del panel (las filas
 * de "Viendo como" del UserMenu).
 */
import type {
  EventoContratoPanel,
  ReclamoPanel,
  ResumenCobros,
  ResumenContextoRol,
  ResumenReclamos,
  SolicitudPanel,
  UserRole,
} from '@rentar/shared-types'
import { propiedades as propiedadesElenco, type PropiedadMock } from '@/lib/mocks'
import { labelTipoReclamo } from '@/lib/reclamos/catalogo'
import { resumenDelMes } from '@/lib/cobros/resumenPanel'
import { diasHasta, hoy } from '@/lib/utils/fechas'
import { formatAddress } from './adapters/propiedad-mock.adapter'
import { readReclamosMock } from './adapters/reclamo-mock.adapter'
import { listarReclamos } from './reclamos.service'
import { filasDeLocador } from './cobros.service'
import { listarMisPropiedades } from './propiedades.service'
import { listarSolicitudesRecibidas, readSolicitudesMock } from './solicitudes.service'
import { USE_MOCKS } from './shared/config'
import { delay } from './shared/delay'
import { readMockCollection } from './shared/mockStore'
import { requireSessionUserId } from './shared/session'

/** Ventana de "Contratos por vencer o por ajustar · próximos 60 días". */
export const DIAS_EVENTOS_CONTRATO = 60

/** Cantidad de reclamos en "Reclamos recientes". */
const RECLAMOS_RECIENTES = 3

// ─── Helpers de la rama mock ────────────────────────────────────────────

/** Propiedades mock (elenco + las del alta) de un locador. */
function propiedadesDe(ownerId: string): PropiedadMock[] {
  return readMockCollection('propiedades', propiedadesElenco).filter((propiedad) => propiedad.ownerId === ownerId)
}

// ─── Bloques del panel ──────────────────────────────────────────────────

/**
 * Cobros del mes del locador en sesión: cobrado, total, vencidos y la lista
 * "Próximos cobros". Sale de los mismos períodos que `/panel/cobros`, con la
 * misma mora (decisión del PO, 05/11).
 * @backend GET /api/v1/cobros-locador/historial (existe), a través de `filasDeLocador`
 */
export async function getResumenCobros(): Promise<ResumenCobros> {
  return resumenDelMes(await filasDeLocador(), hoy().format('YYYY-MM-DD'))
}

/**
 * Arma el resumen del panel a partir de los reclamos del locador (US-15):
 * - "abiertos" son los que siguen sin cerrar (abierto o en proceso);
 * - "sin responder" son los abiertos: por US-18, la primera respuesta del
 *   locador los pasa a en proceso;
 * - los más recientes primero.
 * NOTA: el filtro de estado se hace acá y no con `?estado=`, que hoy no filtra
 * (P0 del issue #39).
 */
function resumenDeReclamos(todos: readonly ReclamoPanel[]): ResumenReclamos {
  const sinCerrar = todos.filter((reclamo) => reclamo.status === 'abierto' || reclamo.status === 'en_proceso')
  return {
    open: sinCerrar.length,
    unanswered: sinCerrar.filter((reclamo) => reclamo.status === 'abierto').length,
    recent: [...todos].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, RECLAMOS_RECIENTES),
  }
}

/**
 * Reclamos del locador en sesión: cuántos están abiertos, cuántos sin
 * responder y los más recientes. En mock salen de `reclamos.mock.ts` (más los
 * registrados en el navegador).
 * @backend GET /api/v1/reclamos?rol=locador   (existe; vía `reclamos.service#listarReclamos`)
 *          En vez del `GET /panel/reclamos` propuesto: no hace falta otra ruta.
 * NOTA: en real no hay fecha de la primera respuesta (R-9): `answeredAt` queda
 * en `null` y la fila dice "respondido" sin fecha.
 * @throws {ServiceError} `network` / `server` (el bloque muestra su error con Reintentar).
 */
export async function getResumenReclamos(): Promise<ResumenReclamos> {
  if (USE_MOCKS) {
    await delay(600)
    const propias = propiedadesDe(requireSessionUserId())
    const todos = readReclamosMock()
      .map((reclamo): ReclamoPanel | null => {
        const propiedad = propias.find((item) => item.id === reclamo.propertyId)
        if (!propiedad) return null
        return {
          id: reclamo.id,
          // Sin título (decisión del PO, 24/11): la fila muestra el tipo.
          title: labelTipoReclamo(reclamo.type),
          status: reclamo.status,
          propertyAddress: formatAddress(propiedad),
          tenantName: reclamo.tenantName,
          createdAt: reclamo.createdAt,
          // La primera respuesta del locador es la que lo pasó a en proceso (US-18).
          answeredAt: reclamo.inProgressAt,
        }
      })
      .filter((reclamo): reclamo is ReclamoPanel => reclamo !== null)
    return resumenDeReclamos(todos)
  }
  const reclamos = await listarReclamos('locador')
  return resumenDeReclamos(
    reclamos.map((reclamo) => ({
      id: reclamo.id,
      title: labelTipoReclamo(reclamo.tipo),
      status: reclamo.estado,
      propertyAddress: reclamo.propiedad.direccion,
      tenantName: reclamo.locatario.nombre,
      createdAt: reclamo.creadoEl,
      answeredAt: reclamo.enProcesoDesde,
    })),
  )
}

/**
 * Contratos del locador en sesión con un ajuste o un vencimiento en los
 * próximos 60 días. Si un contrato tiene los dos, va una sola vez, con el
 * evento más cercano (regla del diseño).
 * @backend GET /api/v1/panel/contratos?dias=60   (no existe — propuesto) → EventoContratoPanel[]
 * TODO(backend): crear la ruta cuando exista el módulo de contratos (US-05 a US-07).
 * NOTA: en modo real devuelve vacío en vez de llamar a una ruta que no
 * existe: así el panel muestra su estado vacío y no un error.
 */
export async function getEventosContratos(): Promise<EventoContratoPanel[]> {
  if (USE_MOCKS) {
    await delay(700)
    const eventos: EventoContratoPanel[] = []
    for (const propiedad of propiedadesDe(requireSessionUserId())) {
      const { rental } = propiedad
      if (!rental) continue
      const candidatos: EventoContratoPanel[] = [
        {
          contractId: rental.contractId,
          propertyAddress: formatAddress(propiedad),
          tenantName: rental.tenantName,
          kind: 'ajuste',
          date: rental.nextAdjustmentDate,
          contractStatus: rental.contractStatus,
          index: propiedad.adjustmentIndex,
          everyMonths: propiedad.adjustmentEveryMonths,
          currentAmount: rental.currentAmount,
        },
        {
          contractId: rental.contractId,
          propertyAddress: formatAddress(propiedad),
          tenantName: rental.tenantName,
          kind: 'vencimiento',
          date: rental.endDate,
          contractStatus: rental.contractStatus,
          index: null,
          everyMonths: null,
          currentAmount: rental.currentAmount,
        },
      ]
      const proximo = candidatos
        .filter((evento) => {
          const dias = diasHasta(evento.date)
          return dias >= 0 && dias <= DIAS_EVENTOS_CONTRATO
        })
        .sort((a, b) => a.date.localeCompare(b.date))[0]
      if (proximo) eventos.push(proximo)
    }
    return eventos.sort((a, b) => a.date.localeCompare(b.date))
  }
  // TODO(backend): cuando exista la ruta:
  // return apiRequest<EventoContratoPanel[]>('/panel/contratos', { query: { dias: DIAS_EVENTOS_CONTRATO } })
  return []
}

/**
 * Solicitudes de alquiler pendientes sobre las propiedades del locador en
 * sesión (las "cosas para resolver" del saludo).
 * @backend GET /api/v1/solicitudes/recibidas?estado=pendiente   (existe · rol locador, US-36) → SolicitudResponse[]
 *          vía `solicitudes.service#listarSolicitudesRecibidas` (adaptador y
 *          errores traducidos de una sola vez).
 * @returns SolicitudPanel[] con el nombre del postulante, la dirección EXACTA
 *   (son sus propiedades) y la fecha. Sin datos sensibles.
 * NOTA: en modo mock también cuenta las solicitudes enviadas en el navegador
 * (`rentar:mock:solicitudes`).
 */
export async function getSolicitudesPendientes(): Promise<SolicitudPanel[]> {
  if (USE_MOCKS) {
    await delay(500)
    const propias = propiedadesDe(requireSessionUserId())
    return readSolicitudesMock()
      .filter((solicitud) => solicitud.status === 'pendiente')
      .map((solicitud): SolicitudPanel | null => {
        const propiedad = propias.find((item) => item.id === solicitud.propertyId)
        if (!propiedad) return null
        return {
          id: solicitud.id,
          applicantName: solicitud.applicantName,
          propertyAddress: formatAddress(propiedad),
          createdAt: solicitud.createdAt,
        }
      })
      .filter((solicitud): solicitud is SolicitudPanel => solicitud !== null)
  }
  const pendientes = await listarSolicitudesRecibidas({ estado: 'pendiente' })
  return pendientes.map((solicitud) => ({
    id: solicitud.id,
    applicantName: solicitud.applicant.fullName,
    propertyAddress: solicitud.property.address,
    createdAt: solicitud.createdAt,
  }))
}

// ─── "Viendo como" (Cambio de rol · 04) ─────────────────────────────────

/** "1 propiedad" / "7 propiedades". */
function contarTexto(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`
}

/**
 * Una fila de "Viendo como" por cada rol con panel del usuario en sesión:
 * qué tiene en cada rol y cuántas cosas pendientes (el contador rojo que se
 * ve cuando ese rol no es el activo).
 * @backend GET /api/v1/usuarios/me/contextos   (no existe — propuesto) → ResumenContextoRol[]
 * TODO(backend): crear la ruta. Mientras tanto, en modo real se arma acá:
 * la cantidad de propiedades sale del `/mis-alquileres` real
 * (`listarMisPropiedades`); cobros vencidos y contratos del locatario no
 * existen todavía, así que no se cuentan.
 */
export async function getResumenRoles(roles: UserRole[]): Promise<ResumenContextoRol[]> {
  if (USE_MOCKS) {
    await delay(300)
    const userId = requireSessionUserId()
    const resumen: ResumenContextoRol[] = []
    if (roles.includes('locador')) {
      const propias = propiedadesDe(userId)
      const { overdueCount: vencidos } = resumenDelMes(await filasDeLocador(), hoy().format('YYYY-MM-DD'))
      const partes = [contarTexto(propias.length, 'propiedad', 'propiedades')]
      if (vencidos > 0) partes.push(contarTexto(vencidos, 'cobro vencido', 'cobros vencidos'))
      resumen.push({ role: 'locador', description: partes.join(' · '), pendingCount: vencidos })
    }
    if (roles.includes('locatario')) {
      const alquiladas = readMockCollection('propiedades', propiedadesElenco).filter((propiedad) => propiedad.rental?.tenantUserId === userId)
      const description = alquiladas[0]
        ? `${alquiladas[0].street} ${alquiladas[0].streetNumber} · ${contarTexto(alquiladas.length, 'contrato', 'contratos')}`
        : 'Sin contratos todavía'
      resumen.push({ role: 'locatario', description, pendingCount: 0 })
    }
    return resumen
  }
  const resumen: ResumenContextoRol[] = []
  if (roles.includes('locador')) {
    const propias = await listarMisPropiedades()
    resumen.push({ role: 'locador', description: contarTexto(propias.length, 'propiedad', 'propiedades'), pendingCount: 0 })
  }
  if (roles.includes('locatario')) {
    resumen.push({ role: 'locatario', description: 'Sin contratos todavía', pendingCount: 0 })
  }
  return resumen
}
