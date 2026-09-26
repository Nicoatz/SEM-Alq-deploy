import {
  InmuebleDTO,
  FotoInmuebleDTO,
  CreateFotoDTO,
  InmuebleXTagDTO,
  TagInmuebleDTO,
  FiltrosInmueblesDisponiblesDTO,
  InmueblesDisponiblesResultadoDTO
} from '../dtos';

import { getSupabaseAdmin } from '../config/supabase';

export interface IInmuebleRepository {
  findAll(): Promise<InmuebleDTO[]>;
  findById(id: number): Promise<InmuebleDTO | null>;
  findByLocadorId(locadorId: number): Promise<InmuebleDTO[]>;
  buscarDisponibles(filtros: FiltrosInmueblesDisponiblesDTO): Promise<InmueblesDisponiblesResultadoDTO>;
  create(data: Omit<InmuebleDTO, 'id'>): Promise<InmuebleDTO>;
  update(id: number, data: Partial<InmuebleDTO>): Promise<InmuebleDTO | null>;
  delete(id: number): Promise<boolean>;
  addFotos(idInmueble: number, fotos: CreateFotoDTO[]): Promise<FotoInmuebleDTO[]>;
  getFotosByInmuebleId(idInmueble: number): Promise<FotoInmuebleDTO[]>;
  addTags(idInmueble: number, tagIds: number[]): Promise<void>;
  getTagsByInmuebleId(idInmueble: number): Promise<TagInmuebleDTO[]>;
}

export class InmuebleRepository implements IInmuebleRepository {
  async findAll(): Promise<InmuebleDTO[]> {
    const { data, error } = await getSupabaseAdmin().from('inmueble').select('*').order('id');
    if (error) throw error;
    return (data ?? []) as InmuebleDTO[];
  }

  async findById(id: number): Promise<InmuebleDTO | null> {
    const { data, error } = await getSupabaseAdmin().from('inmueble').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data as InmuebleDTO | null;
  }

  async findByLocadorId(locadorId: number): Promise<InmuebleDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble')
      .select('*')
      .eq('id_locador', locadorId)
      .order('id');
    if (error) throw error;
    return (data ?? []) as InmuebleDTO[];
  }

  async buscarDisponibles(
    filtros: FiltrosInmueblesDisponiblesDTO
  ): Promise<InmueblesDisponiblesResultadoDTO> {

    const page = filtros.page && filtros.page > 0
      ? filtros.page
      : 1;

    const limit = filtros.limit && filtros.limit > 0
      ? filtros.limit
      : 10;

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      let idsFiltradosPorTags: number[] | null = null;
      
      if (filtros.tags && filtros.tags.length > 0) {
        const { data: tagsRows, error: tagsError } = await getSupabaseAdmin()
          .from('inmueble_x_tag')
          .select('id_inmueble')
          .in('id_tag', filtros.tags);
      
        if (tagsError) {
          throw tagsError;
        }
      
        idsFiltradosPorTags = [
          ...new Set(
            (tagsRows ?? []).map(row => row.id_inmueble)
          )
        ];
      
        if (idsFiltradosPorTags.length === 0) {
          return {
            items: [],
            total: 0,
            page,
            limit,
            totalPages: 0
          };
        }
      }
      
    let query = getSupabaseAdmin()
    .from('inmueble')
    .select(`
      *,
      tipo_inmueble (
        id,
        descripcion
      ),
      servicio (
        id,
        nombre,
        descripcion
      ),
      contrato!inner (
        id,
        monto_alquiler,
        expensas,
        indice_aumento,
        frecuencia_ajuste,
        tipo_indice (
          id,
          descripcion
        )
      ),
      foto_inmueble (
        id,
        url,
        es_principal,
        orden
      ),
      inmueble_x_tag (
        id_tag,
        tags_inmueble (
          id,
          descripcion,
          estado
        )
      )
    `, { count: 'exact' })
    .in(
      'estado_alquiler',
      ['publicado', 'alquilado_disponible']
    );

    if (filtros.barrio) {
      query = query.ilike(
        'barrio',
        `%${filtros.barrio}%`
      );
    }

    if (filtros.tipo !== undefined) {
      query = query.eq(
        'tipo',
        filtros.tipo
      );
    }

    if (filtros.dormitorios !== undefined) {
      query = query.eq(
        'dormitorios',
        filtros.dormitorios
      );
    }

    if (filtros.ambientes !== undefined) {
      query = query.eq(
        'ambientes',
        filtros.ambientes
      );
    }

    if (filtros.superficieMin !== undefined) {
      query = query.gte(
        'm2_totales',
        filtros.superficieMin
      );
    }

    if (filtros.superficieMax !== undefined) {
      query = query.lte(
        'm2_totales',
        filtros.superficieMax
      );
    }

    if (filtros.precioMin !== undefined) {
      query = query.gte(
        'contrato.monto_alquiler',
        filtros.precioMin
      );
    }

    if (filtros.precioMax !== undefined) {
      query = query.lte(
        'contrato.monto_alquiler',
        filtros.precioMax
      );
    }

    if (filtros.indiceAjuste !== undefined) {
      query = query.eq(
        'contrato.indice_aumento',
        filtros.indiceAjuste
      );
    }

    if (idsFiltradosPorTags !== null) {
      query = query.in('id', idsFiltradosPorTags);
    }
    
    // Ordenamiento
    if (filtros.orden === 'precio') {
      query = query.order('monto_alquiler', {
        foreignTable: 'contrato',
        ascending: filtros.direccion !== 'desc'
      });
    } else if (filtros.orden === 'dormitorios') {
      query = query.order('dormitorios', {
        ascending: filtros.direccion !== 'desc'
      });
    } else if (filtros.orden === 'm2') {
      query = query.order('m2_totales', {
        ascending: filtros.direccion !== 'desc'
      });
    } else {
      // Orden por defecto
      query = query.order('id', {
        ascending: false
      });
    }
    
    //Paginación
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const inmuebles = data ?? [];

    const items = inmuebles.map((inmueble: any) => {
      const contrato = Array.isArray(inmueble.contrato)
        ? inmueble.contrato[0]
        : inmueble.contrato;
    
      const tipo = Array.isArray(inmueble.tipo_inmueble)
        ? inmueble.tipo_inmueble[0]
        : inmueble.tipo_inmueble;
    
      const fotos = inmueble.foto_inmueble ?? [];
    
      const fotoPrincipal =
        fotos.find((foto: any) => foto.es_principal === true) ??
        fotos[0] ??
        null;
    
      const tags = (inmueble.inmueble_x_tag ?? [])
        .map((relacion: any) => relacion.tags_inmueble)
        .filter(Boolean)
        .map((tag: any) => ({
          id: tag.id,
          descripcion: tag.descripcion
        }));
    
      const tipoIndice = contrato?.tipo_indice
        ? Array.isArray(contrato.tipo_indice)
          ? contrato.tipo_indice[0]
          : contrato.tipo_indice
        : null;
    
      return {
        id: inmueble.id,
    
        tipo: {
          id: tipo?.id,
          descripcion: tipo?.descripcion
        },
    
        direccion: inmueble.direccion,
        numero: inmueble.numero,
        piso: inmueble.piso ?? null,
    
        ciudad: inmueble.ciudad,
        barrio: inmueble.barrio,
        provincia: inmueble.provincia,
    
        ambientes: inmueble.ambientes,
        dormitorios: inmueble.dormitorios,
        banos: inmueble.banos,
    
        m2_totales: inmueble.m2_totales,
        m2_cubiertos: inmueble.m2_cubiertos,
    
        descripcion: inmueble.descripcion ?? null,
    
        precio: Number(contrato?.monto_alquiler ?? 0),
        expensas: Number(contrato?.expensas ?? 0),
    
        indice_ajuste: tipoIndice
          ? {
              id: tipoIndice.id,
              descripcion: tipoIndice.descripcion
            }
          : null,
    
        fecha_disponible: inmueble.fecha_disponible ?? null,
    
        tags,
    
        foto_principal: fotoPrincipal?.url ?? null
      };
    });

    const total = count ?? 0;

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async create(
    data: Omit<InmuebleDTO, 'id'>
  ): Promise<InmuebleDTO> {

    const { data: inmueble, error } = await getSupabaseAdmin()
      .from('inmueble')
      .insert(data)
      .select('*')
      .single();

    if (error || !inmueble) {
      throw error ?? new Error('No se pudo crear el inmueble.');
    }

    return inmueble as InmuebleDTO;
  }

  async update(id: number, data: Partial<InmuebleDTO>): Promise<InmuebleDTO | null> {
    const { data: inmueble, error } = await getSupabaseAdmin()
      .from('inmueble')
      .update(data)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw error;
    return inmueble as InmuebleDTO | null;
  }

  async delete(id: number): Promise<boolean> {
    const { error, count } = await getSupabaseAdmin()
      .from('inmueble')
      .delete({ count: 'exact' })
      .eq('id', id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async addFotos(idInmueble: number, fotos: CreateFotoDTO[]): Promise<FotoInmuebleDTO[]> {
    const tienePrincipal = fotos.some(foto => foto.es_principal === true);
    const filas = fotos.map((foto, index) => ({
      id_inmueble: idInmueble,
      url: foto.url,
      es_principal: tienePrincipal ? Boolean(foto.es_principal) : index === 0,
      peso_kb: foto.peso_kb,
      formato: foto.formato.toLowerCase(),
      orden: index + 1
    }));
    const { data, error } = await getSupabaseAdmin().from('foto_inmueble').insert(filas).select('*');
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
    const filas = tagIds.map(id_tag => ({ id_inmueble: idInmueble, id_tag }));
    const { error } = await getSupabaseAdmin().from('inmueble_x_tag').insert(filas);
    if (error) throw error;
  }

  async getTagsByInmuebleId(idInmueble: number): Promise<TagInmuebleDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('inmueble_x_tag')
      .select('id_tag, tags_inmueble(id, descripcion, estado)')
      .eq('id_inmueble', idInmueble);
    if (error) throw error;
    return (data ?? []).map((row: any) => row.tags_inmueble).filter(Boolean) as TagInmuebleDTO[];
  }
}

export const inmuebleRepository = new InmuebleRepository();