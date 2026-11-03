import {
  ComprobantePagoService,
} from '../../src/services/comprobante-pago.service';
import type { ComprobantePagoRecord, IComprobantePagoRepository } from '../../src/repositories/comprobante-pago.repository';

function crearComprobante(overrides: Partial<ComprobantePagoRecord> = {}): ComprobantePagoRecord {
  return {
    id: 50,
    monto: 106000,
    fecha_cobro: '2026-11-14',
    medio: 'transferencia',
    nota: null,
    numero_comprobante: 'RC-2026-0001',
    fecha_emision: '2026-11-14T15:00:00.000Z',
    periodo: {
      id: 1,
      periodo: '2026-11',
      fecha_inicio: '2026-11-01',
      fecha_fin: '2026-11-30',
      fecha_vencimiento: '2026-11-10',
      monto_base_alquiler: 100000,
      interes_diario_pct: 3,
      dias_gracia: 2,
      estado: 'pagado',
      contrato: {
        id: 10,
        codigo: 'CON-2026-0001',
        fecha_inicio_contrato: '2026-11-01',
        fecha_fin_contrato: '2027-10-31',
        inmueble: {
          id: 20,
          direccion: 'Av. Colon',
          numero: 1550,
          piso: '4B',
          barrio: 'Alberdi',
          ciudad: 'Cordoba',
          locador: {
            id: 7,
            nombre: 'Ana',
            apellido: 'Locadora',
            numero_documento: '20123456',
            email: 'ana@example.com',
            telefono: '3515550000',
          },
        },
        participantes: [{
          id_usuario: 8,
          tipo_firmante: 2,
          usuario: {
            id: 8,
            nombre: 'Luis',
            apellido: 'Inquilino',
            numero_documento: '30123456',
            email: 'luis@example.com',
            telefono: '3515551111',
          },
        }],
      },
    },
    ...overrides,
  };
}

function crearRepository(record: ComprobantePagoRecord | null): IComprobantePagoRepository {
  return {
    findByIdAndUsuarioPermitido: jest.fn(async () => record),
  };
}

describe('ComprobantePagoService', () => {
  it('devuelve el comprobante con intereses separados y genera el PDF en memoria', async () => {
    const service = new ComprobantePagoService(crearRepository(crearComprobante()));

    const result = await service.generarPdf(50, 8);

    expect(result.comprobante).toMatchObject({
      id_cobro: 50,
      total_pagado: 106000,
      cargos: [
        { concepto: 'alquiler', monto: 100000 },
        { concepto: 'intereses_mora', monto: 6000, diasMora: 2 },
      ],
    });
    expect(result.pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('usa un 404 genérico cuando el repository no autoriza el cobro', async () => {
    const service = new ComprobantePagoService(crearRepository(null));

    await expect(service.obtener(50, 99)).rejects.toMatchObject({
      statusCode: 404,
      message: 'No encontramos este comprobante',
    });
  });

  it('rechaza un detalle cuyo total no coincide con el monto persistido', async () => {
    const service = new ComprobantePagoService(crearRepository(crearComprobante({ monto: 100000 })));

    await expect(service.obtener(50, 8)).rejects.toMatchObject({ statusCode: 500 });
  });
});
