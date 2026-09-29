/**
 * usuario-sesion.ts — el usuario logueado, tal como lo ve el frontend.
 *
 * Qué es: TIPO DE VISTA DEL FRONT. No confundir con `Usuario` (modelo del
 * back, tabla `usuario`, exportado desde `index.ts`): ese tiene `id`
 * numérico y no trae roles; este junta el usuario con sus roles, que el
 * back guarda aparte (`usuario_x_rol`).
 *
 * Adaptador que los conecta:
 * `apps/web/src/services/adapters/usuario.adapter.ts#usuarioMeToSesion`
 * (respuesta de `GET /usuarios/me`, con sus roles → `UsuarioSesion`).
 *
 * Quién lo usa: `AuthProvider` (US-39), el `AppShell`/`UserMenu` del panel y
 * el registro (US-19).
 */
import type { UserRole, UsuarioStatus } from './status'

/**
 * Cuenta en sesión. Un mismo usuario puede tener más de un rol (caso Sofía
 * Ledesma: locadora de una propiedad y locataria de otra) — el rol *activo*
 * en un momento dado no es parte de este tipo, vive en la sesión
 * (`AuthProvider` de `apps/web`).
 */
export interface UsuarioSesion {
  /**
   * Id del usuario, siempre como texto. En modo mock es el id del elenco
   * (`usr-nicolas`); con el back real es el id numérico convertido a texto
   * (`'1'`). La API no lo recibe: el usuario viaja en el token de Supabase
   * (`Authorization: Bearer`).
   */
  id: string
  nombre: string
  apellido: string
  email: string
  roles: UserRole[]
  status: UsuarioStatus
  avatarUrl?: string
  telefono?: string
  /** Número de documento (US-19). */
  dni?: string
  /** Fecha de nacimiento en formato ISO `YYYY-MM-DD` (US-19). */
  fechaNacimiento?: string
}
