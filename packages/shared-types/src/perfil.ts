/**
 * perfil.ts — el perfil del usuario en sesión y su legajo, tal como los ve
 * la pantalla "Mi perfil" (`/panel/perfil`).
 *
 * Qué es: TIPOS DE VISTA DEL FRONT. Cubren US-20 Consultar usuario y US-21
 * Modificar usuario. Los datos personales usan los mismos nombres que
 * `UsuarioSesion` (es la misma persona, con más datos); el legajo usa los de
 * `LegajoSolicitud`, así la precarga de una solicitud nueva (US-35) se arma
 * sin traducir campos.
 *
 * Adaptador que los produce:
 * `apps/web/src/services/adapters/perfil.adapter.ts` (contra los DTO
 * propuestos de `GET /usuarios/me/perfil`, ver `docs/api-endpoints.md`).
 *
 * NOTA de privacidad (US-20): el DNI y los ingresos solo se muestran en el
 * perfil y en el detalle de una solicitud enviada, nunca en listados. Por eso
 * este tipo NO se mezcla con `UsuarioSesion`, que viaja por todo el panel.
 *
 * Quién lo usa: `apps/web/src/services/perfil.service.ts` y
 * `apps/web/src/components/perfil/*`.
 */
import type { UserRole } from './status'
import type { GarantiaOfrecida, OcupacionPostulante } from './solicitud'

/**
 * El legajo del usuario (US-20 y US-21): lo que cuenta de su situación para
 * postularse. Se carga una vez en el perfil y se precarga en cada solicitud
 * nueva (US-21: "los datos del legajo se precargan en las solicitudes
 * nuevas"). Lo que se cambie dentro de una solicitud no vuelve acá.
 */
export interface LegajoUsuario {
  /** Situación ocupacional (mismas opciones que US-35). `sin_informar` es el "-". */
  occupation: OcupacionPostulante
  /**
   * Ingreso mensual declarado, en pesos, entero mayor a 0 (US-21). `null` =
   * no lo cargó. NOTA: a diferencia de `LegajoSolicitud.monthlyIncome`, acá
   * el 0 no existe: en la solicitud, el 0 es "prefiero no informarlo", una
   * decisión que el usuario toma en cada solicitud (decisión del PO).
   */
  monthlyIncome: number | null
  /** Garantías que puede ofrecer (US-21: puede marcar varias). */
  guarantees: GarantiaOfrecida[]
}

/**
 * Contrato que impide cambiar nombre, apellido y DNI (US-21: "no se pueden
 * modificar si el usuario es parte de un contrato vigente o pendiente de
 * firma; en ese caso se debe explicar el motivo").
 */
export interface BloqueoIdentidad {
  /** Código del contrato, ej. `CT-2026-0148`. */
  contractCode: string
  /** Estado del contrato que bloquea. */
  contractStatus: 'vigente' | 'pendiente_firma'
}

/**
 * El perfil completo del usuario en sesión (US-20). Solo existe el propio:
 * no hay forma de pedir el perfil de otro usuario.
 */
export interface PerfilUsuario {
  /** Id del usuario, como texto (igual que `UsuarioSesion.id`). */
  id: string
  nombre: string
  apellido: string
  /** DNI de 7 u 8 dígitos; `null` = no cargado ("Sin cargar"). Dato sensible. */
  dni: string | null
  /** Correo vigente (el que se usa para entrar). */
  email: string
  /**
   * Correo nuevo que todavía no se confirmó (US-21: "el cambio solo se aplica
   * cuando el usuario confirma el nuevo correo desde el enlace"). `null` si
   * no hay un cambio en curso.
   */
  pendingEmail: string | null
  /** Teléfono canónico E.164 (`+543515550101`); `null` = no cargado. */
  telefono: string | null
  /** Fecha de nacimiento ISO `YYYY-MM-DD`; `null` = no cargada. */
  fechaNacimiento: string | null
  /**
   * Roles (US-20: "todo usuario es locatario, y es también locador si publicó
   * al menos una propiedad"). Siempre incluye `'locatario'`.
   */
  roles: UserRole[]
  /** Contrato que bloquea los datos de identidad; `null` si no hay ninguno. */
  identityLock: BloqueoIdentidad | null
  legajo: LegajoUsuario
}

/**
 * Cambios de "Datos personales" (US-21). Solo viajan los campos que se
 * modificaron. El correo no va acá: tiene su propio flujo de confirmación.
 */
export type DatosPersonalesCambios = Partial<Pick<PerfilUsuario, 'nombre' | 'apellido' | 'dni' | 'telefono' | 'fechaNacimiento'>>
