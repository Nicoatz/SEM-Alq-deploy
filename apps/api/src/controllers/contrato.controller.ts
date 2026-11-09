import { NextFunction, Request, Response } from 'express';

import {
  ApiResponse,
  ContratoBorradorResponse,
  ContratoDetalleResponse,
  ContratoDTO,
  ContratosInmuebleResponse,
  EnviarContratoResponse,
  UrlSubidaPdfResponse,
} from '../dtos';
import { AuthenticatedUser } from '../gateway/middlewares/auth.middleware';
import { contratoService } from '../services/contrato.service';

export class ContratoController {
  private parseContratoId(req: Request): number | null {
    const rawId = req.params.id;
    const id = typeof rawId === 'string' ? Number(rawId) : NaN;
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  /** GET /inmuebles/:id/contratos · US-43: los contratos de una propiedad del locador (sin la oferta). */
  async listarPorInmueble(
    req: Request,
    res: Response<ApiResponse<ContratosInmuebleResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idInmueble = this.parseContratoId(req);

      if (idInmueble === null) {
        res.status(400).json({ success: false, error: 'El identificador de la propiedad no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const listado = await contratoService.listarPorInmueble(user, idInmueble);

      res.status(200).json({ success: true, data: listado });
    } catch (error) {
      next(error);
    }
  }

  /** GET /contratos/:id/detalle · US-42: el detalle del contrato del locador (no aplica a borradores). */
  async obtenerDetalle(
    req: Request,
    res: Response<ApiResponse<ContratoDetalleResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const contrato = await contratoService.obtenerDetalle(user, idContrato);

      res.status(200).json({ success: true, data: contrato });
    } catch (error) {
      next(error);
    }
  }

  /** GET /contratos/:id · US-05: el contrato en curso del locador, para retomar el borrador. */
  async obtener(
    req: Request,
    res: Response<ApiResponse<ContratoBorradorResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const contrato = await contratoService.obtener(user, idContrato);

      res.status(200).json({ success: true, data: contrato });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /contratos/:id/pdf/url-subida · US-05, paso 3: URL firmada para que el navegador suba el
   * PDF directo a Storage.
   */
  async urlSubidaPdf(
    req: Request,
    res: Response<ApiResponse<UrlSubidaPdfResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const url = await contratoService.urlSubidaPdf(user, idContrato);

      res.status(200).json({ success: true, data: url });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /contratos/:id/pdf · US-05, paso 3: registra el PDF que el navegador ya subió.
   * Body: { path, nombre }.
   */
  async registrarPdf(
    req: Request,
    res: Response<ApiResponse<ContratoBorradorResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const contrato = await contratoService.registrarPdf(user, idContrato, req.body);

      res.status(200).json({
        success: true,
        message: 'PDF cargado exitosamente.',
        data: contrato
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /contratos/:id · US-05: guarda el borrador desde cualquier paso.
   * Body (todo opcional): { paso, condiciones, garantes }.
   */
  async guardar(
    req: Request,
    res: Response<ApiResponse<ContratoBorradorResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const contrato = await contratoService.guardar(user, idContrato, req.body);

      res.status(200).json({
        success: true,
        message: 'Borrador guardado exitosamente.',
        data: contrato
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /contratos/:id/reabrir · US-06: vuelve a borrador un contrato pendiente de firma sin la
   * firma del locatario (cancela el envío y borra las firmas). El cliente confirma antes.
   */
  async reabrir(
    req: Request,
    res: Response<ApiResponse<ContratoBorradorResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const contrato = await contratoService.reabrir(user, idContrato);

      res.status(200).json({
        success: true,
        message: 'El contrato volvió a borrador.',
        data: contrato
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /contratos/:id/enviar · US-05, paso 4: envía el borrador a firmar. Pasa a "pendiente de
   * firma", recibe el código CT-AAAA-NNNN y se crea el sobre de DocuSign.
   */
  async enviar(
    req: Request,
    res: Response<ApiResponse<EnviarContratoResponse>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const resultado = await contratoService.enviar(user, idContrato, req.body);

      res.status(200).json({
        success: true,
        message: 'El contrato quedó pendiente de firma.',
        data: resultado
      });
    } catch (error) {
      next(error);
    }
  }

  /** DELETE /contratos/:id · US-06: descarta un borrador (el cliente confirma antes). */
  async descartar(req: Request, res: Response<ApiResponse<null>>, next: NextFunction): Promise<void> {
    try {
      const idContrato = this.parseContratoId(req);

      if (idContrato === null) {
        res.status(400).json({ success: false, error: 'El identificador del contrato no es válido.' });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      await contratoService.descartar(user, idContrato);

      res.status(200).json({ success: true, message: 'Borrador descartado exitosamente.' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /contratos · US-05: inicia un contrato (borrador) desde una solicitud aceptada.
   * Body: { id_solicitud: number }
   */
  async iniciar(
    req: Request<unknown, unknown, { id_solicitud?: unknown }>,
    res: Response<ApiResponse<ContratoDTO>>,
    next: NextFunction
  ): Promise<void> {
    try {
      const idSolicitud = req.body?.id_solicitud;

      if (typeof idSolicitud !== 'number' || !Number.isInteger(idSolicitud) || idSolicitud < 1) {
        res.status(400).json({
          success: false,
          error: 'El campo id_solicitud debe ser un entero positivo.'
        });
        return;
      }

      const user = (req as any).user as AuthenticatedUser;
      const contrato = await contratoService.iniciar(user, idSolicitud);

      res.status(201).json({
        success: true,
        message: 'Contrato iniciado exitosamente.',
        data: contrato
      });
    } catch (error) {
      next(error);
    }
  }
}

export const contratoController = new ContratoController();
