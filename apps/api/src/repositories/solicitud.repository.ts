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
  findGarantiasByNames(names: string[]): Promise<TipoGarantiaDTO[]>;
  getGarantiasBySolicitudId(idSolicitud: number): Promise<TipoGarantiaDTO[]>;
  getEstadoById(idEstadoSolicitud: number): Promise<EstadoSolicitudDTO | null>;
  getSituacionById(idSituacionOcupacional: number): Promise<SituacionOcupacionalDTO | null>;
  getSituacionByNombre(nombre: string): Promise<SituacionOcupacionalDTO | null>;
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

  async findGarantiasByNames(names: string[]): Promise<TipoGarantiaDTO[]> {
    if (!names.length) {
      return [];
    }

    const { data, error } = await getSupabaseAdmin()
      .from('tipo_garantia')
      .select('*')
      .in('nombre', names);

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

  async getSituacionByNombre(nombre: string): Promise<SituacionOcupacionalDTO | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('situacion_ocupacional')
      .select('*')
      .eq('nombre', nombre)
      .maybeSingle();

    if (error) throw error;

    return (data as SituacionOcupacionalDTO | null) ?? null;
  }

  async findByIdWithRelations(id: number): Promise<SolicitudResponse | null> {
    const solicitud = await this.findById(id);

    if (!solicitud) {
      return null;
    }

    const [estado, situacion, garantias, inmueble, fotos, postulante] = await Promise.all([
      this.getEstadoById(solicitud.id_estado_solicitud),
      this.getSituacionById(solicitud.id_situacion_ocupacional),
      this.getGarantiasBySolicitudId(id),
      getSupabaseAdmin()
        .from('inmueble')
        .select('id, direccion, numero, piso, barrio')
        .eq('id', solicitud.id_inmueble)
        .maybeSingle(),
      getSupabaseAdmin()
        .from('foto_inmueble')
        .select('url, es_principal, orden')
        .eq('id_inmueble', solicitud.id_inmueble)
        .order('orden'),
      getSupabaseAdmin()
        .from('usuario')
        .select('id, nombre, apellido, numero_documento')
        .eq('id', solicitud.id_locatario)
        .maybeSingle()
    ]);

    if (!estado || !situacion || inmueble.error || fotos.error || postulante.error || !inmueble.data || !postulante.data) {
      return null;
    }

    const ocupaciones: Record<string, NonNullable<SolicitudResponse['legajo']>['ocupacion']> = {
      '-': 'sin_informar',
      'relación de dependencia': 'relacion_dependencia',
      monotributista: 'monotributista',
      autónoma: 'autonoma',
      estudiante: 'estudiante',
      jubilada: 'jubilada'
    };
    const garantiasPorNombre: Record<string, NonNullable<SolicitudResponse['legajo']>['garantias'][number]> = {
      'garantía propietaria': 'propietaria',
      'seguro de caución': 'caucion',
      otra: 'otra'
    };
    const fotoPrincipal = (fotos.data ?? []).find(foto => foto.es_principal)?.url
      ?? fotos.data?.[0]?.url
      ?? null;

    return {
      id: solicitud.id,
      estado: estado.nombre,
      mensaje: solicitud.mensaje ?? null,
      fecha_creacion: solicitud.fecha_creacion,
      fecha_respuesta: solicitud.fecha_respuesta ?? null,
      inmueble: {
        id: inmueble.data.id,
        direccion: inmueble.data.direccion,
        numero: inmueble.data.numero,
        piso: inmueble.data.piso,
        barrio: inmueble.data.barrio,
        foto_principal: fotoPrincipal
      },
      postulante: {
        id: postulante.data.id,
        nombre: postulante.data.nombre,
        apellido: postulante.data.apellido,
        dni: postulante.data.numero_documento,
        telefono: solicitud.telefono,
        email: solicitud.email
      },
      legajo: {
        ocupacion: ocupaciones[situacion.nombre] ?? 'sin_informar',
        ingresos: solicitud.ingresos_aprox,
        convivientes: solicitud.cantidad_personas,
        mascotas: solicitud.posee_mascotas,
        detalle_mascotas: solicitud.detalles_mascotas ?? null,
        garantias: garantias
          .map(garantia => garantiasPorNombre[garantia.nombre])
          .filter((garantia): garantia is NonNullable<SolicitudResponse['legajo']>['garantias'][number] => Boolean(garantia))
      }
    };
  }
}

export const solicitudRepository = new SolicitudRepository();
