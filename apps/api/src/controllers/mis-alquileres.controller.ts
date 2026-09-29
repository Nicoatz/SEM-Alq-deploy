import { Request, Response, NextFunction } from 'express';
import { inmuebleService } from '../services/inmueble.service';
import { ApiResponse, MisAlquileresDTO } from '../dtos';
import { FiltrosMisAlquileresDTO } from '../dtos';

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
      const tipo = req.query.tipo ? Number(req.query.tipo) : undefined;
      const filtros: FiltrosMisAlquileresDTO = {
        barrio: req.query.barrio ? String(req.query.barrio) : undefined,
        tipo: tipo !== undefined && Number.isInteger(tipo) ? tipo : undefined,
        estado: req.query.estado ? String(req.query.estado) as FiltrosMisAlquileresDTO['estado'] : undefined
      };

      const propiedades = await inmuebleService.getMisInmueblesPublicados(locadorId, filtros);

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
