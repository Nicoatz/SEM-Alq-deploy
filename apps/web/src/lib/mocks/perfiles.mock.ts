/**
 * perfiles.mock.ts — el legajo de cada persona del elenco (US-20, US-21).
 *
 * Qué es: lo que cada cuenta del elenco tiene cargado en su legajo
 * (situación ocupacional, ingreso mensual y garantías), armado para que
 * "Mi perfil" muestre los casos de las pruebas de usuario:
 * - Sofía, Julieta y Diego: legajo completo.
 * - Matías: legajo incompleto (le faltan el ingreso y las garantías).
 * - Nicolás: legajo vacío (es locador y nunca se postuló).
 * Los datos personales (nombre, DNI, teléfono…) siguen en `usuarios.mock.ts`;
 * el contrato que bloquea nombre y DNI sale de `propiedades.mock.ts`
 * (`rental`), así ninguna pantalla se contradice.
 *
 * Quién lo usa: la rama mock de `services/perfil.service.ts`. Ninguna
 * pantalla lo importa directo.
 *
 * TODO(db): el legajo no existe en el esquema. Propuesta en
 * `docs/HANDOFF-BACKEND.md` §7 (US-20/US-21).
 */
import type { LegajoUsuario } from '@rentar/shared-types'

/** El legajo de una cuenta del elenco, con el id de la cuenta. */
export interface PerfilMock {
  /** `UsuarioSesion.id` de la cuenta. */
  id: string
  legajo: LegajoUsuario
  /** Correo nuevo esperando confirmación (US-21). En el elenco, ninguno. */
  pendingEmail: string | null
}

/** Legajo vacío: lo que tiene una cuenta recién registrada. */
export const LEGAJO_VACIO: LegajoUsuario = { occupation: 'sin_informar', monthlyIncome: null, guarantees: [] }

/** Un legajo por cuenta del elenco (ver el encabezado). */
export const perfiles: PerfilMock[] = [
  { id: 'usr-nicolas', legajo: LEGAJO_VACIO, pendingEmail: null },
  {
    id: 'usr-sofia',
    legajo: { occupation: 'relacion_dependencia', monthlyIncome: 1450000, guarantees: ['propietaria'] },
    pendingEmail: null,
  },
  {
    id: 'usr-julieta',
    legajo: { occupation: 'monotributista', monthlyIncome: 980000, guarantees: ['caucion'] },
    pendingEmail: null,
  },
  {
    id: 'usr-matias',
    legajo: { occupation: 'estudiante', monthlyIncome: null, guarantees: [] },
    pendingEmail: null,
  },
  {
    id: 'usr-diego',
    legajo: { occupation: 'relacion_dependencia', monthlyIncome: 1200000, guarantees: ['propietaria', 'otra'] },
    pendingEmail: null,
  },
  {
    // Completo (tanda 4 del Sprint 3). Identidad bloqueada por CT-2026-0133, vigente (US-21).
    id: 'usr-camila',
    legajo: { occupation: 'relacion_dependencia', monthlyIncome: 1300000, guarantees: ['propietaria'] },
    pendingEmail: null,
  },
]
