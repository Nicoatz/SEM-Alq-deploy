import {
  TipoInmuebleDTO,
  TagInmuebleDTO,
  ServicioDTO,
  RolDTO,
  UsuarioDTO,
  TipoIndiceDTO,
  EstadoContratoDTO,
  MedioPagoDTO
} from '../dtos';
import { getSupabaseAdmin } from '../config/supabase';

export class LookupRepository {
  async getTipoById(id: number): Promise<TipoInmuebleDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('tipo_inmueble').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as TipoInmuebleDTO | null;
  }

  async getAllTipos(): Promise<TipoInmuebleDTO[]> {
    const { data, error } = await getSupabaseAdmin().from('tipo_inmueble').select('*').order('id');
    if (error) throw error;
    return (data ?? []) as TipoInmuebleDTO[];
  }

  async getTagById(id: number): Promise<TagInmuebleDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('tags_inmueble').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as TagInmuebleDTO | null;
  }

  async getAllTags(): Promise<TagInmuebleDTO[]> {
    const { data, error } = await getSupabaseAdmin().from('tags_inmueble').select('*').order('id');
    if (error) throw error;
    return (data ?? []) as TagInmuebleDTO[];
  }

  async getServicioById(id: number): Promise<ServicioDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('servicio').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as ServicioDTO | null;
  }

  async getAllServicios(): Promise<ServicioDTO[]> {
    const { data, error } = await getSupabaseAdmin().from('servicio').select('*').order('id');
    if (error) throw error;
    return (data ?? []) as ServicioDTO[];
  }

  async getTipoIndiceById(id: number): Promise<TipoIndiceDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('tipo_indice').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as TipoIndiceDTO | null;
  }

  async getEstadoContratoById(id: number): Promise<EstadoContratoDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('estado_contrato').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as EstadoContratoDTO | null;
  }

  async getMedioPagoById(id: number): Promise<MedioPagoDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('medio_pago').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as MedioPagoDTO | null;
  }

  async getAllMediosPago(): Promise<MedioPagoDTO[]> {
    const { data, error } = await getSupabaseAdmin().from('medio_pago').select('*').order('id');
    if (error) throw error;
    return (data ?? []) as MedioPagoDTO[];
  }

  async getRolById(id: number): Promise<RolDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('rol').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as RolDTO | null;
  }

  async getUsuarioById(id: number): Promise<UsuarioDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('usuario')
      .select('id, nombre, apellido, email, numero_documento, telefono, fecha_nacimiento')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data as UsuarioDTO | null;
  }

  async getRolesByUsuarioId(idUsuario: number): Promise<RolDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('usuario_x_rol')
      .select('id_rol, rol(id, descripcion)')
      .eq('id_usuario', idUsuario);
    if (error) throw error;
    return (data ?? []).map((row: any) => row.rol).filter(Boolean) as RolDTO[];
  }
}

export const lookupRepository = new LookupRepository();
