/**
 * plantilla.ts — la plantilla RentAR de locación de vivienda.
 *
 * Qué es: el texto del contrato, cláusula por cláusula, completado con los
 * datos de los pasos 1 y 2 del alta (partes, propiedad, garantes y
 * condiciones). Cubre US-05 Registrar contrato de alquiler, paso 3: "se debe
 * generar el contrato a partir de la plantilla de locación de vivienda de
 * RentAR, completada automáticamente con los datos de los pasos 1 y 2".
 *
 * - **Fijas** (bloqueadas): objeto, plazo, precio, ajuste, depósito,
 *   domicilios y garantía. Salen de los datos cargados: si cambian los pasos
 *   1 o 2, se vuelven a escribir solas.
 * - **Editables**: mora, mascotas, conservación, expensas, cesión,
 *   rescisión y restitución. Hasta 1.000 caracteres. Mientras el locador no
 *   las toca, también se actualizan solas; una vez editadas, se respeta su texto.
 * - **Propias**: las que agrega el locador, al final. Se pueden eliminar.
 *
 * Base: la vista "Flujo de contratos" · 04 de Claude Design (14 cláusulas;
 * la 1 "Objeto y destino" fija, la 7 "Mascotas" y la 9 "Expensas y
 * servicios" editables, la 14 "Garantía") y el régimen de locaciones del
 * Código Civil y Comercial tal como quedó después del DNU 70/2023, que
 * derogó la Ley 27.551 (plazo, moneda y ajuste a convenir entre las partes;
 * rescisión anticipada del locatario pagando el 10 % del canon futuro).
 *
 * NOTA: es un BORRADOR para revisar con el equipo (y, si es posible, con
 * alguien que sepa de derecho). No reemplaza el asesoramiento legal. Todo el
 * texto vive en este archivo: si se corrige, se corrige acá.
 *
 * Quién lo usa: `components/contratos/PasoClausulas.tsx`, la revisión y la
 * rama mock de `services/contratos.service.ts`.
 */
import type { ClausulaContrato, CondicionesNuevoContrato, GaranteContrato, IndiceContrato, ParteContrato, PropiedadDelContrato, TipoClausula } from '@rentar/shared-types'
import { MEDIO_PAGO_CORTO } from '@/lib/catalogs/propiedad'
import { dniParaMostrar } from '@/lib/perfil/formato'
import { cantidadAjustes, fechaCorta, fechaFin, fechaPrimerAjuste, MESES_POR_PERIODO } from './fechas'

/** Nombre de la plantilla, como lo muestra el paso 3 y la revisión. */
export const PLANTILLA_NOMBRE = 'Plantilla RentAR de locación de vivienda (borrador v1)'

/** Lo que necesita la plantilla para completarse. */
export interface DatosPlantilla {
  locador: ParteContrato
  locatario: ParteContrato
  propiedad: PropiedadDelContrato
  garantes: GaranteContrato[]
  condiciones: CondicionesNuevoContrato
}

// ─── Formato de los datos dentro del texto ──────────────────────────────

const pesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

/** Un dato que falta se ve como un hueco a completar, nunca inventado. */
const FALTA = '[a completar]'

function nombre(parte: ParteContrato): string {
  return `${parte.nombre} ${parte.apellido}`.trim()
}
function conDni(parte: ParteContrato): string {
  return parte.dni ? `${nombre(parte)}, DNI ${dniParaMostrar(parte.dni)}` : `${nombre(parte)}, DNI ${FALTA}`
}
function monto(valor: number | null): string {
  return valor === null ? FALTA : pesos.format(valor)
}
function fecha(valor: string | null): string {
  return valor ? fechaCorta(valor) : FALTA
}

/** Nombre del índice dentro del texto. */
const NOMBRE_INDICE: Record<Exclude<IndiceContrato, 'sin_ajuste'>, string> = {
  ICL: 'del Índice para Contratos de Locación (ICL) que publica el Banco Central de la República Argentina',
  IPC: 'del Índice de Precios al Consumidor (IPC) que publica el INDEC',
  CAC: 'del índice del costo de la construcción de la Cámara Argentina de la Construcción (CAC)',
}

// ─── Las cláusulas de la plantilla ──────────────────────────────────────

/** Una cláusula de la plantilla: su clave, su tipo y cómo se escribe con los datos. */
interface ClausulaPlantilla {
  key: string
  tipo: Exclude<TipoClausula, 'propia'>
  titulo: string
  texto: (datos: DatosPlantilla) => string
}

/** Las 14 cláusulas, en orden (el número sale de la posición). */
const CLAUSULAS: readonly ClausulaPlantilla[] = [
  {
    key: 'objeto',
    tipo: 'fija',
    titulo: 'Partes, objeto y destino',
    texto: ({ locador, locatario, propiedad }) =>
      `${conDni(locador)}, en adelante LA PARTE LOCADORA, da en locación a ${conDni(locatario)}, en adelante LA PARTE LOCATARIA, el inmueble ubicado en ${propiedad.address}, barrio ${propiedad.neighborhoodName || FALTA}, ciudad de Córdoba, provincia de Córdoba. El inmueble se destina exclusivamente a vivienda de LA PARTE LOCATARIA y su grupo familiar, y no puede cambiarse su destino.`,
  },
  {
    key: 'plazo',
    tipo: 'fija',
    titulo: 'Plazo',
    texto: ({ condiciones }) =>
      `El contrato rige desde el ${fecha(condiciones.startDate)} hasta el ${fecha(fechaFin(condiciones.startDate, condiciones.durationMonths))}, por un plazo de ${condiciones.durationMonths ?? FALTA} meses. Al vencer, LA PARTE LOCATARIA debe restituir el inmueble sin necesidad de aviso previo, salvo que las partes firmen una renovación.`,
  },
  {
    key: 'precio',
    tipo: 'fija',
    titulo: 'Precio y forma de pago',
    texto: ({ condiciones, propiedad }) => {
      const medios = propiedad.cobro.paymentMethods.map((medio) => MEDIO_PAGO_CORTO[medio.method]).join(', ')
      return `El alquiler mensual inicial es de ${monto(condiciones.initialAmount)}, pagadero por mes adelantado del día 1 al día ${condiciones.paymentDueDay ?? FALTA} de cada mes, a través de la plataforma RentAR${medios ? ` por alguno de estos medios: ${medios}` : ''}. Cada pago queda registrado en la plataforma, que emite el comprobante.`
    },
  },
  {
    key: 'ajuste',
    tipo: 'fija',
    titulo: 'Ajuste del precio',
    texto: ({ condiciones }) => {
      const { adjustmentIndex: indice, adjustmentPeriod: periodo, durationMonths: meses, startDate: inicio } = condiciones
      if (indice === 'sin_ajuste') return 'Las partes acuerdan que el precio se mantiene fijo durante todo el plazo del contrato, sin ajustes.'
      const total = cantidadAjustes(meses, indice, periodo)
      const cada = periodo ? `cada ${MESES_POR_PERIODO[periodo]} meses` : `con la periodicidad ${FALTA}`
      const primero = fechaPrimerAjuste(inicio, meses, indice, periodo)
      return `El precio se ajusta ${cada} según la variación ${NOMBRE_INDICE[indice]}, tomando el último valor publicado al momento de cada ajuste. Durante el plazo del contrato habrá ${total} ${total === 1 ? 'ajuste' : 'ajustes'}${primero ? `; el primero, el ${fechaCorta(primero)}` : ''}. RentAR informa el nuevo monto antes de su vencimiento.`
    },
  },
  {
    key: 'mora',
    tipo: 'editable',
    titulo: 'Mora',
    texto: ({ propiedad }) => {
      const { graceDays: gracia, dailyInterestPct: interes } = propiedad.cobro
      if (interes === null || interes === 0) {
        return 'La falta de pago en término produce la mora automática de LA PARTE LOCATARIA, sin necesidad de intimación previa. Las partes no pactan interés por los días de atraso.'
      }
      return `La falta de pago en término produce la mora automática de LA PARTE LOCATARIA, sin necesidad de intimación previa. Pasados ${gracia ?? 0} días de gracia desde el vencimiento, se aplica un interés del ${interes.toLocaleString('es-AR')} % por cada día de atraso sobre el monto adeudado.`
    },
  },
  {
    key: 'deposito',
    tipo: 'fija',
    titulo: 'Depósito en garantía',
    texto: ({ condiciones }) =>
      condiciones.deposit === 0
        ? 'Las partes acuerdan que no se entrega depósito en garantía.'
        : `LA PARTE LOCATARIA entrega en este acto ${monto(condiciones.deposit)} en concepto de depósito en garantía. LA PARTE LOCADORA lo devuelve al restituirse el inmueble, en el mismo valor del último mes de alquiler, descontando lo que se deba por alquileres, servicios, expensas o daños.`,
  },
  {
    key: 'mascotas',
    tipo: 'editable',
    titulo: 'Mascotas',
    texto: () =>
      'LA PARTE LOCATARIA puede tener animales de compañía siempre que no causen daños al inmueble ni molestias a los vecinos, y cumplan el reglamento del edificio si lo hubiera. Los daños que causen quedan a su cargo.',
  },
  {
    key: 'conservacion',
    tipo: 'editable',
    titulo: 'Conservación, mejoras y reparaciones',
    texto: () =>
      'LA PARTE LOCATARIA recibe el inmueble en buen estado y se obliga a conservarlo así, respondiendo por los daños que no provengan del uso normal. Las reparaciones necesarias por el desgaste del uso o por vicios del inmueble están a cargo de LA PARTE LOCADORA. Las mejoras requieren autorización escrita de LA PARTE LOCADORA y quedan a beneficio del inmueble, sin derecho a reclamo.',
  },
  {
    key: 'expensas',
    tipo: 'editable',
    titulo: 'Expensas y servicios',
    texto: () =>
      'Las expensas ordinarias y los servicios (luz, gas, agua, internet y tasas que graven el uso) están a cargo de LA PARTE LOCATARIA. Las expensas extraordinarias y los impuestos que gravan la propiedad están a cargo de LA PARTE LOCADORA.',
  },
  {
    key: 'cesion',
    tipo: 'editable',
    titulo: 'Cesión y sublocación',
    texto: () => 'LA PARTE LOCATARIA no puede ceder este contrato ni sublocar el inmueble, total o parcialmente, sin la conformidad escrita de LA PARTE LOCADORA.',
  },
  {
    key: 'rescision',
    tipo: 'editable',
    titulo: 'Rescisión anticipada',
    texto: () =>
      'LA PARTE LOCATARIA puede rescindir el contrato en cualquier momento, avisando con al menos 30 días de anticipación a través de la plataforma, y abonando el 10 % del saldo del alquiler que faltaría pagar hasta el fin del plazo pactado.',
  },
  {
    key: 'restitucion',
    tipo: 'editable',
    titulo: 'Restitución del inmueble',
    texto: () =>
      'Al terminar el contrato, LA PARTE LOCATARIA entrega el inmueble libre de personas y cosas, en el estado en que lo recibió salvo el desgaste normal, con los servicios y las expensas pagos, y las llaves. Se labra un acta de entrega firmada por las dos partes.',
  },
  {
    key: 'domicilios',
    tipo: 'fija',
    titulo: 'Domicilios, notificaciones y jurisdicción',
    texto: ({ locador, locatario, propiedad }) =>
      `LA PARTE LOCADORA constituye domicilio electrónico en ${locador.email} y LA PARTE LOCATARIA, en ${locatario.email} y en el inmueble locado (${propiedad.address}). Las notificaciones hechas por la plataforma RentAR o a esos correos son válidas. Para cualquier controversia, las partes se someten a los tribunales ordinarios de la ciudad de Córdoba.`,
  },
  {
    key: 'garantia',
    tipo: 'fija',
    titulo: 'Garantía',
    texto: ({ garantes }) => {
      if (garantes.length === 0) return 'Las partes acuerdan celebrar este contrato sin garantes.'
      const lista = garantes.map((garante) => `${garante.fullName.trim() || FALTA}, DNI ${garante.dni ? dniParaMostrar(garante.dni) : FALTA}, correo ${garante.email || FALTA}`).join('; ')
      return `${garantes.length === 1 ? 'Se constituye en garante' : 'Se constituyen en garantes'}, como ${garantes.length === 1 ? 'fiador solidario, liso, llano y principal pagador' : 'fiadores solidarios, lisos, llanos y principales pagadores'} de todas las obligaciones de LA PARTE LOCATARIA durante el plazo del contrato y hasta la restitución del inmueble: ${lista}.`
    },
  },
]

// ─── Armado ─────────────────────────────────────────────────────────────

/** Las cláusulas de la plantilla completadas con los datos (ninguna editada). */
export function clausulasDePlantilla(datos: DatosPlantilla): ClausulaContrato[] {
  return CLAUSULAS.map((clausula) => ({ key: clausula.key, tipo: clausula.tipo, titulo: clausula.titulo, texto: clausula.texto(datos), editada: false }))
}

/**
 * Vuelve a completar las cláusulas cuando cambian los pasos 1 o 2: las
 * fijas y las editables sin tocar toman el texto nuevo; las editadas y las
 * propias quedan como están (las propias, al final).
 */
export function completarClausulas(actuales: readonly ClausulaContrato[], datos: DatosPlantilla): ClausulaContrato[] {
  const porClave = new Map(actuales.map((clausula) => [clausula.key, clausula]))
  const plantilla = CLAUSULAS.map((clausula): ClausulaContrato => {
    const actual = porClave.get(clausula.key)
    if (actual?.editada) return actual
    return { key: clausula.key, tipo: clausula.tipo, titulo: clausula.titulo, texto: clausula.texto(datos), editada: false }
  })
  return [...plantilla, ...actuales.filter((clausula) => clausula.tipo === 'propia')]
}

/** El texto original de una editable (para "Volver al texto de la plantilla"). `null` si no es de la plantilla. */
export function textoOriginal(key: string, datos: DatosPlantilla): string | null {
  const clausula = CLAUSULAS.find((item) => item.key === key)
  return clausula ? clausula.texto(datos) : null
}

/** US-05: "se debe indicar la cantidad total de cláusulas y cuántas fueron editadas". */
export function contarClausulas(clausulas: readonly ClausulaContrato[]): { total: number; editadas: number; propias: number } {
  return {
    total: clausulas.length,
    editadas: clausulas.filter((clausula) => clausula.editada).length,
    propias: clausulas.filter((clausula) => clausula.tipo === 'propia').length,
  }
}

/** Ordinal de la cláusula para "Ver contrato completo": "PRIMERA", "SEGUNDA"… (hasta 20; después, el número). */
const ORDINALES = [
  'PRIMERA', 'SEGUNDA', 'TERCERA', 'CUARTA', 'QUINTA', 'SEXTA', 'SÉPTIMA', 'OCTAVA', 'NOVENA', 'DÉCIMA',
  'UNDÉCIMA', 'DUODÉCIMA', 'DECIMOTERCERA', 'DECIMOCUARTA', 'DECIMOQUINTA', 'DECIMOSEXTA', 'DECIMOSÉPTIMA', 'DECIMOCTAVA', 'DECIMONOVENA', 'VIGÉSIMA',
]
export function ordinal(numero: number): string {
  return ORDINALES[numero - 1] ?? String(numero)
}

/** Título del documento completo (US-05: "se debe poder ver el contrato completo"). */
export function tituloContrato(datos: Pick<DatosPlantilla, 'propiedad'>): string {
  return `Contrato de locación de vivienda · ${datos.propiedad.address}`
}
