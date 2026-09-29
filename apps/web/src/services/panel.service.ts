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
 * Cómo se calcula cada cifra en modo mock: ver el encabezado de
 * `lib/mocks/panel.mock.ts`.
 * Quién lo usa: `app/(app)/panel/page.tsx` y el layout del panel (las filas
 * de "Viendo como" del UserMenu).
 */
import type {
  CobroPanel,
  EventoContratoPanel,
  ReclamoPanel,
  ResumenCobros,
  ResumenContextoRol,
  ResumenReclamos,
  SolicitudPanel,
  UserRole,
} from '@rentar/shared-types'
import { cobros as cobrosElenco, propiedades as propiedadesElenco, reclamos as reclamosElenco, solicitudes as solicitudesElenco, type PropiedadMock } from '@/lib/mocks'
import { diasHasta, hoy } from '@/lib/utils/fechas'
import { formatAddress } from './adapters/propiedad-mock.adapter'
import { listarMisPropiedades } from './propiedades.service'
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

/** Orden del diseño para "Próximos cobros": vencidos, pendientes por fecha, pagados al final. */
function ordenCobro(cobro: CobroPanel): number {
  return cobro.status === 'vencido' ? 0 : cobro.status === 'pendiente' ? 1 : 2
}

/** Cobros del período de las propiedades de un locador, ya como `CobroPanel`. */
function cobrosDe(ownerId: string): CobroPanel[] {
  const propias = propiedadesDe(ownerId)
  return cobrosElenco
    .map((cobro): CobroPanel | null => {
      const propiedad = propias.find((item) => item.id === cobro.propertyId)
      if (!propiedad?.rental) return null
      const vencido = !cobro.paidAt && diasHasta(cobro.dueDate) < 0
      return {
        id: cobro.id,
        propertyId: propiedad.id,
        propertyAddress: formatAddress(propiedad),
        tenantName: propiedad.rental.tenantName,
        amount: cobro.amount,
        dueDate: cobro.dueDate,
        status: cobro.paidAt ? 'pagado' : vencido ? 'vencido' : 'pendiente',
        paidAt: cobro.paidAt,
      }
    })
    .filter((cobro): cobro is CobroPanel => cobro !== null)
    .sort((a, b) => ordenCobro(a) - ordenCobro(b) || a.dueDate.localeCompare(b.dueDate))
}

// ─── Bloques del panel ──────────────────────────────────────────────────

/**
 * Cobros del mes del locador en sesión: cobrado, total, vencidos y la lista
 * "Próximos cobros".
 * @backend GET /api/v1/panel/cobros   (no existe — propuesto) → ResumenCobros
 * TODO(backend): crear la ruta cuando exista el módulo de cobros (US-08/US-09).
 * NOTA: en modo real devuelve vacío en vez de llamar a una ruta que no
 * existe: así el panel muestra su estado vacío y no un error.
 */
export async function getResumenCobros(): Promise<ResumenCobros> {
  if (USE_MOCKS) {
    await delay(500)
    const items = cobrosDe(requireSessionUserId())
    const vencidos = items.filter((cobro) => cobro.status === 'vencido')
    return {
      // El período de los cobros del elenco (septiembre de 2026).
      month: cobrosElenco[0]?.period ?? hoy().format('YYYY-MM'),
      collected: items.filter((cobro) => cobro.status === 'pagado').reduce((total, cobro) => total + cobro.amount, 0),
      total: items.reduce((total, cobro) => total + cobro.amount, 0),
      overdueAmount: vencidos.reduce((total, cobro) => total + cobro.amount, 0),
      overdueCount: vencidos.length,
      items,
    }
  }
  // TODO(backend): cuando exista la ruta: return apiRequest<ResumenCobros>('/panel/cobros')
  return { month: hoy().format('YYYY-MM'), collected: 0, total: 0, overdueAmount: 0, overdueCount: 0, items: [] }
}

/**
 * Reclamos del locador en sesión: cuántos están abiertos, cuántos sin
 * responder y los más recientes.
 * @backend GET /api/v1/panel/reclamos   (no existe — propuesto) → ResumenReclamos
 * TODO(backend): crear la ruta cuando exista el módulo de reclamos (US-14 a US-18).
 * NOTA: en modo real devuelve vacío en vez de llamar a una ruta que no
 * existe: así el panel muestra su estado vacío y no un error.
 */
export async function getResumenReclamos(): Promise<ResumenReclamos> {
  if (USE_MOCKS) {
    await delay(600)
    const propias = propiedadesDe(requireSessionUserId())
    const todos = reclamosElenco
      .map((reclamo): ReclamoPanel | null => {
        const propiedad = propias.find((item) => item.id === reclamo.propertyId)
        if (!propiedad?.rental) return null
        return {
          id: reclamo.id,
          title: reclamo.title,
          status: reclamo.status,
          propertyAddress: formatAddress(propiedad),
          tenantName: propiedad.rental.tenantName,
          createdAt: reclamo.createdAt,
          answeredAt: reclamo.answeredAt,
        }
      })
      .filter((reclamo): reclamo is ReclamoPanel => reclamo !== null)
    const abiertos = todos.filter((reclamo) => reclamo.status === 'abierto' || reclamo.status === 'en_proceso')
    return {
      open: abiertos.length,
      unanswered: abiertos.filter((reclamo) => !reclamo.answeredAt).length,
      recent: [...todos].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECLAMOS_RECIENTES),
    }
  }
  // TODO(backend): cuando exista la ruta: return apiRequest<ResumenReclamos>('/panel/reclamos')
  return { open: 0, unanswered: 0, recent: [] }
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
 * @backend GET /api/v1/solicitudes?estado=pendiente   (no existe — propuesto, US-36) → SolicitudPanel[]
 * TODO(backend): crear la ruta con el módulo de solicitudes (US-35 a US-38).
 * NOTA: en modo real devuelve vacío en vez de llamar a una ruta que no
 * existe: así el panel muestra su estado vacío y no un error.
 */
export async function getSolicitudesPendientes(): Promise<SolicitudPanel[]> {
  if (USE_MOCKS) {
    await delay(500)
    const propias = propiedadesDe(requireSessionUserId())
    return solicitudesElenco
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
  // TODO(backend): cuando exista la ruta:
  // return apiRequest<SolicitudPanel[]>('/solicitudes', { query: { estado: 'pendiente' } })
  return []
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
      const vencidos = cobrosDe(userId).filter((cobro) => cobro.status === 'vencido').length
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
