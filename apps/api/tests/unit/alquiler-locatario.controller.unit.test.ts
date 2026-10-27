import { Request, Response, NextFunction } from 'express';
import { alquilerLocatarioController } from '../../src/controllers/alquiler-locatario.controller';
import { alquilerLocatarioService } from '../../src/services/alquiler-locatario.service';

jest.mock('../../src/services/alquiler-locatario.service', () => ({
  alquilerLocatarioService: {
    listar: jest.fn(),
    obtenerDetalle: jest.fn()
  }
}));

function crearResponse() {
  const response = {
    status: jest.fn(),
    json: jest.fn()
  };
  response.status.mockReturnValue(response);
  return response;
}

describe('AlquilerLocatarioController', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rechaza filtros de estado desconocidos con 400', async () => {
    const req = { user: { id: 8 }, query: { estado: 'borrador' } } as unknown as Request;
    const res = crearResponse();
    const next = jest.fn() as NextFunction;

    await alquilerLocatarioController.listar(req, res as unknown as Response, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(alquilerLocatarioService.listar).not.toHaveBeenCalled();
  });

  it('requiere sesión y responde 401 sin usuario', async () => {
    const req = { query: {} } as Request;
    const res = crearResponse();

    await alquilerLocatarioController.listar(req, res as unknown as Response, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('usa el usuario autenticado y responde 404 uniforme para detalle no autorizado', async () => {
    jest.mocked(alquilerLocatarioService.obtenerDetalle).mockResolvedValue(null);
    const req = {
      user: { id: 8 },
      params: { idContrato: '41' }
    } as unknown as Request<{ idContrato: string }>;
    const res = crearResponse();

    await alquilerLocatarioController.obtenerDetalle(req, res as unknown as Response, jest.fn());

    expect(alquilerLocatarioService.obtenerDetalle).toHaveBeenCalledWith(41, 8);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'No encontramos este alquiler.'
    });
  });
});