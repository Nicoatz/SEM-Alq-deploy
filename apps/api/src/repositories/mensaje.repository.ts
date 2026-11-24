import { getSupabaseAdmin } from '../config/supabase';
import type { MensajeDTO } from '../dtos';

export interface CreateMensajeEntity {
  id_conversacion: number;
  id_emisor: number;
  contenido: string;
}

export interface IMensajeRepository {
  create(data: CreateMensajeEntity): Promise<MensajeDTO>;
  findByConversacionId(idConversacion: number, limite?: number): Promise<MensajeDTO[]>;
  findById(id: number): Promise<MensajeDTO | null>;
  marcarEliminado(id: number): Promise<void>;
  countByConversacionId(idConversacion: number): Promise<number>;
  podarMensajesAntiguos(idConversacion: number, maximo?: number): Promise<void>;
}

export class MensajeRepository implements IMensajeRepository {
  async create(data: CreateMensajeEntity): Promise<MensajeDTO> {
    const { data: mensaje, error } = await getSupabaseAdmin()
      .from('mensaje')
      .insert({
        id_conversacion: data.id_conversacion,
        id_emisor: data.id_emisor,
        contenido: data.contenido,
        eliminado: false
      })
      .select('*')
      .single();

    if (error || !mensaje) {
      throw new Error(`Error al enviar mensaje: ${error?.message || 'desconocido'}`);
    }

    return mensaje as MensajeDTO;
  }

  async findByConversacionId(idConversacion: number, limite = 100): Promise<MensajeDTO[]> {
    // Obtenemos los últimos `limite` mensajes ordenados cronológicamente
    const { data, error } = await getSupabaseAdmin()
      .from('mensaje')
      .select('*')
      .eq('id_conversacion', idConversacion)
      .order('fecha_envio', { ascending: false })
      .order('id', { ascending: false })
      .limit(limite);

    if (error) {
      throw new Error(`Error al listar mensajes: ${error.message}`);
    }

    if (!data) return [];

    // Los revertimos para que queden en orden cronológico ascendente (el más viejo primero, el más nuevo al final)
    return (data as MensajeDTO[]).reverse();
  }

  async findById(id: number): Promise<MensajeDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('mensaje')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al buscar mensaje: ${error.message}`);
    }

    return (data as MensajeDTO) ?? null;
  }

  async marcarEliminado(id: number): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('mensaje')
      .update({
        eliminado: true,
        fecha_eliminacion: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Error al eliminar mensaje: ${error.message}`);
    }
  }

  async countByConversacionId(idConversacion: number): Promise<number> {
    const { count, error } = await getSupabaseAdmin()
      .from('mensaje')
      .select('id', { count: 'exact', head: true })
      .eq('id_conversacion', idConversacion);

    if (error) {
      return 0;
    }

    return count ?? 0;
  }

  async podarMensajesAntiguos(idConversacion: number, maximo = 100): Promise<void> {
    // Obtiene los IDs a descartar si exceden el límite de 100
    const { data: todos } = await getSupabaseAdmin()
      .from('mensaje')
      .select('id')
      .eq('id_conversacion', idConversacion)
      .order('fecha_envio', { ascending: false })
      .order('id', { ascending: false });

    if (todos && todos.length > maximo) {
      const idsAEliminar = todos.slice(maximo).map(m => m.id);
      await getSupabaseAdmin()
        .from('mensaje')
        .delete()
        .in('id', idsAEliminar);
    }
  }
}

export const mensajeRepository = new MensajeRepository();
