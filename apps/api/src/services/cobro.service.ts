import { randomUUID } from 'node:crypto';
import type {
  FiltrosCobrosLocadorDTO,
  MedioCobroManualDTO,
  PeriodoCobroItemDTO,
  PeriodosCobroResultadoDTO,
  RegistrarCobroDTO,
  RegistrarCobroResultadoDTO,
} from '../dtos';
import {
  IPeriodoCobroRepository,
  periodoCobroRepository,
  PeriodoCobroRecord,
} from '../repositories/cobro.repository';

const MEDIOS_VALIDOS: readonly MedioCobroManualDTO[] = [
  'transferencia',
  'efectivo',
  'cheque',
  'mercadopago_externo',
  'otro',
];

export interface ComprobanteUpload {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

const MIME_EXTENSION: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfToday(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

export function calcularInteresesMora(
  montoBase: number,
  interesDiarioPct: number,
  diasGracia: number,
  fechaVencimiento: string,
  fechaCalculo: Date
): { intereses: number; diasInteres: number } {
  const vencimiento = parseDate(fechaVencimiento);
  if (!vencimiento) return { intereses: 0, diasInteres: 0 };

  const diasAtraso = Math.max(0, daysBetween(startOfToday(fechaCalculo), vencimiento));
  const diasInteres = Math.max(0, diasAtraso - Math.max(0, diasGracia));
  const intereses = Math.round(montoBase * (interesDiarioPct / 100) * diasInteres * 100) / 100;
  return { intereses, diasInteres };
}

function estadoPeriodo(record: PeriodoCobroRecord, now: Date): 'pendiente' | 'vencido' {
  const vencimiento = parseDate(record.fecha_vencimiento);
  return vencimiento && startOfToday(now) > vencimiento ? 'vencido' : 'pendiente';
}

function itemFromRecord(record: PeriodoCobroRecord, now: Date): PeriodoCobroItemDTO {
  const { intereses } = calcularInteresesMora(
    Number(record.monto_base_alquiler),
    Number(record.interes_diario_pct),
    Number(record.dias_gracia),
    record.fecha_vencimiento,
    now
  );
  const montoBase = Number(record.monto_base_alquiler);

  return {
    id_periodo: record.id,
    id_contrato: record.id_contrato,
    periodo: record.periodo,
    inmueble: {
      id: record.contrato.inmueble.id,
      direccion: record.contrato.inmueble.direccion,
      numero: record.contrato.inmueble.numero,
      piso: record.contrato.inmueble.piso,
      barrio: record.contrato.inmueble.barrio,
    },
    locatario: record.locatario,
    estado: estadoPeriodo(record, now),
    fecha_inicio: record.fecha_inicio,
    fecha_fin: record.fecha_fin,
    fecha_vencimiento: record.fecha_vencimiento,
    monto_base_alquiler: montoBase,
    intereses_mora: intereses,
    monto_exigible: montoBase + intereses,
    expensas_snapshot: Number(record.expensas_snapshot),
    saldo: montoBase + intereses,
  };
}

export class CobroService {
  constructor(
    private readonly repository: IPeriodoCobroRepository = periodoCobroRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async listarPeriodos(
    locadorId: number,
    filtros: FiltrosCobrosLocadorDTO = {}
  ): Promise<PeriodosCobroResultadoDTO> {
    const records = await this.repository.findPeriodosCobrablesByLocadorId(locadorId, filtros);
    const filtered = records
      .map(record => itemFromRecord(record, this.now()))
      .filter(item => !filtros.estado || item.estado === filtros.estado);
    const page = filtros.page && filtros.page > 0 ? Math.floor(filtros.page) : 1;
    const limit = filtros.limit && filtros.limit > 0 ? Math.min(Math.floor(filtros.limit), 100) : 20;
    const start = (page - 1) * limit;
    return {
      items: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
    };
  }

  async registrar(
    locadorId: number,
    data: RegistrarCobroDTO,
    comprobante?: ComprobanteUpload
  ): Promise<RegistrarCobroResultadoDTO> {
    if (!Number.isInteger(data.id_periodo) || data.id_periodo <= 0) {
      throw this.validationError('El período indicado no es válido.');
    }
    const fecha = parseDate(data.fecha_cobro);
    if (!fecha) throw this.validationError('La fecha del cobro no es válida.');
    if (!MEDIOS_VALIDOS.includes(data.medio)) {
      throw this.validationError('El medio de cobro no es válido.');
    }
    if (data.medio === 'otro' && !data.nota?.trim()) {
      throw this.validationError('La nota es obligatoria para el medio otro.');
    }
    if (data.nota && data.nota.length > 200) {
      throw this.validationError('La nota no puede superar los 200 caracteres.');
    }

    let storagePath: string | null = null;
    if (comprobante) {
      const extension = MIME_EXTENSION[comprobante.mimetype];
      if (!extension) throw this.validationError('El comprobante debe ser PDF, JPG o PNG.');
      if (comprobante.size > 5 * 1024 * 1024) {
        throw this.validationError('El comprobante no puede superar los 5 MB.');
      }
      storagePath = `cobros/${locadorId}/${data.id_periodo}/${randomUUID()}.${extension}`;
      await this.repository.uploadComprobante(storagePath, comprobante.buffer, comprobante.mimetype);
    }

    try {
      return await this.repository.registrarCobroManual(
        data.id_periodo,
        locadorId,
        dateOnly(fecha),
        data.medio,
        data.nota?.trim() || null,
        storagePath
      );
    } catch (error) {
      if (storagePath) await this.repository.removeComprobante(storagePath).catch(() => undefined);
      const rpcError = error as { code?: unknown; message?: unknown };
      if (rpcError.code === '42501') Object.assign(error as object, { statusCode: 403 });
      if (rpcError.code === 'P0002') Object.assign(error as object, { statusCode: 404 });
      if (rpcError.code === 'P0001') Object.assign(error as object, { statusCode: 409 });
      throw error;
    }
  }

  private validationError(message: string): Error & { statusCode: number } {
    return Object.assign(new Error(message), { statusCode: 400 });
  }
}

export const cobroService = new CobroService();
