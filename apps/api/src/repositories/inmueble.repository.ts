import {
  InmuebleDTO,
  FotoInmuebleDTO,
  CreateFotoDTO,
  InmuebleXTagDTO,
  TagInmuebleDTO,
  FiltrosMisAlquileresDTO,
  CreateInmuebleCompletoDTO,
  FiltrosInmueblesDisponiblesDTO,
  InmueblesDisponiblesResultadoDTO
} from '../dtos';
import { getSupabaseAdmin } from '../config/supabase';
import { lookupRepository } from './lookup.repository';

export interface IInmuebleRepository {
  findAll(): Promise<InmuebleDTO[]>;
  findById(id: number): Promise<InmuebleDTO | null>;
  findByLocadorId(locadorId: number, filtros?: FiltrosMisAlquileresDTO): Promise<InmuebleDTO[]>;
  findBarriosByLocadorId(locadorId: number): Promise<string[]>;
  create(data: Omit<InmuebleDTO, 'id' | 'created_at'>): Promise<InmuebleDTO>;
  update(id: number, data: Partial<InmuebleDTO>): Promise<InmuebleDTO | null>;
  delete(id: number): Promise<boolean>;
  addFotos(idInmueble: number, fotos: CreateFotoDTO[]): Promise<FotoInmuebleDTO[]>;
  getFotosByInmuebleId(idInmueble: number): Promise<FotoInmuebleDTO[]>;
  addTags(idInmueble: number, tagIds: number[]): Promise<void>;
  getTagsByInmuebleId(idInmueble: number): Promise<TagInmuebleDTO[]>;
  poseeReclamosNoResueltos(idInmueble: number): Promise<boolean>;
  findDisponibleById(id: number): Promise<InmuebleDTO | null>;
  buscarDisponibles(filtros?: {
    barrio?: string;
    tipo?: number;
  }): Promise<InmuebleDTO[]>;
  registrarPropiedadCompleta(idLocador: number, data: CreateInmuebleCompletoDTO): Promise<InmuebleDTO>;
}

export class InmuebleRepository implements IInmuebleRepository {
  async registrarPropiedadCompleta(
    idLocador: number,
    data: CreateInmuebleCompletoDTO
  ): Promise<InmuebleDTO> {
    const { data: inmuebles, error } = await getSupabaseAdmin().rpc(
      'registrar_propiedad_completa',
      {
        p_id_locador: idLocador,
        p_data: data
      }
    );

    if (error || !inmuebles?.[0]) {
      throw error ?? new Error('No se pudo registrar la propiedad completa.');
    }

    return inmuebles[0] as InmuebleDTO;
  }

  async findAll(): Promise<InmuebleDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble')
      .select('*')
      .order('id');

    if (error) throw error;

    return (data ?? []) as InmuebleDTO[];
  }

  async findById(id: number): Promise<InmuebleDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return data as InmuebleDTO | null;
  }

  async findByLocadorId(locadorId: number, filtros?: FiltrosMisAlquileresDTO): Promise<InmuebleDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble')
      .select('*')
      .eq('id_locador', locadorId);

    if (error) throw error;

    return data as InmuebleDTO[];
  }

  async findBarriosByLocadorId(locadorId: number): Promise<string[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble')
      .select('barrio')
      .eq('id_locador', locadorId);

    if (error) throw error;

    return [
      ...new Set(
        (data ?? [])
          .map(r => r.barrio)
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b));
  }

  async create(data: Omit<InmuebleDTO, 'id' | 'created_at'>): Promise<InmuebleDTO> {
    const { data: created, error } = await getSupabaseAdmin()
      .from('inmueble')
      .insert(data)
      .select()
      .single();

    if (error) throw error;

    return created as InmuebleDTO;
  }

  async update(id: number, data: Partial<InmuebleDTO>): Promise<InmuebleDTO | null> {
    const { data: updated, error } = await getSupabaseAdmin()
      .from('inmueble')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!updated) return null;

    return updated as InmuebleDTO;
  }

  async delete(id: number): Promise<boolean> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble')
      .delete()
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return !!data;
  }

  /**
   * Agrega fotos al inmueble aplicando la regla de foto principal y orden
   */
  async addFotos(idInmueble: number, fotos: CreateFotoDTO[]): Promise<FotoInmuebleDTO[]> {
    if (fotos.length < 3) {
      throw new Error('Debe cargar al menos 3 fotos');
    }
    if (fotos.length > 50) {
      throw new Error('No se permiten más de 50 fotos');
    }
    const principales = fotos.filter(foto => foto.es_principal === true);

    if (principales.length > 1) {
      throw new Error('Solo puede existir una foto principal');
    }

    const tienePrincipal = principales.length === 1;
    
    const registros = fotos.map((foto, index) => ({
      id_inmueble: idInmueble,
      url: foto.url,
      es_principal: tienePrincipal ? Boolean(foto.es_principal) : index === 0,
      peso_kb: foto.peso_kb,
      formato: foto.formato.toLowerCase(),
      orden: index + 1
    }));

    const { data, error } = await getSupabaseAdmin()
      .from('foto_inmueble')
      .insert(registros)
      .select();

    if (error) throw error;

    return (data ?? []) as FotoInmuebleDTO[];
  }

  async getFotosByInmuebleId(idInmueble: number): Promise<FotoInmuebleDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('foto_inmueble')
      .select('*')
      .eq('id_inmueble', idInmueble)
      .order('orden');

    if (error) throw error;

    return (data ?? []) as FotoInmuebleDTO[];
  }

  async addTags(idInmueble: number, tagIds: number[]): Promise<void> {
    const registros = tagIds.map(idTag => ({
      id_inmueble: idInmueble,
      id_tag: idTag
    }));

    const { error } = await getSupabaseAdmin()
      .from('inmueble_x_tag')
      .insert(registros);

    if (error) throw error;
  }

  async getTagsByInmuebleId(idInmueble: number): Promise<TagInmuebleDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble_x_tag')
      .select(`
        tags_inmueble (
          id,
          descripcion
        )
      `)
      .eq('id_inmueble', idInmueble);

    if (error) throw error;

    return (data ?? [])
      .map((row: any) => row.tags_inmueble)
      .filter(Boolean) as TagInmuebleDTO[];
  }

  async poseeReclamosNoResueltos(idInmueble: number): Promise<boolean> {
    const { count, error } = await getSupabaseAdmin()
      .from('reclamo')
      .select('*', { count: 'exact', head: true })
      .eq('id_inmueble', idInmueble)
      .neq('id_estado_reclamo', 3);

    if (error) throw error;

    return (count ?? 0) > 0;
  }

  async findDisponibleById(id: number): Promise<InmuebleDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble')
      .select('*')
      .eq('id', id)
      .in('estado_alquiler', [
        'publicado',
        'alquilado/publicado'
      ])
      .maybeSingle();

    if (error) { throw error;}

    return data as InmuebleDTO | null;
  }

  async buscarDisponibles(filtros?: { barrio?: string; tipo?: number; }): Promise<InmuebleDTO[]> {

    let query = getSupabaseAdmin()
      .from('inmueble')
      .select('*')
      .in('estado_alquiler', [
        'publicado',
        'alquilado/publicado'
      ]);

    if (filtros?.barrio) {
      query = query.eq('barrio', filtros.barrio);
    }

    if (filtros?.tipo !== undefined) {
      query = query.eq('tipo', filtros.tipo);
    }

    const { data, error } = await query.order('id');

    if (error) {
      throw error;
    }

    return (data ?? []) as InmuebleDTO[];
  }
}

export const inmuebleRepository = new InmuebleRepository();