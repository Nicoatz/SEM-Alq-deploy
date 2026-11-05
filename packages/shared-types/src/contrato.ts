/**
 * contrato.ts — el contrato de alquiler, tal como lo ven la pestaña Contratos
 * de la propiedad, el detalle y el alta en 4 pasos.
 *
 * Qué es: TIPOS DE VISTA DEL FRONT. Cubren US-05 Registrar contrato de
 * alquiler (listado, inicio desde una solicitud aceptada, alta y borrador) y
 * US-07 Firmar contrato de alquiler (detalle, firmantes y firma).
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
  /** US-05: plazo de vencimiento del pago, en días, de 1 a 28 (10 por defecto). No es el día del mes. */
  paymentTermDays: number | null
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

/** El PDF del contrato (US-05, paso 3). */
export interface PdfContrato {
  nombre: string
  tamanoBytes: number
  /** Fecha y hora ISO de la subida; `null` si no se registró. */
  subidoEl: string | null
  /** URL para verlo. En real es firmada y vence a los 5 minutos. */
  url: string
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
  /** El PDF cargado en el paso 3; `null` si todavía no hay. */
  pdf: PdfContrato | null
  /** US-06: la fecha de inicio guardada quedó en el pasado: hay que pedir una nueva antes de volver a enviar. */
  fechaInicioVencida: boolean
}

/** Lo que cambió de un borrador: solo eso viaja al back (reenviar una fecha vencida da 400). */
export interface CambiosBorrador {
  /** Paso en que quedó, de 0 a 3. */
  paso?: number
  condiciones?: Partial<CondicionesNuevoContrato>
  /** Reemplaza la lista completa. */
  garantes?: GaranteContrato[]
}

/** Base de una fila de Mis alquileres (US-27) y de la rama mock de US-43. Sin DNI ni datos de contacto. */
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

/** El PDF de un contrato en la pestaña Contratos (US-43). `null` si no hay. */
export type DocumentoDeContrato = { tipo: 'archivo'; url: string } | null

/** Una firma en la pestaña Contratos (US-43: quién firmó, con fecha y hora, y quién falta). */
export type FirmaDePropiedad = Pick<FirmanteContrato, 'rol' | 'nombre' | 'estado' | 'firmadoEl'>

/** Un contrato en la pestaña Contratos de una propiedad (US-43). Sin DNI ni datos de contacto. */
export interface ContratoDePropiedad {
  id: string
  /** `null` en un borrador sin código ("Borrador sin código"). */
  code: string | null
  status: ContractStatus
  /** Nombre y apellido del locatario; `null` si no hay uno cargado. */
  tenantName: string | null
  /** Alquiler actual; `null` en un borrador sin monto. */
  currentAmount: number | null
  startDate: string | null
  endDate: string | null
  /** `null` si un borrador todavía no lo tiene. */
  adjustmentIndex: IndiceContrato | null
  /** Fecha ISO del próximo ajuste; `null` si no hay. */
  nextAdjustmentDate: string | null
  /** `false` si no hay registro de las firmas: no se inventan. */
  firmasRegistradas: boolean
  /** Solo locador y locatario: el garante no firma (decisión del PO). */
  firmantes: FirmaDePropiedad[]
  /** Fecha y hora ISO de la última firma, con el contrato vigente; `null` si no se registró. */
  firmadoPorTodasEl: string | null
  documento: DocumentoDeContrato
}

/** La pestaña Contratos de una propiedad (US-43). */
export interface ContratosDePropiedad {
  /** Borrador, pendiente de firma o vigente: como máximo uno. */
  actual: ContratoDePropiedad | null
  /** Finalizados, del más reciente al más antiguo por fecha de inicio. */
  anteriores: ContratoDePropiedad[]
  /** Solicitud aceptada que todavía no originó un contrato ("Iniciar contrato"); `null` si no hay. */
  solicitudParaContrato: string | null
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

/**
 * El detalle de un contrato (`/panel/contratos/[id]`, US-07): lo del alta
 * más los firmantes.
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
   * finalizado del elenco): no hay registro de firmas, y no se
   * inventan.
   */
  firmasRegistradas: boolean
  /** Locador y locatario, en ese orden. Vacío si `firmasRegistradas` es `false`. */
  firmantes: FirmanteContrato[]
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
  /**
   * Lo que la ficha del locatario recibe de la API real (US-27,
   * `GET /alquileres-locatario/:id`) y no tiene lugar en el resto del tipo.
   * `null` en modo mock y en el detalle del locador (`/contratos/:id`,
   * propuesto). Cuando viene, la ficha usa estas fechas en lugar de
   * calcularlas, no ofrece la firma en línea (US-07 no existe en la API) y
   * el PDF es el del back, no uno armado en el navegador.
   */
  datosApi: DatosAlquilerApi | null
}

/**
 * Datos de la ficha del locatario que manda `GET /alquileres-locatario/:id`
 * (US-27). Las fechas son ISO (`YYYY-MM-DD`) y ya vienen calculadas por el back.
 */
export interface DatosAlquilerApi {
  /** URL firmada y temporal del PDF guardado en el bucket privado; `null` si todavía no hay PDF. */
  pdfUrl: string | null
  /**
   * Plazo en días para pagar, contado desde que el monto está disponible en
   * cada período. `null` si no se cargó.
   */
  diasParaVencimiento: number | null
  /** Próximo vencimiento del pago; `null` si no hay (sin plazo, finalizado o después del fin). */
  proximoVencimientoPago: string | null
  /** Próximo ajuste; `null` sin ajuste o finalizado. El monto es "a definir" (decisión del PO). */
  proximoAjuste: string | null
  /** Último ajuste aplicado; `null` si nunca se ajustó. */
  ultimoAjuste: string | null
  /** Frecuencia del ajuste tal como la guarda el back ("Semestral", "Bimestral"…); `null` si no tiene. */
  frecuenciaAjuste: string | null
  /** Expensas mensuales, en pesos. */
  expensas: number
  /** Medios de pago del contrato, con el nombre del back ("Transferencia bancaria"). */
  mediosPago: string[]
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
