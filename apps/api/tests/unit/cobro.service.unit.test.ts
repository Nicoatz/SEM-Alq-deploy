import {
  calcularInteresesMora,
  CobroService,
  ComprobanteUpload,
} from '../../src/services/cobro.service';
import type {
  FiltrosCobrosLocadorDTO,
  RegistrarCobroResultadoDTO,
} from '../../src/dtos';
import type {
  IPeriodoCobroRepository,
  PeriodoCobroRecord,
} from '../../src/repositories/cobro.repository';

function crearPeriodo(overrides: Partial<PeriodoCobroRecord> = {}): PeriodoCobroRecord {
  return {
    id: 1,
    id_contrato: 10,
    periodo: '2026-11',
    fecha_inicio: '2026-11-01',
    fecha_fin: '2026-11-30',
    fecha_disponible_monto: '2026-11-01',
    fecha_vencimiento: '2026-11-10',
    monto_base_alquiler: 100000,
    expensas_snapshot: 30000,
    interes_diario_pct: 3,
    dias_gracia: 2,
    estado: 'pendiente',
    contrato: {
      id: 10,
      id_inmueble: 20,
      inmueble: {
        id: 20,
        direccion: 'Av. Colón',
        numero: 1550,
        piso: '4B',
        barrio: 'Alberdi',
        id_locador: 7,
      },
    },
    locatario: { id: 8, nombre: 'Luis', apellido: 'Inquilino' },
    ...overrides,
  };
}

function crearRepository(periodos: PeriodoCobroRecord[] = []) {
  const resultado: RegistrarCobroResultadoDTO = {
    cobro_id: 50,
    periodo_id: 1,
    monto: 106000,
    intereses: 6000,
    dias_interes: 2,
    numero_comprobante: 'RC-2026-0001',
    estado_periodo: 'pagado',
  };
  return {
    findPeriodosCobrablesByLocadorId: jest.fn(async (_id: number, _filtros?: FiltrosCobrosLocadorDTO) => periodos),
    registrarCobroManual: jest.fn(async () => resultado),
    uploadComprobante: jest.fn(async (_path: string, _data: Buffer, _type: string) => undefined),
    removeComprobante: jest.fn(async (_path: string) => undefined),
  } satisfies IPeriodoCobroRepository & Record<string, jest.Mock>;
}

describe('CobroService', () => {
  it('calcula interés lineal después de los días de gracia y excluye expensas', () => {
    expect(calcularInteresesMora(
      100000,
      3,
      2,
      '2026-11-10',
      new Date('2026-11-14T12:00:00.000Z')
    )).toEqual({ intereses: 6000, diasInteres: 2 });
  });

  it('lista períodos cobrables y calcula el estado vencido', async () => {
    const repository = crearRepository([crearPeriodo()]);
    const service = new CobroService(repository, () => new Date('2026-11-14T12:00:00.000Z'));

    const result = await service.listarPeriodos(7);

    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      estado: 'vencido',
      monto_base_alquiler: 100000,
      intereses_mora: 6000,
      monto_exigible: 106000,
      saldo: 106000,
      expensas_snapshot: 30000,
    });
  });

  it('valida el medio otro antes de tocar la persistencia', async () => {
    const repository = crearRepository([crearPeriodo()]);
    const service = new CobroService(repository);

    await expect(service.registrar(7, {
      id_periodo: 1,
      fecha_cobro: '2026-11-14',
      medio: 'otro',
      nota: null,
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.registrarCobroManual).not.toHaveBeenCalled();
  });

  it('sube el adjunto y registra el cobro, limpiándolo si falla la RPC', async () => {
    const repository = crearRepository([crearPeriodo()]);
    const service = new CobroService(repository);
    const file: ComprobanteUpload = {
      buffer: Buffer.from('pdf'),
      mimetype: 'application/pdf',
      originalname: 'comprobante.pdf',
      size: 3,
    };

    await service.registrar(7, {
      id_periodo: 1,
      fecha_cobro: '2026-11-14',
      medio: 'transferencia',
      nota: null,
    }, file);

    expect(repository.uploadComprobante).toHaveBeenCalledWith(
      expect.stringMatching(/^cobros\/7\/1\/.*\.pdf$/),
      file.buffer,
      file.mimetype
    );
    expect(repository.registrarCobroManual).toHaveBeenCalledWith(
      1,
      7,
      '2026-11-14',
      'transferencia',
      null,
      expect.stringMatching(/^cobros\/7\/1\/.*\.pdf$/)
    );
  });
});
