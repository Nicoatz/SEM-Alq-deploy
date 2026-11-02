import { NextFunction, Request, Response } from 'express';

import { ApiResponse, ContratoBorradorResponse, ContratoDTO } from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { contratoService } from '../services/contrato.service';

export class ContratoController {
  private parseContratoId(req: Request): number | null {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? Number(rawId) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  /** GET /contratos/:id · US-05: el contrato en curso del locador, para retomar el borrador. */
  async obtener(
    req: Request,
    res: Response<ApiResponse<ContratoBorradorResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const contrato = await contratoService.obtener(user, idContrato);

      res.status(200).json({ success: true, data: contrato });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /contratos/:id · US-05: guarda el borrador desde cualquier paso.
   * Body (todo opcional): { paso, condiciones, garantes, clausulas }.
   */
  async guardar(
    req: Request,
    res: Response<ApiResponse<ContratoBorradorResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const contrato = await contratoService.guardar(user, idContrato, req.body);

      res.status(200).json({
        success: true,
        message: 'Borrador guardado exitosamente.',
        data: contrato
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /contratos · US-05: inicia un contrato (borrador) desde una solicitud aceptada.
   * Body: { id_solicitud: number }
   */
  async iniciar(
    req: Request<unknown, unknown, { id_solicitud?: unknown }>,
    res: Response<ApiResponse<ContratoDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idSolicitud = req.body?.id_solicitud;

      if (typeof idSolicitud !== 'number' || !Number.isInteger(idSolicitud) || idSolicitud < 1) {
        res.status(400).json({
          success: false,
          error: 'El campo id_solicitud debe ser un entero positivo.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const contrato = await contratoService.iniciar(user, idSolicitud);

      res.status(201).json({
        success: true,
        message: 'Contrato iniciado exitosamente.',
        data: contrato
      });
    } catch (error) {
      next(error);
    }
  }
}

export const contratoController = new ContratoController();
