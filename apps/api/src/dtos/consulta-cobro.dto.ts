import type { EstadoPeriodoCobroDTO, MedioCobroManualDTO } from './cobro.dto';

export type EstadoConsultaCobroDTO = 'todos' | EstadoPeriodoCobroDTO;

export interface FiltrosHistorialCobrosLocadorDTO {
  estado?: EstadoConsultaCobroDTO;
  id_inmueble?: number;
  periodo?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
}

export interface FiltrosPagosLocatarioDTO {
  anio?: number;
  estado?: EstadoConsultaCobroDTO;
  medio?: MedioCobroManualDTO;
  page?: number;
  limit?: number;
}

export interface PersonaCobroConsultaDTO {
  id: number;
  nombre: string;
  apellido: string | null;
  email?: string;
  telefono?: string | null;
}

export interface PropiedadCobroConsultaDTO {
  id: number;
  direccion: string;
  numero: number;
  piso: string | null;
  barrio: string;
  ciudad: string;
}

export interface CargoCobroConsultaDTO {
  concepto: 'alquiler' | 'intereses_mora';
  monto: number;
  dias_mora?: number;
  dias_interes?: number;
}

export interface CobroRegistradoConsultaDTO {
  id_cobro: number;
  numero_comprobante: string;
  fecha_cobro: string;
  monto: number;
  medio: MedioCobroManualDTO;
  nota: string | null;
  created_at: string;
  usuario_registro: Pick<PersonaCobroConsultaDTO, 'nombre' | 'apellido'>;
  tiene_adjunto: boolean;
  adjunto_url: string | null;
  comprobante_url: string;
}

export interface PeriodoCobroResumenDTO {
  id_periodo: number;
  id_contrato: number;
  codigo_contrato: string | null;
  periodo: string;
  estado: EstadoPeriodoCobroDTO;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_vencimiento: string;
  propiedad: PropiedadCobroConsultaDTO;
  locatario: PersonaCobroConsultaDTO | null;
  monto_base_alquiler: number;
  intereses_mora: number;
  dias_atraso: number;
  dias_interes: number;
  monto_exigible: number;
  total_cobrado: number;
  saldo: number;
  cantidad_cobros: number;
  tiene_adjunto: boolean;
  comprobante_url: string | null;
}

export interface ResumenCobrosLocadorDTO {
  cobrado: number;
  vencido: number;
  cantidades: Record<EstadoPeriodoCobroDTO, number>;
}

export interface HistorialCobrosLocadorResultadoDTO {
  items: PeriodoCobroResumenDTO[];
  resumen: ResumenCobrosLocadorDTO;
  total: number;
  page: number;
  limit: number;
  filtros: FiltrosHistorialCobrosLocadorDTO;
}

export interface PagoLocatarioItemDTO extends PeriodoCobroResumenDTO {
  fecha_pago: string;
  monto_pagado: number;
  medio: MedioCobroManualDTO;
  recargo_pagado: number;
  pagos_a_termino: boolean;
}

export interface ResumenPagosLocatarioDTO {
  anio: number;
  total_pagado: number;
  pagos_a_termino: number;
  recargos_pagados: number;
}

export interface PagosLocatarioResultadoDTO {
  proximo_periodo: PeriodoCobroResumenDTO | null;
  items: PagoLocatarioItemDTO[];
  resumen_anual: ResumenPagosLocatarioDTO;
  total: number;
  page: number;
  limit: number;
  filtros: FiltrosPagosLocatarioDTO;
}

export interface PeriodoCobroEventoDTO {
  tipo: 'periodo_generado' | 'cobro_registrado' | 'periodo_pagado';
  fecha_hora: string;
  usuario: Pick<PersonaCobroConsultaDTO, 'nombre' | 'apellido'> | null;
  datos: Record<string, unknown>;
}

export interface DetalleCobroConsultaDTO {
  id_periodo: number;
  id_contrato: number;
  propiedad: PropiedadCobroConsultaDTO;
  locador: PersonaCobroConsultaDTO;
  locatario: PersonaCobroConsultaDTO;
  contrato: {
    codigo: string | null;
    fecha_inicio: string | null;
    fecha_fin: string | null;
  };
  periodo: {
    periodo: string;
    estado: EstadoPeriodoCobroDTO;
    fecha_inicio: string;
    fecha_fin: string;
    fecha_vencimiento: string;
  };
  cargos: CargoCobroConsultaDTO[];
  total_exigible: number;
  total_cobrado: number;
  saldo: number;
  cobros: CobroRegistradoConsultaDTO[];
  historial: PeriodoCobroEventoDTO[];
}