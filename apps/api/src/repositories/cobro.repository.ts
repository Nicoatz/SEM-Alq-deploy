import type {
  FiltrosCobrosLocadorDTO,
  RegistrarCobroResultadoDTO,
} from '../dtos';
import { getSupabaseAdmin } from '../config/supabase';

export interface PeriodoCobroRecord {
  id: number;
  id_contrato: number;
  periodo: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_disponible_monto: string;
  fecha_vencimiento: string;
  monto_base_alquiler: number;
  expensas_snapshot: number;
  interes_diario_pct: number;
  dias_gracia: number;
  estado: 'pendiente' | 'vencido' | 'pagado';
  contrato: {
    id: number;
    id_inmueble: number;
    inmueble: {
      id: number;
      direccion: string;
      numero: number;
      piso: string | null;
      barrio: string;
      id_locador: number;
    };
  };
  locatario: {
    id: number;
    nombre: string;
    apellido: string | null;
  } | null;
}

export interface IPeriodoCobroRepository {
  findPeriodosCobrablesByLocadorId(
    locadorId: number,
    filtros?: FiltrosCobrosLocadorDTO
  ): Promise<PeriodoCobroRecord[]>;
  registrarCobroManual(
    periodoId: number,
    locadorId: number,
    fechaCobro: string,
    medio: string,
    nota: string | null,
    comprobanteStoragePath: string | null
  ): Promise<RegistrarCobroResultadoDTO>;
  uploadComprobante(
    storagePath: string,
    data: Buffer,
    contentType: string
  ): Promise<void>;
  removeComprobante(storagePath: string): Promise<void>;
}

interface ContratoLocadorRecord {
  id: number;
  id_inmueble: number;
  inmueble: {
    id: number;
    id_locador: number;
    direccion: string;
    numero: number;
    piso: string | null;
    barrio: string;
  } | null;
}

interface ParticipanteLocatarioRecord {
  id_contrato: number;
  tipo_firmante: number;
  usuario: {
    id: number;
    nombre: string;
    apellido: string | null;
  } | null;
}

export class PeriodoCobroRepository implements IPeriodoCobroRepository {
  async findPeriodosCobrablesByLocadorId(
    locadorId: number,
    filtros: FiltrosCobrosLocadorDTO = {}
  ): Promise<PeriodoCobroRecord[]> {
    const supabase = getSupabaseAdmin();
    let contratosQuery = supabase
      .from('contrato')
      .select('id, id_inmueble, inmueble!inner(id, id_locador, direccion, numero, piso, barrio)')
      .eq('estado', 2)
      .eq('activo', true)
      .eq('inmueble.id_locador', locadorId);

    if (filtros.id_contrato !== undefined) contratosQuery = contratosQuery.eq('id', filtros.id_contrato);
    if (filtros.id_inmueble !== undefined) contratosQuery = contratosQuery.eq('id_inmueble', filtros.id_inmueble);

    const { data: contratos, error: contratosError } = await contratosQuery;
    if (contratosError) throw contratosError;

    const contratoRows = (contratos ?? []) as unknown as ContratoLocadorRecord[];
    const contratoIds = contratoRows.map(contrato => contrato.id);
    if (contratoIds.length === 0) return [];

    const [{ data: periodos, error: periodosError }, { data: participantes, error: participantesError }] = await Promise.all([
      (() => {
        let query = supabase
          .from('periodo_cobro')
          .select('*')
          .in('id_contrato', contratoIds)
          .in('estado', ['pendiente', 'vencido'])
          .order('fecha_inicio', { ascending: false });
        if (filtros.desde) query = query.gte('fecha_inicio', filtros.desde);
        if (filtros.hasta) query = query.lte('fecha_inicio', filtros.hasta);
        return query;
      })(),
      supabase
        .from('contrato_x_usuario')
        .select('id_contrato, tipo_firmante, usuario(id, nombre, apellido)')
        .in('id_contrato', contratoIds)
        .eq('tipo_firmante', 2),
    ]);

    if (periodosError) throw periodosError;
    if (participantesError) throw participantesError;

    const contratosMap = new Map(contratoRows.map(contrato => [contrato.id, contrato]));
    const locatariosMap = new Map(
      ((participantes ?? []) as unknown as ParticipanteLocatarioRecord[])
        .filter(participante => participante.usuario)
        .map(participante => [participante.id_contrato, participante.usuario!])
    );

    return ((periodos ?? []) as unknown as Array<Omit<PeriodoCobroRecord, 'contrato' | 'locatario'>>)
      .map(periodo => {
        const contrato = contratosMap.get(periodo.id_contrato);
        if (!contrato?.inmueble) return null;
        return {
          ...periodo,
          contrato: {
            id: contrato.id,
            id_inmueble: contrato.id_inmueble,
            inmueble: contrato.inmueble,
          },
          locatario: locatariosMap.get(periodo.id_contrato) ?? null,
        };
      })
      .filter((periodo): periodo is PeriodoCobroRecord => periodo !== null);
  }

  async registrarCobroManual(
    periodoId: number,
    locadorId: number,
    fechaCobro: string,
    medio: string,
    nota: string | null,
    comprobanteStoragePath: string | null
  ): Promise<RegistrarCobroResultadoDTO> {
    const { data, error } = await getSupabaseAdmin().rpc('registrar_cobro_manual', {
      p_id_periodo: periodoId,
      p_id_locador: locadorId,
      p_fecha_cobro: fechaCobro,
      p_medio: medio,
      p_nota: nota,
      p_comprobante_storage_path: comprobanteStoragePath,
    });

    if (error) throw error;
    return data as RegistrarCobroResultadoDTO;
  }

  async uploadComprobante(storagePath: string, data: Buffer, contentType: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .storage
      .from('comprobantes-cobros')
      .upload(storagePath, data, { contentType, upsert: false });
    if (error) throw error;
  }

  async removeComprobante(storagePath: string): Promise<void> {
    const { error } = await getSupabaseAdmin()
      .storage
      .from('comprobantes-cobros')
      .remove([storagePath]);
    if (error) throw error;
  }
}

export const periodoCobroRepository = new PeriodoCobroRepository();
