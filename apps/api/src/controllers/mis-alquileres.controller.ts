import { Request, Response, NextFunction } from 'express';
import { inmuebleService } from '../services/inmueble.service';
import { ApiResponse, MisAlquileresDTO } from '../dtos';
import { FiltrosMisAlquileresDTO } from '../dtos';

export class MisAlquileresController {
  async getBarrios(
    req: Request<{ idLocador: string }>,
    res: Response<ApiResponse<string[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idLocador = Number(req.params.idLocador);
      const user = (req as any).user;

      if (!Number.isInteger(idLocador) || idLocador <= 0) {
        res.status(400).json({ success: false, error: 'El ID del locador debe ser un entero positivo.' });
        return;
      }

      if (user.id !== idLocador) {
        res.status(403).json({ success: false, error: 'No puede consultar barrios de otro locador.' });
        return;
      }

      const barrios = await inmuebleService.getBarriosByLocadorId(idLocador);
      res.status(200).json({
        success: true,
        message: 'Barrios disponibles obtenidos exitosamente.',
        data: barrios
      });
    } catch (error) {
      next(error);
    }
  }

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
      const reclamosParam = String(req.query.reclamos ?? '').toLowerCase();
      const filtros: FiltrosMisAlquileresDTO = {
        barrio: req.query.barrio ? String(req.query.barrio) : undefined,
        tipo: tipo !== undefined && Number.isInteger(tipo) ? tipo : undefined,
        estado: req.query.estado ? String(req.query.estado) as FiltrosMisAlquileresDTO['estado'] : undefined,
        reclamos: reclamosParam === 'true' ? true : reclamosParam === 'false' ? false : undefined
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
