import { NextFunction, Request, Response } from 'express';
import {
  ApiResponse,
  ConversacionReclamoResponse,
  FiltrosReclamosDTO,
  RegistrarReclamoRequest,
  ReclamoResponse,
  ResponderReclamoRequest,
  TipoReclamoDTO
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { reclamoService, ReclamoService } from '../services/reclamo.service';

export class ReclamoController {
  constructor(private readonly service: ReclamoService = reclamoService) {}

  private parseId(rawId: string | undefined): number | null {
    const id = typeof rawId === 'string' ? Number(rawId) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  }

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

  async listarReclamos(
    req: Request,
    res: Response<ApiResponse<ReclamoResponse[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user as AuthenticatedUser;
      const rolParam = req.query.rol as string | undefined;
      const estadoParam = req.query.estado as string | undefined;
      const inmuebleParam = req.query.id_inmueble as string | undefined;

      const filtros: FiltrosReclamosDTO = {
        rol: rolParam === 'locador' || rolParam === 'locatario' ? rolParam : undefined,
        estado: estadoParam,
        id_inmueble: inmuebleParam ? Number(inmuebleParam) : undefined
      };

      const reclamos = await this.service.consultarReclamos(user, filtros);

      if (reclamos.length === 0) {
        res.status(200).json({
          success: true,
          message: 'No se encontraron reclamos registrados.',
          data: []
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: reclamos
      });
    } catch (error) {
      next(error);
    }
  }

  async obtenerDetalleReclamo(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<ReclamoResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idReclamo = this.parseId(req.params.id);
      if (idReclamo === null) {
        res.status(400).json({
          success: false,
          error: 'El identificador del reclamo no es válido.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const reclamo = await this.service.consultarDetalleReclamo(user, idReclamo);

      res.status(200).json({
        success: true,
        data: reclamo
      });
    } catch (error) {
      next(error);
    }
  }

  async responderReclamo(
    req: Request<{ id: string }, unknown, ResponderReclamoRequest>,
    res: Response<ApiResponse<ConversacionReclamoResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idReclamo = this.parseId(req.params.id);
      if (idReclamo === null) {
        res.status(400).json({
          success: false,
          error: 'El identificador del reclamo no es válido.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const respuesta = await this.service.responderReclamo(user, idReclamo, req.body?.mensaje);

      res.status(201).json({
        success: true,
        message: 'Respuesta al reclamo enviada exitosamente.',
        data: respuesta
      });
    } catch (error) {
      next(error);
    }
  }

  async obtenerConversacionReclamo(
    req: Request<{ id: string }>,
    res: Response<ApiResponse<ConversacionReclamoResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idReclamo = this.parseId(req.params.id);
      if (idReclamo === null) {
        res.status(400).json({
          success: false,
          error: 'El identificador del reclamo no es válido.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const conversacion = await this.service.obtenerConversacionReclamo(user, idReclamo);

      res.status(200).json({
        success: true,
        data: conversacion
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reclamoController = new ReclamoController();
