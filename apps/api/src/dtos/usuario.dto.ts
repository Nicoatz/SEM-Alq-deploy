import type { Usuario } from '@rentar/shared-types';

/** Contrato que bloquea nombre, apellido y DNI (US-21). */
export interface BloqueoIdentidadDTO {
  codigo: string | null;
  estado: 'vigente' | 'pendiente_firma';
}

/** Perfil que devuelven `GET` y `PATCH /usuarios/me`: el usuario más el bloqueo de identidad. */
export type PerfilUsuarioDTO = Usuario & { bloqueo_identidad: BloqueoIdentidadDTO | null };

export type { Rol as RolDTO, UsuarioXRol as UsuarioXRolDTO } from '@rentar/shared-types';
export type { 
    CreateUsuarioPayload as CreateUsuarioDTO, 
    Usuario as UsuarioDTO,
    UpdateUsuarioPayload as UpdateUsuarioDTO
} from '@rentar/shared-types';
 
