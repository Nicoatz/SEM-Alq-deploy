import { CobroConsultaService } from '../../src/services/cobro-consulta.service';
import type {
  ICobroConsultaRepository,
  PeriodoCobroConsultaRecord,
  PeriodoCobroEventoRecord,
} from '../../src/repositories/cobro-consulta.repository';

const locador = {
  id: 1,
  nombre: 'Lucía',
  apellido: 'Locadora',
  email: 'lucia@example.test',
  telefono: null,
};

const locatario = {
  id: 2,
  nombre: 'Mateo',
  apellido: 'Locatario',
  email: 'mateo@example.test',
  telefono: null,
};

function makePeriodo(
  id: number,
  periodo: string,
  fechaVencimiento: string,
  estado: PeriodoCobroConsultaRecord['estado'],
  cobros: PeriodoCobroConsultaRecord['cobros'] = []
): PeriodoCobroConsultaRecord {
  return {
    id,
    id_contrato: 50 + id,
    periodo,
    fecha_inicio: `${periodo}-01`,
    fecha_fin: `${periodo}-28`,
    fecha_disponible_monto: `${periodo}-01`,
    fecha_vencimiento: fechaVencimiento,
    monto_base_alquiler: 100000,
    expensas_snapshot: 15000,
    interes_diario_pct: 3,
    dias_gracia: 0,
    estado,
    created_at: `${periodo}-01T00:00:00.000Z`,
    contrato: {
      id: 50 + id,
      codigo: `CT-2026-${id}`,
      estado: 2,
      fecha_inicio_contrato: `${periodo}-01`,
      fecha_fin_contrato: '2027-12-31',
      inmueble: {
        id: 100 + id,
        id_locador: 1,
        direccion: 'Av. Colón',
        numero: 1200,
        piso: null,
        barrio: 'Alberdi',
        ciudad: 'Córdoba',
        locador,
      },
      participantes: [{ id_usuario: 2, tipo_firmante: 2, usuario: locatario }],
    },
    cobros,
  };
}

function makeCobro(
  id: number,
  fechaCobro: string,
  monto: number,
  path: string | null = null
): PeriodoCobroConsultaRecord['cobros'][number] {
  return {
    id,
    id_usuario_registro: 1,
    monto,
    fecha_cobro: fechaCobro,
    medio: 'transferencia',
    nota: null,
    comprobante_storage_path: path,
    numero_comprobante: `RC-2026-${String(id).padStart(4, '0')}`,
    fecha_emision: `${fechaCobro}T12:00:00.000Z`,
    created_at: `${fechaCobro}T12:00:00.000Z`,
    usuario_registro: { id: 1, nombre: 'Lucía', apellido: 'Locadora' },
  };
}

function makeRepository(records: PeriodoCobroConsultaRecord[] = []) {
  const events: PeriodoCobroEventoRecord[] = [];
  return {
    findHistorialByLocadorId: jest.fn(async () => records),
    findPeriodosByLocatarioId: jest.fn(async () => records),
    findDetalleByPeriodoId: jest.fn(async () => records[0] ?? null),
    findEventosByPeriodoId: jest.fn(async () => events),
    createSignedUrlForAttachedProof: jest.fn(async (path: string) => `https://signed.example.test/${path}`),
  } satisfies ICobroConsultaRepository & {
    findHistorialByLocadorId: jest.Mock;
    findPeriodosByLocatarioId: jest.Mock;
    findDetalleByPeriodoId: jest.Mock;
    findEventosByPeriodoId: jest.Mock;
    createSignedUrlForAttachedProof: jest.Mock;
  };
}

describe('CobroConsultaService', () => {
  const now = () => new Date('2026-11-04T12:00:00.000Z');

  it('ordena períodos del locador y calcula indicadores antes de paginar', async () => {
    const records = [
      makePeriodo(1, '2026-11', '2026-11-20', 'pendiente'),
      makePeriodo(2, '2026-10', '2026-10-01', 'vencido'),
      makePeriodo(3, '2026-09', '2026-09-10', 'pagado', [makeCobro(3, '2026-09-10', 100000)]),
    ];
    const repository = makeRepository(records);
    const service = new CobroConsultaService(repository, now);

    const result = await service.historialLocador(1, { page: 1, limit: 1 });

    expect(result.items.map(item => item.estado)).toEqual(['vencido']);
    expect(result.total).toBe(3);
    expect(result.resumen.cantidades).toEqual({ pendiente: 1, vencido: 1, pagado: 1 });
    expect(result.resumen.vencido).toBeGreaterThan(100000);
  });

  it('calcula interés lineal al día actual y no suma expensas', async () => {
    const repository = makeRepository([makePeriodo(1, '2026-10', '2026-11-01', 'pendiente')]);
    const service = new CobroConsultaService(repository, now);

    const result = await service.historialLocador(1, {});

    expect(result.items[0].intereses_mora).toBe(9000);
    expect(result.items[0].monto_exigible).toBe(109000);
    expect(result.items[0].saldo).toBe(109000);
    expect(result.items[0].monto_exigible).not.toBe(124000);
  });

  it('registra y omite un período inconsistente sin cancelar el listado', async () => {
    const records = [
      makePeriodo(1, '2026-10', '2026-11-20', 'pendiente'),
      makePeriodo(2, '2026-09', '2026-09-10', 'pagado'),
    ];
    const repository = makeRepository(records);
    const service = new CobroConsultaService(repository, now);
    const logError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await service.historialLocador(1, {});

    expect(result.items.map(item => item.id_periodo)).toEqual([1]);
    expect(logError).toHaveBeenCalledWith(
      '[US-09] Se omitió un período inconsistente de la lista.',
      expect.objectContaining({ idPeriodo: 2, idContrato: 52 })
    );
    logError.mockRestore();
  });

  it('usa la fecha de pago para el resumen anual aunque el período sea de otro año', async () => {
    const record = makePeriodo(1, '2025-12', '2025-12-31', 'pagado', [
      makeCobro(21, '2026-01-02', 106000),
    ]);
    const repository = makeRepository([record]);
    const service = new CobroConsultaService(repository, now);

    const result = await service.pagosLocatario(2, { anio: 2026 });

    expect(result.items).toHaveLength(0);
    expect(result.resumen_anual.total_pagado).toBe(106000);
    expect(result.resumen_anual.recargos_pagados).toBe(6000);
    expect(result.resumen_anual.pagos_a_termino).toBe(0);
  });

  it('devuelve 404 genérico para períodos inexistentes o ajenos', async () => {
    const repository = makeRepository([]);
    const service = new CobroConsultaService(repository, now);

    await expect(service.detalle(999, 44)).rejects.toMatchObject({
      statusCode: 404,
      message: 'No encontramos este cobro',
    });
    expect(repository.findEventosByPeriodoId).not.toHaveBeenCalled();
    expect(repository.createSignedUrlForAttachedProof).not.toHaveBeenCalled();
  });

  it('autoriza al locatario principal y devuelve 404 genérico a un tercero', async () => {
    const record = makePeriodo(1, '2026-09', '2026-09-10', 'pagado', [
      makeCobro(33, '2026-09-10', 100000),
    ]);
    const repository = makeRepository([record]);
    const service = new CobroConsultaService(repository, now);

    await expect(service.detalle(record.id, locatario.id)).resolves.toMatchObject({
      id_periodo: record.id,
      locatario: { id: locatario.id },
    });
    await expect(service.detalle(record.id, 44)).rejects.toMatchObject({
      statusCode: 404,
      message: 'No encontramos este cobro',
    });
    expect(repository.findDetalleByPeriodoId).toHaveBeenNthCalledWith(1, record.id);
    expect(repository.findDetalleByPeriodoId).toHaveBeenNthCalledWith(2, record.id);
  });

  it('firma temporalmente el adjunto solo después de autorizar el detalle', async () => {
    const record = makePeriodo(1, '2026-09', '2026-09-10', 'pagado', [
      makeCobro(33, '2026-09-10', 100000, 'cobros/1/1/original.pdf'),
    ]);
    const repository = makeRepository([record]);
    const service = new CobroConsultaService(repository, now);

    const detail = await service.detalle(record.id, 1);

    expect(detail.cobros[0].adjunto_url).toBe('https://signed.example.test/cobros/1/1/original.pdf');
    expect(detail.cobros[0]).not.toHaveProperty('comprobante_storage_path');
    expect(repository.findDetalleByPeriodoId).toHaveBeenCalledWith(record.id);
  });
});