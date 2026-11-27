import { getSupabaseAdmin } from '../config/supabase';
import type { MensajeDTO } from '../dtos';

export interface CreateMensajeEntity {
  id_conversacion: number;
  id_emisor: number;
  contenido: string;
}

export interface ResumenMensajesConversacion {
  id_conversacion: number;
  total_mensajes: number;
  ultimo_id: number | null;
  ultimo_contenido: string | null;
  ultimo_fecha_envio: string | null;
  ultimo_id_emisor: number | null;
  ultimo_eliminado: boolean | null;
}

export interface IMensajeRepository {
  create(data: CreateMensajeEntity): Promise<MensajeDTO>;
  createEnConversacionReclamo(data: CreateMensajeEntity): Promise<MensajeDTO>;
  findResumenPorConversacionIds(idsConversacion: number[]): Promise<ResumenMensajesConversacion[]>;
  findByConversacionId(idConversacion: number, limite?: number): Promise<MensajeDTO[]>;
  findById(id: number): Promise<MensajeDTO | null>;
  marcarEliminado(id: number): Promise<void>;
  marcarEliminadoEnConversacionReclamo(idMensaje: number, idEmisor: number): Promise<void>;
  countByConversacionId(idConversacion: number): Promise<number>;
  podarMensajesAntiguos(idConversacion: number, maximo?: number): Promise<void>;
}

export class MensajeRepository implements IMensajeRepository {
  private errorRpc(error: { code?: string; message: string }): Error & { statusCode?: number; codigo?: string } {
    const mapped = new Error(error.message) as Error & { statusCode?: number; codigo?: string };
    if (error.code === 'P0001' && error.message.includes('ESTADO_INVALIDO')) {
      mapped.statusCode = 409;
      mapped.codigo = 'ESTADO_INVALIDO';
    } else if (error.code === 'P0001' && error.message.includes('MENSAJE_YA_ELIMINADO')) {
      mapped.statusCode = 409;
      mapped.codigo = 'MENSAJE_YA_ELIMINADO';
    } else if (error.code === 'P0002') {
      mapped.statusCode = 404;
    } else if (error.code === '42501') {
      mapped.statusCode = 403;
    } else if (error.code === '22023') {
      mapped.statusCode = 400;
    }
    return mapped;
  }

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

  async createEnConversacionReclamo(data: CreateMensajeEntity): Promise<MensajeDTO> {
    const { data: mensaje, error } = await getSupabaseAdmin().rpc('enviar_mensaje_reclamo', {
      p_id_conversacion: data.id_conversacion,
      p_id_emisor: data.id_emisor,
      p_contenido: data.contenido
    });

    if (error) throw this.errorRpc(error);
    return mensaje as MensajeDTO;
  }

  async findResumenPorConversacionIds(idsConversacion: number[]): Promise<ResumenMensajesConversacion[]> {
    if (idsConversacion.length === 0) return [];

    const { data, error } = await getSupabaseAdmin().rpc('resumen_mensajes_conversaciones', {
      p_ids_conversacion: idsConversacion
    });

    if (error) throw new Error(`Error al consultar resumen de mensajes: ${error.message}`);
    return (data ?? []) as ResumenMensajesConversacion[];
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
    const { data, error } = await getSupabaseAdmin()
      .from('mensaje')
      .update({
        eliminado: true,
        fecha_eliminacion: new Date().toISOString()
      })
      .eq('id', id)
      .eq('eliminado', false)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Error al eliminar mensaje: ${error.message}`);
    }

    if (!data) {
      throw Object.assign(new Error('El mensaje ya fue eliminado.'), {
        statusCode: 409,
        codigo: 'MENSAJE_YA_ELIMINADO'
      });
    }
  }

  async marcarEliminadoEnConversacionReclamo(idMensaje: number, idEmisor: number): Promise<void> {
    const { data, error } = await getSupabaseAdmin().rpc('eliminar_mensaje_reclamo', {
      p_id_mensaje: idMensaje,
      p_id_emisor: idEmisor
    });

    if (error) throw this.errorRpc(error);
    if (!data) throw new Error('No se pudo eliminar el mensaje del reclamo.');
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
