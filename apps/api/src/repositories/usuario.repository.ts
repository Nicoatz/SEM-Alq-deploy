import { CreateUsuarioDTO, RolDTO, UsuarioDTO } from '../dtos';
import { getSupabaseAdmin } from '../config/supabase';

const ROL_LOCATARIO_ID = 0;

export interface IUsuarioRepository {
  create(data: CreateUsuarioDTO): Promise<UsuarioDTO>;
  findByAuthUserId(authUserId: string): Promise<UsuarioDTO | null>;
  getRolesByUsuarioId(usuarioId: number): Promise<RolDTO[]>;
}

export class UsuarioRepository implements IUsuarioRepository {
  async findByAuthUserId(authUserId: string): Promise<UsuarioDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('usuario')
      .select('id, nombre, apellido, email, numero_documento, telefono, fecha_nacimiento')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) throw error;
    return data as UsuarioDTO | null;
  }

  async getRolesByUsuarioId(usuarioId: number): Promise<RolDTO[]> {
    const supabase = getSupabaseAdmin();
    const { data: relaciones, error: relacionesError } = await supabase
      .from('usuario_x_rol')
      .select('id_rol')
      .eq('id_usuario', usuarioId);

    if (relacionesError) throw relacionesError;

    const ids = (relaciones ?? []).map(relacion => relacion.id_rol);
    if (ids.length === 0) return [];

    const { data: roles, error: rolesError } = await supabase
      .from('rol')
      .select('id, descripcion')
      .in('id', ids);

    if (rolesError) throw rolesError;
    return (roles ?? []) as RolDTO[];
  }

  async create(data: CreateUsuarioDTO): Promise<UsuarioDTO> {
    const supabase = getSupabaseAdmin();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: data.email,
      password: data.contraseña,
      email_confirm: true,
      user_metadata: {
        nombre: data.nombre,
        apellido: data.apellido,
        numero_documento: data.numero_documento,
        telefono: data.telefono,
        fecha_nacimiento: data.fecha_nacimiento
      }
    });

    if (authError || !authData.user) {
      const error = new Error(authError?.message || 'No se pudo crear el usuario en Supabase Auth.');
      (error as any).statusCode = authError?.status === 422 ? 409 : 400;
      throw error;
    }

    const authUserId = authData.user.id;
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuario')
      .insert({
        auth_user_id: authUserId,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        numero_documento: data.numero_documento,
        telefono: data.telefono,
        fecha_nacimiento: data.fecha_nacimiento
      })
      .select('id, nombre, apellido, email, numero_documento, telefono, fecha_nacimiento')
      .single();

    if (usuarioError || !usuario) {
      await supabase.auth.admin.deleteUser(authUserId);
      const error = new Error(usuarioError?.message || 'No se pudo guardar el perfil del usuario.');
      (error as any).statusCode = usuarioError?.code === '23505' ? 409 : 400;
      throw error;
    }

    const { error: rolError } = await supabase
      .from('usuario_x_rol')
      .insert({ id_usuario: usuario.id, id_rol: ROL_LOCATARIO_ID });

    if (rolError) {
      await supabase.from('usuario').delete().eq('id', usuario.id);
      await supabase.auth.admin.deleteUser(authUserId);
      const error = new Error(rolError.message || 'No se pudo asignar el rol inicial al usuario.');
      (error as any).statusCode = 400;
      throw error;
    }

    return usuario as UsuarioDTO;
  }
}

export const usuarioRepository = new UsuarioRepository();