import { getSupabaseAdmin } from '../config/supabase';
import type {
  FiltrosReclamosDTO,
  FotoReclamoDTO,
  FotoReclamoPayloadDTO,
  ParticipanteReclamoDTO,
  ReclamoResponse,
  TipoReclamoDTO
} from '../dtos';
import { ESTADO_CONTRATO } from './contrato.repository';

export interface CreateReclamoEntity {
  id_inmueble: number;
  id_locatario: number;
  id_contrato: number;
  id_tipo_reclamo: number;
  titulo: string;
  descripcion: string;
}

export interface ContratoVigenteLocatarioResult {
  id: number;
  estado: number;
}

export interface IReclamoRepository {
  create(data: CreateReclamoEntity, fotos?: FotoReclamoPayloadDTO[]): Promise<ReclamoResponse>;
  findById(id: number): Promise<ReclamoResponse | null>;
  findByLocatarioId(idLocatario: number, filtros?: FiltrosReclamosDTO): Promise<ReclamoResponse[]>;
  findByLocadorId(idLocador: number, filtros?: FiltrosReclamosDTO): Promise<ReclamoResponse[]>;
  findTiposReclamo(): Promise<TipoReclamoDTO[]>;
  findTipoReclamoById(id: number): Promise<TipoReclamoDTO | null>;
  findTipoReclamoByNombre(nombre: string): Promise<TipoReclamoDTO | null>;
  findContratoVigenteLocatarioInmueble(
    idLocatario: number,
    idInmueble: number
  ): Promise<ContratoVigenteLocatarioResult | null>;
  actualizarEstado(idReclamo: number, idEstado: number): Promise<void>;
  actualizarEstadoSiPermitido(
    idReclamo: number,
    idLocatario: number,
    estadosActuales: number[],
    idEstadoNuevo: number
  ): Promise<ReclamoResponse | null>;
}

const SELECT_RECLAMO_COMPLETO = `
  *,
  tipo_reclamo(id, nombre, descripcion),
  estado_reclamo!inner(id, nombre),
  locatario:usuario!reclamo_id_locatario_fkey(id, nombre, apellido, email, telefono),
  conversacion(id),
  inmueble!inner(
    id,
    direccion,
    numero,
    piso,
    barrio,
    ciudad,
    id_locador,
    locador:usuario!inmueble_id_locador_fkey(id, nombre, apellido, email, telefono),
    fotos:foto_inmueble(url, es_principal, orden)
  ),
  fotos:foto_reclamo(id, id_reclamo, url, peso_kb, formato, orden)
`;

function mapReclamoRow(data: any): ReclamoResponse {
  const tipo = Array.isArray(data.tipo_reclamo) ? data.tipo_reclamo[0] : data.tipo_reclamo;
  const estado = Array.isArray(data.estado_reclamo) ? data.estado_reclamo[0] : data.estado_reclamo;
  if (!estado?.nombre) {
    throw new Error('No se pudo determinar el estado del reclamo.');
  }
  const inmuebleRaw = Array.isArray(data.inmueble) ? data.inmueble[0] : data.inmueble;
  const fotos = (Array.isArray(data.fotos) ? data.fotos : []) as FotoReclamoDTO[];
  fotos.sort((a, b) => a.orden - b.orden);

  const locatario = (Array.isArray(data.locatario) ? data.locatario[0] : data.locatario) as ParticipanteReclamoDTO;
  const locador = (Array.isArray(inmuebleRaw?.locador) ? inmuebleRaw.locador[0] : inmuebleRaw?.locador) as ParticipanteReclamoDTO;

  const fotosInmueble = Array.isArray(inmuebleRaw?.fotos) ? inmuebleRaw.fotos : [];
  const fotoPrincipal = fotosInmueble.find((f: any) => f.es_principal)?.url ?? fotosInmueble[0]?.url ?? null;

  return {
    id: data.id,
    id_conversacion: Array.isArray(data.conversacion) ? data.conversacion[0]?.id ?? null : data.conversacion?.id ?? null,
    id_inmueble: data.id_inmueble,
    id_locatario: data.id_locatario,
    id_contrato: data.id_contrato,
    id_tipo_reclamo: data.id_tipo_reclamo,
    id_estado_reclamo: data.id_estado_reclamo,
    titulo: data.titulo,
    descripcion: data.descripcion,
    fecha_creacion: data.fecha_creacion,
    fecha_actualizacion: data.fecha_actualizacion,
    tipo_reclamo: tipo,
    estado: estado.nombre,
    fotos,
    inmueble: {
      id: inmuebleRaw?.id ?? data.id_inmueble,
      direccion: inmuebleRaw?.direccion ?? '',
      numero: inmuebleRaw?.numero ?? 0,
      piso: inmuebleRaw?.piso ?? null,
      barrio: inmuebleRaw?.barrio ?? '',
      ciudad: inmuebleRaw?.ciudad ?? '',
      foto_principal: fotoPrincipal
    },
    locador: locador ?? { id: 0, nombre: '', email: '' },
    locatario: locatario ?? { id: data.id_locatario, nombre: '', email: '' }
  };
}

export class ReclamoRepository implements IReclamoRepository {
  async findTiposReclamo(): Promise<TipoReclamoDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('tipo_reclamo')
      .select('id, nombre, descripcion')
      .order('id', { ascending: true });

    if (error) {
      throw new Error(`Error al consultar tipos de reclamo: ${error.message}`);
    }

    return (data ?? []) as TipoReclamoDTO[];
  }

  async findTipoReclamoById(id: number): Promise<TipoReclamoDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('tipo_reclamo')
      .select('id, nombre, descripcion')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al consultar tipo de reclamo por ID: ${error.message}`);
    }

    return (data as TipoReclamoDTO) ?? null;
  }

  async findTipoReclamoByNombre(nombre: string): Promise<TipoReclamoDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('tipo_reclamo')
      .select('id, nombre, descripcion')
      .eq('nombre', nombre)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al consultar tipo de reclamo por nombre: ${error.message}`);
    }

    return (data as TipoReclamoDTO) ?? null;
  }

  async findContratoVigenteLocatarioInmueble(
    idLocatario: number,
    idInmueble: number
  ): Promise<ContratoVigenteLocatarioResult | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato_x_usuario')
      .select(`
        id_contrato,
        contrato!inner (
          id,
          id_inmueble,
          estado,
          activo
        )
      `)
      .eq('id_usuario', idLocatario)
      .eq('tipo_firmante', 2)
      .eq('contrato.id_inmueble', idInmueble)
      .eq('contrato.estado', ESTADO_CONTRATO.VIGENTE)
      .eq('contrato.activo', true)
      .limit(1);

    if (error) {
      try {
        const { data: contratos } = await getSupabaseAdmin()
          .from('contrato')
          .select('id, estado')
          .eq('id_inmueble', idInmueble)
          .eq('estado', ESTADO_CONTRATO.VIGENTE)
          .eq('activo', true);

        if (!contratos || contratos.length === 0) return null;

        const ids = contratos.map(c => c.id);
        const { data: participacion } = await getSupabaseAdmin()
          .from('contrato_x_usuario')
          .select('id_contrato')
          .in('id_contrato', ids)
          .eq('id_usuario', idLocatario)
          .eq('tipo_firmante', 2)
          .limit(1);

        if (participacion && participacion.length > 0) {
          const match = contratos.find(c => c.id === participacion[0].id_contrato);
          return match ? { id: match.id, estado: match.estado } : null;
        }

        return null;
      } catch {
        return null;
      }
    }

    if (data && data.length > 0) {
      const row = data[0];
      const contrato = Array.isArray(row.contrato) ? row.contrato[0] : row.contrato;
      return {
        id: contrato.id,
        estado: contrato.estado
      };
    }

    return null;
  }

  async create(
    data: CreateReclamoEntity,
    fotos: FotoReclamoPayloadDTO[] = []
  ): Promise<ReclamoResponse> {
    const supabase = getSupabaseAdmin();

    const { data: reclamo, error: reclamoError } = await supabase
      .from('reclamo')
      .insert({
        id_inmueble: data.id_inmueble,
        id_locatario: data.id_locatario,
        id_contrato: data.id_contrato,
        id_tipo_reclamo: data.id_tipo_reclamo,
        id_estado_reclamo: 1, // Pendiente / Abierto
        titulo: data.titulo,
        descripcion: data.descripcion
      })
      .select('*')
      .single();

    if (reclamoError || !reclamo) {
      throw new Error(`Error al registrar el reclamo: ${reclamoError?.message || 'desconocido'}`);
    }

    if (fotos && fotos.length > 0) {
      const fotosAInsertar = fotos.map((f, idx) => ({
        id_reclamo: reclamo.id,
        url: f.url,
        peso_kb: f.peso_kb,
        formato: f.formato.toLowerCase(),
        orden: f.orden ?? (idx + 1)
      }));

      const { error: fotosError } = await supabase
        .from('foto_reclamo')
        .insert(fotosAInsertar);

      if (fotosError) {
        throw new Error(`Error al asociar fotos al reclamo: ${fotosError.message}`);
      }
    }

    const reclamoCompleto = await this.findById(reclamo.id);
    if (!reclamoCompleto) {
      throw new Error('No se pudo recuperar el reclamo registrado.');
    }

    return reclamoCompleto;
  }

  async findById(id: number): Promise<ReclamoResponse | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('reclamo')
      .select(SELECT_RECLAMO_COMPLETO)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al consultar el reclamo: ${error.message}`);
    }

    if (!data) return null;

    return mapReclamoRow(data);
  }

  async findByLocatarioId(
    idLocatario: number,
    filtros?: FiltrosReclamosDTO
  ): Promise<ReclamoResponse[]> {
    let query = getSupabaseAdmin()
      .from('reclamo')
      .select(SELECT_RECLAMO_COMPLETO)
      .eq('id_locatario', idLocatario)
      .order('fecha_actualizacion', { ascending: false });

    if (filtros?.id_inmueble) {
      query = query.eq('id_inmueble', filtros.id_inmueble);
    }

    if (filtros?.estado) {
      query = query.eq('estado_reclamo.nombre', filtros.estado);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error al consultar reclamos del locatario: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    return data.map(mapReclamoRow);
  }

  async findByLocadorId(
    idLocador: number,
    filtros?: FiltrosReclamosDTO
  ): Promise<ReclamoResponse[]> {
    let query = getSupabaseAdmin()
      .from('reclamo')
      .select(SELECT_RECLAMO_COMPLETO)
      .eq('inmueble.id_locador', idLocador)
      .order('fecha_actualizacion', { ascending: false });

    if (filtros?.id_inmueble) {
      query = query.eq('id_inmueble', filtros.id_inmueble);
    }

    if (filtros?.estado) {
      query = query.eq('estado_reclamo.nombre', filtros.estado);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Error al consultar reclamos del locador: ${error.message}`);
    }

    if (!data || data.length === 0) return [];

    return data.map(mapReclamoRow);
  }

  async actualizarEstado(idReclamo: number, idEstado: number): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .from('reclamo')
      .update({
        id_estado_reclamo: idEstado,
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', idReclamo);

    if (error) {
      throw new Error(`Error al actualizar estado del reclamo: ${error.message}`);
    }
  }

  async actualizarEstadoSiPermitido(
    idReclamo: number,
    idLocatario: number,
    estadosActuales: number[],
    idEstadoNuevo: number
  ): Promise<ReclamoResponse | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('reclamo')
      .update({
        id_estado_reclamo: idEstadoNuevo,
        fecha_actualizacion: new Date().toISOString()
      })
      .eq('id', idReclamo)
      .eq('id_locatario', idLocatario)
      .in('id_estado_reclamo', estadosActuales)
      .select('id')
      .maybeSingle();

    if (error) {
      throw new Error(`Error al actualizar estado del reclamo: ${error.message}`);
    }

    if (!data) return null;

    return this.findById(data.id);
  }
}

export const reclamoRepository = new ReclamoRepository();
