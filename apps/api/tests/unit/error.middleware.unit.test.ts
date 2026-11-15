import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../src/gateway/middlewares/error.middleware';

describe('errorHandler', () => {
  afterEach(() => jest.restoreAllMocks());

  it('no expone detalles PostgREST en un 500 y los conserva en el log', () => {
    const internalMessage = 'failed to parse logic tree (inmueble.id_locador.eq.23, participantes.id_usuario.eq.8)';
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const req = {
      method: 'GET',
      originalUrl: '/api/v1/cobros/12',
    } as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    errorHandler(
      { code: 'PGRST100', message: internalMessage },
      req,
      res as Response,
      jest.fn() as NextFunction
    );

    expect(res.status).toHaveBeenCalledWith(500);
    const body = jest.mocked(res.json).mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain('PGRST100');
    expect(JSON.stringify(body)).not.toContain('inmueble.id_locador');
    expect(JSON.stringify(body)).not.toContain('participantes.id_usuario');
    expect(JSON.stringify(body)).not.toContain('23');
    expect(errorLog).toHaveBeenCalledWith(expect.stringContaining(internalMessage));
  });
});