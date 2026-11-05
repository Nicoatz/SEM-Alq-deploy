import type { NextFunction, Request, Response } from 'express';
import { CobroConsultaController } from '../../src/controllers/cobro-consulta.controller';
import { cobroConsultaService } from '../../src/services/cobro-consulta.service';

jest.mock('../../src/services/cobro-consulta.service', () => ({
  cobroConsultaService: {
    historialLocador: jest.fn(),
    pagosLocatario: jest.fn(),
    detalle: jest.fn(),
  },
}));

function makeResponse() {
  const response = { status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
}

describe('CobroConsultaController', () => {
  const controller = new CobroConsultaController();
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
  });

  it('valida estado antes de consultar el historial del locador', async () => {
    const req = { user: { id: 7 }, query: { estado: 'parcial' } } as unknown as Request;
    const res = makeResponse();

    await controller.historialLocador(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(cobroConsultaService.historialLocador).not.toHaveBeenCalled();
  });

  it('valida formato YYYY-MM y rango cronológico', async () => {
    const req = {
      user: { id: 7 },
      query: { desde: '2026-12', hasta: '2026-10' },
    } as unknown as Request;
    const res = makeResponse();

    await controller.historialLocador(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(cobroConsultaService.historialLocador).not.toHaveBeenCalled();
  });

  it('rechaza un medio de pago no admitido antes de consultar', async () => {
    const req = { user: { id: 7 }, query: { medio: 'crypto' } } as unknown as Request;
    const res = makeResponse();

    await controller.pagosLocatario(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(cobroConsultaService.pagosLocatario).not.toHaveBeenCalled();
  });

  it('responde 401 sin sesión', async () => {
    const req = { query: {} } as Request;
    const res = makeResponse();

    await controller.pagosLocatario(req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('pasa el ID y usuario autenticado al service para el detalle', async () => {
    jest.mocked(cobroConsultaService.detalle).mockRejectedValue(
      Object.assign(new Error('No encontramos este cobro'), { statusCode: 404 })
    );
    const req = { user: { id: 7 }, params: { id: '90' } } as unknown as Request<{ id: string }>;
    const res = makeResponse();

    await controller.detalle(req, res as unknown as Response, next);

    expect(cobroConsultaService.detalle).toHaveBeenCalledWith(90, 7);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 404,
      message: 'No encontramos este cobro',
    }));
  });
});import type { NextFunction, Request, Response } from 'express';
import { CobroConsultaController } from '../../src/controllers/cobro-consulta.controller';
import { cobroConsultaService } from '../../src/services/cobro-consulta.service';

jest.mock('../../src/services/cobro-consulta.service', () => ({
  cobroConsultaService: {
    historialLocador: jest.fn(),
    pagosLocatario: jest.fn(),
    detalle: jest.fn(),
  },
}));

function makeResponse() {
  const response = { status: jest.fn(), json: jest.fn() };
  response.status.mockReturnValue(response);
  return response;
}

describe('CobroConsultaController', () => {
  const controller = new CobroConsultaController();
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
  });

  it('rechaza un estado no admitido antes de consultar', async () => {
    const req = { user: { id: 8 }, query: { estado: 'parcial' } } as unknown as Request;
    const res = makeResponse();

    await controller.historialLocador(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(cobroConsultaService.historialLocador).not.toHaveBeenCalled();
  });

  it('rechaza un rango mensual invertido', async () => {
    const req = {
      user: { id: 8 },
      query: { desde: '2026-11', hasta: '2026-09' },
    } as unknown as Request;
    const res = makeResponse();

    await controller.historialLocador(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 400 }));
    expect(cobroConsultaService.historialLocador).not.toHaveBeenCalled();
  });

  it('devuelve 404 genérico cuando el detalle no existe o no está autorizado', async () => {
    jest.mocked(cobroConsultaService.detalle).mockRejectedValue(
      Object.assign(new Error('No encontramos este cobro'), { statusCode: 404 })
    );
    const req = { user: { id: 8 }, params: { id: '90' } } as unknown as Request<{ id: string }>;
    const res = makeResponse();

    await controller.detalle(req, res as unknown as Response, next);

    expect(cobroConsultaService.detalle).toHaveBeenCalledWith(90, 8);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 404,
      message: 'No encontramos este cobro',
    }));
  });
});