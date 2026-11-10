/**
 * perfil.ts — el perfil del usuario en sesión, tal como lo ve la pantalla
 * "Mi perfil" (`/panel/perfil`).
 *
 * Qué es: TIPOS DE VISTA DEL FRONT. Cubren US-20 Consultar usuario y US-21
 * Modificar usuario. Los datos personales usan los mismos nombres que
 * `UsuarioSesion` (es la misma persona, con más datos). El legajo salió de
 * US-20 y US-21 el 06/11: la solicitud (US-35) tiene el suyo
 * (`LegajoSolicitud`).
 *
 * Adaptador que los produce:
 * `apps/web/src/services/adapters/perfil.adapter.ts` (contra los DTO
 * de `GET /usuarios/me`, ver `docs/api-endpoints.md`).
 *
 * NOTA de privacidad (US-20): el DNI solo se muestra en el perfil y en el
 * detalle de una solicitud enviada, nunca en listados. Por eso
 * este tipo NO se mezcla con `UsuarioSesion`, que viaja por todo el panel.
 *
 * Quién lo usa: `apps/web/src/services/perfil.service.ts` y
 * `apps/web/src/components/perfil/*`.
 */
import type { UserRole } from './status'

/**
 * Contrato que impide cambiar nombre, apellido y DNI (US-21: "no se pueden
 * modificar si el usuario es parte de un contrato vigente o pendiente de
 * firma; en ese caso se debe explicar el motivo").
 */
export interface BloqueoIdentidad {
  /** Código del contrato, ej. `CT-2026-0148`; `null` si el contrato no tiene código (no se muestra). */
  contractCode: string | null
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
   * Teléfono canónico E.164 (`+543515550101`); `null` = no cargado.
   * NOTA: en modo real, si el back lo guardó sin código de país (los 10
   * dígitos del seed), llegan los dígitos tal cual, SIN "+"
   * (`telefonoDelBack` en `apps/web/src/lib/perfil/formato.ts`).
   */
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
}

/**
 * Cambios de "Datos personales" (US-21). Solo viajan los campos que se
 * modificaron. El correo va con los demás: el back lo aplica en el momento,
 * sin enlace de confirmación (US-21 actualizada el 06/11).
 */
export type DatosPersonalesCambios = Partial<Pick<PerfilUsuario, 'nombre' | 'apellido' | 'dni' | 'email' | 'telefono' | 'fechaNacimiento'>>
