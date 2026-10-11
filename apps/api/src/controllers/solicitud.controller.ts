import { NextFunction, Request, Response } from 'express';

import { ApiResponse, CrearSolicitudRequest, SolicitudResponse } from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { solicitudService } from '../services/solicitud.service';

export class SolicitudController {
  async create(
    req: Request<unknown, unknown, CrearSolicitudRequest>,
    res: Response<ApiResponse<SolicitudResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user as AuthenticatedUser;
      const solicitud = await solicitudService.create(user, req.body);

      res.status(201).json({
        success: true,
        message: 'Solicitud de alquiler creada exitosamente.',
        data: solicitud
      });
    } catch (error) {
      next(error);
    }
  }
}

export const solicitudController = new SolicitudController();
