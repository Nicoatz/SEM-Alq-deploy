import type { MedioCobroManualDTO } from './cobro.dto';

export interface PersonaComprobanteDTO {
  id: number;
  nombre: string;
  apellido: string | null;
  numero_documento: string | null;
  email: string;
  telefono: string | null;
}

export interface PropiedadComprobanteDTO {
  id: number;
  direccion: string;
  numero: number;
  piso: string | null;
  barrio: string;
  ciudad: string;
}

export interface ContratoComprobanteDTO {
  id: number;
  codigo: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
}

export interface PeriodoComprobanteDTO {
  id: number;
  periodo: string;
  fecha_inicio: string;
  fecha_fin: string;
  fecha_vencimiento: string;
}

export interface CargoComprobanteDTO {
  concepto: 'alquiler' | 'intereses_mora';
  monto: number;
  diasMora?: number;
}

export interface ComprobantePagoDTO {
  id_cobro: number;
  numero_comprobante: string;
  fecha_emision: string;
  estado: 'pagado';
  locatario: PersonaComprobanteDTO;
  locador: PersonaComprobanteDTO;
  propiedad: PropiedadComprobanteDTO;
  contrato: ContratoComprobanteDTO;
  periodo: PeriodoComprobanteDTO;
  cargos: CargoComprobanteDTO[];
  total_pagado: number;
  total_en_letras: string;
  medio: MedioCobroManualDTO;
  fecha_cobro: string;
  nota: string | null;
}
