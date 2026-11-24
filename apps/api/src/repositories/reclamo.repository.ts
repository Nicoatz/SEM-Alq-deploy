import { getSupabaseAdmin } from '../config/supabase';
import type {
  FotoReclamoDTO,
  FotoReclamoPayloadDTO,
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
  findTiposReclamo(): Promise<TipoReclamoDTO[]>;
  findTipoReclamoById(id: number): Promise<TipoReclamoDTO | null>;
  findTipoReclamoByNombre(nombre: string): Promise<TipoReclamoDTO | null>;
  findContratoVigenteLocatarioInmueble(
    idLocatario: number,
    idInmueble: number
  ): Promise<ContratoVigenteLocatarioResult | null>;
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
    // Busca en contrato_x_usuario para el locatario y el inmueble indicado
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
      // Fallback en dos pasos si el inner join de PostgREST tiene diferencias de configuración
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
      .select(`
        *,
        tipo_reclamo(id, nombre, descripcion),
        estado_reclamo(id, nombre),
        inmueble(id, direccion, numero, piso, barrio, ciudad),
        fotos:foto_reclamo(id, id_reclamo, url, peso_kb, formato, orden)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al consultar el reclamo: ${error.message}`);
    }

    if (!data) return null;

    const tipo = Array.isArray(data.tipo_reclamo) ? data.tipo_reclamo[0] : data.tipo_reclamo;
    const estado = Array.isArray(data.estado_reclamo) ? data.estado_reclamo[0] : data.estado_reclamo;
    const inmueble = Array.isArray(data.inmueble) ? data.inmueble[0] : data.inmueble;
    const fotos = (Array.isArray(data.fotos) ? data.fotos : []) as FotoReclamoDTO[];

    fotos.sort((a, b) => a.orden - b.orden);

    return {
      id: data.id,
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
      estado: estado?.nombre || 'pendiente',
      fotos,
      inmueble: inmueble ?? null
    };
  }
}

export const reclamoRepository = new ReclamoRepository();
