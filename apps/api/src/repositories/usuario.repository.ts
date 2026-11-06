import { CreateUsuarioDTO, RolDTO, UsuarioDTO, UpdateUsuarioDTO } from '../dtos';
import { getSupabaseAdmin } from '../config/supabase';

const ROL_LOCATARIO_ID = 0;

export interface IUsuarioRepository {
  create(data: CreateUsuarioDTO): Promise<UsuarioDTO>;
  findByAuthUserId(authUserId: string): Promise<UsuarioDTO | null>;
  getRolesByUsuarioId(usuarioId: number): Promise<RolDTO[]>;
  updateByAuthUserId(authUserId: string, data: UpdateUsuarioDTO): Promise<UsuarioDTO>;
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
  
  async updateByAuthUserId(
    authUserId: string,
    data: UpdateUsuarioDTO
  ): Promise<UsuarioDTO> {
    const supabase = getSupabaseAdmin();

    // US-21: si cambia el correo, se guarda una copia de lo que había para poder revertir
    // si Supabase Auth rechaza el cambio (los dos lugares tienen que quedar iguales).
    const anterior = data.email !== undefined ? await this.findByAuthUserId(authUserId) : null;

    const { data: usuario, error } = await supabase
      .from('usuario')
      .update(data)
      .eq('auth_user_id', authUserId)
      .select(
        'id, nombre, apellido, email, numero_documento, telefono, fecha_nacimiento'
      )
      .maybeSingle();

    if (error) {
      // 23505 = violación de unicidad. Los campos únicos que se pueden tocar son el DNI y el
      // correo: se responde un mensaje claro (nunca el texto crudo de Postgres) con `codigo`
      // para que el front distinga cada 409 (y el del contrato).
      if (error.code === '23505') {
        const esCorreo = /email/i.test(`${error.message} ${error.details ?? ''}`);
        const err = new Error(
          esCorreo ? 'Ya existe una cuenta con ese correo.' : 'El DNI ya está registrado por otro usuario.'
        );
        (err as any).statusCode = 409;
        (err as any).codigo = esCorreo ? 'EMAIL_DUPLICADO' : 'DNI_DUPLICADO';
        throw err;
      }
      const err = new Error(error.message);
      (err as any).statusCode = 400;
      throw err;
    }

    if (!usuario) {
      const err = new Error('No se encontró el perfil del usuario autenticado.');
      (err as any).statusCode = 404;
      throw err;
    }

    // US-21: el correo también se cambia en Supabase Auth (el de login), ya confirmado: no se
    // manda ningún enlace. El trigger `trg_sincronizar_email_usuario` deja `usuario.email`
    // igual, así que acá no hay nada más que escribir.
    if (data.email !== undefined) {
      const { error: authError } = await supabase.auth.admin.updateUserById(authUserId, {
        email: data.email,
        email_confirm: true
      });

      if (authError) {
        // Se revierten los campos ya guardados para no dejar el perfil a medias.
        if (anterior) {
          const previo: Record<string, unknown> = {};
          for (const campo of Object.keys(data)) {
            previo[campo] = (anterior as unknown as Record<string, unknown>)[campo];
          }
          await supabase.from('usuario').update(previo).eq('auth_user_id', authUserId);
        }

        const duplicado = (authError as { code?: string }).code === 'email_exists';
        const err = new Error(
          duplicado ? 'Ya existe una cuenta con ese correo.' : 'No se pudo actualizar el correo electrónico.'
        );
        (err as any).statusCode = duplicado ? 409 : 400;
        if (duplicado) (err as any).codigo = 'EMAIL_DUPLICADO';
        throw err;
      }
    }

    return usuario as UsuarioDTO;
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