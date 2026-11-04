import type { Request, Response, NextFunction } from 'express';
import type { ApiResponse, ComprobantePagoDTO } from '../dtos';
import type { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { comprobantePagoService } from '../services/comprobante-pago.service';

export class ComprobantePagoController {
  async obtener(
    req: Request,
    res: Response<ApiResponse<ComprobantePagoDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as Request & { user: AuthenticatedUser }).user;
      const idCobro = Number(req.params.id);
      const comprobante = await comprobantePagoService.obtener(idCobro, user.id);
      res.status(200).json({
        success: true,
        data: comprobante,
      });
    } catch (error) {
      next(error);
    }
  }

  async pdf(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as Request & { user: AuthenticatedUser }).user;
      const idCobro = Number(req.params.id);
      const { comprobante, pdf } = await comprobantePagoService.generarPdf(idCobro, user.id);
      const descarga = req.query.descarga !== 'false';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${descarga ? 'attachment' : 'inline'}; filename="${comprobante.numero_comprobante}.pdf"`
      );
      res.status(200).send(pdf);
    } catch (error) {
      next(error);
    }
  }
}

export const comprobantePagoController = new ComprobantePagoController();
