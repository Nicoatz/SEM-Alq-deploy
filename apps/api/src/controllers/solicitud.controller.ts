import { NextFunction, Request, Response } from 'express';

import {
  ApiResponse,
  CrearSolicitudRequest,
  FiltrosMisSolicitudesDTO,
  SolicitudPreparacionResponse,
  SolicitudResponse
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { solicitudService } from '../services/solicitud.service';

export class SolicitudController {
  async getMisSolicitudes(
    req: Request,
    res: Response<ApiResponse<SolicitudResponse[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const rawEstado = req.query.estado;
      const rawInmueble = req.query.inmueble;
      const estados: FiltrosMisSolicitudesDTO['estado'][] = [
        'pendiente',
        'aceptada',
        'rechazada',
        'cancelada'
      ];

      if (rawEstado !== undefined && (typeof rawEstado !== 'string' || !estados.includes(rawEstado as FiltrosMisSolicitudesDTO['estado']))) {
        res.status(400).json({
          success: false,
          error: 'El filtro estado no es válido.'
        });
        return;
      }

      const inmueble = rawInmueble === undefined
        ? undefined
        : typeof rawInmueble === 'string' ? Number(rawInmueble) : NaN;

      const user = (req as any).user as AuthenticatedUser;
      const solicitudes = await solicitudService.getMisSolicitudes(user, {
        estado: rawEstado as FiltrosMisSolicitudesDTO['estado'] | undefined,
        inmueble
      });

      res.status(200).json({
        success: true,
        data: solicitudes
      });
    } catch (error) {
      next(error);
    }
  }

  async prepare(
    req: Request,
    res: Response<ApiResponse<SolicitudPreparacionResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const rawIdInmueble = req.query.id_inmueble;
      const idInmueble = typeof rawIdInmueble === 'string' ? Number(rawIdInmueble) : NaN;

      if (!Number.isInteger(idInmueble) || idInmueble < 1) {
        res.status(400).json({
          success: false,
          error: 'El parámetro id_inmueble debe ser un entero positivo.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const datos = await solicitudService.prepare(user, idInmueble);

      res.status(200).json({
        success: true,
        message: 'Datos para la solicitud obtenidos exitosamente.',
        data: datos
      });
    } catch (error) {
      next(error);
    }
  }

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
