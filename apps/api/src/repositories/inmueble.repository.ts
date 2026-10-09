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
  eliminarLogicamente(
    idInmueble: number,
    idLocador: number
  ): Promise<{ success: boolean; statusCode: number; message: string }>;
  addFotos(idInmueble: number, fotos: CreateFotoDTO[]): Promise<FotoInmuebleDTO[]>;
  getFotosByInmuebleId(idInmueble: number): Promise<FotoInmuebleDTO[]>;
  addTags(idInmueble: number, tagIds: number[]): Promise<void>;
  getTagsByInmuebleId(idInmueble: number): Promise<TagInmuebleDTO[]>;
  poseeReclamosNoResueltos(idInmueble: number): Promise<boolean>;
  findDisponibleById(id: number): Promise<InmuebleDTO | null>;
  buscarDisponibles(filtros?: FiltrosInmueblesDisponiblesDTO): Promise<{
    items: InmuebleDTO[];
    total: number;
    page: number;
    limit: number;
  }>;
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
      .eq('activo', true)
      .order('id');
  
    if (error) throw error;
    return (data ?? []) as InmuebleDTO[];
  }

  async findById(id: number): Promise<InmuebleDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble')
      .select('*')
      .eq('id', id)
      .eq('activo', true)
      .maybeSingle();

    if (error) throw error;

    return data as InmuebleDTO | null;
  }

  async findByLocadorId(locadorId: number, filtros?: FiltrosMisAlquileresDTO): Promise<InmuebleDTO[]> {
    
    let query = getSupabaseAdmin()
      .from('inmueble')
      .select('*')
      .eq('id_locador', locadorId)
      .eq('activo', true);

    if (filtros?.barrio) query = query.eq('barrio', filtros.barrio);
    if (filtros?.tipo !== undefined) query = query.eq('tipo', filtros.tipo);
    if (filtros?.estado) query = query.eq('estado_alquiler', filtros.estado);

    const { data, error } = await query;

    if (error) throw error;

    return data as InmuebleDTO[];
  }

  async findBarriosByLocadorId(locadorId: number): Promise<string[]> {
        
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble')
      .select('barrio')
      .eq('id_locador', locadorId)
      .eq('activo', true);

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

  

  
async eliminarLogicamente(
  idInmueble: number,
  idLocador: number
): Promise<{ success: boolean; statusCode: number; message: string }> {
  const { data, error } = await getSupabaseAdmin().rpc(
    'eliminar_inmueble_logico',
    {
      p_id_inmueble: idInmueble,
      p_id_locador: idLocador,
    }
  );

  if (error) {
    throw error;
  }

  return data as {
    success: boolean;
    statusCode: number;
    message: string;
  };
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
      .eq('activo', true)
      .in('estado_alquiler', [
        'publicado',
        'publicado/alquilado'
      ])
      .maybeSingle();
  
    if (error) {
      throw error;
    }
  
    return data as InmuebleDTO | null;
  }

  async buscarDisponibles(filtros?: FiltrosInmueblesDisponiblesDTO): Promise<{
    items: InmuebleDTO[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filtros?.page && Number.isSafeInteger(filtros.page) && filtros.page > 0
      ? filtros.page
      : 1;
    const requestedLimit = filtros?.limit && Number.isSafeInteger(filtros.limit) && filtros.limit > 0
      ? filtros.limit
      : 1000;
    const limit = Math.min(requestedLimit, 1000);
    const supabase = getSupabaseAdmin();

    let propertyIdsForTags: number[] | undefined;
    if (filtros?.tags?.length) {
      const { data: taggedProperties, error: tagsError } = await supabase
        .from('inmueble_x_tag')
        .select('id_inmueble')
        .in('id_tag', filtros.tags);

      if (tagsError) throw tagsError;

      propertyIdsForTags = [...new Set((taggedProperties ?? []).map(row => row.id_inmueble))];
      if (propertyIdsForTags.length === 0) {
        return { items: [], total: 0, page, limit };
      }
    }

    
    
    let query = supabase
      .from('inmueble')
      .select('*, contrato!inner(monto_alquiler, indice_aumento)', { count: 'exact' })
      .eq('activo', true)
      .eq('contrato.activo', true)
      .neq('contrato.estado', 3)
      .in('estado_alquiler', [
        'publicado',
        'publicado/alquilado'
      ]);

    if (filtros?.barrio) {
      query = query.eq('barrio', filtros.barrio);
    }

    if (filtros?.tipo !== undefined) {
      query = query.eq('tipo', filtros.tipo);
    }
    if (filtros?.precioMin !== undefined) {
      query = query.gte('contrato.monto_alquiler', filtros.precioMin);
    }
    if (filtros?.precioMax !== undefined) {
      query = query.lte('contrato.monto_alquiler', filtros.precioMax);
    }
    if (filtros?.dormitorios !== undefined) {
      query = query.eq('dormitorios', filtros.dormitorios);
    }
    if (filtros?.ambientes !== undefined) {
      query = query.eq('ambientes', filtros.ambientes);
    }
    if (filtros?.superficieMin !== undefined) {
      query = query.gte('m2_totales', filtros.superficieMin);
    }
    if (filtros?.superficieMax !== undefined) {
      query = query.lte('m2_totales', filtros.superficieMax);
    }
    if (filtros?.indiceAjuste !== undefined) {
      query = query.eq('contrato.indice_aumento', filtros.indiceAjuste);
    }
    if (propertyIdsForTags) {
      query = query.in('id', propertyIdsForTags);
    }

    const ascending = filtros?.direccion !== 'desc';
    if (filtros?.orden === 'dormitorios') {
      query = query.order('dormitorios', { ascending });
    } else if (filtros?.orden === 'm2') {
      query = query.order('m2_totales', { ascending });
    }

    const from = (page - 1) * limit;
    const { data, count, error } = await query
      .order('id', { ascending: false })
      .range(from, from + limit - 1);

    if (error) {
      throw error;
    }

    return {
      items: (data ?? []) as InmuebleDTO[],
      total: count ?? 0,
      page,
      limit
    };
  }
}

export const inmuebleRepository = new InmuebleRepository();