/**
 * cobro.ts — períodos, cobros y comprobantes del locador.
 *
 * Qué es: TIPOS DE VISTA DEL FRONT para `/panel/cobros`, el detalle del período
 * y su comprobante. Cubre US-08 Registrar cobro, US-09 Consultar cobro y US-10
 * Emitir comprobante de pago. Los DTO del back están en
 * `apps/web/src/services/shared/backend-dtos.ts`.
 *
 * Quién lo usa: `apps/web/src/services/cobros.service.ts`, sus adaptadores y
 * `apps/web/src/components/cobros/*`.
 *
 * NOTA (decisión del PO, 05/11): no hay pago parcial. Hay un cobro por período,
 * por el total (alquiler + mora), así que no hay saldo ni estado "parcial".
 */
import type { PaymentStatus } from './status'

/** Estado de un período. "Anulado" y "parcial" no aplican (ver el encabezado). */
export type EstadoPeriodo = Extract<PaymentStatus, 'pendiente' | 'vencido' | 'pagado'>

/** Filtro de estado del listado (US-09). */
export type FiltroEstadoCobro = 'todos' | EstadoPeriodo

/** Medio de un cobro registrado a mano (US-08). */
export type MedioCobro = 'transferencia' | 'efectivo' | 'cheque' | 'mercadopago_externo' | 'otro'

/** Filtros del listado, guardados en la URL (US-09). */
export interface FiltrosCobros {
  estado: FiltroEstadoCobro
  /** Id de la propiedad; `null` = todas. */
  propiedad: string | null
  /** Mes `AAAA-MM`; `null` = todos. */
  mes: string | null
}

/** Una fila del listado. Sin DNI ni contacto del locatario (US-09). */
export interface PeriodoFila {
  id: string
  contratoId: string
  propiedadId: string
  /** Domicilio de la propiedad (calle, número y piso). */
  propiedad: string
  /** Nombre del locatario; `null` si el back no lo manda. */
  locatario: string | null
  /** Mes `AAAA-MM`. */
  periodo: string
  /** Fecha ISO del primer día del período. */
  inicio: string
  /** Fecha ISO de vencimiento. */
  vencimiento: string
  estado: EstadoPeriodo
  /** Alquiler del período, sin mora. */
  alquiler: number
  /** Total: lo cobrado si está pagado; si no, alquiler + mora a hoy. */
  monto: number
  diasAtraso: number
  /** Fecha ISO del pago; `null` si no está pagado o el listado no la trae. */
  fechaPago: string | null
}

/** Indicadores del mes elegido, o del mes actual sin filtro (US-09). */
export interface IndicadoresCobros {
  /** Mes `AAAA-MM`. */
  mes: string
  cobrado: number
  vencido: number
}

/** Lo que muestra `/panel/cobros`. */
export interface ListadoCobros {
  /** Filas filtradas y ordenadas. */
  filas: PeriodoFila[]
  /** Períodos del locador sin filtros: en 0 es el estado vacío, no "sin resultados". */
  totalPeriodos: number
  cantidades: Record<FiltroEstadoCobro, number>
  indicadores: IndicadoresCobros
  propiedades: { id: string; nombre: string }[]
  /** Meses con períodos, `AAAA-MM`, del más nuevo al más viejo. */
  meses: string[]
}

/** Un cobro registrado de un período. */
export interface CobroRegistrado {
  id: string
  /** Número del comprobante, `RC-AAAA-NNNN` (US-10). */
  numeroComprobante: string
  /** Fecha ISO del cobro. */
  fecha: string
  monto: number
  medio: MedioCobro
  nota: string | null
  /** Quién lo cargó; `null` si el back no lo manda. */
  registradoPor: string | null
  /** Fecha y hora ISO de la carga. */
  registradoEl: string
  /** Nombre del adjunto en mock; en real, el back solo dice que existe. */
  adjuntoNombre: string | null
  tieneAdjunto: boolean
}

/** Un evento del historial del período (US-08 y US-09). */
export interface EventoPeriodo {
  id: string
  titulo: string
  /** Fecha y hora ISO. */
  fecha: string
  /** Quién lo hizo; `null` si lo hizo el sistema. */
  quien: string | null
}

/** Detalle de un período (`/panel/cobros/[id]`). */
export interface DetallePeriodo {
  id: string
  contratoId: string
  contratoCodigo: string | null
  propiedadId: string
  propiedad: string
  barrio: string | null
  /**
   * `null` cuando el detalle se armó con el listado del locador (ver
   * `getPeriodo`): ese listado solo trae períodos propios.
   */
  locadorId: string | null
  locatario: string | null
  periodo: string
  inicio: string
  fin: string
  vencimiento: string
  estado: EstadoPeriodo
  alquiler: number
  mora: number
  diasMora: number
  total: number
  cobros: CobroRegistrado[]
  /** `false` si no se pudo traer la lista: no es lo mismo que no tener cobros. */
  cobrosDisponibles: boolean
  /** Cobro del comprobante; `null` si el período no tiene cobros. */
  comprobanteCobroId: string | null
  /** `null` = no disponible por ahora; no se oculta el resto de la pantalla. */
  historial: EventoPeriodo[] | null
}

/** Un período que se puede cobrar, para el modal de US-08. */
export interface PeriodoRegistrable {
  id: string
  contratoId: string
  propiedadId: string
  propiedad: string
  locatario: string | null
  periodo: string
  vencimiento: string
  alquiler: number
}

/** Lo que hace falta del contrato para calcular el monto y validar la fecha (US-08). */
export interface CondicionesCobro {
  /** Interés diario en %; 0 si el contrato no tiene. */
  tasaDiariaPct: number
  diasGracia: number
  /** Fecha ISO de inicio del contrato; `null` si no se sabe. */
  inicioContrato: string | null
}

/** Datos del modal de US-08. */
export interface RegistrarCobroDatos {
  periodoId: string
  /** Fecha ISO del cobro. */
  fecha: string
  medio: MedioCobro
  nota: string | null
  adjunto: File | null
}

/** Lo que devuelve registrar un cobro. */
export interface CobroCreado {
  cobroId: string
  periodoId: string
  monto: number
  numeroComprobante: string
}

/** Una parte del comprobante (US-10). `null` = el dato no está. */
export interface ParteComprobante {
  nombre: string
  documento: string | null
  email: string | null
  telefono: string | null
}

/** Comprobante de pago (US-10). El locador y el locatario ven el mismo. */
export interface Comprobante {
  cobroId: string
  numero: string
  /** Fecha y hora ISO de emisión. */
  emitidoEl: string
  locatario: ParteComprobante
  locador: ParteComprobante
  /** Domicilio completo: calle, número, piso, barrio y ciudad. */
  domicilio: string
  contratoCodigo: string | null
  contratoInicio: string | null
  contratoFin: string | null
  periodo: string
  periodoInicio: string
  periodoFin: string
  vencimiento: string
  alquiler: number
  mora: number
  diasMora: number
  total: number
  medio: MedioCobro
  /** Fecha ISO del pago: es un dato distinto del período imputado (US-10). */
  fechaPago: string
}
