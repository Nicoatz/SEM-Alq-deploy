import { getSupabaseAdmin } from '../config/supabase';
import type {
  ConversacionDTO,
  ConversacionResponse,
  ConversacionDetalleResponse,
  InmuebleConversacionDTO,
  ParticipanteConversacionDTO,
  TipoTemaConversacionDTO
} from '../dtos';
import { ESTADO_CONTRATO } from './contrato.repository';

export interface CreateConversacionEntity {
  id_locador: number;
  id_locatario: number;
  iniciado_por: number;
  tipo_tema: TipoTemaConversacionDTO;
  asunto: string;
  id_inmueble?: number | null;
  id_reclamo?: number | null;
  id_contrato?: number | null;
}

export interface IConversacionRepository {
  create(data: CreateConversacionEntity): Promise<ConversacionDTO>;
  findById(id: number): Promise<ConversacionDetalleResponse | null>;
  findByUsuarioId(idUsuario: number): Promise<ConversacionResponse[]>;
  findActivaPorParticipantesEInmueble(
    idLocador: number,
    idLocatario: number,
    idInmueble: number | null
  ): Promise<ConversacionResponse | null>;
  findByReclamoId(idReclamo: number): Promise<ConversacionResponse | null>;
  existeContratoVigente(
    idLocador: number,
    idLocatario: number,
    idContrato?: number,
    idInmueble?: number
  ): Promise<boolean>;
  actualizarFechaActividad(idConversacion: number): Promise<void>;
}

const SELECT_INMUEBLE_CONVERSACION = `
  id, direccion, numero, piso, barrio, ciudad,
  fotos:foto_inmueble(url, es_principal, orden)
`;

function mapInmuebleConversacion(raw: any): InmuebleConversacionDTO | null {
  const inmueble = Array.isArray(raw) ? raw[0] : raw;
  if (!inmueble) return null;

  const fotos = Array.isArray(inmueble.fotos) ? inmueble.fotos : [];
  const fotoPrincipal = fotos.find((foto: any) => foto.es_principal)?.url
    ?? [...fotos].sort((a: any, b: any) => a.orden - b.orden)[0]?.url
    ?? null;

  return {
    id: inmueble.id,
    direccion: inmueble.direccion,
    numero: inmueble.numero,
    piso: inmueble.piso,
    barrio: inmueble.barrio,
    ciudad: inmueble.ciudad,
    foto_principal: fotoPrincipal
  };
}

export class ConversacionRepository implements IConversacionRepository {
  async create(data: CreateConversacionEntity): Promise<ConversacionDTO> {
    const { data: conversacion, error } = await getSupabaseAdmin()
      .from('conversacion')
      .insert({
        id_locador: data.id_locador,
        id_locatario: data.id_locatario,
        iniciado_por: data.iniciado_por,
        tipo_tema: data.tipo_tema,
        asunto: data.asunto,
        id_inmueble: data.id_inmueble ?? null,
        id_reclamo: data.id_reclamo ?? null,
        id_contrato: data.id_contrato ?? null,
        activo: true
      })
      .select('*')
      .single();

    if (error || !conversacion) {
      throw Object.assign(
        new Error(`Error al crear la conversación: ${error?.message || 'desconocido'}`),
        { code: error?.code }
      );
    }

    return conversacion as ConversacionDTO;
  }

  async findById(id: number): Promise<ConversacionDetalleResponse | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('conversacion')
      .select(`
        *,
        locador:usuario!conversacion_id_locador_fkey(id, nombre, apellido, email, telefono),
        locatario:usuario!conversacion_id_locatario_fkey(id, nombre, apellido, email, telefono),
        inmueble(${SELECT_INMUEBLE_CONVERSACION})
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al buscar la conversación: ${error.message}`);
    }

    if (!data) return null;

    const locador = (Array.isArray(data.locador) ? data.locador[0] : data.locador) as ParticipanteConversacionDTO;
    const locatario = (Array.isArray(data.locatario) ? data.locatario[0] : data.locatario) as ParticipanteConversacionDTO;
    const inmueble = Array.isArray(data.inmueble) ? data.inmueble[0] : data.inmueble;

    return {
      id: data.id,
      id_locador: data.id_locador,
      id_locatario: data.id_locatario,
      iniciado_por: data.iniciado_por,
      tipo_tema: data.tipo_tema,
      asunto: data.asunto,
      id_inmueble: data.id_inmueble,
      id_reclamo: data.id_reclamo,
      id_contrato: data.id_contrato,
      activo: data.activo,
      fecha_creacion: data.fecha_creacion,
      fecha_actualizacion: data.fecha_actualizacion,
      locador,
      locatario,
      inmueble: mapInmuebleConversacion(inmueble),
      otro_participante: locador // Se ajusta en el servicio según quién consulte
    };
  }

  async findByUsuarioId(idUsuario: number): Promise<ConversacionResponse[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('conversacion')
      .select(`
        *,
        locador:usuario!conversacion_id_locador_fkey(id, nombre, apellido, email, telefono),
        locatario:usuario!conversacion_id_locatario_fkey(id, nombre, apellido, email, telefono),
        inmueble(${SELECT_INMUEBLE_CONVERSACION})
      `)
      .or(`id_locador.eq.${idUsuario},id_locatario.eq.${idUsuario}`)
      .eq('activo', true)
      .neq('tipo_tema', 'reclamo')
      .order('fecha_actualizacion', { ascending: false });

    if (error) {
      throw new Error(`Error al listar conversaciones: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    return data.map(item => {
      const locador = (Array.isArray(item.locador) ? item.locador[0] : item.locador) as ParticipanteConversacionDTO;
      const locatario = (Array.isArray(item.locatario) ? item.locatario[0] : item.locatario) as ParticipanteConversacionDTO;
      const otro = item.id_locador === idUsuario ? locatario : locador;

      return {
        id: item.id,
        id_locador: item.id_locador,
        id_locatario: item.id_locatario,
        iniciado_por: item.iniciado_por,
        tipo_tema: item.tipo_tema,
        asunto: item.asunto,
        id_inmueble: item.id_inmueble,
        id_reclamo: item.id_reclamo,
        id_contrato: item.id_contrato,
        activo: item.activo,
        fecha_creacion: item.fecha_creacion,
        fecha_actualizacion: item.fecha_actualizacion,
        inmueble: mapInmuebleConversacion(item.inmueble),
        otro_participante: otro
      };
    });
  }

  async findActivaPorParticipantesEInmueble(
    idLocador: number,
    idLocatario: number,
    idInmueble: number | null
  ): Promise<ConversacionResponse | null> {
    let query = getSupabaseAdmin()
      .from('conversacion')
      .select(`
        *,
        locador:usuario!conversacion_id_locador_fkey(id, nombre, apellido, email, telefono),
        locatario:usuario!conversacion_id_locatario_fkey(id, nombre, apellido, email, telefono),
        inmueble(${SELECT_INMUEBLE_CONVERSACION})
      `)
      .eq('id_locador', idLocador)
      .eq('id_locatario', idLocatario)
      .neq('tipo_tema', 'reclamo')
      .eq('activo', true);

    query = idInmueble === null
      ? query.is('id_inmueble', null)
      : query.eq('id_inmueble', idInmueble);

    const { data, error } = await query
      .order('fecha_creacion', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Error al buscar conversación existente: ${error.message}`);
    if (!data) return null;

    const locador = (Array.isArray(data.locador) ? data.locador[0] : data.locador) as ParticipanteConversacionDTO;
    const locatario = (Array.isArray(data.locatario) ? data.locatario[0] : data.locatario) as ParticipanteConversacionDTO;

    return {
      ...data,
      inmueble: mapInmuebleConversacion(data.inmueble),
      otro_participante: idLocador === data.id_locador ? locatario : locador
    } as ConversacionResponse;
  }

  async existeContratoVigente(
    idLocador: number,
    idLocatario: number,
    idContrato?: number,
    idInmueble?: number
  ): Promise<boolean> {
    // Busca contratos vigentes y activos donde el locador sea dueño del inmueble o firmante
    // y el locatario sea firmante tipo 2
    let query = getSupabaseAdmin()
      .from('contrato_x_usuario')
      .select(`
        id_contrato,
        contrato!inner (
          id,
          estado,
          activo,
          inmueble!inner (
            id_locador
          )
        )
      `)
      .eq('id_usuario', idLocatario)
      .eq('tipo_firmante', 2)
      .eq('contrato.estado', ESTADO_CONTRATO.VIGENTE)
      .eq('contrato.activo', true)
      .eq('contrato.inmueble.id_locador', idLocador);

    if (idContrato !== undefined) query = query.eq('contrato.id', idContrato);
    if (idInmueble !== undefined) query = query.eq('contrato.id_inmueble', idInmueble);

    const { data, error } = await query;

    if (error) {
      // Si falla por foreign key o estructura PostgREST, fallback a consulta de dos pasos
      try {
        let contratosQuery = getSupabaseAdmin()
          .from('contrato')
          .select('id, inmueble!inner(id_locador)')
          .eq('estado', ESTADO_CONTRATO.VIGENTE)
          .eq('activo', true)
          .eq('inmueble.id_locador', idLocador);

        if (idContrato !== undefined) contratosQuery.eq('id', idContrato);
        if (idInmueble !== undefined) contratosQuery.eq('id_inmueble', idInmueble);

        const { data: contratosLocador } = await contratosQuery;

        if (!contratosLocador || contratosLocador.length === 0) return false;

        const idsContrato = contratosLocador.map(c => c.id);
        const { data: participacion } = await getSupabaseAdmin()
          .from('contrato_x_usuario')
          .select('id')
          .in('id_contrato', idsContrato)
          .eq('id_usuario', idLocatario)
          .eq('tipo_firmante', 2)
          .limit(1);

        return Boolean(participacion && participacion.length > 0);
      } catch {
        return false;
      }
    }

    return Boolean(data && data.length > 0);
  }

  async findByReclamoId(idReclamo: number): Promise<ConversacionResponse | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('conversacion')
      .select(`
        *,
        locador:usuario!conversacion_id_locador_fkey(id, nombre, apellido, email, telefono),
        locatario:usuario!conversacion_id_locatario_fkey(id, nombre, apellido, email, telefono)
      `)
      .eq('id_reclamo', idReclamo)
      .eq('activo', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al buscar conversación del reclamo: ${error.message}`);
    }

    if (!data) return null;

    const locador = (Array.isArray(data.locador) ? data.locador[0] : data.locador) as ParticipanteConversacionDTO;
    const locatario = (Array.isArray(data.locatario) ? data.locatario[0] : data.locatario) as ParticipanteConversacionDTO;

    return {
      id: data.id,
      id_locador: data.id_locador,
      id_locatario: data.id_locatario,
      iniciado_por: data.iniciado_por,
      tipo_tema: data.tipo_tema,
      asunto: data.asunto,
      id_inmueble: data.id_inmueble,
      id_reclamo: data.id_reclamo,
      id_contrato: data.id_contrato,
      activo: data.activo,
      fecha_creacion: data.fecha_creacion,
      fecha_actualizacion: data.fecha_actualizacion,
      otro_participante: locador
    };
  }

  async actualizarFechaActividad(idConversacion: number): Promise<void> {
    await getSupabaseAdmin()
      .from('conversacion')
      .update({ fecha_actualizacion: new Date().toISOString() })
      .eq('id', idConversacion);
  }
}

export const conversacionRepository = new ConversacionRepository();
