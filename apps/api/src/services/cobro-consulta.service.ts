import type {
  CobroRegistradoConsultaDTO,
  DetalleCobroConsultaDTO,
  EstadoPeriodoCobroDTO,
  EstadoConsultaCobroDTO,
  FiltrosHistorialCobrosLocadorDTO,
  FiltrosPagosLocatarioDTO,
  HistorialCobrosLocadorResultadoDTO,
  PagosLocatarioResultadoDTO,
  PagoLocatarioItemDTO,
  PeriodoCobroEventoDTO,
  PeriodoCobroResumenDTO,
  ResumenPagosLocatarioDTO,
} from '../dtos';
import {
  calcularInteresesMora,
} from './cobro.service';
import {
  cobroConsultaRepository,
  type ICobroConsultaRepository,
  type PeriodoCobroConsultaRecord,
} from '../repositories/cobro-consulta.repository';

const API_BASE_PATH = '/api/v1';

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function todayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function periodStatus(record: PeriodoCobroConsultaRecord, now: Date): EstadoPeriodoCobroDTO {
  if (record.estado === 'pagado') return 'pagado';
  const due = parseDate(record.fecha_vencimiento);
  return due && todayUtc(now) > due ? 'vencido' : 'pendiente';
}

interface PeriodMoney {
  state: EstadoPeriodoCobroDTO;
  daysLate: number;
  daysInterest: number;
  interest: number;
  exigible: number;
  paid: number;
  balance: number;
  cobro: PeriodoCobroConsultaRecord['cobros'][number] | null;
}

function consistencyError(message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode: 500 });
}

function calculatePeriodMoney(record: PeriodoCobroConsultaRecord, now: Date): PeriodMoney {
  const cobros = record.cobros ?? [];
  if (cobros.length > 1) {
    throw consistencyError(`El período ${record.id} tiene más de un cobro registrado.`);
  }

  const cobro = cobros[0] ?? null;
  const state = periodStatus(record, now);
  if ((state === 'pagado') !== Boolean(cobro)) {
    throw consistencyError(`El estado del período ${record.id} no coincide con sus cobros.`);
  }

  const amountDate = cobro ? parseDate(cobro.fecha_cobro) : todayUtc(now);
  if (!amountDate) throw consistencyError(`El período ${record.id} tiene una fecha de cobro inválida.`);
  const { intereses, diasInteres } = calcularInteresesMora(
    Number(record.monto_base_alquiler),
    Number(record.interes_diario_pct),
    Number(record.dias_gracia),
    record.fecha_vencimiento,
    amountDate
  );
  const base = money(Number(record.monto_base_alquiler));
  const exigible = money(base + intereses);
  const paid = cobro ? money(Number(cobro.monto)) : 0;

  if (cobro && Math.abs(paid - exigible) > 0.01) {
    throw consistencyError(`El cobro del período ${record.id} no coincide con el monto exigible.`);
  }

  const due = parseDate(record.fecha_vencimiento);
  const daysLate = due ? Math.max(0, daysBetween(amountDate, due)) : 0;
  return {
    state,
    daysLate,
    daysInterest: diasInteres,
    interest: money(intereses),
    exigible,
    paid,
    balance: state === 'pagado' ? 0 : money(Math.max(0, exigible - paid)),
    cobro,
  };
}

function locatarioPrincipal(record: PeriodoCobroConsultaRecord) {
  return record.contrato.participantes.find(
    participant => participant.tipo_firmante === 2 && participant.usuario
  )?.usuario ?? null;
}

function usuarioEsAmbasPartes(record: PeriodoCobroConsultaRecord, usuarioId: number): boolean {
  return record.contrato.inmueble.id_locador === usuarioId
    && locatarioPrincipal(record)?.id === usuarioId;
}

function isEstado(status: PeriodMoney['state'], estado?: EstadoConsultaCobroDTO): boolean {
  return !estado || estado === 'todos' || status === estado;
}

function pageValues(page?: number, limit?: number): { page: number; limit: number } {
  return {
    page: Math.max(1, Math.floor(page ?? 1)),
    limit: Math.min(100, Math.max(1, Math.floor(limit ?? 20))),
  };
}

function pageItems<T>(items: T[], page: number, limit: number): T[] {
  const start = (page - 1) * limit;
  return items.slice(start, start + limit);
}

function periodoYear(record: PeriodoCobroConsultaRecord): number {
  return Number(record.periodo.slice(0, 4));
}

function periodoResumen(
  record: PeriodoCobroConsultaRecord,
  finances: PeriodMoney
): PeriodoCobroResumenDTO {
  const property = record.contrato.inmueble;
  if (!property) throw consistencyError(`El contrato ${record.id_contrato} no tiene una propiedad.`);
  const locatario = locatarioPrincipal(record);
  const cobro = finances.cobro;

  return {
    id_periodo: record.id,
    id_contrato: record.id_contrato,
    codigo_contrato: record.contrato.codigo,
    periodo: record.periodo,
    estado: finances.state,
    fecha_inicio: record.fecha_inicio,
    fecha_fin: record.fecha_fin,
    fecha_vencimiento: record.fecha_vencimiento,
    propiedad: {
      id: property.id,
      direccion: property.direccion,
      numero: property.numero,
      piso: property.piso,
      barrio: property.barrio,
      ciudad: property.ciudad,
    },
    locatario: locatario ? {
      id: locatario.id,
      nombre: locatario.nombre,
      apellido: locatario.apellido,
    } : null,
    monto_base_alquiler: money(stateBaseAmount(record)),
    intereses_mora: finances.interest,
    dias_atraso: finances.daysLate,
    dias_interes: finances.daysInterest,
    monto_exigible: finances.exigible,
    total_cobrado: finances.paid,
    saldo: finances.balance,
    cantidad_cobros: record.cobros?.length ?? 0,
    tiene_adjunto: Boolean(cobro?.comprobante_storage_path),
    comprobante_url: cobro ? `${API_BASE_PATH}/cobros/${cobro.id}/comprobante` : null,
  };
}

interface PeriodoListadoPreparado {
  record: PeriodoCobroConsultaRecord;
  finances: PeriodMoney;
  summary: PeriodoCobroResumenDTO;
}

function prepareListRecords(
  records: PeriodoCobroConsultaRecord[],
  now: Date
): PeriodoListadoPreparado[] {
  const prepared: PeriodoListadoPreparado[] = [];

  for (const record of records) {
    try {
      const finances = calculatePeriodMoney(record, now);
      prepared.push({ record, finances, summary: periodoResumen(record, finances) });
    } catch (error) {
      console.error('[US-09] Se omitió un período inconsistente de la lista.', {
        idPeriodo: record.id,
        idContrato: record.id_contrato,
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return prepared;
}

function stateBaseAmount(record: PeriodoCobroConsultaRecord): number {
  return Number(record.monto_base_alquiler);
}

function toPagoItem(summary: PeriodoCobroResumenDTO, cobro: NonNullable<PeriodMoney['cobro']>): PagoLocatarioItemDTO {
  return {
    ...summary,
    fecha_pago: cobro.fecha_cobro,
    monto_pagado: money(Number(cobro.monto)),
    medio: cobro.medio,
    recargo_pagado: summary.intereses_mora,
    pagos_a_termino: summary.dias_atraso === 0,
  };
}

function notFoundError(): Error & { statusCode: number } {
  return Object.assign(new Error('No encontramos este cobro'), { statusCode: 404 });
}

function signedUrlError(): Error & { statusCode: number } {
  return Object.assign(new Error('No se pudo generar el enlace del comprobante adjunto.'), { statusCode: 500 });
}

function cobroDto(
  record: PeriodoCobroConsultaRecord['cobros'][number],
  adjuntoUrl: string | null
): CobroRegistradoConsultaDTO {
  if (!record.usuario_registro) {
    throw consistencyError(`El cobro ${record.id} no tiene usuario de registro asociado.`);
  }
  return {
    id_cobro: record.id,
    numero_comprobante: record.numero_comprobante,
    fecha_cobro: record.fecha_cobro,
    monto: money(Number(record.monto)),
    medio: record.medio,
    nota: record.nota,
    created_at: record.created_at,
    usuario_registro: {
      nombre: record.usuario_registro.nombre,
      apellido: record.usuario_registro.apellido,
    },
    tiene_adjunto: Boolean(record.comprobante_storage_path),
    adjunto_url: adjuntoUrl,
    comprobante_url: `${API_BASE_PATH}/cobros/${record.id}/comprobante`,
  };
}

export class CobroConsultaService {
  constructor(
    private readonly repository: ICobroConsultaRepository = cobroConsultaRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async historialLocador(
    usuarioId: number,
    filtros: FiltrosHistorialCobrosLocadorDTO
  ): Promise<HistorialCobrosLocadorResultadoDTO> {
    const now = this.now();
    const fetched = await this.repository.findHistorialByLocadorId(usuarioId, filtros);
    const inconsistent = fetched.filter(record => usuarioEsAmbasPartes(record, usuarioId));
    if (inconsistent.length > 0) {
      console.error('[US-09] El mismo usuario figura como locador y locatario del contrato.', {
        contratos: inconsistent.map(record => record.id_contrato),
      });
    }
    const records = fetched.filter(record => !usuarioEsAmbasPartes(record, usuarioId));
    const prepared = prepareListRecords(records, now);
    let items = prepared.map(item => item.summary);
    items = items.filter(item => isEstado(item.estado, filtros.estado));
    items.sort((left, right) => {
      const stateRank: Record<EstadoPeriodoCobroDTO, number> = { vencido: 0, pendiente: 1, pagado: 2 };
      return stateRank[left.estado] - stateRank[right.estado]
        || left.periodo.localeCompare(right.periodo)
        || left.id_periodo - right.id_periodo;
    });

    const summaryMonth = filtros.periodo ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const filteredIds = new Set(items.map(item => item.id_periodo));
    const summaryCobrado = records.filter(record => filteredIds.has(record.id)).reduce((sum, record) => {
      const monthCobros = (record.cobros ?? []).filter(cobro => cobro.fecha_cobro.startsWith(summaryMonth));
      return sum + monthCobros.reduce((subtotal, cobro) => subtotal + Number(cobro.monto), 0);
    }, 0);
    const summaryOverdue = items
      .filter(item => item.estado === 'vencido')
      .reduce((sum, item) => sum + item.saldo, 0);
    const cantidades: Record<EstadoPeriodoCobroDTO, number> = {
      pendiente: items.filter(item => item.estado === 'pendiente').length,
      vencido: items.filter(item => item.estado === 'vencido').length,
      pagado: items.filter(item => item.estado === 'pagado').length,
    };
    const { page, limit } = pageValues(filtros.page, filtros.limit);

    return {
      items: pageItems(items, page, limit),
      resumen: { cobrado: money(summaryCobrado), vencido: money(summaryOverdue), cantidades },
      total: items.length,
      page,
      limit,
      filtros,
    };
  }

  async pagosLocatario(
    usuarioId: number,
    filtros: FiltrosPagosLocatarioDTO
  ): Promise<PagosLocatarioResultadoDTO> {
    const now = this.now();
    const fetched = await this.repository.findPeriodosByLocatarioId(usuarioId);
    const inconsistent = fetched.filter(record => usuarioEsAmbasPartes(record, usuarioId));
    if (inconsistent.length > 0) {
      console.error('[US-09] El mismo usuario figura como locador y locatario del contrato.', {
        contratos: inconsistent.map(record => record.id_contrato),
      });
    }
    const records = fetched.filter(record => !usuarioEsAmbasPartes(record, usuarioId));
    const annualYear = filtros.anio ?? now.getUTCFullYear();
    const prepared = prepareListRecords(records, now);
    const paidInYear = (filtros.estado && filtros.estado !== 'todos' && filtros.estado !== 'pagado'
      ? []
      : prepared.filter(({ record }) => (record.cobros ?? []).some(cobro =>
        Number(cobro.fecha_cobro.slice(0, 4)) === annualYear
        && (!filtros.medio || cobro.medio === filtros.medio)
      )))
      .filter(({ finances }) => finances.cobro !== null);
    const resumenAnual: ResumenPagosLocatarioDTO = {
      anio: annualYear,
      total_pagado: money(paidInYear.reduce((sum, item) => sum + item.finances.paid, 0)),
      pagos_a_termino: paidInYear.filter(item => item.finances.daysLate === 0).length,
      recargos_pagados: money(paidInYear.reduce((sum, item) => sum + item.finances.interest, 0)),
    };

    const summaries = prepared
      .filter(({ record }) => !filtros.anio || periodoYear(record) === filtros.anio)
      .filter(({ finances }) => isEstado(finances.state, filtros.estado));

    const nextCandidate = summaries
      .filter(({ finances }) => finances.state !== 'pagado')
      .sort((left, right) => left.record.fecha_inicio.localeCompare(right.record.fecha_inicio))[0] ?? null;
    const proximoPeriodo = nextCandidate
      ? nextCandidate.summary
      : null;

    const paidItems = summaries
      .filter(({ finances }) => finances.cobro !== null)
      .filter(({ finances }) => !filtros.medio || finances.cobro?.medio === filtros.medio)
      .map(({ summary, finances }) => toPagoItem(summary, finances.cobro!))
      .sort((left, right) => right.periodo.localeCompare(left.periodo) || right.fecha_pago.localeCompare(left.fecha_pago));
    const { page, limit } = pageValues(filtros.page, filtros.limit);

    return {
      proximo_periodo: filtros.estado === 'pagado' ? null : proximoPeriodo,
      items: pageItems(paidItems, page, limit),
      resumen_anual: resumenAnual,
      total: paidItems.length,
      page,
      limit,
      filtros,
    };
  }

  async detalle(idPeriodo: number, usuarioId: number): Promise<DetalleCobroConsultaDTO> {
    if (!Number.isSafeInteger(idPeriodo) || idPeriodo <= 0) throw notFoundError();
    const record = await this.repository.findDetalleByPeriodoId(idPeriodo);
    if (!record) throw notFoundError();

    const property = record.contrato.inmueble;
    const locador = property.locador;
    const locatario = locatarioPrincipal(record);
    if (!locador || !locatario) throw consistencyError('El período no tiene ambas partes asociadas al contrato.');
    const isLandlord = property.id_locador === usuarioId;
    const isTenant = locatario.id === usuarioId;
    if (isLandlord && isTenant) {
      console.error('[US-09] El mismo usuario está vinculado a ambas partes del contrato.', {
        idContrato: record.id_contrato,
      });
      throw notFoundError();
    }
    if (!isLandlord && !isTenant) throw notFoundError();

    const finances = calculatePeriodMoney(record, this.now());
    const events = await this.repository.findEventosByPeriodoId(idPeriodo);
    const cobros: CobroRegistradoConsultaDTO[] = [];
    for (const cobro of record.cobros ?? []) {
      let signedUrl: string | null = null;
      if (cobro.comprobante_storage_path) {
        try {
          signedUrl = await this.repository.createSignedUrlForAttachedProof(cobro.comprobante_storage_path);
        } catch {
          throw signedUrlError();
        }
      }
      cobros.push(cobroDto(cobro, signedUrl));
    }

    return {
      id_periodo: record.id,
      id_contrato: record.id_contrato,
      propiedad: {
        id: property.id,
        direccion: property.direccion,
        numero: property.numero,
        piso: property.piso,
        barrio: property.barrio,
        ciudad: property.ciudad,
      },
      locador: {
        id: locador.id,
        nombre: locador.nombre,
        apellido: locador.apellido,
        email: locador.email,
        telefono: locador.telefono,
      },
      locatario: {
        id: locatario.id,
        nombre: locatario.nombre,
        apellido: locatario.apellido,
        email: locatario.email,
        telefono: locatario.telefono,
      },
      contrato: {
        codigo: record.contrato.codigo,
        fecha_inicio: record.contrato.fecha_inicio_contrato,
        fecha_fin: record.contrato.fecha_fin_contrato,
      },
      periodo: {
        periodo: record.periodo,
        estado: finances.state,
        fecha_inicio: record.fecha_inicio,
        fecha_fin: record.fecha_fin,
        fecha_vencimiento: record.fecha_vencimiento,
      },
      cargos: [
        { concepto: 'alquiler', monto: money(Number(record.monto_base_alquiler)) },
        ...(finances.interest > 0 ? [{
          concepto: 'intereses_mora' as const,
          monto: finances.interest,
          dias_mora: finances.daysLate,
          dias_interes: finances.daysInterest,
        }] : []),
      ],
      total_exigible: finances.exigible,
      total_cobrado: finances.paid,
      saldo: finances.balance,
      cobros,
      historial: events.map(event => ({
        tipo: event.tipo,
        fecha_hora: event.fecha_hora,
        usuario: event.usuario ? { nombre: event.usuario.nombre, apellido: event.usuario.apellido } : null,
        datos: event.datos,
      })) as PeriodoCobroEventoDTO[],
    };
  }
}

export const cobroConsultaService = new CobroConsultaService();