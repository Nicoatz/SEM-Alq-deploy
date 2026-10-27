export type EstadoContratoLocatarioDTO =
  | 'pendiente_firma'
  | 'vigente'
  | 'finalizado';

export type EstadoFirmaLocatarioDTO =
  | 'pendiente'
  | 'firmado'
  | 'rechazado'
  | 'desconocido';

export interface FiltrosAlquileresLocatarioDTO {
  estado?: EstadoContratoLocatarioDTO;
}

export interface ParticipanteFirmaAlquilerDTO {
  tipo: 'locador' | 'locatario' | 'garante';
  estado: EstadoFirmaLocatarioDTO;
  fecha_conformidad: string | null;
  fecha_firma: string | null;
  fecha_rechazo: string | null;
  motivo_rechazo: string | null;
}

export interface AlquilerLocatarioItemDTO {
  id_contrato: number;
  codigo: string;
  estado: EstadoContratoLocatarioDTO;
  inmueble: {
    id: number;
    direccion: string;
    numero: number;
    piso: string | null;
    barrio: string;
    ciudad: string;
    foto_principal: string | null;
  };
  locador: {
    id: number;
    nombre: string;
    apellido: string | null;
    email: string;
    telefono: string | null;
  };
  monto_actual: number;
  expensas: number;
  fecha_inicio_contrato: string | null;
  fecha_fin_contrato: string | null;
  deposito: number | null;
  indice_ajuste: string | null;
  frecuencia_ajuste: string | null;
  fecha_ultimo_ajuste: string | null;
  fecha_proximo_ajuste: string | null;
}

export interface DetalleAlquilerLocatarioDTO extends AlquilerLocatarioItemDTO {
  dias_para_vencimiento: number | null;
  fecha_proximo_vencimiento_pago: string | null;
  pdf_url: string | null;
  medios_pago: string[];
  garantes: Array<{
    nombre: string;
    apellido: string | null;
    email: string;
    telefono: string | null;
  }>;
  firmas: ParticipanteFirmaAlquilerDTO[];
  puede_firmar: boolean;
  monto_proximo_ajuste: 'a definir' | null;
}