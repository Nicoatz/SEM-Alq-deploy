import type { EstadoContratoLocatarioDTO } from '../dtos';
import { getSupabaseAdmin } from '../config/supabase';

const ESTADO_CONTRATO_ID: Record<EstadoContratoLocatarioDTO, number> = {
  pendiente_firma: 4,
  vigente: 2,
  finalizado: 3
};

type Relation<T> = T | T[] | null;

interface UsuarioRelacionado {
  id: number;
  nombre: string;
  apellido: string | null;
  email: string;
  telefono: string | null;
}

interface FotoRelacionada {
  url: string;
  es_principal: boolean;
  orden: number;
}

interface InmuebleRelacionado {
  id: number;
  direccion: string;
  numero: number;
  piso: string | null;
  barrio: string;
  ciudad: string;
  locador: Relation<UsuarioRelacionado>;
  fotos: FotoRelacionada[] | null;
}

interface MedioPagoRelacionado {
  medio_pago: Relation<{ nombre: string }>;
}

interface ContratoRelacionado {
  id: number;
  estado: number | null;
  monto_alquiler: number;
  expensas: number;
  deposito: number | null;
  indice_aumento: number | null;
  frecuencia_ajuste: string | null;
  fecha_inicio_contrato: string | null;
  fecha_fin_contrato: string | null;
  dias_para_vencimiento: number | null;
  pdf_storage_path: string | null;
  pdf_sha256: string | null;
  inmueble: Relation<InmuebleRelacionado>;
  indice: Relation<{ descripcion: string }>;
  medio_pago_x_contrato: MedioPagoRelacionado[] | null;
}

interface ParticipanteRelacionado extends UsuarioRelacionado {
  id_contrato: number;
  tipo_firmante: number;
  estado_firma: 'pendiente' | 'firmado' | 'rechazado' | 'desconocido';
  fecha_conformidad: string | null;
  hash_documento_conforme: string | null;
  fecha_firma: string | null;
  fecha_rechazo: string | null;
  hash_documento_firmado: string | null;
  motivo_rechazo: string | null;
}

interface AjusteRelacionado {
  id_contrato: number;
  fecha_efectiva: string;
}

export interface AlquilerLocatarioRecord {
  contrato: ContratoRelacionado;
  participantes: ParticipanteRelacionado[];
  fecha_ultimo_ajuste: string | null;
}

export interface IAlquilerLocatarioRepository {
  findByLocatarioId(
    locatarioId: number,
    estado?: EstadoContratoLocatarioDTO
  ): Promise<AlquilerLocatarioRecord[]>;
  findByIdAndLocatarioId(
    idContrato: number,
    locatarioId: number
  ): Promise<AlquilerLocatarioRecord | null>;
  createPdfSignedUrl(storagePath: string): Promise<string>;
}

const CONTRATO_SELECT = `
  id, estado, monto_alquiler, expensas, deposito, indice_aumento,
  frecuencia_ajuste, fecha_inicio_contrato, fecha_fin_contrato,
  dias_para_vencimiento, pdf_storage_path, pdf_sha256,
  inmueble:inmueble!contrato_id_inmueble_fkey(
    id, direccion, numero, piso, barrio, ciudad,
    locador:usuario!inmueble_id_locador_fkey(id, nombre, apellido, email, telefono),
    fotos:foto_inmueble(url, es_principal, orden)
  ),
  indice:tipo_indice(descripcion),
  medio_pago_x_contrato(medio_pago(nombre))
`;

function firstRelation<T>(relation: Relation<T>): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation;
}

export class AlquilerLocatarioRepository implements IAlquilerLocatarioRepository {
  async findByLocatarioId(
    locatarioId: number,
    estado?: EstadoContratoLocatarioDTO
  ): Promise<AlquilerLocatarioRecord[]> {
    const { data: relaciones, error: errorRelaciones } = await getSupabaseAdmin()
      .from('contrato_x_usuario')
      .select('id_contrato')
      .eq('id_usuario', locatarioId)
      .eq('tipo_firmante', 2);

    if (errorRelaciones) throw errorRelaciones;

    const idsContrato = [...new Set((relaciones ?? []).map(row => row.id_contrato))];
    return this.findContratos(idsContrato, estado);
  }

  async findByIdAndLocatarioId(
    idContrato: number,
    locatarioId: number
  ): Promise<AlquilerLocatarioRecord | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('contrato')
      .select(`${CONTRATO_SELECT}, contrato_x_usuario!inner(id_usuario, tipo_firmante)`)
      .eq('id', idContrato)
      .eq('contrato_x_usuario.id_usuario', locatarioId)
      .eq('contrato_x_usuario.tipo_firmante', 2)
      .in('estado', [ESTADO_CONTRATO_ID.pendiente_firma, ESTADO_CONTRATO_ID.vigente, ESTADO_CONTRATO_ID.finalizado])
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    const [alquiler] = await this.enriquecerContratos([data as unknown as ContratoRelacionado]);
    return alquiler ?? null;
  }

  async createPdfSignedUrl(storagePath: string): Promise<string> {
    const { data, error } = await getSupabaseAdmin()
      .storage
      .from('contratos-pdf')
      .createSignedUrl(storagePath, 60);

    if (error) throw error;
    return data.signedUrl;
  }

  private async findContratos(
    idsContrato: number[],
    estado?: EstadoContratoLocatarioDTO
  ): Promise<AlquilerLocatarioRecord[]> {
    if (idsContrato.length === 0) return [];

    let consulta = getSupabaseAdmin()
      .from('contrato')
      .select(CONTRATO_SELECT)
      .in('id', idsContrato)
      .in('estado', [ESTADO_CONTRATO_ID.pendiente_firma, ESTADO_CONTRATO_ID.vigente, ESTADO_CONTRATO_ID.finalizado]);

    if (estado) consulta = consulta.eq('estado', ESTADO_CONTRATO_ID[estado]);

    const { data, error } = await consulta;
    if (error) throw error;

    const contratos = (data ?? []) as unknown as ContratoRelacionado[];
    if (contratos.length === 0) return [];

    return this.enriquecerContratos(contratos);
  }

  private async enriquecerContratos(
    contratos: ContratoRelacionado[]
  ): Promise<AlquilerLocatarioRecord[]> {
    const idsEncontrados = contratos.map(contrato => contrato.id);

    const [{ data: participantesData, error: errorParticipantes }, { data: ajustesData, error: errorAjustes }] = await Promise.all([
      getSupabaseAdmin()
        .from('contrato_x_usuario')
        .select('id_contrato, tipo_firmante, estado_firma, fecha_conformidad, hash_documento_conforme, fecha_firma, fecha_rechazo, hash_documento_firmado, motivo_rechazo, usuario(id, nombre, apellido, email, telefono)')
        .in('id_contrato', idsEncontrados),
      getSupabaseAdmin()
        .from('ajuste_contrato')
        .select('id_contrato, fecha_efectiva')
        .in('id_contrato', idsEncontrados)
        .order('fecha_efectiva', { ascending: false })
        .order('id', { ascending: false })
    ]);

    if (errorParticipantes) throw errorParticipantes;
    if (errorAjustes) throw errorAjustes;

    const participantes = (participantesData ?? []) as unknown as Array<{
      id_contrato: number;
      tipo_firmante: number;
      estado_firma: ParticipanteRelacionado['estado_firma'];
      fecha_conformidad: string | null;
      hash_documento_conforme: string | null;
      fecha_firma: string | null;
      fecha_rechazo: string | null;
      hash_documento_firmado: string | null;
      motivo_rechazo: string | null;
      usuario: Relation<UsuarioRelacionado>;
    }>;
    const ajustes = (ajustesData ?? []) as unknown as AjusteRelacionado[];
    const participantesMapeados: ParticipanteRelacionado[] = participantes.flatMap(participante => {
      const usuario = firstRelation(participante.usuario);
      if (!usuario) return [];

      return [{
        ...usuario,
        id_contrato: participante.id_contrato,
        tipo_firmante: participante.tipo_firmante,
        estado_firma: participante.estado_firma,
        fecha_conformidad: participante.fecha_conformidad,
        hash_documento_conforme: participante.hash_documento_conforme,
        fecha_firma: participante.fecha_firma,
        fecha_rechazo: participante.fecha_rechazo,
        hash_documento_firmado: participante.hash_documento_firmado,
        motivo_rechazo: participante.motivo_rechazo
      }];
    });

    return contratos.map(contrato => ({
      contrato,
      participantes: participantesMapeados.filter(participante => participante.id_contrato === contrato.id),
      fecha_ultimo_ajuste: ajustes.find(ajuste => ajuste.id_contrato === contrato.id)?.fecha_efectiva ?? null
    }));
  }
}

export const alquilerLocatarioRepository = new AlquilerLocatarioRepository();

export { firstRelation };