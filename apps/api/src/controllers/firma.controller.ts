import { NextFunction, Request, Response } from 'express';

import {
  ApiResponse,
  ConsultaEnlaceGaranteResponse,
  EnlaceFirmaGaranteResponse,
  IniciarFirmaResponse,
  RechazarContratoResponse,
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { contratoFirmaService } from '../services/contrato-firma.service';

/**
 * Rutas de firma de contratos (US-07). Delgado: traduce HTTP al servicio y vuelta.
 * El detalle de las reglas está en `contrato-firma.service.ts`.
 */
export class FirmaController {
  private parseId(valor: unknown): number | null {
    const id = typeof valor === 'string' ? Number(valor) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  /** POST /contratos/:id/firmar · el locador o el locatario piden su URL de firma. */
  async firmar(req: Request, res: Response<ApiResponse<IniciarFirmaResponse>>, next: NextFunction): Promise<void> {
    try {
      const idContrato = this.parseId(req.params.id);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const data = await contratoFirmaService.iniciarFirma(user, idContrato, req.body);

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** POST /contratos/:id/rechazar · el locador o el locatario rechazan la firma. */
  async rechazar(req: Request, res: Response<ApiResponse<RechazarContratoResponse>>, next: NextFunction): Promise<void> {
    try {
      const idContrato = this.parseId(req.params.id);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const data = await contratoFirmaService.rechazar(user, idContrato, req.body);

      res.status(200).json({ success: true, message: 'La firma fue rechazada. El contrato volvió a borrador.', data });
    } catch (error) {
      next(error);
    }
  }

  /** POST /contratos/:id/garantes/:idGarante/enlace-firma · el locador genera el enlace de un garante. */
  async generarEnlaceGarante(
    req: Request,
    res: Response<ApiResponse<EnlaceFirmaGaranteResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseId(req.params.id);
      const idGarante = this.parseId(req.params.idGarante);

      if (idContrato === null || idGarante === null) {
        res.status(400).json({ success: false, error: 'El identificador no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const data = await contratoFirmaService.generarEnlaceGarante(user, idContrato, idGarante);

      res.status(200).json({ success: true, message: 'Enlace de firma generado.', data });
    } catch (error) {
      next(error);
    }
  }

  /** GET /firma-garante/:token · público: qué va a firmar el garante. */
  async consultarEnlaceGarante(
    req: Request,
    res: Response<ApiResponse<ConsultaEnlaceGaranteResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const data = await contratoFirmaService.consultarEnlaceGarante(req.params.token);

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  /** POST /firma-garante/:token/firmar · público: el garante pide su URL de firma. */
  async firmarGarante(req: Request, res: Response<ApiResponse<IniciarFirmaResponse>>, next: NextFunction): Promise<void> {
    try {
      const data = await contratoFirmaService.iniciarFirmaGarante(req.params.token, req.body);

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export const firmaController = new FirmaController();
