/**
 * contratos.mock.ts — los contratos del elenco que no salen de una propiedad alquilada.
 *
 * Qué es: los contratos de US-05 que no están en `propiedades.mock.ts`:
 * - **CT-2026-0207, pendiente de firma:** Rondeau 480, PB, con Julieta
 *   Peralta. Nace de su solicitud aceptada SOL-2026-0031 (mapa: "la
 *   solicita, la aceptan y firma CT-2026-0207"). $385.000 (el valor
 *   canónico del mapa; el wizard del diseño decía $320.000), del 01/10/2026
 *   al 30/09/2029, ICL semestral. Mientras está pendiente de firma, Rondeau
 *   sigue publicada (decisión del PO).
 * - **CT-2023-0041, finalizado:** Rondeau 480, PB, con Camila Ríos, del
 *   01/12/2023 al 30/11/2025 (24 meses). Así Camila tiene un vigente
 *   (CT-2026-0133, en Mariano Moreno 285, desde el 01/12/2025) y un
 *   finalizado: el caso de "dos o más contratos" de US-27 sin inventar gente
 *   nueva (decisión del PO).
 *   NOTA: termina el día antes de que empiece CT-2026-0133, así respeta "un
 *   inquilino pertenece a una sola propiedad" a la vez (mapa; PO, tanda 3).
 *
 * Los 5 vigentes del elenco (CT-2026-0102, 0115, 0121, 0133 y 0148) NO se
 * repiten acá: salen de `propiedades.mock.ts` (`rental`), así el listado de
 * contratos, Mis propiedades y el panel nunca se contradicen.
 *
 * Quién lo usa: la rama mock de `services/contratos.service.ts` (a través de
 * `services/adapters/contrato-mock.adapter.ts`). Ninguna pantalla lo importa.
 *
 * TODO(db): son filas de `contrato` + garantes + cláusulas + firmas, que
 * hoy no existen en el esquema (HANDOFF §7, US-05).
 */
import type { ClausulaContrato, CondicionesNuevoContrato, ContractStatus, GaranteContrato } from '@rentar/shared-types'

/**
 * Un contrato como lo guardaría el back. JSON puro: los borradores que se
 * crean en el navegador se guardan con esta forma en `rentar:mock:contratos`
 * (sin el DNI de los garantes: ver `contrato-mock.adapter.ts`).
 */
export interface ContratoMock {
  /** Id interno. En los del elenco es el mismo código; en los borradores, `BOR-<n>`. */
  id: string
  /** `CT-AAAA-NNNN`; `null` en los borradores. */
  code: string | null
  status: ContractStatus
  /** `UsuarioSesion.id` del locador. */
  ownerId: string
  propertyId: string
  /** Solicitud aceptada de la que nace; `null` en los anteriores a US-05. */
  solicitudId: string | null
  /** `UsuarioSesion.id` del locatario, si tiene cuenta en el elenco. */
  tenantUserId: string | null
  /** Nombre y apellido del locatario (para los que no tienen cuenta). */
  tenantName: string
  garantes: GaranteContrato[]
  condiciones: CondicionesNuevoContrato
  /** `null` = la plantilla sin cambios (se arma al leer, con los datos de hoy). */
  clausulas: ClausulaContrato[] | null
  /** Paso en que quedó el borrador (0 a 3). */
  ultimoPaso: number
  /** Fecha y hora ISO de creación y del último cambio. */
  createdAt: string
  updatedAt: string
  /** Fecha y hora ISO en que se envió a firmar; `null` si es borrador. */
  sentAt: string | null
}

/** Los contratos del elenco que no salen de `propiedades.mock.ts` (ver el encabezado). */
export const contratos: ContratoMock[] = [
  {
    id: 'CT-2026-0207',
    code: 'CT-2026-0207',
    status: 'pendiente_firma',
    ownerId: 'usr-nicolas',
    propertyId: 'prop-rondeau-480',
    solicitudId: 'SOL-2026-0031',
    tenantUserId: 'usr-julieta',
    tenantName: 'Julieta Peralta',
    // Del diseño ("tu papá"), con el dominio del elenco.
    garantes: [{ key: 'garante-1', fullName: 'Hugo Peralta', dni: '14902338', email: 'hugo.peralta@rentar.test' }],
    condiciones: {
      startDate: '2026-10-01',
      durationMonths: 36,
      initialAmount: 385000,
      deposit: 385000,
      paymentDueDay: 10,
      adjustmentIndex: 'ICL',
      adjustmentPeriod: 'semestral',
    },
    clausulas: null,
    ultimoPaso: 3,
    // NOTA: el diseño fecha la aceptación el 14/09, pero en el elenco la
    // solicitud se envió el 20/09: se acepta el 21, el borrador es del 21 y
    // se envía a firmar el 22 (antes del "hoy" mock, 23/09).
    createdAt: '2026-09-21T17:22:00',
    updatedAt: '2026-09-22T11:40:00',
    sentAt: '2026-09-22T11:40:00',
  },
  {
    id: 'CT-2023-0041',
    code: 'CT-2023-0041',
    status: 'finalizado',
    ownerId: 'usr-nicolas',
    propertyId: 'prop-rondeau-480',
    solicitudId: null,
    tenantUserId: null,
    tenantName: 'Camila Ríos',
    garantes: [],
    condiciones: {
      startDate: '2023-12-01',
      durationMonths: 24,
      // NOTA: el monto con que terminó (el diseño muestra $240.000); los ajustes no se guardan.
      initialAmount: 240000,
      deposit: 240000,
      paymentDueDay: 10,
      adjustmentIndex: 'IPC',
      adjustmentPeriod: 'semestral',
    },
    clausulas: null,
    ultimoPaso: 3,
    createdAt: '2023-11-20T10:00:00',
    updatedAt: '2023-11-25T10:00:00',
    sentAt: '2023-11-25T10:00:00',
  },
]
