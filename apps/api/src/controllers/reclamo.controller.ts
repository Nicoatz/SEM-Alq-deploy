import { NextFunction, Request, Response } from 'express';
import {
  ApiResponse,
  RegistrarReclamoRequest,
  ReclamoResponse,
  TipoReclamoDTO
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { reclamoService, ReclamoService } from '../services/reclamo.service';

export class ReclamoController {
  constructor(private readonly service: ReclamoService = reclamoService) {}

  async registrarReclamo(
    req: Request<unknown, unknown, RegistrarReclamoRequest>,
    res: Response<ApiResponse<ReclamoResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user as AuthenticatedUser;
      const reclamo = await this.service.registrarReclamo(user, req.body);

      res.status(201).json({
        success: true,
        message: 'Reclamo registrado exitosamente.',
        data: reclamo
      });
    } catch (error) {
      next(error);
    }
  }

  async obtenerTiposReclamo(
    req: Request,
    res: Response<ApiResponse<TipoReclamoDTO[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const tipos = await this.service.obtenerTiposReclamo();

      res.status(200).json({
        success: true,
        data: tipos
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reclamoController = new ReclamoController();
