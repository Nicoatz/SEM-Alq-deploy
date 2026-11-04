import { getSupabaseAdmin } from '../config/supabase';
import type { MedioCobroManualDTO } from '../dtos';

export interface ComprobantePagoRecord {
  id: number;
  monto: number;
  fecha_cobro: string;
  medio: MedioCobroManualDTO;
  nota: string | null;
  numero_comprobante: string;
  fecha_emision: string;
  periodo: {
    id: number;
    periodo: string;
    fecha_inicio: string;
    fecha_fin: string;
    fecha_vencimiento: string;
    monto_base_alquiler: number;
    interes_diario_pct: number;
    dias_gracia: number;
    estado: 'pagado';
    contrato: {
      id: number;
      codigo: string | null;
      fecha_inicio_contrato: string | null;
      fecha_fin_contrato: string | null;
      inmueble: {
        id: number;
        direccion: string;
        numero: number;
        piso: string | null;
        barrio: string;
        ciudad: string;
        locador: {
          id: number;
          nombre: string;
          apellido: string | null;
          numero_documento: string | null;
          email: string;
          telefono: string | null;
        } | null;
      } | null;
      participantes: Array<{
        id_usuario: number;
        tipo_firmante: number;
        usuario: {
          id: number;
          nombre: string;
          apellido: string | null;
          numero_documento: string | null;
          email: string;
          telefono: string | null;
        } | null;
      }>;
    } | null;
  } | null;
}

export interface IComprobantePagoRepository {
  findByIdAndUsuarioPermitido(idCobro: number, usuarioId: number): Promise<ComprobantePagoRecord | null>;
}

export class ComprobantePagoRepository implements IComprobantePagoRepository {
  async findByIdAndUsuarioPermitido(
    idCobro: number,
    usuarioId: number
  ): Promise<ComprobantePagoRecord | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('cobro')
      .select(`
        id, monto, fecha_cobro, medio, nota, numero_comprobante, fecha_emision,
        periodo:periodo_cobro!inner(
          id, periodo, fecha_inicio, fecha_fin, fecha_vencimiento,
          monto_base_alquiler, interes_diario_pct, dias_gracia, estado,
          contrato:contrato!inner(
            id, codigo, fecha_inicio_contrato, fecha_fin_contrato,
            inmueble:inmueble!inner(
              id, id_locador, direccion, numero, piso, barrio, ciudad,
              locador:usuario!inmueble_id_locador_fkey(
                id, nombre, apellido, numero_documento, email, telefono
              )
            ),
            participantes:contrato_x_usuario!inner(
              id_usuario, tipo_firmante,
              usuario(id, nombre, apellido, numero_documento, email, telefono)
            )
          )
        )
      `)
      .eq('id', idCobro)
      .or(
        `inmueble.id_locador.eq.${usuarioId},and(participantes.id_usuario.eq.${usuarioId},participantes.tipo_firmante.eq.2)`,
        { foreignTable: 'periodo_cobro.contrato' }
      )
      .maybeSingle();

    if (error) throw error;
    return data as unknown as ComprobantePagoRecord | null;
  }
}

export const comprobantePagoRepository = new ComprobantePagoRepository();
