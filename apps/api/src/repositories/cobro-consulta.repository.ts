import type {
  FiltrosHistorialCobrosLocadorDTO,
  MedioCobroManualDTO,
} from '../dtos';
import { getSupabaseAdmin } from '../config/supabase';

export interface UsuarioCobroRecord {
  id: number;
  nombre: string;
  apellido: string | null;
  email: string;
  telefono: string | null;
}

export interface PeriodoCobroConsultaRecord {
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
  created_at: string;
  contrato: {
    id: number;
    codigo: string | null;
    estado: number;
    fecha_inicio_contrato: string | null;
    fecha_fin_contrato: string | null;
    inmueble: {
      id: number;
      id_locador: number;
      direccion: string;
      numero: number;
      piso: string | null;
      barrio: string;
      ciudad: string;
      locador: UsuarioCobroRecord | null;
    };
    participantes: Array<{
      id_usuario: number;
      tipo_firmante: number;
      usuario: UsuarioCobroRecord | null;
    }>;
  };
  cobros: Array<{
    id: number;
    id_usuario_registro: number;
    monto: number;
    fecha_cobro: string;
    medio: MedioCobroManualDTO;
    nota: string | null;
    comprobante_storage_path: string | null;
    numero_comprobante: string;
    fecha_emision: string;
    created_at: string;
    usuario_registro: Pick<UsuarioCobroRecord, 'id' | 'nombre' | 'apellido'> | null;
  }>;
}

type CobroConsultaRecord = PeriodoCobroConsultaRecord['cobros'][number];

type PeriodoCobroSupabaseRow = Omit<PeriodoCobroConsultaRecord, 'cobros'> & {
  cobros?: CobroConsultaRecord | CobroConsultaRecord[] | null;
};

export function normalizeCobrosRelation<T>(cobros: T | T[] | null | undefined): T[] {
  return Array.isArray(cobros) ? cobros : cobros ? [cobros] : [];
}

function normalizePeriodoRows(rows: unknown[]): PeriodoCobroConsultaRecord[] {
  return rows.map(value => {
    const row = value as PeriodoCobroSupabaseRow;
    return { ...row, cobros: normalizeCobrosRelation(row.cobros) };
  });
}

export interface PeriodoCobroEventoRecord {
  id: number;
  tipo: 'periodo_generado' | 'cobro_registrado' | 'periodo_pagado';
  fecha_hora: string;
  datos: Record<string, unknown>;
  usuario: Pick<UsuarioCobroRecord, 'id' | 'nombre' | 'apellido'> | null;
}

export interface ICobroConsultaRepository {
  findHistorialByLocadorId(
    usuarioId: number,
    filtros: FiltrosHistorialCobrosLocadorDTO
  ): Promise<PeriodoCobroConsultaRecord[]>;
  findPeriodosByLocatarioId(
    usuarioId: number
  ): Promise<PeriodoCobroConsultaRecord[]>;
  findDetalleByPeriodoId(idPeriodo: number): Promise<PeriodoCobroConsultaRecord | null>;
  findEventosByPeriodoId(idPeriodo: number): Promise<PeriodoCobroEventoRecord[]>;
  createSignedUrlForAttachedProof(path: string): Promise<string>;
}

const PERIODO_SELECT = `
  id, id_contrato, periodo, fecha_inicio, fecha_fin, fecha_disponible_monto,
  fecha_vencimiento, monto_base_alquiler, expensas_snapshot,
  interes_diario_pct, dias_gracia, estado, created_at,
  contrato:contrato!inner(
    id, codigo, estado, fecha_inicio_contrato, fecha_fin_contrato, id_inmueble,
    inmueble:inmueble!inner(
      id, id_locador, direccion, numero, piso, barrio, ciudad,
      locador:usuario!inmueble_id_locador_fkey(id, nombre, apellido, email, telefono)
    ),
    participantes:contrato_x_usuario!inner(
      id_usuario, tipo_firmante,
      usuario(id, nombre, apellido, email, telefono)
    )
  ),
  cobros:cobro!cobro_id_periodo_fkey(
    id, id_usuario_registro, monto, fecha_cobro, medio, nota,
    comprobante_storage_path, numero_comprobante, fecha_emision, created_at,
    usuario_registro:usuario!cobro_id_usuario_registro_fkey(id, nombre, apellido)
  )
`;

const PAGE_SIZE = 500;

async function fetchAllPages<T>(loadPage: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const page = await loadPage(from, from + PAGE_SIZE - 1);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    from += PAGE_SIZE;
  }
}

export class CobroConsultaRepository implements ICobroConsultaRepository {
  async findHistorialByLocadorId(
    usuarioId: number,
    filtros: FiltrosHistorialCobrosLocadorDTO
  ): Promise<PeriodoCobroConsultaRecord[]> {
    const supabase = getSupabaseAdmin();
    return fetchAllPages(async (from, to) => {
      let query = supabase
        .from('periodo_cobro')
        .select(PERIODO_SELECT)
        .eq('contrato.inmueble.id_locador', usuarioId)
        .order('fecha_inicio', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to);

      if (filtros.id_inmueble !== undefined) query = query.eq('contrato.id_inmueble', filtros.id_inmueble);
      if (filtros.periodo) query = query.eq('periodo', filtros.periodo);
      if (filtros.desde) query = query.gte('periodo', filtros.desde);
      if (filtros.hasta) query = query.lte('periodo', filtros.hasta);

      const { data, error } = await query;
      if (error) throw error;
      return normalizePeriodoRows(data ?? []);
    });
  }

  async findPeriodosByLocatarioId(
    usuarioId: number
  ): Promise<PeriodoCobroConsultaRecord[]> {
    const supabase = getSupabaseAdmin();
    const { data: relaciones, error: errorRelaciones } = await supabase
      .from('contrato_x_usuario')
      .select('id_contrato')
      .eq('id_usuario', usuarioId)
      .eq('tipo_firmante', 2);

    if (errorRelaciones) throw errorRelaciones;
    const contratoIds = [...new Set((relaciones ?? []).map(row => row.id_contrato))];
    if (contratoIds.length === 0) return [];

    return fetchAllPages(async (from, to) => {
      let query = supabase
        .from('periodo_cobro')
        .select(PERIODO_SELECT)
        .in('id_contrato', contratoIds)
        .order('fecha_inicio', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to);

      const { data, error } = await query;
      if (error) throw error;
      return normalizePeriodoRows(data ?? []);
    });
  }

  async findDetalleByPeriodoId(idPeriodo: number): Promise<PeriodoCobroConsultaRecord | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('periodo_cobro')
      .select(PERIODO_SELECT)
      .eq('id', idPeriodo)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return normalizePeriodoRows([data])[0] ?? null;
  }

  async findEventosByPeriodoId(idPeriodo: number): Promise<PeriodoCobroEventoRecord[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('periodo_cobro_evento')
      .select('id, tipo, fecha_hora, datos, usuario:usuario(id, nombre, apellido)')
      .eq('id_periodo', idPeriodo)
      .order('fecha_hora', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;
    return (data ?? []) as unknown as PeriodoCobroEventoRecord[];
  }

  async createSignedUrlForAttachedProof(path: string): Promise<string> {
    const { data, error } = await getSupabaseAdmin()
      .storage
      .from('comprobantes-cobros')
      .createSignedUrl(path, 60);

    if (error) throw error;
    return data.signedUrl;
  }
}

export const cobroConsultaRepository = new CobroConsultaRepository();