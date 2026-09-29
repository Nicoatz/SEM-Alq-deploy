import { Request, Response, NextFunction } from 'express';
import { inmuebleService } from '../services/inmueble.service';
import { ApiResponse, MisAlquileresDTO } from '../dtos';

export class MisAlquileresController {
  async getMisAlquileres(
    req: Request,
    res: Response<ApiResponse<MisAlquileresDTO[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      // El ID del locador proviene del contexto de autenticación inyectado por el API Gateway
      const user = (req as any).user;
      const locadorId = user.id;

      const propiedades = await inmuebleService.getMisInmueblesPublicados(locadorId);

      res.status(200).json({
        success: true,
        message: `Se recuperaron ${propiedades.length} propiedad(es) publicadas para el locador.`,
        data: propiedades
      });
    } catch (error) {
      next(error);
    }
  }
}

export const misAlquileresController = new MisAlquileresController();
