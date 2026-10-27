import { NextFunction, Request, Response } from 'express';
import type { ApiResponse, AlquilerLocatarioItemDTO, DetalleAlquilerLocatarioDTO, EstadoContratoLocatarioDTO } from '../dtos';
import type { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { alquilerLocatarioService } from '../services/alquiler-locatario.service';

const ESTADOS_VALIDOS: EstadoContratoLocatarioDTO[] = [
  'pendiente_firma',
  'vigente',
  'finalizado'
];

function usuarioAutenticado(req: Request): AuthenticatedUser | null {
  return (req as Request & { user?: AuthenticatedUser }).user ?? null;
}

export class AlquilerLocatarioController {
  async listar(
    req: Request,
    res: Response<ApiResponse<AlquilerLocatarioItemDTO[]>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = usuarioAutenticado(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'No autorizado.' });
        return;
      }

      const estadoQuery = req.query.estado;
      if (estadoQuery !== undefined && (
        typeof estadoQuery !== 'string'
        || !ESTADOS_VALIDOS.includes(estadoQuery as EstadoContratoLocatarioDTO)
      )) {
        res.status(400).json({
          success: false,
          error: `El estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}.`
        });
        return;
      }

      const alquileres = await alquilerLocatarioService.listar(
        user.id,
        estadoQuery as EstadoContratoLocatarioDTO | undefined
      );

      res.status(200).json({
        success: true,
        message: `Se recuperaron ${alquileres.length} alquiler(es) del locatario.`,
        data: alquileres
      });
    } catch (error) {
      next(error);
    }
  }

  async obtenerDetalle(
    req: Request<{ idContrato: string }>,
    res: Response<ApiResponse<DetalleAlquilerLocatarioDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = usuarioAutenticado(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'No autorizado.' });
        return;
      }

      const idContrato = Number(req.params.idContrato);
      if (!Number.isSafeInteger(idContrato) || idContrato <= 0) {
        res.status(400).json({ success: false, error: 'El ID del alquiler debe ser un entero positivo.' });
        return;
      }

      const alquiler = await alquilerLocatarioService.obtenerDetalle(idContrato, user.id);
      if (!alquiler) {
        res.status(404).json({ success: false, error: 'No encontramos este alquiler.' });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Alquiler obtenido exitosamente.',
        data: alquiler
      });
    } catch (error) {
      next(error);
    }
  }
}

export const alquilerLocatarioController = new AlquilerLocatarioController();