import type {
  EstadoSolicitudDTO,
  SituacionOcupacionalDTO,
  SolicitudDTO,
  SolicitudResponse,
  TipoGarantiaDTO
} from '../dtos';

import { getSupabaseAdmin } from '../config/supabase';

export type CreateSolicitudEntity = Omit<
  SolicitudDTO,
  'id' | 'fecha_creacion' | 'fecha_actualizacion'
>;

export interface ISolicitudRepository {
  findById(id: number): Promise<SolicitudDTO | null>;
  findByInmuebleId(idInmueble: number): Promise<SolicitudDTO[]>;
  findActiveByInmuebleAndLocatario(
    idInmueble: number,
    idLocatario: number
  ): Promise<SolicitudDTO | null>;
  findSolicitudesPendientesByLocatario(idLocatario: number): Promise<SolicitudDTO[]>;
  create(data: CreateSolicitudEntity): Promise<SolicitudDTO>;
  addGarantias(idSolicitud: number, garantiaIds: number[]): Promise<void>;
  findGarantiasByIds(garantiaIds: number[]): Promise<TipoGarantiaDTO[]>;
  getGarantiasBySolicitudId(idSolicitud: number): Promise<TipoGarantiaDTO[]>;
  getEstadoById(idEstadoSolicitud: number): Promise<EstadoSolicitudDTO | null>;
  getSituacionById(idSituacionOcupacional: number): Promise<SituacionOcupacionalDTO | null>;
  findByIdWithRelations(id: number): Promise<SolicitudResponse | null>;
}

export class SolicitudRepository implements ISolicitudRepository {
  async findById(id: number): Promise<SolicitudDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('solicitud')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return (data as SolicitudDTO | null) ?? null;
  }

  async findByInmuebleId(idInmueble: number): Promise<SolicitudDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('solicitud')
      .select('*')
      .eq('id_inmueble', idInmueble)
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    return (data ?? []) as SolicitudDTO[];
  }

  async findActiveByInmuebleAndLocatario(
    idInmueble: number,
    idLocatario: number
  ): Promise<SolicitudDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('solicitud')
      .select('*')
      .eq('id_inmueble', idInmueble)
      .eq('id_locatario', idLocatario)
      .neq('id_estado_solicitud', 3)
      .neq('id_estado_solicitud', 4)
      .order('fecha_creacion', { ascending: false })
      .maybeSingle();

    if (error) throw error;

    return (data as SolicitudDTO | null) ?? null;
  }

  async findSolicitudesPendientesByLocatario(idLocatario: number): Promise<SolicitudDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('solicitud')
      .select('*')
      .eq('id_locatario', idLocatario)
      .in('id_estado_solicitud', [1, 2])
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    return (data ?? []) as SolicitudDTO[];
  }

  async create(data: CreateSolicitudEntity): Promise<SolicitudDTO> {
    const { data: created, error } = await getSupabaseAdmin()
      .from('solicitud')
      .insert(data)
      .select('*')
      .single();

    if (error) throw error;

    return created as SolicitudDTO;
  }

  async addGarantias(idSolicitud: number, garantiaIds: number[]): Promise<void> {
    if (!garantiaIds.length) {
      return;
    }

    const rows = garantiaIds.map(idTipoGarantia => ({
      id_solicitud: idSolicitud,
      id_tipo_garantia: idTipoGarantia
    }));

    const { error } = await getSupabaseAdmin()
      .from('solicitud_x_garantia')
      .insert(rows);

    if (error) throw error;
  }

  async findGarantiasByIds(garantiaIds: number[]): Promise<TipoGarantiaDTO[]> {
    if (!garantiaIds.length) {
      return [];
    }

    const { data, error } = await getSupabaseAdmin()
      .from('tipo_garantia')
      .select('*')
      .in('id', garantiaIds);

    if (error) throw error;

    return (data ?? []) as TipoGarantiaDTO[];
  }

  async getGarantiasBySolicitudId(idSolicitud: number): Promise<TipoGarantiaDTO[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('solicitud_x_garantia')
      .select('tipo_garantia (id, nombre)')
      .eq('id_solicitud', idSolicitud);

    if (error) throw error;

    return (data ?? [])
      .map((row: any) => row.tipo_garantia)
      .filter(Boolean) as TipoGarantiaDTO[];
  }

  async getEstadoById(idEstadoSolicitud: number): Promise<EstadoSolicitudDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('estado_solicitud')
      .select('*')
      .eq('id', idEstadoSolicitud)
      .maybeSingle();

    if (error) throw error;

    return (data as EstadoSolicitudDTO | null) ?? null;
  }

  async getSituacionById(idSituacionOcupacional: number): Promise<SituacionOcupacionalDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('situacion_ocupacional')
      .select('*')
      .eq('id', idSituacionOcupacional)
      .maybeSingle();

    if (error) throw error;

    return (data as SituacionOcupacionalDTO | null) ?? null;
  }

  async findByIdWithRelations(id: number): Promise<SolicitudResponse | null> {
    const solicitud = await this.findById(id);

    if (!solicitud) {
      return null;
    }

    const [estado, situacion, garantias] = await Promise.all([
      this.getEstadoById(solicitud.id_estado_solicitud),
      this.getSituacionById(solicitud.id_situacion_ocupacional),
      this.getGarantiasBySolicitudId(id)
    ]);

    if (!estado || !situacion) {
      return null;
    }

    return {
      ...solicitud,
      estado_solicitud: estado,
      situacion_ocupacional: situacion,
      garantias
    } as SolicitudResponse;
  }
}

export const solicitudRepository = new SolicitudRepository();
