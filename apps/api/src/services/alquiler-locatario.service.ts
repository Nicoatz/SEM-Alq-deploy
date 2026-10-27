import type {
  AlquilerLocatarioItemDTO,
  DetalleAlquilerLocatarioDTO,
  EstadoContratoLocatarioDTO,
  EstadoFirmaLocatarioDTO
} from '../dtos';
import {
  AlquilerLocatarioRecord,
  IAlquilerLocatarioRepository,
  alquilerLocatarioRepository,
  firstRelation
} from '../repositories/alquiler-locatario.repository';

const ESTADO_POR_ID: Record<number, EstadoContratoLocatarioDTO> = {
  2: 'vigente',
  3: 'finalizado',
  4: 'pendiente_firma'
};

const ORDEN_ESTADO: Record<EstadoContratoLocatarioDTO, number> = {
  pendiente_firma: 0,
  vigente: 1,
  finalizado: 2
};

function asDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function addMonthsClamped(date: Date, months: number): Date {
  const targetMonth = date.getUTCMonth() + months;
  const firstOfTargetMonth = new Date(Date.UTC(date.getUTCFullYear(), targetMonth, 1));
  const lastDay = new Date(Date.UTC(
    firstOfTargetMonth.getUTCFullYear(),
    firstOfTargetMonth.getUTCMonth() + 1,
    0
  )).getUTCDate();

  return new Date(Date.UTC(
    firstOfTargetMonth.getUTCFullYear(),
    firstOfTargetMonth.getUTCMonth(),
    Math.min(date.getUTCDate(), lastDay)
  ));
}

function parseAdjustmentMonths(frequency: string | null): number | null {
  if (!frequency) return null;
  const normalized = frequency.trim().toLowerCase();
  const named: Record<string, number> = {
    mensual: 1,
    bimestral: 2,
    trimestral: 3,
    cuatrimestral: 4,
    semestral: 6,
    anual: 12
  };
  if (named[normalized]) return named[normalized];
  const match = normalized.match(/^(\d+)\s+mes(?:es)?$/);
  return match ? Number(match[1]) : null;
}

export function calcularFechaProximoAjuste(
  contractStartDate: string | null,
  lastAdjustmentDate: string | null,
  frequency: string | null
): string | null {
  const intervalMonths = parseAdjustmentMonths(frequency);
  const baseDate = parseDateOnly(lastAdjustmentDate) ?? parseDateOnly(contractStartDate);
  if (intervalMonths === null || intervalMonths <= 0 || !baseDate) return null;
  return asDateOnly(addMonthsClamped(baseDate, intervalMonths));
}

export function calcularFechaProximoVencimiento(
  today: Date,
  contractStartDate: string | null,
  daysAfterAmountAvailable: number | null,
  lastAdjustmentDate: string | null = null
): string | null {
  const startDate = parseDateOnly(contractStartDate);
  if (!startDate || daysAfterAmountAvailable === null || daysAfterAmountAvailable <= 0) return null;

  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const firstDayOfCurrentPeriod = new Date(Date.UTC(todayUtc.getUTCFullYear(), todayUtc.getUTCMonth(), 1));
  let availabilityDate = startDate > todayUtc
    ? startDate
    : startDate > firstDayOfCurrentPeriod
      ? startDate
      : firstDayOfCurrentPeriod;
  const adjustmentDate = parseDateOnly(lastAdjustmentDate);
  if (adjustmentDate && adjustmentDate > availabilityDate) {
    availabilityDate = adjustmentDate;
  }
  availabilityDate.setUTCDate(availabilityDate.getUTCDate() + daysAfterAmountAvailable);

  return asDateOnly(availabilityDate);
}

function stateFor(record: AlquilerLocatarioRecord): EstadoContratoLocatarioDTO {
  const state = record.contrato.estado === null ? undefined : ESTADO_POR_ID[record.contrato.estado];
  if (!state) throw new Error(`Estado de contrato no soportado: ${record.contrato.estado}`);
  return state;
}

function itemFromRecord(record: AlquilerLocatarioRecord): AlquilerLocatarioItemDTO {
  const contract = record.contrato;
  const property = firstRelation(contract.inmueble);
  if (!property) throw new Error(`El contrato ${contract.id} no tiene inmueble asociado.`);
  const landlord = firstRelation(property.locador);
  if (!landlord) throw new Error(`El inmueble ${property.id} no tiene locador asociado.`);
  const photos = [...(property.fotos ?? [])].sort((left, right) => left.orden - right.orden);
  const mainPhoto = photos.find(photo => photo.es_principal) ?? photos[0] ?? null;
  const index = firstRelation(contract.indice);
  const nextAdjustmentDate = stateFor(record) === 'finalizado' ? null : calcularFechaProximoAjuste(
    contract.fecha_inicio_contrato,
    record.fecha_ultimo_ajuste,
    contract.frecuencia_ajuste
  );
  const fechaProximoAjuste = nextAdjustmentDate
    && contract.fecha_fin_contrato
    && nextAdjustmentDate > contract.fecha_fin_contrato
    ? contract.fecha_fin_contrato
    : nextAdjustmentDate;

  return {
    id_contrato: contract.id,
    codigo: String(contract.id),
    estado: stateFor(record),
    inmueble: {
      id: property.id,
      direccion: property.direccion,
      numero: property.numero,
      piso: property.piso,
      barrio: property.barrio,
      ciudad: property.ciudad,
      foto_principal: mainPhoto?.url ?? null
    },
    locador: {
      id: landlord.id,
      nombre: landlord.nombre,
      apellido: landlord.apellido,
      email: landlord.email,
      telefono: landlord.telefono
    },
    monto_actual: Number(contract.monto_alquiler),
    expensas: Number(contract.expensas),
    fecha_inicio_contrato: contract.fecha_inicio_contrato,
    fecha_fin_contrato: contract.fecha_fin_contrato,
    deposito: contract.deposito === null ? null : Number(contract.deposito),
    indice_ajuste: index?.descripcion ?? null,
    frecuencia_ajuste: contract.frecuencia_ajuste,
    fecha_ultimo_ajuste: record.fecha_ultimo_ajuste,
    fecha_proximo_ajuste: fechaProximoAjuste
  };
}

function signatureState(state: string): EstadoFirmaLocatarioDTO {
  if (state === 'pendiente' || state === 'firmado' || state === 'rechazado') return state;
  return 'desconocido';
}

export class AlquilerLocatarioService {
  constructor(
    private readonly repository: IAlquilerLocatarioRepository = alquilerLocatarioRepository,
    private readonly now: () => Date = () => new Date()
  ) {}

  async listar(
    locatarioId: number,
    estado?: EstadoContratoLocatarioDTO
  ): Promise<AlquilerLocatarioItemDTO[]> {
    const records = await this.repository.findByLocatarioId(locatarioId, estado);
    return records
      .map(record => itemFromRecord(record))
      .sort((left, right) =>
        ORDEN_ESTADO[left.estado] - ORDEN_ESTADO[right.estado]
        || (right.fecha_inicio_contrato ?? '').localeCompare(left.fecha_inicio_contrato ?? '')
        || right.id_contrato - left.id_contrato
      );
  }

  async obtenerDetalle(
    idContrato: number,
    locatarioId: number
  ): Promise<DetalleAlquilerLocatarioDTO | null> {
    const record = await this.repository.findByIdAndLocatarioId(idContrato, locatarioId);
    if (!record) return null;

    const item = itemFromRecord(record);
    const tenant = record.participantes.find(participant => participant.tipo_firmante === 2);
    const landlord = record.participantes.find(participant => participant.tipo_firmante === 1);
    const bothAgreedToSameDocument = Boolean(
      landlord?.fecha_conformidad
      && tenant?.fecha_conformidad
      && landlord.hash_documento_conforme
      && landlord.hash_documento_conforme === tenant.hash_documento_conforme
      && landlord.hash_documento_conforme === record.contrato.pdf_sha256
    );
    const canSign = item.estado === 'pendiente_firma'
      && bothAgreedToSameDocument
      && tenant?.estado_firma === 'pendiente';
    const contract = record.contrato;
    const signedPdfUrl = contract.pdf_storage_path
      ? await this.repository.createPdfSignedUrl(contract.pdf_storage_path)
      : null;
    const nextPaymentDate = item.estado === 'finalizado' ? null : calcularFechaProximoVencimiento(
      this.now(),
      contract.fecha_inicio_contrato,
      contract.dias_para_vencimiento,
      record.fecha_ultimo_ajuste
    );

    return {
      ...item,
      dias_para_vencimiento: contract.dias_para_vencimiento,
      fecha_proximo_vencimiento_pago: nextPaymentDate
        && contract.fecha_fin_contrato
        && nextPaymentDate > contract.fecha_fin_contrato
        ? null
        : nextPaymentDate,
      pdf_url: signedPdfUrl,
      medios_pago: (contract.medio_pago_x_contrato ?? [])
        .map(payment => firstRelation(payment.medio_pago)?.nombre)
        .filter((name): name is string => Boolean(name)),
      garantes: record.participantes
        .filter(participant => participant.tipo_firmante === 3)
        .map(participant => ({
          nombre: participant.nombre,
          apellido: participant.apellido,
          email: participant.email,
          telefono: participant.telefono
        })),
      firmas: record.participantes
        .filter(participant => [1, 2, 3].includes(participant.tipo_firmante))
        .map(participant => ({
        tipo: participant.tipo_firmante === 1
          ? 'locador'
          : participant.tipo_firmante === 2
            ? 'locatario'
            : 'garante',
        estado: signatureState(participant.estado_firma),
        fecha_conformidad: participant.fecha_conformidad,
        fecha_firma: participant.fecha_firma,
        fecha_rechazo: participant.fecha_rechazo,
        motivo_rechazo: participant.motivo_rechazo
        })),
      puede_firmar: canSign,
      monto_proximo_ajuste: item.fecha_proximo_ajuste ? 'a definir' : null
    };
  }
}

export const alquilerLocatarioService = new AlquilerLocatarioService();