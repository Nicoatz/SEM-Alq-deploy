import type { Request, Response, NextFunction } from 'express';
import type {
  ApiResponse,
  FiltrosCobrosLocadorDTO,
  PeriodoCobroItemDTO,
  PeriodosCobroResultadoDTO,
  RegistrarCobroDTO,
  RegistrarCobroResultadoDTO,
} from '../dtos';
import type { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { cobroService } from '../services/cobro.service';

export class CobroController {
  async listar(
    req: Request,
    res: Response<ApiResponse<PeriodosCobroResultadoDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user as AuthenticatedUser;
      const filtros: FiltrosCobrosLocadorDTO = {
        estado: req.query.estado === 'pendiente' || req.query.estado === 'vencido'
          ? req.query.estado
          : undefined,
        id_inmueble: this.optionalPositiveInteger(req.query.id_inmueble),
        id_contrato: this.optionalPositiveInteger(req.query.id_contrato),
        desde: this.optionalDate(req.query.desde),
        hasta: this.optionalDate(req.query.hasta),
        page: this.optionalPositiveInteger(req.query.page),
        limit: this.optionalPositiveInteger(req.query.limit),
      };

      if (req.query.estado && !filtros.estado) {
        res.status(400).json({ success: false, error: 'El estado del período no es válido.' });
        return;
      }

      const periodos = await cobroService.listarPeriodos(user.id, filtros);
      res.status(200).json({
        success: true,
        message: 'Períodos cobrables obtenidos exitosamente.',
        data: periodos,
      });
    } catch (error) {
      next(error);
    }
  }

  async registrar(
    req: Request,
    res: Response<ApiResponse<RegistrarCobroResultadoDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user as AuthenticatedUser;
      const data: RegistrarCobroDTO = {
        id_periodo: Number(req.body.id_periodo),
        fecha_cobro: String(req.body.fecha_cobro ?? ''),
        medio: String(req.body.medio ?? '') as RegistrarCobroDTO['medio'],
        nota: req.body.nota === undefined ? null : String(req.body.nota),
      };

      const resultado = await cobroService.registrar(user.id, data, req.file
        ? {
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
            originalname: req.file.originalname,
            size: req.file.size,
          }
        : undefined);

      res.status(201).json({
        success: true,
        message: 'Cobro registrado exitosamente.',
        data: resultado,
      });
    } catch (error) {
      next(error);
    }
  }

  private optionalPositiveInteger(value: unknown): number | undefined {
    if (value === undefined) return undefined;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  }

  private optionalDate(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    const text = String(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
  }
}

export const cobroController = new CobroController();
