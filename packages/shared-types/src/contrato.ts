/**
 * contrato.ts — el contrato de alquiler, tal como lo ven el listado
 * `/panel/contratos` y el alta en 4 pasos.
 *
 * Qué es: TIPOS DE VISTA DEL FRONT. Cubren US-05 Registrar contrato de
 * alquiler (listado, inicio desde una solicitud aceptada, alta y borrador) y
 * US-07 Firmar contrato de alquiler (detalle, firmantes, historial y firma).
 * No confundir con `CondicionesContrato` de `propiedad.ts`: esas son las
 * condiciones que el locador cargó al PUBLICAR (US-01); acá están las del
 * contrato real con un locatario.
 *
 * Adaptador que los produce: `apps/web/src/services/adapters/contrato.adapter.ts`
 * (contra los DTO PROPUESTOS de `/contratos`, ver `docs/api-endpoints.md`,
 * "Contratos").
 *
 * NOTA de privacidad: el DNI de las partes y de los garantes se ve en el
 * alta (pasos 1 y 4), nunca en el listado: `ContratoResumen` no lo trae.
 *
 * Quién lo usa: `apps/web/src/services/contratos.service.ts`,
 * `apps/web/src/lib/contratos/*` y `apps/web/src/components/contratos/*`.
 */
import type { AdjustmentIndex, MedioPagoConRecargo } from './propiedad'
import type { GarantiaOfrecida } from './solicitud'
import type { ContractStatus, SignatureStatus } from './status'

/**
 * Índice de ajuste del contrato (US-05: "Sin ajuste, ICL, IPC o CAC").
 * NOTA: el de la publicación (`AdjustmentIndex`) no tiene CAC ni "sin ajuste".
 */
export type IndiceContrato = 'sin_ajuste' | 'ICL' | 'IPC' | 'CAC'

/** Cada cuánto se ajusta (US-05: "trimestral, semestral o anual"). */
export type PeriodicidadAjuste = 'trimestral' | 'semestral' | 'anual'

/** Una de las dos partes que firman: el locador o el locatario (US-05, paso 1: solo lectura). */
export interface ParteContrato {
  /** Id del usuario, como texto. */
  userId: string
  nombre: string
  apellido: string
  /** DNI; `null` si el perfil no lo tiene. Dato sensible: solo en el alta. */
  dni: string | null
  email: string
  /** E.164 (`+543515550101`); `null` si no tiene. */
  telefono: string | null
}

/**
 * Un garante (US-05: "nombre y apellido, DNI y correo electrónico; los tres
 * datos son obligatorios"). Decisión del PO: en el Sprint 3 es un dato del
 * contrato y NO firma.
 */
export interface GaranteContrato {
  /** Clave local para la lista (no la manda el back). */
  key: string
  fullName: string
  /** 7 u 8 dígitos. Dato sensible: solo en el alta. */
  dni: string
  email: string
}

/**
 * Condiciones del contrato (US-05, paso 2). En un borrador cualquier campo
 * puede faltar (`null`): se validan todas al avanzar del paso y al enviar.
 */
export interface CondicionesNuevoContrato {
  /** Fecha ISO de inicio; no anterior a hoy. */
  startDate: string | null
  /** Duración en meses, entero mayor a 0 (24 por defecto). */
  durationMonths: number | null
  /** Monto inicial mensual, entero mayor a 0 (por defecto, el precio publicado). */
  initialAmount: number | null
  /** Depósito en garantía, entero mayor o igual a 0 (por defecto, un mes). */
  deposit: number | null
  /** Día de vencimiento del pago, de 1 a 28 (10 por defecto). */
  paymentDueDay: number | null
  adjustmentIndex: IndiceContrato
  /** Solo si el índice no es `sin_ajuste`; si no, `null`. */
  adjustmentPeriod: PeriodicidadAjuste | null
}

/**
 * Tipo de cláusula (US-05, paso 3): las fijas no se editan; las editables
 * vienen de la plantilla y se pueden cambiar; las propias las agrega el
 * locador y se pueden eliminar.
 */
export type TipoClausula = 'fija' | 'editable' | 'propia'

/** Una cláusula del contrato. El número sale del orden en la lista. */
export interface ClausulaContrato {
  /** Clave estable de la plantilla (`objeto`, `precio`…) o `propia-<n>`. */
  key: string
  tipo: TipoClausula
  titulo: string
  /** Texto final (ya completado con los datos de los pasos 1 y 2). Hasta 1.000 caracteres si no es fija. */
  texto: string
  /**
   * `true` si el locador cambió el texto de una editable (US-05: "cuántas
   * fueron editadas"). En las fijas y las propias, siempre `false`.
   */
  editada: boolean
}

/** Condiciones de cobro que el locador cargó en la propiedad (US-05, paso 2: solo lectura). */
export interface CondicionesCobroPropiedad {
  paymentMethods: MedioPagoConRecargo[]
  /** Días de gracia; `null` si no se cargaron. */
  graceDays: number | null
  /** Interés por día de atraso en %; `null` si no se cobra. */
  dailyInterestPct: number | null
}

/** La propiedad del contrato, con lo que necesita el alta. */
export interface PropiedadDelContrato {
  id: string
  /** Dirección EXACTA con el piso (es del locador): "Rondeau 480, PB". */
  address: string
  neighborhoodName: string
  /** Precio publicado: el monto inicial por defecto (US-05). `null` si no tiene. */
  priceMonthly: number | null
  /** Índice de la publicación: se precarga en el paso 2 (decisión del PO). */
  adjustmentIndex: AdjustmentIndex | null
  cobro: CondicionesCobroPropiedad
  /** Foto principal (URL); `null` si no tiene. La muestra la ficha del locatario (US-27). */
  photoSrc: string | null
}

/**
 * Un contrato en el alta: lo que se carga en los 4 pasos, guardado o no.
 * `id` es `null` hasta guardar el primer borrador.
 */
export interface ContratoBorrador {
  id: string | null
  /** `CT-AAAA-NNNN`; `null` mientras es borrador (se asigna al enviar a firmar). */
  code: string | null
  status: ContractStatus
  /** Solicitud aceptada de la que nace (US-05: "una solicitud aceptada puede originar un solo contrato"). */
  solicitudId: string
  /** Fecha ISO en que se aceptó la solicitud (aviso del paso 1). */
  solicitudAceptadaEl: string | null
  propiedad: PropiedadDelContrato
  locador: ParteContrato
  locatario: ParteContrato
  /** Garantías que el locatario ofreció en su solicitud (US-05, paso 1: como referencia). */
  garantiasOfrecidas: GarantiaOfrecida[]
  garantes: GaranteContrato[]
  condiciones: CondicionesNuevoContrato
  clausulas: ClausulaContrato[]
  /** Paso en que quedó (0 a 3), para retomarlo (US-05: "un borrador se puede retomar desde el paso en que quedó"). */
  ultimoPaso: number
}

/** Lo que se guarda de un borrador (`POST` / `PUT /contratos`). Las partes y la propiedad las pone el back. */
export type DatosContrato = Pick<ContratoBorrador, 'solicitudId' | 'garantes' | 'condiciones' | 'clausulas' | 'ultimoPaso'>

/** Una fila del listado `/panel/contratos` (US-05). Sin DNI ni datos de contacto. */
export interface ContratoResumen {
  id: string
  /** `null` en los borradores. */
  code: string | null
  status: ContractStatus
  propertyId: string
  /** Dirección exacta con el piso (el listado es del locador). */
  propertyAddress: string
  neighborhoodName: string
  /** Nombre y apellido del locatario. */
  tenantName: string
  /** Monto mensual actual; en un borrador, el inicial cargado (o `null`). */
  currentAmount: number | null
  startDate: string | null
  endDate: string | null
  adjustmentIndex: IndiceContrato | null
  /** Fecha ISO del próximo ajuste; `null` si no hay (sin ajuste, finalizado o borrador incompleto). */
  nextAdjustmentDate: string | null
  /** Solicitud de origen; `null` en los contratos anteriores a US-05. */
  solicitudId: string | null
}

/** Resultado de enviar a firmar (US-05, paso 4). */
export interface ContratoEnviado {
  id: string
  code: string
  status: 'pendiente_firma'
  /** Quiénes firman (decisión del PO: locador y locatario; el garante no firma en el Sprint 3). */
  firmantes: { rol: 'locador' | 'locatario'; nombre: string }[]
}

/**
 * El contrato que originó una solicitud aceptada (vista del locador): lo usa
 * "Iniciar contrato" / "Continuar contrato" (US-05).
 */
export interface ContratoDeSolicitud {
  id: string
  status: ContractStatus
}

// ─── US-07 Firmar contrato de alquiler ──────────────────────────────────

/** Quién firma (decisión del PO: el locador y el locatario; el garante no firma en el Sprint 3). */
export type RolFirmante = 'locador' | 'locatario'

/** Una de las dos partes que firman, con el estado de su firma. */
export interface FirmanteContrato {
  rol: RolFirmante
  userId: string
  /** Nombre y apellido. */
  nombre: string
  /** US-07: "pendiente, firmado (con fecha y hora) o rechazado (con el motivo)". Es el dominio `firma` de `StatusTag`. */
  estado: SignatureStatus
  /** Fecha y hora ISO de la firma; `null` si no firmó. La IP la guarda el back y no se muestra. */
  firmadoEl: string | null
  /** Fecha y hora ISO del rechazo; `null` si no rechazó. */
  rechazadoEl: string | null
  /** Motivo del rechazo (opcional, hasta 300 caracteres); `null` si no dio uno. */
  motivoRechazo: string | null
  /** Fecha y hora ISO de la última invitación (el envío o un reenvío); `null` si nunca se invitó. */
  ultimaInvitacion: string | null
}

/** Qué pasó en el contrato (US-07: "creación, envío a firmar, firmas, rechazos, reenvíos y cancelaciones"). */
export type TipoEventoContrato = 'creado' | 'enviado' | 'firmado' | 'rechazado' | 'reenviado' | 'envio_cancelado' | 'vigente'

/** Un evento del historial del contrato. */
export interface EventoContrato {
  id: string
  tipo: TipoEventoContrato
  /** Fecha y hora ISO. */
  fecha: string
  /** Quién (en firmas y rechazos) o a quién (en reenvíos); `null` en el resto. */
  rol: RolFirmante | null
  nombre: string | null
  /** Motivo del rechazo; `null` en el resto. */
  motivo: string | null
}

/**
 * El detalle de un contrato (`/panel/contratos/[id]`, US-07): lo del alta
 * más los firmantes y el historial.
 */
export interface ContratoDetalle extends ContratoBorrador {
  /** Fecha y hora ISO en que se envió a firmar; `null` si es borrador o no se registró. */
  enviadoEl: string | null
  /**
   * Fecha y hora ISO de la última firma, cuando firmaron todas las partes
   * (US-07: "Firmado por todas las partes el dd/mm/aaaa"); `null` si faltan
   * firmas o no se registró.
   */
  firmadoPorTodasEl: string | null
  /**
   * `false` en los contratos anteriores a RentAR (los vigentes y el
   * finalizado del elenco): no hay registro de firmas ni historial, y no se
   * inventan.
   */
  firmasRegistradas: boolean
  /** Locador y locatario, en ese orden. Vacío si `firmasRegistradas` es `false`. */
  firmantes: FirmanteContrato[]
  /** Del más reciente al más viejo. */
  historial: EventoContrato[]
  /** Fecha ISO de fin (inicio + duración); `null` si faltan datos. */
  endDate: string | null
  /**
   * Monto mensual actual, con los ajustes aplicados (US-27: "monto actual");
   * `null` si no se sabe. NOTA: en mock, en los contratos hechos en RentAR es
   * el inicial (los ajustes no se calculan).
   */
  montoActual: number | null
  /**
   * Cada cuántos meses se ajusta (3, 6 o 12 en los contratos de RentAR; los
   * del elenco pueden ajustar cada 4). `null` sin ajuste o si no se sabe.
   */
  ajusteCadaMeses: number | null
}

/**
 * Una fila de Mis alquileres (`/panel/alquileres`, US-27): lo del listado
 * del locador más el nombre del locador. Sin DNI ni contacto.
 */
export interface AlquilerResumen extends ContratoResumen {
  /** Nombre y apellido del locador. */
  landlordName: string
}

/**
 * Lo que abre Mi alquiler (`/panel/alquiler`, US-27): ninguno, la ficha del
 * único, o "varios" (va al listado `/panel/alquileres`).
 */
export type MiAlquiler = { tipo: 'ninguno' } | { tipo: 'uno'; contrato: ContratoDetalle } | { tipo: 'varios'; cantidad: number }
