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
 * US-07: las firmas viven en el mismo registro (`firmas`): locador, locatario
 * y una por garante. Cuando firman todos, este adaptador refleja lo que en
 * real hace el back ({@link pasarAVigenteMock}): la propiedad pasa a alquilada
 * y sus solicitudes pendientes, a rechazadas. Rechazar vuelve el contrato a
 * borrador ({@link rechazoMock}).
 * La firma en DocuSign se simula en `/simulador-firma`: la firma no se registra
 * en el momento sino unos segundos después ({@link registrarFirmaDiferidaMock}),
 * como el aviso de DocuSign al back. Ver "Firmas diferidas" más abajo.
 *
 * Cubre: US-05 Registrar contrato de alquiler, US-07 Firmar contrato de
 * alquiler, US-27 Consultar mis alquileres (y US-21, el bloqueo).
 * Quién lo usa: la rama mock de `contratos.service.ts`, `solicitudes.service.ts`
 * y `perfil.service.ts`. Nunca las pantallas.
 */
import type { AlquilerResumen, ContractStatus, ContratoDeSolicitud, ContratoResumen, IndiceContrato, PdfContrato, PeriodicidadAjuste } from '@rentar/shared-types'
import {
  contratos as contratosElenco,
  propiedades as propiedadesElenco,
  solicitudes as solicitudesElenco,
  type ContratoMock,
  type FirmaMock,
  type FirmasMock,
  type PropiedadMock,
} from '@/lib/mocks'
import { fechaFin, fechaPrimerAjuste, MESES_POR_PERIODO, proximoAjuste } from '@/lib/contratos/fechas'
import { ahoraIso } from '@/lib/utils/fechas'
import { deleteMockRecord, readMockCollection, saveMockRecord } from '../shared/mockStore'
import { formatAddress } from './propiedad-mock.adapter'

// ─── Lectura y guardado ─────────────────────────────────────────────────

/** DNI de los garantes cargados en el navegador, por contrato y garante (ver la NOTA del encabezado). */
const dniGarantesEnMemoria = new Map<string, Map<string, string>>()

/** El PDF ficticio del elenco (`public/mocks/`). Sin datos reales. */
export const PDF_FICTICIO_URL = '/mocks/contrato-ficticio.pdf'

/** URL de los PDF subidos en esta visita: el archivo no entra en `localStorage`. */
const pdfsEnMemoria = new Map<string, string>()

/** Recuerda el archivo subido hasta recargar; después se ve el PDF ficticio. */
export function recordarPdfMock(contratoId: string, archivo: Blob): void {
  const anterior = pdfsEnMemoria.get(contratoId)
  if (anterior) URL.revokeObjectURL(anterior)
  pdfsEnMemoria.set(contratoId, URL.createObjectURL(archivo))
}

/** El PDF de un contrato del elenco o del navegador; `null` si no tiene. */
export function pdfDeContratoMock(contrato: Pick<ContratoMock, 'id' | 'pdf'>): PdfContrato | null {
  if (!contrato.pdf) return null
  return { ...contrato.pdf, url: pdfsEnMemoria.get(contrato.id) ?? PDF_FICTICIO_URL }
}

/** Las propiedades del modo mock (elenco + navegador), sin las eliminadas. */
export function readPropiedadesContratoMock(): PropiedadMock[] {
  return readMockCollection('propiedades', propiedadesElenco).filter((propiedad) => !propiedad.deletedAt)
}

/** Los contratos guardados (elenco + navegador), con el DNI de los garantes que está en memoria. */
export function readContratosMock(): ContratoMock[] {
  return readMockCollection('contratos', contratosElenco).filter((contrato) => !contrato.descartado).map((guardado) => {
    const contrato = conFirmasActualesMock(guardado)
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

/**
 * Devuelve a pendiente la solicitud de un borrador descartado, como
 * `descartar_borrador_contrato`: sin respuesta ni motivo de rechazo.
 */
function solicitudAPendienteMock(solicitudId: string | null): boolean {
  const solicitud = readMockCollection('solicitudes', solicitudesElenco).find((item) => item.id === solicitudId)
  return solicitud ? saveMockRecord('solicitudes', { ...solicitud, status: 'pendiente', respondedAt: null, rejectionMessage: null }) : true
}

/**
 * Borra un borrador del navegador. Uno sembrado queda marcado `descartado`: el
 * elenco no se puede borrar, y "Reiniciar datos de prueba" lo vuelve a traer.
 * NOTA: la solicitud vuelve a pendiente, como en el back (decisión del PO,
 * HANDOFF §7, S4-11): para iniciar otro contrato hay que aceptarla de nuevo.
 */
export function eliminarContratoMock(id: string): boolean {
  const solicitudId = readContratosMock().find((contrato) => contrato.id === id)?.solicitudId ?? null
  dniGarantesEnMemoria.delete(id)
  const sembrado = contratosElenco.find((contrato) => contrato.id === id)
  const eliminado = sembrado ? saveMockRecord('contratos', { ...sembrado, descartado: true }) : deleteMockRecord('contratos', id)
  return eliminado && solicitudAPendienteMock(solicitudId)
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
    nextAdjustmentDate: rental.contractStatus === 'vigente' && propiedad.adjustmentIndex ? rental.nextAdjustmentDate : null,
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

/**
 * Los contratos de un usuario como LOCATARIO para Mis alquileres (US-27):
 * los del elenco (`rental`) y los guardados, en los estados pedidos y sin
 * repetir, con el nombre del locador. Sin ordenar.
 * @param nombreDe Resuelve "Nombre Apellido" de una cuenta del elenco por su id.
 */
export function contratosDeLocatarioMock(
  userId: string,
  nombreDe: (userId: string) => string | null,
  hoyIso: string,
  estados: readonly ContractStatus[],
): AlquilerResumen[] {
  const propiedades = readPropiedadesContratoMock()
  const guardados = readContratosMock().filter((contrato) => contrato.tenantUserId === userId && estados.includes(contrato.status))
  const codigosGuardados = new Set(guardados.map((contrato) => contrato.code))
  const deAlquileres = propiedades
    .filter((propiedad) => propiedad.rental?.tenantUserId === userId && estados.includes(propiedad.rental.contractStatus))
    .map((propiedad) => {
      const resumen = resumenDeAlquiler(propiedad)
      return resumen ? { ...resumen, landlordName: nombreDe(propiedad.ownerId) ?? '' } : null
    })
    .filter((item): item is AlquilerResumen => item !== null && !codigosGuardados.has(item.id))
  const filasGuardadas = guardados.map((contrato) => {
    const propiedad = propiedades.find((item) => item.id === contrato.propertyId)
    const nombre = (contrato.tenantUserId && nombreDe(contrato.tenantUserId)) || contrato.tenantName
    return { ...resumenDeContrato(contrato, propiedad, nombre, hoyIso), landlordName: nombreDe(contrato.ownerId) ?? '' }
  })
  return [...deAlquileres, ...filasGuardadas]
}

/** Periodicidad de la publicación, para precargar el paso 2. */
export function periodicidadDePublicacion(propiedad: Pick<PropiedadMock, 'adjustmentEveryMonths'>): PeriodicidadAjuste | null {
  return periodicidadDeMeses(propiedad.adjustmentEveryMonths)
}

/**
 * Fecha y hora ISO de un hecho nuevo en mock (borradores, envíos, firmas,
 * rechazos y cancelaciones): el reloj único (`lib/utils/fechas.ts#ahora`).
 */
export function ahoraIsoMock(): string {
  return ahoraIso()
}

// ─── Firmas (US-07) ─────────────────────────────────────────────────────

/** Una firma que todavía no se hizo. */
const FIRMA_PENDIENTE: FirmaMock = { estado: 'pendiente', firmadoEl: null, rechazadoEl: null, motivoRechazo: null }

/** Las firmas al enviar a firmar (US-07): todas pendientes, una por garante. */
export function firmasAlEnviar(cantidadGarantes: number): FirmasMock {
  return {
    locador: { ...FIRMA_PENDIENTE },
    locatario: { ...FIRMA_PENDIENTE },
    garantes: Array.from({ length: cantidadGarantes }, () => ({ ...FIRMA_PENDIENTE })),
  }
}

/**
 * Un contrato guardado antes del 11/11 tiene las firmas de las dos partes sin
 * los garantes (y con `ultimaInvitacion`). Se le suman los garantes pendientes,
 * así un navegador con datos viejos sigue funcionando sin reiniciar.
 */
function conFirmasActualesMock(contrato: ContratoMock): ContratoMock {
  const { firmas } = contrato
  // NOTA: el tipo dice que `garantes` siempre está; en datos viejos del navegador, no.
  if (!firmas || Array.isArray(firmas.garantes)) return contrato
  const limpia = ({ estado, firmadoEl, rechazadoEl, motivoRechazo }: FirmaMock): FirmaMock => ({ estado, firmadoEl, rechazadoEl, motivoRechazo })
  return {
    ...contrato,
    firmas: { locador: limpia(firmas.locador), locatario: limpia(firmas.locatario), garantes: contrato.garantes.map(() => ({ ...FIRMA_PENDIENTE })) },
  }
}

/**
 * Quién firma en una acción del mock: una parte, un garante por su posición
 * (`garante-1`, `garante-2`…) o todos los garantes juntos (`garantes`, el botón
 * de desarrollo "Firmar como garantes" del simulador).
 */
export type FirmanteMock = 'locador' | 'locatario' | `garante-${number}` | 'garantes'

/** US-07: "Cuando firman el locador, el locatario y todos los garantes, el contrato pasa a vigente". */
export function firmaronTodosMock(firmas: FirmasMock): boolean {
  return [firmas.locador, firmas.locatario, ...firmas.garantes].every((firma) => firma.estado === 'firmado')
}

/** La firma de `firmante` en el contrato. `null` si no existe (ej. `garante-3` con un garante). */
export function firmaDeMock(firmas: FirmasMock, firmante: Exclude<FirmanteMock, 'garantes'>): FirmaMock | null {
  if (firmante === 'locador' || firmante === 'locatario') return firmas[firmante]
  return firmas.garantes[Number(firmante.slice('garante-'.length)) - 1] ?? null
}

/**
 * Registra la firma de `firmante`, como el webhook en el back. Si con ella
 * firmaron todos, el contrato pasa a vigente (y la propiedad, a alquilada:
 * {@link pasarAVigenteMock}). Un contrato que ya no está pendiente no cambia.
 * @returns `false` si `localStorage` está lleno o bloqueado.
 */
export function firmarMock(contrato: ContratoMock, firmante: FirmanteMock, fecha: string): boolean {
  const { firmas } = contrato
  if (contrato.status !== 'pendiente_firma' || !firmas) return true
  const firmar = (firma: FirmaMock, leToca: boolean): FirmaMock => (leToca && firma.estado === 'pendiente' ? { ...firma, estado: 'firmado', firmadoEl: fecha } : firma)
  const nuevas: FirmasMock = {
    locador: firmar(firmas.locador, firmante === 'locador'),
    locatario: firmar(firmas.locatario, firmante === 'locatario'),
    garantes: firmas.garantes.map((firma, posicion) => firmar(firma, firmante === 'garantes' || firmante === `garante-${posicion + 1}`)),
  }
  const todas = firmaronTodosMock(nuevas)
  const actualizado: ContratoMock = todas
    ? { ...contrato, firmas: nuevas, updatedAt: fecha, status: 'vigente', firmadoPorTodasEl: fecha }
    : { ...contrato, firmas: nuevas, updatedAt: fecha }
  if (!guardarContratoMock(actualizado)) return false
  return todas ? pasarAVigenteMock(actualizado, fecha) : true
}

/**
 * US-07 — "Al rechazar la firma el contrato vuelve a 'borrador' y se borran las
 * firmas registradas", como `registrar_rechazo_contrato` en el back: conserva
 * el código, vuelve al paso 1 del alta (el back guarda 1; el alta cuenta desde
 * 0) y deja de estar enviado. Devuelve el contrato; lo guarda quien llama.
 */
export function rechazoMock(contrato: ContratoMock, fecha: string): ContratoMock {
  const borrador: ContratoMock = { ...contrato, status: 'borrador', ultimoPaso: 0, sentAt: null, firmadoPorTodasEl: null, updatedAt: fecha }
  delete borrador.firmas
  return borrador
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

// ─── Firmas diferidas: el aviso de DocuSign, simulado (US-07) ───────────

/**
 * Una firma (o un rechazo desde DocuSign) que todavía no se registró. En real,
 * DocuSign devuelve a la persona apenas firma, pero el back se entera entre 3 y
 * 30 segundos después (guía del back, §6). El simulador (`/simulador-firma`)
 * deja la acción acá y se aplica cuando vence `aplicarDesde`, así la pantalla
 * pasa por "Estamos registrando tu firma" igual que en real.
 * NOTA: se guarda en `rentar:mock:firmas-diferidas`, sin URLs ni tokens.
 */
export interface FirmaDiferidaMock {
  id: string
  contratoId: string
  firmante: FirmanteMock
  /** `rechazar`: el firmante declinó en DocuSign (vuelve a borrador, como `/rechazar`). */
  accion: 'firmar' | 'rechazar'
  /**
   * Desde cuándo se aplica, en milisegundos del reloj REAL (`Date.now()`).
   * NOTA: no usa el "hoy" del mock: es una espera de segundos, no una fecha del elenco.
   */
  aplicarDesde: number
}

/**
 * Deja una firma o un rechazo para dentro de `demoraMs` (el simulador usa 8 s, o
 * 60 s con "Simular un aviso demorado").
 * @returns `false` si `localStorage` está lleno o bloqueado.
 */
export function registrarFirmaDiferidaMock(datos: Pick<FirmaDiferidaMock, 'contratoId' | 'firmante' | 'accion'>, demoraMs: number): boolean {
  const ahora = Date.now()
  return saveMockRecord<FirmaDiferidaMock>('firmas-diferidas', { ...datos, id: `${datos.contratoId}|${datos.firmante}|${ahora}`, aplicarDesde: ahora + demoraMs })
}

/**
 * Aplica las firmas y rechazos diferidos que ya vencieron, en orden. Lo llaman
 * las lecturas mock de contratos antes de responder (detalle, Mi alquiler,
 * pestaña Contratos y listados), como si el webhook ya hubiera llegado.
 * Un contrato que dejó de estar pendiente (otro lo rechazó, el locador lo
 * modificó) se ignora, igual que el back con un sobre anulado.
 */
export function aplicarFirmasDiferidasMock(): void {
  const ahora = Date.now()
  const vencidas = readMockCollection<FirmaDiferidaMock>('firmas-diferidas', [])
    .filter((diferida) => diferida.aplicarDesde <= ahora)
    .sort((a, b) => a.aplicarDesde - b.aplicarDesde)
  for (const diferida of vencidas) {
    const contrato = readContratosMock().find((item) => item.id === diferida.contratoId)
    if (contrato?.status === 'pendiente_firma') {
      const fecha = ahoraIso()
      if (diferida.accion === 'firmar') firmarMock(contrato, diferida.firmante, fecha)
      else guardarContratoMock(rechazoMock(contrato, fecha))
    }
    deleteMockRecord('firmas-diferidas', diferida.id)
  }
}

// ─── Enlace de firma del garante (US-07, Tanda B) ───────────────────────

/** Vigencia del enlace del garante, como el back (`HORAS_VIGENCIA_ENLACE_GARANTE`). */
export const HORAS_VIGENCIA_ENLACE_GARANTE = 48

/**
 * Token nuevo del enlace, como el back: 32 bytes al azar en base64url (43 caracteres).
 * NOTA: se devuelve una sola vez; lo único que se guarda es su hash.
 */
export function tokenDeEnlaceMock(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** SHA-256 del token en hexadecimal (el mismo formato que `garante.token_firma_hash`). */
export async function hashDeTokenMock(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Guarda el hash del enlace nuevo en la firma del garante `posicion` (0, 1…).
 * Reemplaza al anterior: el enlace viejo deja de servir.
 * @returns `false` si `localStorage` está lleno o bloqueado.
 */
export function guardarEnlaceGaranteMock(contrato: ContratoMock, posicion: number, enlace: { hash: string; venceEl: string }): boolean {
  if (!contrato.firmas) return false
  const garantes = contrato.firmas.garantes.map((firma, indice) => (indice === posicion ? { ...firma, enlace } : firma))
  return guardarContratoMock({ ...contrato, firmas: { ...contrato.firmas, garantes } })
}

/** El contrato y la posición del garante dueño de un enlace (por el hash del token), o `null`. */
export function garantePorHashMock(hash: string): { contrato: ContratoMock; posicion: number } | null {
  for (const contrato of readContratosMock()) {
    const posicion = contrato.firmas?.garantes.findIndex((firma) => firma.enlace?.hash === hash) ?? -1
    if (posicion >= 0) return { contrato, posicion }
  }
  return null
}
