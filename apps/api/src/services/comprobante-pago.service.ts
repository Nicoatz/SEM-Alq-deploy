import type {
  CargoComprobanteDTO,
  ComprobantePagoDTO,
  PersonaComprobanteDTO,
  PropiedadComprobanteDTO,
} from '../dtos';
import {
  comprobantePagoRepository,
  type ComprobantePagoRecord,
  type IComprobantePagoRepository,
} from '../repositories/comprobante-pago.repository';
import { generarComprobantePagoPdf, totalEnLetras } from './comprobante-pago.pdf';

export interface ComprobantePagoResultado {
  comprobante: ComprobantePagoDTO;
  pdf: Buffer;
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}

interface PersonaRecord {
  id: number;
  nombre: string;
  apellido: string | null;
  numero_documento: string | null;
  email: string;
  telefono: string | null;
}

function personaFromRecord(persona: PersonaRecord | null): PersonaComprobanteDTO {
  if (!persona) throw consistencyError('El comprobante no tiene los datos completos de una parte.');
  return {
    id: persona.id,
    nombre: persona.nombre,
    apellido: persona.apellido,
    numero_documento: persona.numero_documento,
    email: persona.email,
    telefono: persona.telefono,
  };
}

function consistencyError(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 500 });
}

function notFoundError(): Error & { statusCode: number } {
  return Object.assign(new Error('No encontramos este comprobante'), { statusCode: 404 });
}

function construirComprobante(record: ComprobantePagoRecord): ComprobantePagoDTO {
  const periodo = record.periodo;
  const contrato = periodo?.contrato;
  const inmueble = contrato?.inmueble;
  if (!periodo || !contrato || !inmueble || !inmueble.locador || periodo.estado !== 'pagado') {
    throw consistencyError('El comprobante no tiene una relación de pago válida.');
  }

  const locatario = contrato.participantes.find(
    participante => participante.tipo_firmante === 2 && participante.usuario
  )?.usuario;
  if (!locatario) throw consistencyError('El comprobante no tiene un locatario principal.');

  const fechaCobro = parseDate(record.fecha_cobro);
  const fechaVencimiento = parseDate(periodo.fecha_vencimiento);
  if (!fechaCobro || !fechaVencimiento) {
    throw consistencyError('El comprobante tiene fechas inválidas.');
  }

  const diasAtraso = Math.max(0, daysBetween(fechaCobro, fechaVencimiento));
  const diasInteres = Math.max(0, diasAtraso - Math.max(0, Number(periodo.dias_gracia)));
  const alquiler = money(Number(periodo.monto_base_alquiler));
  const intereses = money(
    alquiler * (Number(periodo.interes_diario_pct) / 100) * diasInteres
  );
  const total = money(Number(record.monto));
  if (Math.abs(money(alquiler + intereses) - total) > 0.01) {
    throw consistencyError('El monto del comprobante no coincide con el detalle del período.');
  }

  const cargos: CargoComprobanteDTO[] = [{ concepto: 'alquiler', monto: alquiler }];
  if (intereses > 0) {
    cargos.push({ concepto: 'intereses_mora', monto: intereses, diasMora: diasInteres });
  }

  const propiedad: PropiedadComprobanteDTO = {
    id: inmueble.id,
    direccion: inmueble.direccion,
    numero: inmueble.numero,
    piso: inmueble.piso,
    barrio: inmueble.barrio,
    ciudad: inmueble.ciudad,
  };

  return {
    id_cobro: record.id,
    numero_comprobante: record.numero_comprobante,
    fecha_emision: record.fecha_emision,
    estado: 'pagado',
    locatario: personaFromRecord(locatario),
    locador: personaFromRecord(inmueble.locador),
    propiedad,
    contrato: {
      id: contrato.id,
      codigo: contrato.codigo,
      fecha_inicio: contrato.fecha_inicio_contrato,
      fecha_fin: contrato.fecha_fin_contrato,
    },
    periodo: {
      id: periodo.id,
      periodo: periodo.periodo,
      fecha_inicio: periodo.fecha_inicio,
      fecha_fin: periodo.fecha_fin,
      fecha_vencimiento: periodo.fecha_vencimiento,
    },
    cargos,
    total_pagado: total,
    total_en_letras: totalEnLetras(total),
    medio: record.medio,
    fecha_cobro: record.fecha_cobro,
    nota: record.nota,
  };
}

export class ComprobantePagoService {
  constructor(
    private readonly repository: IComprobantePagoRepository = comprobantePagoRepository
  ) {}

  async obtener(idCobro: number, usuarioId: number): Promise<ComprobantePagoDTO> {
    if (!Number.isInteger(idCobro) || idCobro <= 0) throw notFoundError();
    const record = await this.repository.findById(idCobro);
    if (!record) throw notFoundError();
    const contrato = record.periodo?.contrato;
    const inmueble = contrato?.inmueble;
    const locatario = contrato?.participantes.find(
      participante => participante.tipo_firmante === 2
    );
    const esLocadorPropietario = inmueble?.id_locador === usuarioId;
    const esLocatarioPrincipal = locatario?.id_usuario === usuarioId;
    if (!esLocadorPropietario && !esLocatarioPrincipal) throw notFoundError();
    return construirComprobante(record);
  }

  async generarPdf(idCobro: number, usuarioId: number): Promise<ComprobantePagoResultado> {
    const comprobante = await this.obtener(idCobro, usuarioId);
    return {
      comprobante,
      pdf: await generarComprobantePagoPdf(comprobante),
    };
  }
}

export const comprobantePagoService = new ComprobantePagoService();
