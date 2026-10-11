import type {
  CrearSolicitudRequest,
  EstadoSolicitud,
  SituacionOcupacional,
  Solicitud,
  SolicitudResponse,
  TipoGarantia
} from '@rentar/shared-types';

import { getSupabaseAdmin } from '../config/supabase';

export type CreateSolicitudEntity = Omit<
  Solicitud,
  'id' | 'fecha_creacion' | 'fecha_actualizacion'
>;

export interface ISolicitudRepository {
  findById(id: number): Promise<Solicitud | null>;
  findByInmuebleId(idInmueble: number): Promise<Solicitud[]>;
  findActiveByInmuebleAndLocatario(
    idInmueble: number,
    idLocatario: number
  ): Promise<Solicitud | null>;
  findSolicitudesPendientesByLocatario(idLocatario: number): Promise<Solicitud[]>;
  create(data: CreateSolicitudEntity): Promise<Solicitud>;
  addGarantias(idSolicitud: number, garantiaIds: number[]): Promise<void>;
  getGarantiasBySolicitudId(idSolicitud: number): Promise<TipoGarantia[]>;
  getEstadoById(idEstadoSolicitud: number): Promise<EstadoSolicitud | null>;
  getSituacionById(idSituacionOcupacional: number): Promise<SituacionOcupacional | null>;
  findByIdWithRelations(id: number): Promise<SolicitudResponse | null>;
}

export class SolicitudRepository implements ISolicitudRepository {
  async findById(id: number): Promise<Solicitud | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('solicitud')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;

    return (data as Solicitud | null) ?? null;
  }

  async findByInmuebleId(idInmueble: number): Promise<Solicitud[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('solicitud')
      .select('*')
      .eq('id_inmueble', idInmueble)
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    return (data ?? []) as Solicitud[];
  }

  async findActiveByInmuebleAndLocatario(
    idInmueble: number,
    idLocatario: number
  ): Promise<Solicitud | null> {
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

    return (data as Solicitud | null) ?? null;
  }

  async findSolicitudesPendientesByLocatario(idLocatario: number): Promise<Solicitud[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('solicitud')
      .select('*')
      .eq('id_locatario', idLocatario)
      .in('id_estado_solicitud', [1, 2])
      .order('fecha_creacion', { ascending: false });

    if (error) throw error;

    return (data ?? []) as Solicitud[];
  }

  async create(data: CreateSolicitudEntity): Promise<Solicitud> {
    const { data: created, error } = await getSupabaseAdmin()
      .from('solicitud')
      .insert(data)
      .select('*')
      .single();

    if (error) throw error;

    return created as Solicitud;
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

  async getGarantiasBySolicitudId(idSolicitud: number): Promise<TipoGarantia[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('solicitud_x_garantia')
      .select('tipo_garantia (id, nombre)')
      .eq('id_solicitud', idSolicitud);

    if (error) throw error;

    return (data ?? [])
      .map((row: any) => row.tipo_garantia)
      .filter(Boolean) as TipoGarantia[];
  }

  async getEstadoById(idEstadoSolicitud: number): Promise<EstadoSolicitud | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('estado_solicitud')
      .select('*')
      .eq('id', idEstadoSolicitud)
      .maybeSingle();

    if (error) throw error;

    return (data as EstadoSolicitud | null) ?? null;
  }

  async getSituacionById(idSituacionOcupacional: number): Promise<SituacionOcupacional | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('situacion_ocupacional')
      .select('*')
      .eq('id', idSituacionOcupacional)
      .maybeSingle();

    if (error) throw error;

    return (data as SituacionOcupacional | null) ?? null;
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
