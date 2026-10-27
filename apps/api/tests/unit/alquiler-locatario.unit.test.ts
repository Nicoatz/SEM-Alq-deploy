import {
  AlquilerLocatarioService,
  calcularFechaProximoAjuste,
  calcularFechaProximoVencimiento
} from '../../src/services/alquiler-locatario.service';
import type {
  AlquilerLocatarioRecord,
  IAlquilerLocatarioRepository
} from '../../src/repositories/alquiler-locatario.repository';

function crearRegistro(
  id: number,
  estado: number,
  fechaInicio: string,
  options: { fechaUltimoAjuste?: string | null; participantes?: AlquilerLocatarioRecord['participantes'] } = {}
): AlquilerLocatarioRecord {
  return {
    contrato: {
      id,
      estado,
      monto_alquiler: 300000,
      expensas: 25000,
      deposito: 300000,
      indice_aumento: 1,
      frecuencia_ajuste: 'Semestral',
      fecha_inicio_contrato: fechaInicio,
      fecha_fin_contrato: '2028-09-30',
      dias_para_vencimiento: 10,
      pdf_storage_path: `contrato-${id}.pdf`,
      pdf_sha256: 'a'.repeat(64),
      inmueble: {
        id: id + 100,
        direccion: 'Av. Colón',
        numero: 1550,
        piso: '4B',
        barrio: 'Alberdi',
        ciudad: 'Córdoba',
        locador: {
          id: 1,
          nombre: 'Ana',
          apellido: 'Locadora',
          email: 'ana@example.test',
          telefono: null
        },
        fotos: [{ url: 'https://example.test/foto.jpg', es_principal: true, orden: 1 }]
      },
      indice: { descripcion: 'ICL' },
      medio_pago_x_contrato: [{ medio_pago: { nombre: 'Transferencia' } }]
    },
    participantes: options.participantes ?? [],
    fecha_ultimo_ajuste: options.fechaUltimoAjuste ?? null
  } as AlquilerLocatarioRecord;
}

function firmante(tipoFirmante: number, hash: string, estadoFirma = 'pendiente') {
  return {
    id: tipoFirmante,
    id_contrato: 1,
    tipo_firmante: tipoFirmante,
    nombre: tipoFirmante === 1 ? 'Ana' : 'Luis',
    apellido: 'Persona',
    email: 'persona@example.test',
    telefono: null,
    estado_firma: estadoFirma as 'pendiente' | 'firmado' | 'rechazado' | 'desconocido',
    fecha_conformidad: '2026-10-20T12:00:00.000Z',
    hash_documento_conforme: hash,
    fecha_firma: null,
    fecha_rechazo: null,
    hash_documento_firmado: null,
    motivo_rechazo: null
  };
}

function crearRepository(records: AlquilerLocatarioRecord[] = []) {
  return {
    findByLocatarioId: jest.fn(async (_locatarioId: number, estado?: string) =>
      estado
        ? records.filter(record => record.contrato.estado === ({ pendiente_firma: 4, vigente: 2, finalizado: 3 } as const)[estado as 'pendiente_firma' | 'vigente' | 'finalizado'])
        : records
    ),
    findByIdAndLocatarioId: jest.fn(async () => records[0] ?? null),
    createPdfSignedUrl: jest.fn(async (path: string) => `https://signed.example.test/${path}`)
  } satisfies IAlquilerLocatarioRepository & {
    findByLocatarioId: jest.Mock;
    findByIdAndLocatarioId: jest.Mock;
    createPdfSignedUrl: jest.Mock;
  };
}

describe('AlquilerLocatarioService', () => {
  it('calcula el próximo ajuste desde el último ajuste y acota fechas de fin de mes', () => {
    expect(calcularFechaProximoAjuste('2024-08-31', null, 'Semestral')).toBe('2025-02-28');
    expect(calcularFechaProximoAjuste('2026-01-01', '2026-08-31', 'Mensual')).toBe('2026-09-30');
    expect(calcularFechaProximoAjuste('2026-01-01', null, 'sin frecuencia')).toBeNull();
  });

  it('calcula el vencimiento sumando el plazo desde la disponibilidad mensual asumida', () => {
    expect(calcularFechaProximoVencimiento(
      new Date('2026-10-26T12:00:00.000Z'),
      '2026-01-01',
      10
    )).toBe('2026-10-11');
    expect(calcularFechaProximoVencimiento(
      new Date('2026-10-26T12:00:00.000Z'),
      '2026-01-01',
      35
    )).toBe('2026-11-05');
    expect(calcularFechaProximoVencimiento(
      new Date('2026-10-26T12:00:00.000Z'),
      '2026-01-01',
      10,
      '2026-10-20'
    )).toBe('2026-10-30');
  });

  it('pasa el filtro y ordena pendiente, vigente y finalizado', async () => {
    const repository = crearRepository([
      crearRegistro(3, 3, '2025-01-01'),
      crearRegistro(2, 2, '2026-01-01'),
      crearRegistro(1, 4, '2025-12-01')
    ]);
    const service = new AlquilerLocatarioService(repository);

    const results = await service.listar(22);

    expect(repository.findByLocatarioId).toHaveBeenCalledWith(22, undefined);
    expect(results.map(item => item.estado)).toEqual([
      'pendiente_firma',
      'vigente',
      'finalizado'
    ]);

    const onlyCurrent = await service.listar(22, 'vigente');
    expect(repository.findByLocatarioId).toHaveBeenLastCalledWith(22, 'vigente');
    expect(onlyCurrent.map(item => item.estado)).toEqual(['vigente']);
  });

  it('permite firmar solo si ambas conformidades corresponden al mismo documento', async () => {
    const record = crearRegistro(1, 4, '2026-10-01', {
      participantes: [
        firmante(1, 'a'.repeat(64)),
        firmante(2, 'a'.repeat(64)),
        firmante(3, 'a'.repeat(64))
      ]
    });
    const repository = crearRepository([record]);
    const service = new AlquilerLocatarioService(repository, () => new Date('2026-10-26T12:00:00.000Z'));

    const details = await service.obtenerDetalle(1, 22);

    expect(details?.puede_firmar).toBe(true);
    expect(details?.fecha_proximo_vencimiento_pago).toBe('2026-10-11');
    expect(details?.pdf_url).toBe('https://signed.example.test/contrato-1.pdf');
    expect(repository.createPdfSignedUrl).toHaveBeenCalledWith('contrato-1.pdf');
    expect(details?.firmas.map(signature => signature.tipo)).toEqual([
      'locador',
      'locatario',
      'garante'
    ]);
  });

  it('no permite firmar si las partes conformaron versiones distintas del PDF', async () => {
    const record = crearRegistro(1, 4, '2026-10-01', {
      participantes: [firmante(1, 'a'.repeat(64)), firmante(2, 'b'.repeat(64))]
    });
    const service = new AlquilerLocatarioService(crearRepository([record]));

    const details = await service.obtenerDetalle(1, 22);

    expect(details?.puede_firmar).toBe(false);
  });

  it('no ofrece vencimientos ni ajustes futuros para contratos finalizados', async () => {
    const repository = crearRepository([crearRegistro(1, 3, '2026-10-01')]);
    const service = new AlquilerLocatarioService(repository);

    const details = await service.obtenerDetalle(1, 22);

    expect(details?.fecha_proximo_vencimiento_pago).toBeNull();
    expect(details?.fecha_proximo_ajuste).toBeNull();
    expect(details?.puede_firmar).toBe(false);
  });

  it('limita al fin del contrato un próximo ajuste posterior a su vigencia', async () => {
    const record = crearRegistro(1, 2, '2026-10-01');
    record.contrato.fecha_fin_contrato = '2026-12-31';
    const service = new AlquilerLocatarioService(crearRepository([record]));

    const results = await service.listar(22);

    expect(results[0]?.fecha_proximo_ajuste).toBe('2026-12-31');
  });

  it('no devuelve detalle ni solicita URL del PDF si la relación autenticada no existe', async () => {
    const repository = crearRepository([]);
    const service = new AlquilerLocatarioService(repository);

    await expect(service.obtenerDetalle(999, 22)).resolves.toBeNull();
    expect(repository.createPdfSignedUrl).not.toHaveBeenCalled();
  });
});