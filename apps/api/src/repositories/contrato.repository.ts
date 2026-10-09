import { ContratoDTO, MedioPagoDTO, UsuarioDTO } from '../dtos';
import { getSupabaseAdmin } from '../config/supabase';

export interface IContratoRepository {
  findById(id: number): Promise<ContratoDTO | null>;
  findByInmuebleId(inmuebleId: number): Promise<ContratoDTO | null>;
  create(data: Omit<ContratoDTO, 'id'>, mediosPagoIds: number[]): Promise<ContratoDTO>;
  getMediosPagoByContratoId(contratoId: number): Promise<MedioPagoDTO[]>;
  getLocatarioByContratoId(contratoId: number): Promise<UsuarioDTO | null>;
  delete(id: number): Promise<boolean>;
}

export class ContratoRepository implements IContratoRepository {
  async findById(id: number): Promise<ContratoDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('contrato').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as ContratoDTO | null;
  }

  async findByInmuebleId(inmuebleId: number): Promise<ContratoDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato')
      .select('*')
      .eq('id_inmueble', inmuebleId)
      .eq('activo', true)
      .order('id', { ascending: false });
    if (error) throw error;

    // NOTA: un inmueble puede tener varios contratos (historial de finalizados). Con
    // maybeSingle() eso rompía con "multiple (or no) rows returned". Se prefiere el
    // contrato no finalizado (estado 3) más reciente; si no hay, el último.
    const contratos = (data ?? []) as ContratoDTO[];
    return contratos.find(c => c.estado !== 3) ?? contratos[0] ?? null;
  }

  

  async create(
    data: Omit<ContratoDTO, 'id'>,
    mediosPagoIds: number[]
  ): Promise<ContratoDTO> {
    const supabase = getSupabaseAdmin();
    const { data: contrato, error } = await supabase.from('contrato').insert(data).select('*').single();
    if (error || !contrato) throw error ?? new Error('No se pudo crear el contrato.');

    const relaciones = mediosPagoIds.map(id_medio_pago => ({ id_contrato: contrato.id, id_medio_pago }));
    const { error: mediosError } = await supabase.from('medio_pago_x_contrato').insert(relaciones);
    if (mediosError) {
      await this.delete(contrato.id);
      throw mediosError;
    }
    return contrato as ContratoDTO;
  }

  async getMediosPagoByContratoId(contratoId: number): Promise<MedioPagoDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('medio_pago_x_contrato')
      .select('medio_pago(id, nombre, descripcion)')
      .eq('id_contrato', contratoId);
    if (error) throw error;
    return (data ?? []).map((row: any) => row.medio_pago).filter(Boolean) as MedioPagoDTO[];
  }

  async getLocatarioByContratoId(contratoId: number): Promise<UsuarioDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato_x_usuario')
      .select('usuario(id, nombre, apellido, email, numero_documento, telefono, fecha_nacimiento)')
      .eq('id_contrato', contratoId)
      .eq('tipo_firmante', 2)
      .limit(1);

    if (error) throw error;

    // NOTA: limit(1) en vez de maybeSingle() para no fallar si hubiera más de un locatario principal.
    const relacion = (data as unknown as { usuario: UsuarioDTO | null }[] | null)?.[0];
    return relacion?.usuario ?? null;
  }

  async delete(id: number): Promise<boolean> {
    const { error, count } = await getSupabaseAdmin()
      .from('contrato')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }
}

export const contratoRepository = new ContratoRepository();
