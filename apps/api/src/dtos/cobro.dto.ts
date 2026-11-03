export type EstadoPeriodoCobroDTO = 'pendiente' | 'vencido' | 'pagado';

export type MedioCobroManualDTO =
  | 'transferencia'
  | 'efectivo'
  | 'cheque'
  | 'mercadopago_externo'
  | 'otro';

export interface FiltrosCobrosLocadorDTO {
  estado?: Extract<EstadoPeriodoCobroDTO, 'pendiente' | 'vencido'>;
  id_inmueble?: number;
  id_contrato?: number;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
}

export interface PeriodoCobroItemDTO {
  id_periodo: number;
  id_contrato: number;
  periodo: string;
  inmueble: {
    id: number;
    direccion: string;
    numero: number;
    piso: string | null;
    barrio: string;
  };
  locatario: {
    id: number;
    nombre: string;
    apellido: string | null;
  } | null;
  estado: EstadoPeriodoCobroDTO;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_vencimiento: string;
  monto_base_alquiler: number;
  intereses_mora: number;
  monto_exigible: number;
  expensas_snapshot: number;
  saldo: number;
}

export interface PeriodosCobroResultadoDTO {
  items: PeriodoCobroItemDTO[];
  total: number;
  page: number;
  limit: number;
}

export interface RegistrarCobroDTO {
  id_periodo: number;
  fecha_cobro: string;
  medio: MedioCobroManualDTO;
  nota?: string | null;
}

export interface CobroDTO {
  id: number;
  id_periodo: number;
  id_usuario_registro: number;
  monto: number;
  fecha_cobro: string;
  medio: MedioCobroManualDTO;
  nota: string | null;
  comprobante_storage_path: string | null;
  numero_comprobante: string;
  fecha_emision: string;
  created_at: string;
}

export interface RegistrarCobroResultadoDTO {
  cobro_id: number;
  periodo_id: number;
  monto: number;
  intereses: number;
  dias_interes: number;
  numero_comprobante: string;
  estado_periodo: 'pagado';
}
