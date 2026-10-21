/**
 * contrato-mock.adapter.ts — los contratos del modo mock, en un solo lugar.
 *
 * Qué es: lee y guarda los contratos del elenco y los que se crean en el
 * navegador, y responde las preguntas que hacen otras pantallas sobre ellos
 * (¿esta solicitud ya originó un contrato?, ¿esta propiedad tiene uno
 * activo?, ¿este usuario es parte de un contrato vigente o pendiente?). Así
 * el listado, "Iniciar contrato" y el bloqueo de identidad del perfil
 * (US-21) usan la misma fuente y nunca se contradicen.
 *
 * Dos fuentes, sin duplicar:
 * - Los vigentes del elenco salen de `propiedades.mock.ts` (`rental`).
 * - El resto (CT-2026-0207, CT-2023-0041 y los borradores del navegador)
 *   sale de `contratos.mock.ts` + `rentar:mock:contratos`.
 *
 * NOTA (datos sensibles, mismo criterio que la tanda 1): el DNI de los
 * garantes que se cargan en el navegador vive SOLO en memoria
 * (`dniGarantesEnMemoria`): en `localStorage` el garante se guarda sin DNI.
 * Sobrevive a la navegación dentro del panel, no a una recarga: al recargar,
 * el borrador pide el DNI de nuevo. El DNI de las partes no se guarda en el
 * contrato: se lee del perfil al abrirlo.
 *
 * US-07 (tanda 3): las firmas y el historial viven en el mismo registro
 * (`firmas`, `eventos`). Cuando firman las dos partes, este adaptador
 * refleja lo que en real hace el back ({@link pasarAVigenteMock}): la
 * propiedad pasa a alquilada y sus solicitudes pendientes, a rechazadas.
 *
 * Cubre: US-05 Registrar contrato de alquiler, US-07 Firmar contrato de
 * alquiler (y US-21, el bloqueo).
 * Quién lo usa: la rama mock de `contratos.service.ts`, `solicitudes.service.ts`
 * y `perfil.service.ts`. Nunca las pantallas.
 */
import type { ContractStatus, ContratoDeSolicitud, ContratoResumen, IndiceContrato, PeriodicidadAjuste, RolFirmante, TipoEventoContrato } from '@rentar/shared-types'
import {
  contratos as contratosElenco,
  propiedades as propiedadesElenco,
  solicitudes as solicitudesElenco,
  type ContratoMock,
  type EventoMock,
  type FirmaMock,
  type PropiedadMock,
} from '@/lib/mocks'
import { fechaFin, fechaPrimerAjuste, MESES_POR_PERIODO, proximoAjuste } from '@/lib/contratos/fechas'
import { momentoActual } from '@/lib/utils/fechas'
import { deleteMockRecord, readMockCollection, saveMockRecord } from '../shared/mockStore'
import { formatAddress } from './propiedad-mock.adapter'

// ─── Lectura y guardado ─────────────────────────────────────────────────

/** DNI de los garantes cargados en el navegador, por contrato y garante (ver la NOTA del encabezado). */
const dniGarantesEnMemoria = new Map<string, Map<string, string>>()

/** Las propiedades del modo mock (elenco + navegador), sin las eliminadas. */
export function readPropiedadesContratoMock(): PropiedadMock[] {
  return readMockCollection('propiedades', propiedadesElenco).filter((propiedad) => !propiedad.deletedAt)
}

/** Los contratos guardados (elenco + navegador), con el DNI de los garantes que está en memoria. */
export function readContratosMock(): ContratoMock[] {
  return readMockCollection('contratos', contratosElenco).map((contrato) => {
    const enMemoria = dniGarantesEnMemoria.get(contrato.id)
    if (!enMemoria) return contrato
    return { ...contrato, garantes: contrato.garantes.map((garante) => ({ ...garante, dni: enMemoria.get(garante.key) ?? garante.dni })) }
  })
}

/**
 * Guarda un contrato en `rentar:mock:contratos` SIN el DNI de los garantes
 * (queda en memoria). Devuelve `false` si `localStorage` está lleno o bloqueado.
 */
export function guardarContratoMock(contrato: ContratoMock): boolean {
  dniGarantesEnMemoria.set(contrato.id, new Map(contrato.garantes.map((garante) => [garante.key, garante.dni])))
  return saveMockRecord('contratos', { ...contrato, garantes: contrato.garantes.map((garante) => ({ ...garante, dni: '' })) })
}

/** Borra un borrador del navegador. */
export function eliminarContratoMock(id: string): boolean {
  dniGarantesEnMemoria.delete(id)
  return deleteMockRecord('contratos', id)
}

// ─── Contratos activos ──────────────────────────────────────────────────

/** Estados que bloquean otro contrato y la identidad de las partes (US-05, US-21). */
const ESTADOS_ACTIVOS: readonly ContractStatus[] = ['vigente', 'pendiente_firma']

/**
 * El contrato que originó una solicitud (US-05: "una solicitud aceptada
 * puede originar un solo contrato"), o `null`.
 */
export function contratoDeSolicitudMock(solicitudId: string): ContratoDeSolicitud | null {
  const contrato = readContratosMock().find((item) => item.solicitudId === solicitudId)
  return contrato ? { id: contrato.id, status: contrato.status } : null
}

/**
 * `true` si la propiedad tiene un contrato vigente o pendiente de firma
 * (US-05: "la propiedad no debe tener un contrato vigente ni pendiente de
 * firma"). `exceptoId` deja afuera al contrato que se está editando.
 */
export function propiedadConContratoActivoMock(propertyId: string, exceptoId?: string): boolean {
  const propiedad = readPropiedadesContratoMock().find((item) => item.id === propertyId)
  if (propiedad?.rental && ESTADOS_ACTIVOS.includes(propiedad.rental.contractStatus)) return true
  return readContratosMock().some((item) => item.propertyId === propertyId && item.id !== exceptoId && ESTADOS_ACTIVOS.includes(item.status))
}

/**
 * Un contrato vigente o pendiente de firma del que el usuario es parte, como
 * locador o como locatario (US-21: bloquea nombre, apellido y DNI). Mira las
 * dos fuentes. `null` si no hay ninguno.
 */
export function contratoActivoDeUsuarioMock(userId: string): { code: string; status: 'vigente' | 'pendiente_firma' } | null {
  for (const propiedad of readPropiedadesContratoMock()) {
    const { rental } = propiedad
    if (!rental || !ESTADOS_ACTIVOS.includes(rental.contractStatus)) continue
    if (propiedad.ownerId === userId || rental.tenantUserId === userId) {
      return { code: rental.contractId, status: rental.contractStatus as 'vigente' | 'pendiente_firma' }
    }
  }
  const contrato = readContratosMock().find((item) => ESTADOS_ACTIVOS.includes(item.status) && (item.ownerId === userId || item.tenantUserId === userId))
  return contrato?.code ? { code: contrato.code, status: contrato.status as 'vigente' | 'pendiente_firma' } : null
}

// ─── Código CT-AAAA-NNNN ────────────────────────────────────────────────

/**
 * El próximo código libre del año (US-05: "recibe un código con formato
 * CT-AAAA-NNNN"). En mock: el número más alto de ese año entre todos los
 * contratos conocidos, más uno. En real lo genera el back.
 */
export function siguienteCodigoMock(anio: number): string {
  const prefijo = `CT-${anio}-`
  const codigos = [
    ...readContratosMock().map((item) => item.code),
    ...readPropiedadesContratoMock().map((item) => item.rental?.contractId ?? null),
  ].filter((codigo): codigo is string => Boolean(codigo?.startsWith(prefijo)))
  const maximo = codigos.reduce((max, codigo) => Math.max(max, Number(codigo.slice(prefijo.length)) || 0), 0)
  return `${prefijo}${String(maximo + 1).padStart(4, '0')}`
}

// ─── Al listado (ContratoResumen) ───────────────────────────────────────

/** Cada cuántos meses → periodicidad del contrato (`null` si no es 3, 6 o 12). */
function periodicidadDeMeses(meses: number | null): PeriodicidadAjuste | null {
  if (meses === 3) return 'trimestral'
  if (meses === 6) return 'semestral'
  if (meses === 12) return 'anual'
  return null
}

/**
 * Un vigente del elenco (`propiedad.rental`) → fila del listado. El monto y
 * el próximo ajuste salen de `rental` (los mismos que muestran Mis
 * propiedades y el panel); el índice, de la publicación.
 */
function resumenDeAlquiler(propiedad: PropiedadMock): ContratoResumen | null {
  const { rental } = propiedad
  if (!rental) return null
  return {
    id: rental.contractId,
    code: rental.contractId,
    status: rental.contractStatus,
    propertyId: propiedad.id,
    propertyAddress: formatAddress(propiedad),
    neighborhoodName: propiedad.neighborhoodName,
    tenantName: rental.tenantName,
    currentAmount: rental.currentAmount,
    startDate: rental.startDate,
    endDate: rental.endDate,
    adjustmentIndex: propiedad.adjustmentIndex ?? 'sin_ajuste',
    nextAdjustmentDate: rental.contractStatus === 'vigente' ? rental.nextAdjustmentDate : null,
    solicitudId: null,
  }
}

/** Un contrato guardado → fila del listado. `nombreLocatario` resuelve el nombre de las cuentas del elenco. */
function resumenDeContrato(contrato: ContratoMock, propiedad: PropiedadMock | undefined, nombreLocatario: string, hoyIso: string): ContratoResumen {
  const { condiciones } = contrato
  const indice: IndiceContrato = condiciones.adjustmentIndex
  const terminado = contrato.status === 'finalizado' || contrato.status === 'rescindido'
  return {
    id: contrato.id,
    code: contrato.code,
    status: contrato.status,
    propertyId: contrato.propertyId,
    propertyAddress: propiedad ? formatAddress(propiedad) : '',
    neighborhoodName: propiedad?.neighborhoodName ?? '',
    tenantName: nombreLocatario,
    // NOTA: los ajustes no se calculan en mock: el monto actual es el inicial.
    currentAmount: condiciones.initialAmount,
    startDate: condiciones.startDate,
    endDate: fechaFin(condiciones.startDate, condiciones.durationMonths),
    adjustmentIndex: indice,
    nextAdjustmentDate: terminado ? null : proximoAjuste(condiciones.startDate, condiciones.durationMonths, indice, condiciones.adjustmentPeriod, hoyIso),
    solicitudId: contrato.solicitudId,
  }
}

/**
 * Todos los contratos de un locador para el listado (US-05): los vigentes
 * del elenco y los guardados. Sin ordenar (lo hace `lib/contratos/listado.ts`).
 * @param nombreDe Resuelve "Nombre Apellido" de una cuenta del elenco por su id.
 */
export function contratosDeLocadorMock(ownerId: string, nombreDe: (userId: string) => string | null, hoyIso: string): ContratoResumen[] {
  const propiedades = readPropiedadesContratoMock()
  const deAlquileres = propiedades
    .filter((propiedad) => propiedad.ownerId === ownerId)
    .map(resumenDeAlquiler)
    .filter((item): item is ContratoResumen => item !== null)
  const guardados = readContratosMock().filter((contrato) => contrato.ownerId === ownerId)
  // Un contrato que pasó a vigente en el navegador también está en `rental`: se lista una sola vez.
  const codigosGuardados = new Set(guardados.map((contrato) => contrato.code))
  const deAlquileresSinRepetir = deAlquileres.filter((item) => !codigosGuardados.has(item.id))
  const filasGuardadas = guardados
    .map((contrato) => {
      const propiedad = propiedades.find((item) => item.id === contrato.propertyId)
      const nombre = (contrato.tenantUserId && nombreDe(contrato.tenantUserId)) || contrato.tenantName
      return resumenDeContrato(contrato, propiedad, nombre, hoyIso)
    })
  return [...deAlquileresSinRepetir, ...filasGuardadas]
}

/** Periodicidad de la publicación, para precargar el paso 2. */
export function periodicidadDePublicacion(propiedad: Pick<PropiedadMock, 'adjustmentEveryMonths'>): PeriodicidadAjuste | null {
  return periodicidadDeMeses(propiedad.adjustmentEveryMonths)
}

/**
 * Fecha y hora ISO REALES de un hecho nuevo en mock (borradores, envíos,
 * firmas, rechazos, cancelaciones y reenvíos; ver `momentoActual`).
 */
export function ahoraIsoMock(): string {
  return momentoActual().format('YYYY-MM-DDTHH:mm:ss')
}

// ─── Firmas e historial (US-07) ─────────────────────────────────────────

/** Las dos firmas al enviar a firmar: pendientes e invitadas en ese momento. */
export function firmasAlEnviar(fecha: string): Record<RolFirmante, FirmaMock> {
  const pendiente: FirmaMock = { estado: 'pendiente', firmadoEl: null, rechazadoEl: null, motivoRechazo: null, ultimaInvitacion: fecha }
  return { locador: { ...pendiente }, locatario: { ...pendiente } }
}

/**
 * El historial guardado. Los contratos guardados antes de la tanda 3 no lo
 * tienen: se arma con lo que sí hay (`createdAt` y `sentAt`).
 */
export function eventosDe(contrato: ContratoMock): EventoMock[] {
  if (contrato.eventos) return contrato.eventos
  const eventos: EventoMock[] = [{ id: `ev-${contrato.id}-1`, tipo: 'creado', fecha: contrato.createdAt, rol: null, motivo: null }]
  if (contrato.sentAt) eventos.push({ id: `ev-${contrato.id}-2`, tipo: 'enviado', fecha: contrato.sentAt, rol: null, motivo: null })
  return eventos
}

/** El historial con un evento nuevo al final. */
export function conEvento(contrato: ContratoMock, tipo: TipoEventoContrato, fecha: string, rol: RolFirmante | null = null, motivo: string | null = null): EventoMock[] {
  const actuales = eventosDe(contrato)
  return [...actuales, { id: `ev-${contrato.id}-${actuales.length + 1}`, tipo, fecha, rol, motivo }]
}

/** US-07: "un mensaje automático de que la propiedad ya fue alquilada" (va en `mensaje_rechazo`). */
export const MENSAJE_PROPIEDAD_ALQUILADA = 'La propiedad ya fue alquilada.'

/**
 * Lo que pasa cuando el contrato queda vigente (US-07), como lo haría el back:
 * - la propiedad pasa a `alquilada` (sin "Disponible desde": deja de
 *   aparecer en `/buscar`) y gana su `rental`, así Mis propiedades, el panel
 *   y el bloqueo del perfil la leen como las alquiladas del elenco;
 * - sus solicitudes pendientes pasan a `rechazada` con
 *   {@link MENSAJE_PROPIEDAD_ALQUILADA}.
 * @returns `false` si `localStorage` está lleno o bloqueado.
 */
export function pasarAVigenteMock(contrato: ContratoMock, fecha: string): boolean {
  const propiedad = readPropiedadesContratoMock().find((item) => item.id === contrato.propertyId)
  if (!propiedad || !contrato.code) return false
  const { condiciones } = contrato
  const inicio = condiciones.startDate ?? fecha.slice(0, 10)
  const fin = fechaFin(inicio, condiciones.durationMonths) ?? inicio
  const indice = condiciones.adjustmentIndex
  const conIndiceDeLaPublicacion = indice === 'ICL' || indice === 'IPC'
  const guardoPropiedad = saveMockRecord('propiedades', {
    ...propiedad,
    status: 'alquilada',
    availableFrom: null,
    // El panel calcula los ajustes con el índice y la periodicidad de la propiedad: se toman los del contrato.
    ...(conIndiceDeLaPublicacion && condiciones.adjustmentPeriod
      ? { adjustmentIndex: indice, adjustmentEveryMonths: MESES_POR_PERIODO[condiciones.adjustmentPeriod] }
      : {}),
    rental: {
      contractId: contrato.code,
      contractStatus: 'vigente',
      tenantName: contrato.tenantName,
      tenantUserId: contrato.tenantUserId,
      startDate: inicio,
      endDate: fin,
      currentAmount: condiciones.initialAmount ?? 0,
      // NOTA: `rental` pide una fecha; sin ajuste (o CAC), el panel muestra el vencimiento.
      nextAdjustmentDate: fechaPrimerAjuste(inicio, condiciones.durationMonths, indice, condiciones.adjustmentPeriod) ?? fin,
    },
  })
  if (!guardoPropiedad) return false
  const pendientes = readMockCollection('solicitudes', solicitudesElenco).filter(
    (solicitud) => solicitud.propertyId === contrato.propertyId && solicitud.status === 'pendiente',
  )
  return pendientes.every((solicitud) =>
    saveMockRecord('solicitudes', { ...solicitud, status: 'rechazada', respondedAt: fecha, rejectionMessage: MENSAJE_PROPIEDAD_ALQUILADA }),
  )
}
